import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { hydrateFromServer, clearHydrationFlag } from './lib/store';

// Hide loading overlay once app is ready
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    // Remove from DOM after fade-out animation
    setTimeout(() => overlay.remove(), 200);
  }
}

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
  // Hide loading overlay after React has rendered
  hideLoadingOverlay();
});
