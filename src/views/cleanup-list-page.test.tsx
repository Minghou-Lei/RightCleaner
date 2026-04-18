import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AppStateProvider } from "@/state/app-state";
import { CleanupListPage } from "./cleanup-list-page";

describe("CleanupListPage", () => {
  it("renders detection badges for flagged context menu entries", () => {
    render(
      <MemoryRouter>
        <AppStateProvider>
          <CleanupListPage />
        </AppStateProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "菜单项识别结果与批量处置入口" })).toBeInTheDocument();
    expect(screen.getAllByText("异常").length).toBeGreaterThan(0);
    expect(screen.getByText("来源不明")).toBeInTheDocument();
    expect(screen.getByText("第三方扩展")).toBeInTheDocument();
  });
});
