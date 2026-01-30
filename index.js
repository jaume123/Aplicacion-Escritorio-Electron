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
        found = await usuarios.findOne({ email: user.email });
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
  ipcMain.handle('nfc:registrar-entrada-salida', async (event, uid) => {
    try {
      const usuario = await db.getUsuarioByTokenNFC(uid);
      if (!usuario) {
        return { ok: false, error: 'NFC no asociado a ningún usuario.' };
      }

      const database = await db.connect();
      const collection = database.collection('registrosEntradaSalida');

      const ultimo = await collection
        .find({ userId: String(usuario._id) })
        .sort({ fechaHora: -1 })
        .limit(1)
        .toArray();

      let tipo = 'entrada';
      if (ultimo.length && ultimo[0].tipo === 'entrada') {
        tipo = 'salida';
      }

      const registro = {
        userId: String(usuario._id),
        nombre: usuario.nombre || '',
        email: usuario.email || '',
        fechaHora: new Date(),
        tipo,
        uid
      };

      await collection.insertOne(registro);
      return { ok: true, registro };

    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ===============================
  // LEER NFC Y GUARDAR TOKEN
  // - Lee una tarjeta NFC y, si hay usuario objetivo, guarda la asociación
  // - Devuelve { ok, uid } o { ok:false, error, uid } para gestionar conflictos
  // ===============================
  ipcMain.handle('nfc:leer', async (event, user) => {
    return new Promise((resolve, reject) => {
      const nfc = new NFC();
      let finished = false;

      nfc.on('reader', reader => {

        reader.once('card', async card => {
          try {
            // Solo guardar el token si se está asociando desde Home (usuario presente)
            if (user && (user._id || user.email)) {
              await db.guardarNFCToken(card.uid, user);
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
      const usuario = await db.getUsuarioByTokenNFC(uid);
      if (!usuario) return { ok: false };

      return {
        ok: true,
        user: {
          email: usuario.email,
          password: usuario.contraseña || usuario.password || ''
        }
      };
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
      return { ok: true, user: { _id: String(usuario._id), nombre: usuario.nombre || '', email: usuario.email || '', role: usuario.role || 'alumno' } };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

});
