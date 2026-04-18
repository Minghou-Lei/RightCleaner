import { analyzeMenuItemDetection, getDetectionTagLabel } from "./menu-item-detection";

describe("analyzeMenuItemDetection", () => {
  it("marks broken and unknown items as abnormal high-risk entries", () => {
    const result = analyzeMenuItemDetection({
      commandState: "missing",
      duplicateGroup: null,
      visibility: "visible",
      source: "unknown"
    });

    expect(result.tags).toEqual(["abnormal", "unknown-source"]);
    expect(result.badgeTone).toBe("high");
    expect(result.headline).toContain("异常");
    expect(result.detail).toContain("发布者");
  });

  it("marks hidden third-party duplicates without escalating to abnormal", () => {
    const result = analyzeMenuItemDetection({
      commandState: "healthy",
      duplicateGroup: "archive-tools",
      visibility: "hidden",
      source: "third-party"
    });

    expect(result.tags).toEqual(["duplicate", "hidden", "third-party"]);
    expect(result.badgeTone).toBe("medium");
    expect(result.headline).toBe("重复 / 已隐藏 / 第三方扩展");
  });

  it("returns a healthy summary when no issues are detected", () => {
    const result = analyzeMenuItemDetection({
      commandState: "healthy",
      duplicateGroup: null,
      visibility: "visible",
      source: "windows"
    });

    expect(result.tags).toEqual([]);
    expect(result.badgeTone).toBe("low");
    expect(getDetectionTagLabel("hidden")).toBe("已隐藏");
  });
});
