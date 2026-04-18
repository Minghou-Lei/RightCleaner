import { describe, expect, it } from "vitest";

import {
  disableMenuItem,
  loadChangeHistory,
  loadMenuItems,
  redoChange,
  undoChange,
} from "./menu-item-service";

describe("menu-item-service fallback history", () => {
  it("records disable, undo, and redo when Tauri invoke is unavailable", async () => {
    const items = await loadMenuItems();
    const target = items[0];

    expect(target).toBeDefined();

    const record = await disableMenuItem(target!, "test");
    expect(record.status).toBe("applied");

    const afterDisable = await loadMenuItems();
    expect(afterDisable.some((entry) => entry.id === target?.id)).toBe(false);

    const undone = await undoChange(record.id);
    expect(undone.status).toBe("undone");

    const afterUndo = await loadMenuItems();
    expect(afterUndo.some((entry) => entry.id === target?.id)).toBe(true);

    const redone = await redoChange(record.id);
    expect(redone.status).toBe("applied");

    const history = await loadChangeHistory();
    expect(history[0]?.id).toBe(record.id);
  });
});
