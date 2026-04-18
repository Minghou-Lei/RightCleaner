/* eslint-disable react-refresh/only-export-components */
import { createBrowserRouter, Outlet } from "react-router-dom";

import { AppShell } from "./shell/app-shell";
import { BatchReviewPage } from "./views/batch-review-page";
import { CleanupDetailPage } from "./views/cleanup-detail-page";
import { CleanupListPage } from "./views/cleanup-list-page";
import { OverviewPage } from "./views/overview-page";
import { RecoveryCenterPage } from "./views/recovery-center-page";

function RoutedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const appRouter = createBrowserRouter([
  {
    path: "/",
    element: <RoutedLayout />,
    children: [
      {
        index: true,
        element: <OverviewPage />
      },
      {
        path: "cleanup",
        element: <CleanupListPage />
      },
      {
        path: "cleanup/:itemId",
        element: <CleanupDetailPage />
      },
      {
        path: "batch",
        element: <BatchReviewPage />
      },
      {
        path: "recovery",
        element: <RecoveryCenterPage />
      }
    ]
  }
]);
