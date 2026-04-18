import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AppStateProvider } from "@/state/app-state";
import { CleanupListPage } from "./cleanup-list-page";

describe("CleanupListPage", () => {
  it("renders detection badges for flagged context menu entries", async () => {
    render(
      <MemoryRouter>
        <AppStateProvider>
          <CleanupListPage />
        </AppStateProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "菜单项识别结果与批量处置入口" })).toBeInTheDocument();
    expect((await screen.findAllByText("异常")).length).toBeGreaterThan(0);
    expect(await screen.findByText("来源不明")).toBeInTheDocument();
    expect((await screen.findAllByText("第三方扩展")).length).toBeGreaterThan(0);
  });
});
