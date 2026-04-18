export const themeTokens = {
  surfaces: {
    canvas: "var(--color-bg)",
    elevated: "var(--color-surface)",
    muted: "var(--color-surface-strong)"
  },
  text: {
    primary: "var(--color-text)",
    secondary: "var(--color-text-muted)",
    inverse: "var(--color-text-inverse)"
  },
  accents: {
    brand: "var(--color-brand)",
    info: "var(--color-accent)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    danger: "var(--color-danger)"
  },
  layout: {
    pageWidth: "var(--page-max-width)",
    pagePadding: "var(--page-padding)",
    controlHeight: "var(--control-height)"
  },
  radius: {
    card: "var(--radius-lg)",
    pill: "var(--radius-pill)"
  }
} as const;

export type ThemeTokens = typeof themeTokens;
