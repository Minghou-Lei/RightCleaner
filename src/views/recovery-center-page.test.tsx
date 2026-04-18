import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { invoke } from "@tauri-apps/api/core";
import { MemoryRouter } from "react-router-dom";

import { AppStateProvider } from "@/state/app-state";
import { RecoveryCenterPage } from "./recovery-center-page";

describe("RecoveryCenterPage", () => {
  const invokeMock = vi.mocked(invoke);

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_menu_items") {
        return [];
      }

      if (command === "list_recovery_points") {
        return [
          {
            id: "toggle-1713490000",
            itemId: "shell-verb-open-code",
            itemTitle: "Open with Code",
            registryPath: "HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode",
            label: "禁用 Open with Code",
            createdAt: "1713490000",
            action: "disable",
            status: "ready",
            previousEnabled: true,
            resultingEnabled: false,
            previousLegacyDisable: null
          }
        ];
      }

      if (command === "restore_recovery_point") {
        return null;
      }

      throw new Error(`unexpected command ${command}`);
    });
  });

  it("restores a recorded toggle operation", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppStateProvider>
          <RecoveryCenterPage />
        </AppStateProvider>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole("button", { name: "恢复" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("restore_recovery_point", {
        backupId: "toggle-1713490000"
      });
    });
  });
});
