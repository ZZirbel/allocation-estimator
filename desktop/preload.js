// Preload script — sandboxed bridge between Electron and the web app
const { contextBridge, ipcRenderer } = require('electron');

// Expose update-related functions to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Check if updates are available (returns { available: boolean, commitsBehind: number })
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Trigger the update process (pulls, rebuilds, reloads)
  performUpdate: () => ipcRenderer.invoke('perform-update'),

  // Check if running in Electron
  isElectron: true,
});
