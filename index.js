/**
 * Proceso principal de Electron
 * Responsabilidades:
 * - Crear y configurar la ventana principal
 * - Integración con lector NFC (nfc-pcsc) en modo escucha continua
 * - Canales IPC para login por NFC, registro entrada/salida y gestión admin
 */
const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const db = require('./src/main/db');
const { NFC } = require('nfc-pcsc');

let window;
// Suscriptores de escucha continua para login por NFC
const nfcLoginListeners = new Set();
let lastNfcUid = null;
let lastNfcTs = 0;

app.on('ready', () => {

  // ===============================
  // VENTANA PRINCIPAL
  // ===============================
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
  window.maximize();
  window.webContents.openDevTools({ mode: 'detach' });

  // ===============================
  // NFC ESCUCHA CONTINUA (LOGIN)
  // - Emite 'nfc:uid' a los renderers suscritos cuando se detecta una tarjeta
  // - Evita lecturas repetidas muy seguidas mediante debounce
  // ===============================
  try {
    const nfcContinuous = new NFC();

    nfcContinuous.on('reader', (reader) => {
      reader.on('card', async (card) => {
        try {
          const uid = card?.uid;
          if (!uid) return;
          // Evitar disparos múltiples muy seguidos (debounce 1s)
          const now = Date.now();
          if (uid === lastNfcUid && now - lastNfcTs < 1000) return;
          lastNfcUid = uid;
          lastNfcTs = now;

          // Notificar a todos los renderers suscritos
          for (const wcId of nfcLoginListeners) {
            const wc = webContents.fromId(wcId);
            if (wc && !wc.isDestroyed()) {
              wc.send('nfc:uid', uid);
            }
          }
        } catch (err) {
          // Log pero no interrumpir la escucha
          console.error('Error procesando tarjeta (escucha continua):', err);
        }
      });

      reader.on('error', (err) => {
        console.error('Error lector NFC (escucha continua):', err);
      });
      reader.on('end', () => {
        // El lector se ha desconectado
      });
    });

    nfcContinuous.on('error', (err) => {
      console.error('Error general NFC (escucha continua):', err);
    });
  } catch (err) {
    console.error('No se pudo iniciar NFC continua:', err);
  }

  // ===============================
  // AUTH
  // - Login y registro de alumnos vía modelo de datos (src/main/db.js)
  // ===============================
  ipcMain.handle('auth:login', async (event, payload) => {
    try {
      return await db.login(payload.email, payload.password);
    } catch (err) {
      throw new Error(err.message || 'Error de acceso');
    }
  });

  ipcMain.handle('auth:registerAlumno', async (event, payload) => {
    try {
      return await db.registerAlumno(payload);
    } catch (err) {
      throw new Error(err.message || 'Error al registrar alumno');
    }
  });

  // ===============================
  // CONTROL SUSCRIPCIÓN LOGIN NFC
  // - Renderers se suscriben/desuscriben para recibir eventos 'nfc:uid'
  // ===============================
  ipcMain.on('nfc:escuchar-login', (event) => {
    const id = event.sender.id;
    nfcLoginListeners.add(id);
    // Limpiar si el renderer muere
    event.sender.once('destroyed', () => {
      nfcLoginListeners.delete(id);
    });
  });
  ipcMain.on('nfc:detener-escucha', (event) => {
    nfcLoginListeners.delete(event.sender.id);
  });

  // ===============================
  // CONSULTAS AUXILIARES NFC
  // - Comprobar si un usuario tiene NFC
  // - Listar usuarios con estado NFC
  // - Deshabilitar NFC para un usuario
  // ===============================
  ipcMain.handle('nfc:check-user', async (event, user) => {
    try {
      if (!user) return { hasNFC: false };
      const database = await db.connect();
      const usuarios = database.collection('usuarios');
      let found = null;
      if (user._id) {
        try { found = await usuarios.findOne({ _id: new (require('mongodb').ObjectId)(String(user._id)) }); } catch {}
      }
      if (!found && user.email) {
        // Some schemas store email under 'gmail'
        found = await usuarios.findOne({ gmail: user.email });
        if (!found) found = await usuarios.findOne({ email: user.email });
      }
      if (found?.nfcToken) return { hasNFC: true };
      // Buscar en nfctokens por userId/email
      const nfcTokens = database.collection('nfctokens');
      const entry = await nfcTokens.findOne({ $or: [
        { userId: user?._id ? String(user._id) : null },
        { email: user?.email || null }
      ]});
      return { hasNFC: !!entry };
    } catch {
      return { hasNFC: false };
    }
  });

  // Lista de usuarios con estado NFC
  ipcMain.handle('nfc:list-users-with-nfc', async () => {
    try {
      const list = await db.listAllUsersSimple();
      return list;
    } catch (err) {
      throw new Error(err.message || 'Error listando usuarios');
    }
  });

  // Crear usuario (admin/professor): role = 'alumno' | 'professor'
  ipcMain.handle('users:create', async (event, payload) => {
    try {
      const res = await db.createUserSimple(payload || {});
      return res;
    } catch (err) {
      return { ok: false, error: err.message || 'Error creando usuario' };
    }
  });

  // Deshabilitar NFC para un usuario
  ipcMain.handle('nfc:disable', async (event, userId) => {
    try {
      return await db.disableUserNfc(userId);
    } catch (err) {
      throw new Error(err.message || 'Error deshabilitando NFC');
    }
  });

  // ===============================
  // REGISTRO ENTRADA / SALIDA NFC
  // - Alterna 'entrada'/'salida' por usuario al pasar tarjeta
  // ===============================
  ipcMain.handle('nfc:registrar-entrada-salida', async (event, arg1, arg2) => {
    try {
      const ctx = (arg1 && typeof arg1 === 'object' && arg1.uid) ? arg1 : { uid: arg1, userId: arg2 };
      const headers = { 'Content-Type': 'application/json' };
      if (ctx.token) headers['Authorization'] = 'Bearer ' + ctx.token;
      const res = await fetch('http://localhost:8080/api/usuarios/registrar-entrada-salida', {
        method: 'POST',
        headers,
        body: JSON.stringify({ uid: ctx.uid, userId: ctx.userId })
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
        return { ok: false, error: msg };
      }
      return data || { ok: true };

    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ===============================
  // LEER NFC Y GUARDAR TOKEN (vía API)
  // - Lee una tarjeta NFC y, si hay usuario objetivo, delega en la API la asociación
  // - Devuelve { ok, uid } o { ok:false, error, uid } para gestionar conflictos
  // ===============================
  ipcMain.handle('nfc:leer', async (event, ctx) => {
    return new Promise((resolve, reject) => {
      const nfc = new NFC();
      let finished = false;

      nfc.on('reader', reader => {

        reader.once('card', async card => {
          try {
            // Delegar asignación en API si hay usuario objetivo
            const user = (ctx && typeof ctx === 'object') ? ctx.user : ctx;
            const token = (ctx && typeof ctx === 'object') ? ctx.token : null;
            if (user && (user._id || user.email || user.dni)) {
              const res = await fetch('http://localhost:8080/api/usuarios/asignar-nfc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
                body: JSON.stringify({
                  uid: card.uid,
                  userId: user._id || undefined,
                  dni: user.dni || undefined,
                  gmail: user.email || undefined
                })
              });
              const text = await res.text();
              let data = null;
              try { data = text ? JSON.parse(text) : null; } catch {}
              if (!res.ok) {
                finished = true;
                const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
                resolve({ ok: false, error: msg, uid: card.uid });
                reader.close();
                return;
              }
            }
            finished = true;
            resolve({ ok: true, uid: card.uid });
            reader.close();
          } catch (err) {
            finished = true;
            // Propagar mensaje descriptivo y el UID leído
            resolve({ ok: false, error: err.message || 'Error guardando NFC', uid: card.uid });
            reader.close();
          }
        });

        setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve({ ok: false, error: 'Timeout: No se detectó tarjeta NFC.' });
            reader.close();
          }
        }, 15000);
      });

      nfc.on('error', err => {
        if (!finished) {
          finished = true;
          resolve({ ok: false, error: 'Error NFC: ' + err.message });
        }
      });
    });
  });

  // ===============================
  // LOGIN AUTOMÁTICO POR NFC
  // - Resolver credenciales para auto-login cuando llega un UID
  // ===============================
  ipcMain.handle('nfc:login', async (event, uid) => {
    try {
      // Delegar autenticación a la API para obtener JWT sin password
      const res = await fetch('http://localhost:8080/api/usuarios/login-nfc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
        return { ok: false, error: msg };
      }
      return { ok: true, auth: { usuario: data?.usuario, token: data?.token } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Obtener propietario de un UID NFC
  // - Útil para mostrar conflictos y permitir acciones admin
  ipcMain.handle('nfc:get-owner', async (event, uid) => {
    try {
      const usuario = await db.getUsuarioByTokenNFC(uid);
      if (!usuario) return { ok: false };
      const roleRaw = usuario.rol || usuario.role;
      const role = String(roleRaw||'').toUpperCase()==='ADMIN' ? 'admin' : (String(roleRaw||'').toUpperCase()==='PROFESOR' ? 'professor' : 'alumno');
      const email = usuario.gmail || usuario.email || '';
      return { ok: true, user: { _id: String(usuario._id), nombre: usuario.nombre || '', email, role } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Listar registros de entrada/salida para un usuario (requiere JWT)
  ipcMain.handle('nfc:list-registros', async (event, ctx) => {
    try {
      const { userId, token, limit } = ctx || {};
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const url = `http://localhost:8080/api/usuarios/registros?userId=${encodeURIComponent(userId||'')}&limit=${Number(limit||50)}`;
      const res = await fetch(url, { method: 'GET', headers });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
        return { ok: false, error: msg };
      }
      return data || { ok: true, registros: [] };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // Admin: actualizar perfil de usuario
  ipcMain.handle('admin:update-user', async (event, ctx) => {
    try {
      const { id, updates, token } = ctx || {};
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch('http://localhost:8080/api/usuarios/actualizar', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id, ...updates })
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
        return { ok: false, error: msg };
      }
      return data || { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

});
