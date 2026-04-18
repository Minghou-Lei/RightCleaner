import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import {
  inspectMenuItemPermissions,
  loadMenuItems,
  loadRecoveryPoints,
} from "./menu-item-service";

describe("menu-item-service fallback", () => {
  it("provides menu items, permission hints, and recovery points without Tauri", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("fallback"));

    const items = await loadMenuItems();
    expect(items.length).toBeGreaterThan(0);

    const permission = await inspectMenuItemPermissions("HKEY_CLASSES_ROOT\\Directory\\shell\\OpenWithCode");
    expect(permission.requiresElevation).toBe(true);
    expect(permission.recommendedAction).toContain("提权");

    const recoveryPoints = await loadRecoveryPoints();
    expect(recoveryPoints.length).toBeGreaterThan(0);
    expect(recoveryPoints[0]?.label).toContain("Open with Code");
  });
});
