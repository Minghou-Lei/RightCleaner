use serde::Serialize;
use std::fmt;

#[cfg(windows)]
use std::io::ErrorKind;

#[cfg(windows)]
use winreg::{
    enums::{
        HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, REG_BINARY, REG_DWORD,
        REG_DWORD_BIG_ENDIAN, REG_EXPAND_SZ, REG_MULTI_SZ, REG_NONE, REG_QWORD, REG_SZ,
    },
    RegKey, RegValue,
};

const CLASSES_PREFIX: &str = "Software\\Classes";

const CONTEXT_MENU_CLASSES_RELATIVE_PATHS: &[&str] = &[
    "*\\shell",
    "*\\shellex\\ContextMenuHandlers",
    "AllFileSystemObjects\\shellex\\ContextMenuHandlers",
    "Directory\\shell",
    "Directory\\shellex\\ContextMenuHandlers",
    "Directory\\Background\\shell",
    "Directory\\Background\\shellex\\ContextMenuHandlers",
    "Drive\\shell",
    "Drive\\shellex\\ContextMenuHandlers",
    "Folder\\shell",
    "Folder\\shellex\\ContextMenuHandlers",
    "DesktopBackground\\shell",
    "DesktopBackground\\shellex\\ContextMenuHandlers",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RegistryRoot {
    CurrentUser,
    LocalMachine,
    ClassesRoot,
    CurrentUserClasses,
    LocalMachineClasses,
}

impl RegistryRoot {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CurrentUser => "HKCU",
            Self::LocalMachine => "HKLM",
            Self::ClassesRoot => "HKCR",
            Self::CurrentUserClasses => "HKCU\\Software\\Classes",
            Self::LocalMachineClasses => "HKLM\\Software\\Classes",
        }
    }

    pub fn classes_roots() -> [Self; 3] {
        [Self::CurrentUserClasses, Self::LocalMachineClasses, Self::ClassesRoot]
    }

    fn fixed_prefix(self) -> Option<&'static str> {
        match self {
            Self::CurrentUserClasses | Self::LocalMachineClasses => Some(CLASSES_PREFIX),
            _ => None,
        }
    }
}

impl fmt::Display for RegistryRoot {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RegistryLocation {
    pub root: RegistryRoot,
    pub key_path: String,
}

impl RegistryLocation {
    pub fn new(root: RegistryRoot, key_path: impl Into<String>) -> Self {
        Self {
            root,
            key_path: normalize_registry_path(&key_path.into()),
        }
    }

    pub fn full_path(&self) -> String {
        if self.key_path.is_empty() {
            return self.root.as_str().to_string();
        }

        format!("{}\\{}", self.root.as_str(), self.key_path)
    }

    #[cfg(windows)]
    fn open_path(&self) -> String {
        match (self.root.fixed_prefix(), self.key_path.is_empty()) {
            (Some(prefix), true) => prefix.to_string(),
            (Some(prefix), false) => format!("{prefix}\\{}", self.key_path),
            (None, _) => self.key_path.clone(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum RegistryData {
    None,
    String(String),
    ExpandString(String),
    MultiString(Vec<String>),
    U32(u32),
    U32BigEndian(u32),
    U64(u64),
    Binary(Vec<u8>),
    Unknown(Vec<u8>),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RegistryValueSnapshot {
    pub name: String,
    pub data: RegistryData,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RegistryKeySnapshot {
    pub location: RegistryLocation,
    pub default_value: Option<RegistryData>,
    pub values: Vec<RegistryValueSnapshot>,
    pub subkeys: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RegistryError {
    UnsupportedPlatform,
    OpenKey {
        path: String,
        message: String,
    },
    EnumerateKey {
        path: String,
        message: String,
    },
}

impl fmt::Display for RegistryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedPlatform => f.write_str("registry access is only supported on Windows"),
            Self::OpenKey { path, message } => {
                write!(f, "failed to open registry key `{path}`: {message}")
            }
            Self::EnumerateKey { path, message } => {
                write!(f, "failed to enumerate registry key `{path}`: {message}")
            }
        }
    }
}

impl std::error::Error for RegistryError {}

pub trait RegistryReader {
    fn read_key(&self, location: &RegistryLocation) -> Result<Option<RegistryKeySnapshot>, RegistryError>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct WindowsRegistryReader;

impl WindowsRegistryReader {
    pub fn new() -> Self {
        Self
    }

    pub fn context_menu_locations(&self) -> Vec<RegistryLocation> {
        context_menu_registry_locations()
    }

    pub fn read_context_menu_roots(
        &self,
    ) -> Result<Vec<RegistryKeySnapshot>, RegistryError> {
        self.context_menu_locations()
            .into_iter()
            .filter_map(|location| self.read_key(&location).transpose())
            .collect()
    }
}

impl RegistryReader for WindowsRegistryReader {
    fn read_key(&self, location: &RegistryLocation) -> Result<Option<RegistryKeySnapshot>, RegistryError> {
        #[cfg(not(windows))]
        {
            let _ = location;
            Err(RegistryError::UnsupportedPlatform)
        }

        #[cfg(windows)]
        {
            let path = location.full_path();
            let open_path = location.open_path();
            let root_key = root_key(location.root);
            let key = if open_path.is_empty() {
                root_key
            } else {
                match open_registry_key(&root_key, &open_path) {
                    Ok(Some(key)) => key,
                    Ok(None) => return Ok(None),
                    Err(error) => {
                        return Err(RegistryError::OpenKey {
                            path,
                            message: error,
                        })
                    }
                }
            };

            let default_value = read_default_value(&key).map_err(|message| RegistryError::EnumerateKey {
                path: location.full_path(),
                message,
            })?;
            let values = read_named_values(&key).map_err(|message| RegistryError::EnumerateKey {
                path: location.full_path(),
                message,
            })?;
            let subkeys = read_subkeys(&key).map_err(|message| RegistryError::EnumerateKey {
                path: location.full_path(),
                message,
            })?;

            Ok(Some(RegistryKeySnapshot {
                location: location.clone(),
                default_value,
                values,
                subkeys,
            }))
        }
    }
}

pub fn context_menu_registry_locations() -> Vec<RegistryLocation> {
    RegistryRoot::classes_roots()
        .into_iter()
        .flat_map(|root| {
            CONTEXT_MENU_CLASSES_RELATIVE_PATHS
                .iter()
                .map(move |path| RegistryLocation::new(root, *path))
        })
        .collect()
}

fn normalize_registry_path(path: &str) -> String {
    path.replace('/', "\\")
        .split('\\')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("\\")
}

#[cfg(windows)]
fn root_key(root: RegistryRoot) -> RegKey {
    match root {
        RegistryRoot::CurrentUser | RegistryRoot::CurrentUserClasses => RegKey::predef(HKEY_CURRENT_USER),
        RegistryRoot::LocalMachine | RegistryRoot::LocalMachineClasses => {
            RegKey::predef(HKEY_LOCAL_MACHINE)
        }
        RegistryRoot::ClassesRoot => RegKey::predef(HKEY_CLASSES_ROOT),
    }
}

#[cfg(windows)]
fn open_registry_key(root: &RegKey, path: &str) -> Result<Option<RegKey>, String> {
    match root.open_subkey(path) {
        Ok(key) => Ok(Some(key)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(windows)]
fn read_default_value(key: &RegKey) -> Result<Option<RegistryData>, String> {
    match key.get_raw_value("") {
        Ok(value) => Ok(Some(convert_registry_data(&value))),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(windows)]
fn read_named_values(key: &RegKey) -> Result<Vec<RegistryValueSnapshot>, String> {
    key.enum_values()
        .map(|entry| {
            entry
                .map_err(|error| error.to_string())
        })
        .filter_map(|entry| match entry {
            Ok((name, _)) if name.is_empty() => None,
            Ok((name, value)) => Some(Ok(RegistryValueSnapshot {
                name,
                data: convert_registry_data(&value),
            })),
            Err(error) => Some(Err(error)),
        })
        .collect()
}

#[cfg(windows)]
fn read_subkeys(key: &RegKey) -> Result<Vec<String>, String> {
    key.enum_keys()
        .map(|entry| entry.map_err(|error| error.to_string()))
        .collect()
}

#[cfg(windows)]
fn convert_registry_data(value: &RegValue) -> RegistryData {
    match value.vtype {
        REG_NONE => RegistryData::None,
        REG_SZ => RegistryData::String(decode_utf16_bytes(&value.bytes)),
        REG_EXPAND_SZ => RegistryData::ExpandString(decode_utf16_bytes(&value.bytes)),
        REG_MULTI_SZ => RegistryData::MultiString(decode_multi_string(&value.bytes)),
        REG_DWORD => RegistryData::U32(read_u32_le(&value.bytes)),
        REG_DWORD_BIG_ENDIAN => RegistryData::U32BigEndian(read_u32_be(&value.bytes)),
        REG_QWORD => RegistryData::U64(read_u64_le(&value.bytes)),
        REG_BINARY => RegistryData::Binary(value.bytes.clone()),
        _ => RegistryData::Unknown(value.bytes.clone()),
    }
}

#[cfg(windows)]
fn decode_utf16_bytes(bytes: &[u8]) -> String {
    let code_units = bytes
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .take_while(|unit| *unit != 0)
        .collect::<Vec<_>>();

    String::from_utf16_lossy(&code_units)
}

#[cfg(windows)]
fn decode_multi_string(bytes: &[u8]) -> Vec<String> {
    decode_utf16_bytes(bytes)
        .split('\0')
        .filter(|entry| !entry.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

#[cfg(windows)]
fn read_u32_le(bytes: &[u8]) -> u32 {
    let mut buffer = [0_u8; 4];
    let length = bytes.len().min(buffer.len());
    buffer[..length].copy_from_slice(&bytes[..length]);
    u32::from_le_bytes(buffer)
}

#[cfg(windows)]
fn read_u32_be(bytes: &[u8]) -> u32 {
    let mut buffer = [0_u8; 4];
    let length = bytes.len().min(buffer.len());
    buffer[..length].copy_from_slice(&bytes[..length]);
    u32::from_be_bytes(buffer)
}

#[cfg(windows)]
fn read_u64_le(bytes: &[u8]) -> u64 {
    let mut buffer = [0_u8; 8];
    let length = bytes.len().min(buffer.len());
    buffer[..length].copy_from_slice(&bytes[..length]);
    u64::from_le_bytes(buffer)
}

#[cfg(test)]
mod tests {
    use super::{context_menu_registry_locations, RegistryLocation, RegistryReader, RegistryRoot, WindowsRegistryReader};

    #[test]
    fn normalizes_registry_paths() {
        let location = RegistryLocation::new(
            RegistryRoot::CurrentUserClasses,
            "\\Directory/Background\\\\shell\\",
        );

        assert_eq!(location.key_path, "Directory\\Background\\shell");
        assert_eq!(location.full_path(), "HKCU\\Software\\Classes\\Directory\\Background\\shell");
    }

    #[test]
    fn builds_context_menu_locations_for_all_classes_roots() {
        let locations = context_menu_registry_locations();

        assert_eq!(locations.len(), 39);
        assert!(locations.contains(&RegistryLocation::new(
            RegistryRoot::CurrentUserClasses,
            "Directory\\shell"
        )));
        assert!(locations.contains(&RegistryLocation::new(
            RegistryRoot::LocalMachineClasses,
            "Drive\\shellex\\ContextMenuHandlers"
        )));
        assert!(locations.contains(&RegistryLocation::new(
            RegistryRoot::ClassesRoot,
            "DesktopBackground\\shell"
        )));
    }

    #[cfg(windows)]
    #[test]
    fn returns_none_for_missing_key() {
        let reader = WindowsRegistryReader::new();
        let location = RegistryLocation::new(
            RegistryRoot::CurrentUserClasses,
            "RightCleaner\\Tests\\DefinitelyMissing",
        );

        let snapshot = reader.read_key(&location).expect("missing keys should not fail");
        assert!(snapshot.is_none());
    }

    #[cfg(windows)]
    #[test]
    fn can_read_classes_root_base_keys() {
        let reader = WindowsRegistryReader::new();

        for root in [
            RegistryRoot::CurrentUserClasses,
            RegistryRoot::LocalMachineClasses,
            RegistryRoot::ClassesRoot,
        ] {
            let snapshot = reader
                .read_key(&RegistryLocation::new(root, ""))
                .expect("classes roots should be readable");

            assert!(snapshot.is_some(), "{root} should exist");
        }
    }
}

pub mod menu_item_scanner;
