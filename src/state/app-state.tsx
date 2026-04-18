/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  startTransition,
  type Dispatch,
  type PropsWithChildren,
} from "react";

import { loadMenuItems } from "../shared/menu-item-service";
import {
  filterMenuItems,
  type MenuItemFilterState,
  type NormalizedMenuItem,
} from "../shared/menu-items";

export type AppPhase =
  | "idle"
  | "scanning"
  | "scan-complete"
  | "cleanup-running"
  | "cleanup-complete"
  | "restore-running"
  | "restore-complete"
  | "partial-failure";

export type ThemeMode = "light" | "system";

export type BackupRecord = {
  id: string;
  label: string;
  createdAt: string;
  sizeLabel: string;
  status: "ready" | "expired" | "restored";
};

export type MenuLoadState = "idle" | "loading" | "ready" | "error";

export type AppState = {
  phase: AppPhase;
  themeMode: ThemeMode;
  menuLoadState: MenuLoadState;
  menuLoadError: string | null;
  selectedItemIds: string[];
  filters: MenuItemFilterState;
  menuItems: NormalizedMenuItem[];
  backups: BackupRecord[];
  scannedScopeCount: number;
  lastScanSummary: string;
};

type AppAction =
  | { type: "set-phase"; phase: AppPhase }
  | { type: "set-theme-mode"; themeMode: ThemeMode }
  | { type: "set-menu-load-state"; menuLoadState: MenuLoadState }
  | { type: "hydrate-menu-items"; items: NormalizedMenuItem[] }
  | { type: "set-menu-load-error"; message: string }
  | { type: "toggle-item-selection"; itemId: string }
  | { type: "clear-selection" }
  | { type: "set-filter"; filter: Partial<MenuItemFilterState> };

const seedBackups: BackupRecord[] = [
  {
    id: "backup-0415",
    label: "周二快速清理",
    createdAt: "2026-04-15 18:40",
    sizeLabel: "1.2 GB",
    status: "ready",
  },
  {
    id: "backup-0410",
    label: "应用缓存回滚点",
    createdAt: "2026-04-10 09:15",
    sizeLabel: "640 MB",
    status: "ready",
  },
];

const initialState: AppState = {
  phase: "idle",
  themeMode: "light",
  menuLoadState: "idle",
  menuLoadError: null,
  selectedItemIds: [],
  filters: {
    keyword: "",
    sourceKind: null,
    target: null,
    enabledOnly: false,
    editableOnly: false,
  },
  menuItems: [],
  backups: seedBackups,
  scannedScopeCount: 0,
  lastScanSummary: "等待首次扫描",
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-phase":
      return { ...state, phase: action.phase };
    case "set-theme-mode":
      return { ...state, themeMode: action.themeMode };
    case "set-menu-load-state":
      return { ...state, menuLoadState: action.menuLoadState };
    case "hydrate-menu-items": {
      const nextSelectedItemIds = state.selectedItemIds.filter((itemId) =>
        action.items.some((item) => item.id === itemId)
      );
      const scannedScopeCount = new Set(action.items.map((item) => item.target)).size;

      return {
        ...state,
        phase: "scan-complete",
        menuItems: action.items,
        menuLoadState: "ready",
        menuLoadError: null,
        selectedItemIds:
          nextSelectedItemIds.length > 0
            ? nextSelectedItemIds
            : action.items[0]
              ? [action.items[0].id]
              : [],
        scannedScopeCount,
        lastScanSummary: `已识别 ${action.items.length} 个菜单项，覆盖 ${scannedScopeCount} 个对象场景。`,
      };
    }
    case "set-menu-load-error":
      return {
        ...state,
        phase: "partial-failure",
        menuLoadState: "error",
        menuLoadError: action.message,
        lastScanSummary: "菜单项加载失败，当前使用回退数据。",
      };
    case "toggle-item-selection": {
      const exists = state.selectedItemIds.includes(action.itemId);
      return {
        ...state,
        selectedItemIds: exists
          ? state.selectedItemIds.filter((id) => id !== action.itemId)
          : [...state.selectedItemIds, action.itemId],
      };
    }
    case "clear-selection":
      return { ...state, selectedItemIds: [] };
    case "set-filter":
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.filter,
        },
      };
    default:
      return state;
  }
}

type AppStateContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);

  useEffect(() => {
    let active = true;

    dispatch({ type: "set-menu-load-state", menuLoadState: "loading" });

    loadMenuItems()
      .then((items) => {
        if (!active) {
          return;
        }

        startTransition(() => {
          dispatch({ type: "hydrate-menu-items", items });
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        dispatch({
          type: "set-menu-load-error",
          message: error instanceof Error ? error.message : "菜单项加载失败",
        });
      });

    return () => {
      active = false;
    };
  }, []);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return context;
}

export function useFilteredMenuItems() {
  const {
    state: { menuItems, filters },
  } = useAppState();

  return useMemo(() => filterMenuItems(menuItems, filters), [filters, menuItems]);
}
