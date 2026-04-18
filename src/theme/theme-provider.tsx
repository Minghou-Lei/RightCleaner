import { useEffect, type PropsWithChildren } from "react";

import { useAppState } from "../state/app-state";

export function AppThemeProvider({ children }: PropsWithChildren) {
  const {
    state: { themeMode }
  } = useAppState();

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  return children;
}
