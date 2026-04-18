import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { invoke } from '@tauri-apps/api/core';
import { MemoryRouter } from 'react-router-dom';

import { AppStateProvider } from '@/state/app-state';
import { CleanupListPage } from './cleanup-list-page';

describe('CleanupListPage', () => {
  const invokeMock = vi.mocked(invoke);

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command, args) => {
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
            tags: ['unknown-source', 'third-party'],
          },
          {
            id: 'handler-7zip',
            title: '7-Zip',
            canonicalTitle: '7-zip',
            sourceKind: 'shell_extension',
            sourceLabel: '目录',
            target: 'directory',
            targetLabel: '目录',
            enabled: false,
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
        return [];
      }

      if (command === 'set_menu_item_enabled') {
        return null;
      }

      throw new Error(`unexpected command ${command} ${JSON.stringify(args)}`);
    });
  });

  it('renders detection badges for flagged context menu entries', async () => {
    render(
      <MemoryRouter>
        <AppStateProvider>
          <CleanupListPage />
        </AppStateProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: '菜单项识别结果与批量处置入口' }),
    ).toBeInTheDocument();
    expect((await screen.findAllByText('来源不明')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('第三方扩展')).length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: '禁用' })).toBeInTheDocument();
  });

  it('invokes the backend toggle command for a single item', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppStateProvider>
          <CleanupListPage />
        </AppStateProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: '禁用' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('set_menu_item_enabled', {
        itemId: 'shell-verb-open-code',
        enabled: false,
      });
    });
  });

  it('applies homepage query filters for issue hotspots', async () => {
    render(
      <MemoryRouter initialEntries={['/cleanup?source=third_party&issue=third-party']}>
        <AppStateProvider>
          <CleanupListPage />
        </AppStateProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: '当前聚焦: 第三方扩展' }),
    ).toBeInTheDocument();
    expect(screen.getByText('7-Zip')).toBeInTheDocument();
    expect(screen.queryByText('Open with Code')).not.toBeInTheDocument();
  });

  it('filters by risk and source, then updates sort direction', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppStateProvider>
          <CleanupListPage />
        </AppStateProvider>
      </MemoryRouter>,
    );

    await user.selectOptions(await screen.findByDisplayValue('全部风险'), 'high');
    await user.selectOptions(screen.getByDisplayValue('全部来源'), 'unknown');

    expect(screen.getByText('Open with Code')).toBeInTheDocument();
    expect(screen.queryByText('7-Zip')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '降序' }));
    expect(screen.getByRole('button', { name: '升序' })).toBeInTheDocument();
  });
});
