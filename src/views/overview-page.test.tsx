import { render, screen } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { MemoryRouter } from 'react-router-dom';

import { AppStateProvider } from '@/state/app-state';
import { OverviewPage } from './overview-page';

describe('OverviewPage', () => {
  const invokeMock = vi.mocked(invoke);

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command) => {
      if (command === 'list_menu_items') {
        return [
          {
            id: 'shell-verb-open-code',
            title: 'Open with Code',
            canonicalTitle: 'open with code',
            sourceKind: 'shell_verb',
            sourceLabel: '文件',
            target: 'file',
            targetLabel: '文件',
            enabled: true,
            editable: true,
            visibility: 'primary',
            command: {
              verb: 'openwithcode',
              command: '"Code.exe" "%1"',
              delegateExecute: null,
              explorerCommandHandler: null,
              subCommands: [],
            },
            handlerClsid: null,
            trace: {
              registrationPath: 'HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode',
              commandPath: 'HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode\\command',
              commandStorePaths: [],
              sourceValues: [],
              notes: [],
            },
            tags: ['unknown-source'],
          },
          {
            id: 'handler-7zip',
            title: '7-Zip',
            canonicalTitle: '7-zip',
            sourceKind: 'shell_extension',
            sourceLabel: '目录',
            target: 'directory',
            targetLabel: '目录',
            enabled: true,
            editable: false,
            visibility: 'primary',
            command: null,
            handlerClsid: '{23170F69-40C1-278A-1000-000100020000}',
            trace: {
              registrationPath: 'HKEY_CLASSES_ROOT\\Directory\\shellex\\ContextMenuHandlers\\7-Zip',
              commandPath: null,
              commandStorePaths: [],
              sourceValues: [],
              notes: [],
            },
            tags: ['third-party'],
          },
        ];
      }

      if (command === 'list_recovery_points') {
        return [
          {
            id: 'toggle-1713490000',
            itemId: 'shell-verb-open-code',
            itemTitle: 'Open with Code',
            registryPath: 'HKEY_CLASSES_ROOT\\*\\shell\\OpenWithCode',
            label: '禁用 Open with Code',
            createdAt: '1713490000',
            action: 'disable',
            status: 'ready',
            previousEnabled: true,
            resultingEnabled: false,
            previousLegacyDisable: null,
          },
        ];
      }

      return null;
    });
  });

  it('renders overview metrics, category entries, and main actions', async () => {
    render(
      <MemoryRouter>
        <AppStateProvider>
          <OverviewPage />
        </AppStateProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: '首页概览与分类导航' })).toBeInTheDocument();
    expect((await screen.findAllByText('菜单项总数')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /文件菜单/i })).toHaveAttribute(
      'href',
      '/cleanup?target=file',
    );
    expect(screen.getByRole('link', { name: /第三方扩展/i })).toHaveAttribute(
      'href',
      '/cleanup?source=third_party&issue=third-party',
    );
    expect(screen.getByRole('button', { name: '重新扫描' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入批量确认' })).toHaveAttribute('href', '/batch');
  });
});
