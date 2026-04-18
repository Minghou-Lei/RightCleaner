import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

import { AppStateProvider } from "@/state/app-state";
import { CleanupDetailPage } from "./cleanup-detail-page";

describe("CleanupDetailPage", () => {
  const invokeMock = vi.mocked(invoke);

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_menu_items") {
        return [
          {
            id: "shell-verb-open-code",
            title: "Open with Code",
            canonicalTitle: "open with code",
            sourceKind: "shell_verb",
            sourceLabel: "文件",
            target: "file",
            targetLabel: "文件",
            enabled: true,
            editable: true,
            visibility: "primary",
            command: {
              verb: "openwithcode",
              command: "powershell.exe -File launch-code.ps1 \"%1\"",
              delegateExecute: "{11111111-1111-1111-1111-111111111111}",
              explorerCommandHandler: null,
              subCommands: ["OpenWithCode"]
            },
            handlerClsid: null,
            trace: {
              registrationPath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode",
              commandPath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode\\command",
              commandStorePaths: [
                "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CommandStore\\shell\\OpenWithCode"
              ],
              sourceValues: [
                {
                  name: "MUIVerb",
                  valueType: "REG_SZ",
                  data: "Open with Code",
                  sourcePath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode"
                }
              ],
              notes: ["当前为测试数据，用于验证详情页信息块。"]
            },
            tags: ["unknown-source"]
          }
        ];
      }

      if (command === "list_recovery_points") {
        return [];
      }

      if (command === "set_menu_item_enabled") {
        return null;
      }

      throw new Error(`unexpected command ${command}`);
    });
  });

  it("renders source command registry and risk sections for the selected item", async () => {
    render(
      <MemoryRouter initialEntries={["/cleanup/shell-verb-open-code"]}>
        <AppStateProvider>
          <Routes>
            <Route path="/cleanup/:itemId" element={<CleanupDetailPage />} />
          </Routes>
        </AppStateProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Open with Code" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "来源" })).toBeInTheDocument();
    expect(screen.getByText("来源未完成归属识别，处置前应先核对发布者或安装软件。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "命令" })).toBeInTheDocument();
    expect(screen.getByText("powershell.exe -File launch-code.ps1 \"%1\"")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "注册表位置" })).toBeInTheDocument();
    expect(
      screen.getByText("HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode\\command")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "风险提示" })).toBeInTheDocument();
    expect(screen.getByText("高风险命令")).toBeInTheDocument();
    expect(screen.getByText("归属待确认")).toBeInTheDocument();
  });
});
