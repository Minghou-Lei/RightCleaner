/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useCallback,
  startTransition,
  type Dispatch,
  type PropsWithChildren,
} from "react";

import {
  loadMenuItems,
  loadRecoveryPoints,
  restoreRecoveryPoint,
  setMenuItemEnabled,
} from "../shared/menu-item-service";
import {
  filterMenuItems,
  type MenuItemBackupRecord,
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

export type MenuLoadState = "idle" | "loading" | "ready" | "error";

export type AppState = {
  phase: AppPhase;
  themeMode: ThemeMode;
  menuLoadState: MenuLoadState;
  menuLoadError: string | null;
  operationError: string | null;
  selectedItemIds: string[];
  filters: MenuItemFilterState;
  menuItems: NormalizedMenuItem[];
  backups: MenuItemBackupRecord[];
  scannedScopeCount: number;
  lastScanSummary: string;
};

type AppAction =
  | { type: "set-phase"; phase: AppPhase }
  | { type: "set-theme-mode"; themeMode: ThemeMode }
  | { type: "set-menu-load-state"; menuLoadState: MenuLoadState }
  | { type: "hydrate-menu-items"; items: NormalizedMenuItem[] }
  | { type: "hydrate-backups"; backups: MenuItemBackupRecord[] }
  | { type: "set-menu-load-error"; message: string }
  | { type: "set-operation-error"; message: string | null }
  | { type: "toggle-item-selection"; itemId: string }
  | { type: "clear-selection" }
  | { type: "set-filter"; filter: Partial<MenuItemFilterState> };

const initialState: AppState = {
  phase: "idle",
  themeMode: "light",
  menuLoadState: "idle",
  menuLoadError: null,
  operationError: null,
  selectedItemIds: [],
  filters: {
    keyword: "",
    sourceKind: null,
    target: null,
    enabledOnly: false,
    editableOnly: false,
  },
  menuItems: [],
  backups: [],
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
        operationError: null,
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
    case "hydrate-backups":
      return {
        ...state,
        backups: action.backups,
      };
    case "set-menu-load-error":
      return {
        ...state,
        phase: "partial-failure",
        menuLoadState: "error",
        menuLoadError: action.message,
        lastScanSummary: "菜单项加载失败，当前使用回退数据。",
      };
    case "set-operation-error":
      return {
        ...state,
        operationError: action.message,
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
  activeItemId: string | null;
  activeBackupId: string | null;
  reloadAppData: () => Promise<void>;
  toggleMenuItemEnabled: (itemId: string, enabled: boolean) => Promise<void>;
  restoreBackup: (backupId: string) => Promise<void>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeBackupId, setActiveBackupId] = useState<string | null>(null);

  const reloadAppData = useCallback(async () => {
    dispatch({ type: "set-menu-load-state", menuLoadState: "loading" });

    try {
      const [items, backups] = await Promise.all([loadMenuItems(), loadRecoveryPoints()]);

      startTransition(() => {
        dispatch({ type: "hydrate-menu-items", items });
        dispatch({ type: "hydrate-backups", backups });
      });
    } catch (error: unknown) {
      dispatch({
        type: "set-menu-load-error",
        message: error instanceof Error ? error.message : "菜单项加载失败",
      });
    }
  }, []);

  const toggleMenuItemEnabled = useCallback(async (itemId: string, enabled: boolean) => {
    setActiveItemId(itemId);
    dispatch({ type: "set-operation-error", message: null });

    try {
      await setMenuItemEnabled(itemId, enabled);
      await reloadAppData();
    } catch (error: unknown) {
      dispatch({
        type: "set-operation-error",
        message: error instanceof Error ? error.message : "菜单项状态更新失败",
      });
    } finally {
      setActiveItemId(null);
    }
  }, [reloadAppData]);

  const restoreBackup = useCallback(async (backupId: string) => {
    setActiveBackupId(backupId);
    dispatch({ type: "set-operation-error", message: null });

    try {
      await restoreRecoveryPoint(backupId);
      await reloadAppData();
    } catch (error: unknown) {
      dispatch({
        type: "set-operation-error",
        message: error instanceof Error ? error.message : "恢复操作失败",
      });
    } finally {
      setActiveBackupId(null);
    }
  }, [reloadAppData]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      activeItemId,
      activeBackupId,
      reloadAppData,
      toggleMenuItemEnabled,
      restoreBackup,
    }),
    [activeBackupId, activeItemId, reloadAppData, restoreBackup, state, toggleMenuItemEnabled]
  );

  useEffect(() => {
    let active = true;

    dispatch({ type: "set-menu-load-state", menuLoadState: "loading" });

    Promise.all([loadMenuItems(), loadRecoveryPoints()])
      .then(([items, backups]) => {
        if (!active) {
          return;
        }

        startTransition(() => {
          dispatch({ type: "hydrate-menu-items", items });
          dispatch({ type: "hydrate-backups", backups });
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
