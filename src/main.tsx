import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import '@/styles/index.css';
import './styles/app.css';
import { appRouter } from './router';
import { AppStateProvider } from './state/app-state';
import { AppThemeProvider } from './theme/theme-provider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppStateProvider>
      <AppThemeProvider>
        <RouterProvider router={appRouter} />
      </AppThemeProvider>
    </AppStateProvider>
  </React.StrictMode>,
);
