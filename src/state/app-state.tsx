import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type PropsWithChildren
} from "react";

export type AppPhase =
  | "idle"
  | "scanning"
  | "scan-complete"
  | "cleanup-running"
  | "cleanup-complete"
  | "restore-running"
  | "restore-complete"
  | "partial-failure";

export type RiskLevel = "low" | "medium" | "high";
export type ThemeMode = "light" | "system";

export type CleanupItem = {
  id: string;
  title: string;
  category: string;
  spaceLabel: string;
  hitCount: number;
  riskLevel: RiskLevel;
  recoverable: boolean;
  summary: string;
};

export type BackupRecord = {
  id: string;
  label: string;
  createdAt: string;
  sizeLabel: string;
  status: "ready" | "expired" | "restored";
};

export type FilterState = {
  keyword: string;
  category: string | null;
  risk: RiskLevel | null;
  recoverableOnly: boolean;
};

export type AppState = {
  phase: AppPhase;
  themeMode: ThemeMode;
  selectedItemIds: string[];
  filters: FilterState;
  cleanupItems: CleanupItem[];
  backups: BackupRecord[];
};

type AppAction =
  | { type: "set-phase"; phase: AppPhase }
  | { type: "set-theme-mode"; themeMode: ThemeMode }
  | { type: "toggle-item-selection"; itemId: string }
  | { type: "clear-selection" }
  | { type: "set-filter"; filter: Partial<FilterState> };

const seedItems: CleanupItem[] = [
  {
    id: "system-cache",
    title: "系统缓存与临时日志",
    category: "系统垃圾",
    spaceLabel: "3.2 GB",
    hitCount: 148,
    riskLevel: "low",
    recoverable: true,
    summary: "适合默认推荐的一组低风险临时文件。"
  },
  {
    id: "app-residue",
    title: "已卸载应用残留",
    category: "应用残留",
    spaceLabel: "1.4 GB",
    hitCount: 36,
    riskLevel: "medium",
    recoverable: true,
    summary: "安装目录和配置残留，需要在清理前确认依赖影响。"
  },
  {
    id: "large-downloads",
    title: "长期未访问下载文件",
    category: "下载目录",
    spaceLabel: "8.6 GB",
    hitCount: 17,
    riskLevel: "high",
    recoverable: false,
    summary: "用户文件占比高，必须二次确认，不进入默认推荐。"
  }
];

const seedBackups: BackupRecord[] = [
  {
    id: "backup-0415",
    label: "周二快速清理",
    createdAt: "2026-04-15 18:40",
    sizeLabel: "1.2 GB",
    status: "ready"
  },
  {
    id: "backup-0410",
    label: "应用缓存回滚点",
    createdAt: "2026-04-10 09:15",
    sizeLabel: "640 MB",
    status: "ready"
  }
];

const initialState: AppState = {
  phase: "idle",
  themeMode: "light",
  selectedItemIds: ["system-cache"],
  filters: {
    keyword: "",
    category: null,
    risk: null,
    recoverableOnly: false
  },
  cleanupItems: seedItems,
  backups: seedBackups
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-phase":
      return { ...state, phase: action.phase };
    case "set-theme-mode":
      return { ...state, themeMode: action.themeMode };
    case "toggle-item-selection": {
      const exists = state.selectedItemIds.includes(action.itemId);
      return {
        ...state,
        selectedItemIds: exists
          ? state.selectedItemIds.filter((id) => id !== action.itemId)
          : [...state.selectedItemIds, action.itemId]
      };
    }
    case "clear-selection":
      return { ...state, selectedItemIds: [] };
    case "set-filter":
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.filter
        }
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

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }

  return context;
}
