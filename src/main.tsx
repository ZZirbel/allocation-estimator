import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { hydrateFromServer, clearHydrationFlag } from './lib/store';

// Clear hydration flag on page load so Ctrl+R properly re-fetches data
clearHydrationFlag();

// Hydrate localStorage from server file before rendering.
// This ensures data persists across Electron rebuilds.
hydrateFromServer().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
});
