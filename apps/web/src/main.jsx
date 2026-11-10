import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext.jsx';
import { AppRoutes } from './App.jsx';
import { ErrorBoundary } from './components/layout/ErrorBoundary.jsx';
import { startErrorReporting } from './lib/errorReporting.js';
import { registerServiceWorker } from './lib/pwa.js';
import { startThemeSync } from './lib/theme.js';
import { applyDocumentLanguage } from './i18n/index.js';
import './styles/tokens.css';
import './styles/global.css';

// Off unless the API has a Sentry DSN configured; never blocks the app from starting
startErrorReporting();
// Installable app + offline copy (production builds only)
registerServiceWorker();
// Light/dark: the rider's switch, else follow the phone (also when the phone switches)
startThemeSync();
// <html lang> matches the app language (screen readers, hyphenation, translation tools)
applyDocumentLanguage();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Retry only server/network hiccups, never 4xx (they won't fix themselves)
      retry: (count, error) => (error?.status === 0 || error?.status >= 500) && count < 2,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
