use serde::{Deserialize, Serialize};
use std::fmt;

#[cfg(windows)]
use std::io::ErrorKind;

#[cfg(windows)]
use winreg::{
    enums::{
        HKEY_CLASSES_ROOT, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WRITE, REG_BINARY,
        REG_DWORD, REG_DWORD_BIG_ENDIAN, REG_EXPAND_SZ, REG_MULTI_SZ, REG_NONE, REG_QWORD, REG_SZ,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

    pub fn parse_full_path(path: &str) -> Option<Self> {
        let normalized = normalize_registry_path(path);
        let mut segments = normalized.split('\\');
        let root = segments.next()?;
        let remainder = segments.collect::<Vec<_>>().join("\\");

        match root.to_ascii_uppercase().as_str() {
            "HKCR" | "HKEY_CLASSES_ROOT" => Some(Self::new(RegistryRoot::ClassesRoot, remainder)),
            "HKCU" | "HKEY_CURRENT_USER" => {
                if let Some(stripped) = strip_classes_prefix(&remainder) {
                    Some(Self::new(RegistryRoot::CurrentUserClasses, stripped))
                } else {
                    Some(Self::new(RegistryRoot::CurrentUser, remainder))
                }
            }
            "HKLM" | "HKEY_LOCAL_MACHINE" => {
                if let Some(stripped) = strip_classes_prefix(&remainder) {
                    Some(Self::new(RegistryRoot::LocalMachineClasses, stripped))
                } else {
                    Some(Self::new(RegistryRoot::LocalMachine, remainder))
                }
            }
            _ => None,
        }
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegistryValueSnapshot {
    pub name: String,
    pub data: RegistryData,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegistryKeySnapshot {
    pub location: RegistryLocation,
    pub default_value: Option<RegistryData>,
    pub values: Vec<RegistryValueSnapshot>,
    pub subkeys: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RegistryTreeSnapshot {
    pub key: RegistryKeySnapshot,
    pub children: Vec<RegistryTreeSnapshot>,
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

    pub fn read_tree(
        &self,
        location: &RegistryLocation,
    ) -> Result<Option<RegistryTreeSnapshot>, RegistryError> {
        self.read_tree_inner(location)
    }

    fn read_tree_inner(
        &self,
        location: &RegistryLocation,
    ) -> Result<Option<RegistryTreeSnapshot>, RegistryError> {
        let Some(key) = self.read_key(location)? else {
            return Ok(None);
        };

        let mut children = Vec::new();
        for subkey in &key.subkeys {
            let child_location =
                RegistryLocation::new(location.root, format!("{}\\{}", location.key_path, subkey));
            if let Some(child) = self.read_tree_inner(&child_location)? {
                children.push(child);
            }
        }

        Ok(Some(RegistryTreeSnapshot { key, children }))
    }

    pub fn restore_tree(&self, snapshot: &RegistryTreeSnapshot) -> Result<(), RegistryError> {
        #[cfg(not(windows))]
        {
            let _ = snapshot;
            Err(RegistryError::UnsupportedPlatform)
        }

        #[cfg(windows)]
        {
            write_tree_snapshot(snapshot)?;
            Ok(())
        }
    }

    pub fn delete_tree(&self, location: &RegistryLocation) -> Result<(), RegistryError> {
        #[cfg(not(windows))]
        {
            let _ = location;
            Err(RegistryError::UnsupportedPlatform)
        }

        #[cfg(windows)]
        {
            delete_tree_snapshot(location)?;
            Ok(())
        }
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

fn strip_classes_prefix(path: &str) -> Option<String> {
    let upper = path.to_ascii_uppercase();
    let prefix = CLASSES_PREFIX.to_ascii_uppercase();
    if upper == prefix {
        return Some(String::new());
    }

    upper
        .strip_prefix(&(prefix + "\\"))
        .map(|_| path[prefix.len() + 1..].to_string())
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
fn open_registry_key_with_flags(root: &RegKey, path: &str, flags: u32) -> Result<Option<RegKey>, String> {
    match root.open_subkey_with_flags(path, flags) {
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
fn encode_utf16_bytes(value: &str) -> Vec<u8> {
    value
        .encode_utf16()
        .chain(std::iter::once(0))
        .flat_map(|unit| unit.to_le_bytes())
        .collect()
}

#[cfg(windows)]
fn encode_multi_string_bytes(values: &[String]) -> Vec<u8> {
    values
        .iter()
        .flat_map(|entry| entry.encode_utf16().chain(std::iter::once(0)))
        .chain(std::iter::once(0))
        .flat_map(|unit| unit.to_le_bytes())
        .collect()
}

#[cfg(windows)]
fn to_reg_value(data: &RegistryData) -> RegValue {
    match data {
        RegistryData::None => RegValue {
            bytes: Vec::new(),
            vtype: REG_NONE,
        },
        RegistryData::String(value) => RegValue {
            bytes: encode_utf16_bytes(value),
            vtype: REG_SZ,
        },
        RegistryData::ExpandString(value) => RegValue {
            bytes: encode_utf16_bytes(value),
            vtype: REG_EXPAND_SZ,
        },
        RegistryData::MultiString(values) => RegValue {
            bytes: encode_multi_string_bytes(values),
            vtype: REG_MULTI_SZ,
        },
        RegistryData::U32(value) => RegValue {
            bytes: value.to_le_bytes().to_vec(),
            vtype: REG_DWORD,
        },
        RegistryData::U32BigEndian(value) => RegValue {
            bytes: value.to_be_bytes().to_vec(),
            vtype: REG_DWORD_BIG_ENDIAN,
        },
        RegistryData::U64(value) => RegValue {
            bytes: value.to_le_bytes().to_vec(),
            vtype: REG_QWORD,
        },
        RegistryData::Binary(bytes) => RegValue {
            bytes: bytes.clone(),
            vtype: REG_BINARY,
        },
        RegistryData::Unknown(bytes) => RegValue {
            bytes: bytes.clone(),
            vtype: REG_BINARY,
        },
    }
}

#[cfg(windows)]
fn write_tree_snapshot(snapshot: &RegistryTreeSnapshot) -> Result<(), RegistryError> {
    let root = root_key(snapshot.key.location.root);
    let path = snapshot.key.location.open_path();
    let full_path = snapshot.key.location.full_path();
    let key = if path.is_empty() {
        root
    } else {
        root.create_subkey(&path)
            .map_err(|error| RegistryError::OpenKey {
                path: full_path.clone(),
                message: error.to_string(),
            })?
            .0
    };

    if let Some(default_value) = &snapshot.key.default_value {
        key.set_raw_value("", &to_reg_value(default_value))
            .map_err(|error| RegistryError::EnumerateKey {
                path: full_path.clone(),
                message: error.to_string(),
            })?;
    }

    for value in &snapshot.key.values {
        key.set_raw_value(&value.name, &to_reg_value(&value.data))
            .map_err(|error| RegistryError::EnumerateKey {
                path: full_path.clone(),
                message: error.to_string(),
            })?;
    }

    for child in &snapshot.children {
        write_tree_snapshot(child)?;
    }

    Ok(())
}

#[cfg(windows)]
fn delete_tree_snapshot(location: &RegistryLocation) -> Result<(), RegistryError> {
    let path = location.open_path();
    if path.is_empty() {
        return Err(RegistryError::OpenKey {
            path: location.full_path(),
            message: "refusing to delete a registry root".to_string(),
        });
    }

    let Some((parent_path, key_name)) = path.rsplit_once('\\') else {
        return Err(RegistryError::OpenKey {
            path: location.full_path(),
            message: "refusing to delete an unresolved top-level key".to_string(),
        });
    };

    let root = root_key(location.root);
    let Some(parent) = open_registry_key_with_flags(&root, parent_path, KEY_READ | KEY_WRITE).map_err(
        |message| RegistryError::OpenKey {
            path: location.full_path(),
            message,
        },
    )?
    else {
        return Ok(());
    };

    match parent.delete_subkey_all(key_name) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(RegistryError::OpenKey {
            path: location.full_path(),
            message: error.to_string(),
        }),
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

    #[test]
    fn parses_classes_paths_from_full_path() {
        let location =
            RegistryLocation::parse_full_path("HKEY_CURRENT_USER\\Software\\Classes\\Directory\\shell\\Foo")
                .expect("expected a parsed location");

        assert_eq!(location.root, RegistryRoot::CurrentUserClasses);
        assert_eq!(location.key_path, "Directory\\shell\\Foo");
    }

    #[test]
    fn parses_hkcr_paths_from_full_path() {
        let location =
            RegistryLocation::parse_full_path("HKCR\\Directory\\Background\\shell\\Bar")
                .expect("expected a parsed location");

        assert_eq!(location.root, RegistryRoot::ClassesRoot);
        assert_eq!(location.key_path, "Directory\\Background\\shell\\Bar");
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
