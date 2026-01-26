// 1.
const { app, BrowserWindow, ipcMain } = require('electron');
// Conexión directa a MongoDB (como antes)
const db = require('./src/main/db');

// 2.
let window;

// 3.
app.on('ready', () => {
  // 4.
  window = new BrowserWindow({
    resizable: true,
    show: true,
    useContentSize: true,
    minWidth: 1024,
    minHeight: 700,
    width: 1360,
    height: 890,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  });
  window.loadFile('index.html');
  // Maximiza por defecto para ocupar toda la pantalla útil
  window.maximize();
  // Abrir DevTools para inspeccionar errores del renderer
  window.webContents.openDevTools({ mode: 'detach' });

  // IPC handlers for auth (delegan en la API Spring)
  ipcMain.handle('auth:login', async (event, payload) => {
    try {
      return await db.login(payload.email, payload.password);
    } catch (err) {
      return Promise.reject(new Error(err.message || 'Error de acceso'));
    }
  });

  ipcMain.handle('auth:registerAlumno', async (event, payload) => {
    try {
      return await db.registerAlumno(payload);
    } catch (err) {
      return Promise.reject(new Error(err.message || 'Error al registrar alumno'));
    }
  });
});