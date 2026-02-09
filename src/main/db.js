const COLLECTION_REGISTROS = 'registros';
// Asigna un token NFC permanente a un usuario si no tiene
async function asignarTokenNFC(userId, token) {
  const database = await connect();
  const usuarios = database.collection(COLLECTION_USUARIOS);
  const user = await usuarios.findOne({ _id: new ObjectId(String(userId)) });
  if (!user) throw new Error('Usuario no encontrado');
  if (user.nfcToken) throw new Error('El usuario ya tiene un token NFC asignado');
  await usuarios.updateOne({ _id: new ObjectId(String(userId)) }, { $set: { nfcToken: token } });
  return { ok: true };
}

// Busca usuario por token NFC. Si no está en usuarios.nfcToken, intenta resolver vía colección 'nfctokens'.
async function getUsuarioByTokenNFC(token) {
  const database = await connect();
  const usuarios = database.collection(COLLECTION_USUARIOS);
  // 1) Búsqueda directa en el usuario
  let user = await usuarios.findOne({ nfcToken: token });
  if (user) return user;

  // 2) Buscar en colección nfctokens por uid
  const nfcTokens = database.collection('nfctokens');
  const entry = await nfcTokens.findOne({ uid: token });
  if (!entry) return null;

  // 3) Resolver usuario por userId o email
  if (entry.userId) {
    try {
      const _id = new ObjectId(String(entry.userId));
      user = await usuarios.findOne({ _id });
    } catch {}
  }
  if (!user && entry.email) {
    user = await usuarios.findOne(ciEmailQuery(entry.email));
  }

  // Si lo encontramos, aprovechar para sincronizar nfcToken en usuarios
  if (user) {
    await usuarios.updateOne({ _id: user._id }, { $set: { nfcToken: token } });
    return user;
  }
  return null;
}

// Registra entrada o salida en la colección de registros
async function registrarNFC(token) {
  const database = await connect();
  const usuario = await getUsuarioByTokenNFC(token);
  if (!usuario) throw new Error('Token NFC no asociado a ningún usuario');
  const registros = database.collection(COLLECTION_REGISTROS);
  // Buscar último registro para alternar entrada/salida
  const ultimo = await registros.find({ token }).sort({ fechaHora: -1 }).limit(1).toArray();
  let tipo = 'entrada';
  if (ultimo.length && ultimo[0].tipo === 'entrada') tipo = 'salida';
  const registro = {
    token,
    userId: String(usuario._id),
    nombre: usuario.nombre || '',
    tipo,
    fechaHora: new Date(),
  };
  await registros.insertOne(registro);
  return { ok: true, registro };
}
// Servicios de DB para proceso principal de Electron
// Estructura unificada de usuarios con roles y gestión de asistencias

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'appdb';
const COLLECTION_USUARIOS = 'usuarios';

let client = null;
let db = null;

/**
 * Establece conexión (singleton) con MongoDB y devuelve la DB.
 * - URL local: mongodb://localhost:27017
 * - DB: appdb
 */
async function connect() {
  if (db) return db;
  client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 3000, directConnection: true });
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

/**
 * Construye una query case-insensitive para el campo email.
 */
function ciEmailQuery(email) {
  const esc = String(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { email: { $regex: `^${esc}$`, $options: 'i' } };
}

async function getUsuarioById(id) {
  const database = await connect();
  try {
    const _id = new ObjectId(String(id));
    return await database.collection(COLLECTION_USUARIOS).findOne({ _id });
  } catch {
    return null;
  }
}

/**
 * Autentica un usuario por email/contraseña (plaintext, básico).
 * - Devuelve { ok, user: { role, email, _id } }
 */
async function login(email, password) {
  const database = await connect();
  const emailNorm = String(email || '').trim().toLowerCase();
  const pass = String(password || '').trim();
  if (!emailNorm || !pass) throw new Error('Credenciales inválidas');

  const user = await database.collection(COLLECTION_USUARIOS).findOne(ciEmailQuery(emailNorm));
  if (!user) throw new Error('Cuenta no encontrada. Si eres alumno, regístrate.');

  const stored = user['contraseña'] ?? user['password'] ?? '';
  if (stored !== pass) throw new Error('Contraseña incorrecta.');

  const role = user.role || 'alumno';
  return { ok: true, user: { role, email: user.email, _id: String(user._id) } };
}

/**
 * Registra un alumno con validaciones básicas y normalización de email.
 */
async function registerAlumno(payload) {
  const database = await connect();
  const emailNorm = String(payload?.email || '').trim().toLowerCase();
  const pass = String(payload?.password || '').trim();
  if (!emailNorm || !pass) throw new Error('Completa correo y contraseña.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) throw new Error('El correo no es válido.');

  // Campos adicionales
  const nombre = String(payload?.nombre || '').trim();
  const apellidos = String(payload?.apellidos || '').trim();
  const dni = String(payload?.dni || '').trim().toUpperCase();
  const fechaNacimiento = String(payload?.fechaNacimiento || '').trim();
  if (!nombre || !apellidos) throw new Error('Nombre y apellidos son obligatorios.');
  if (!/^[0-9]{7,8}[A-Za-z]?$/.test(dni)) throw new Error('DNI no válido.');
  if (!fechaNacimiento) throw new Error('Fecha de nacimiento es obligatoria.');

  const usuarios = database.collection(COLLECTION_USUARIOS);
  const existing = await usuarios.findOne(ciEmailQuery(emailNorm));
  if (existing) throw new Error('El usuario ya existe en la base de datos.');

  // Solo alumnos pueden registrarse desde la app; admin/professor se crean manualmente en DB
  const doc = {
    email: emailNorm,
    contraseña: pass,
    role: 'alumno',
    nombre,
    apellidos,
    dni,
    fechaNacimiento,
    createdAt: new Date(),
  };
  const res = await usuarios.insertOne(doc);
  return { ok: true, id: String(res.insertedId) };
}

// Guarda un token NFC en la colección nfctokens y lo asocia a un usuario
/**
 * Asigna un UID NFC a un usuario respetando unicidad global.
 * - Si el UID pertenece a otro usuario: lanza Error descriptivo.
 * - Si pertenece al mismo: asegura consistencia en 'usuarios' y 'nfctokens'.
 * - Si no existe: inserta en 'nfctokens' y vincula en 'usuarios'.
 */
async function guardarNFCToken(uid, user) {
  const database = await connect();
  const collection = database.collection('nfctokens');
  // Regla: un UID no puede estar asignado a más de un usuario.
  // Si ya está asignado a otro usuario distinto, lanzar error descriptivo.
  const assigned = await getUsuarioByTokenNFC(uid);
  if (assigned) {
    const sameUser = (user?._id && String(user._id) === String(assigned._id)) ||
                     (user?.email && String(user.email).toLowerCase() === String(assigned.email).toLowerCase());
    if (!sameUser) {
      const owner = assigned.nombre || assigned.email || 'otro usuario';
      throw new Error(`Este NFC ya está habilitado y pertenece a ${owner}. Deshabilítalo primero para reasignarlo.`);
    }
    // Mismo usuario: garantizar consistencia de las colecciones
    const exists = await collection.findOne({ uid });
    if (!exists) {
      await collection.insertOne({
        uid,
        fecha: new Date(),
        userId: String(assigned._id),
        email: assigned.email || undefined,
        nombre: assigned.nombre || undefined
      });
    }
    const usuarios = database.collection('usuarios');
    await usuarios.updateOne({ _id: assigned._id }, { $set: { nfcToken: uid } });
    return; // ya asignado correctamente al mismo usuario
  }

  // No asignado: crear registro y vincular al usuario objetivo
  let nombre = user?.nombre;
  if (!nombre && user?.email) {
    const usuarios = database.collection('usuarios');
    const found = await usuarios.findOne(ciEmailQuery(user.email));
    if (found && found.nombre) nombre = found.nombre;
  }
  await collection.insertOne({
    uid,
    fecha: new Date(),
    userId: user?._id ? String(user._id) : undefined,
    email: user?.email || undefined,
    nombre: nombre || undefined
  });
  try {
    const usuarios = database.collection('usuarios');
    let targetUser = null;
    if (user?._id) {
      try { targetUser = await usuarios.findOne({ _id: new ObjectId(String(user._id)) }); } catch {}
    }
    if (!targetUser && user?.email) {
      targetUser = await usuarios.findOne(ciEmailQuery(user.email));
    }
    if (targetUser) {
      await usuarios.updateOne({ _id: targetUser._id }, { $set: { nfcToken: uid } });
    }
  } catch {}
}

// ---- Admin helpers NFC ----
/**
 * Lista usuarios con un subconjunto de campos útil para la sección admin NFC.
 */
function normalizeRole(raw) {
  const up = String(raw || '').toUpperCase();
  if (up === 'PROFESOR' || up === 'PROFESSOR') return 'professor';
  if (up === 'ADMIN') return 'admin';
  return 'alumno';
}

async function listAllUsersSimple() {
  const database = await connect();
  const usuarios = database.collection(COLLECTION_USUARIOS);
  const cur = usuarios.find({}, { projection: { gmail: 1, email: 1, nombre: 1, apellidos: 1, dni: 1, rol: 1, role: 1, nfcToken: 1 } });
  const list = await cur.toArray();
  return list.map(u => ({
    _id: String(u._id),
    email: u.gmail || u.email,
    nombre: u.nombre,
    apellidos: u.apellidos || '',
    dni: u.dni || '',
    role: normalizeRole(u.rol || u.role),
    nfcToken: u.nfcToken || null,
  }));
}

/**
 * Deshabilita NFC de un usuario:
 * - Limpia usuarios.nfcToken
 * - Elimina registros en 'nfctokens' por userId/email
 */
async function disableUserNfc(userId) {
  const database = await connect();
  const usuarios = database.collection(COLLECTION_USUARIOS);
  const nfcTokens = database.collection('nfctokens');
  const _id = new ObjectId(String(userId));
  const user = await usuarios.findOne({ _id });
  if (!user) throw new Error('Usuario no encontrado');
  await usuarios.updateOne({ _id }, { $unset: { nfcToken: '' } });
  // Eliminar tokens asociados por userId/email
  const query = { $or: [ { userId: String(user._id) }, { email: user.email } ] };
  await nfcTokens.deleteMany(query);
  return { ok: true };
}

module.exports = {
  connect,
  login,
  registerAlumno,
  /**
   * Crea usuario simple (admin/professor) con validación mínima.
   * Campos: nombre, apellidos, dni (opcional), email, role ('alumno'|'professor').
   * contraseña: si no se indica, se genera '123456'.
   */
  async createUserSimple(payload) {
    const database = await connect();
    const usuarios = database.collection(COLLECTION_USUARIOS);
    const email = String(payload?.email || '').trim().toLowerCase();
    const nombre = String(payload?.nombre || '').trim();
    const apellidos = String(payload?.apellidos || '').trim();
    const dni = String(payload?.dni || '').trim().toUpperCase();
    const role = String(payload?.role || 'alumno').toLowerCase();
    const password = String(payload?.password || '123456');
    const fechaNacimiento = String(payload?.fechaNacimiento || '').trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email inválido.');
    if (!nombre) throw new Error('Nombre es obligatorio.');
    if (!apellidos) throw new Error('Apellidos son obligatorios.');
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    const existing = await usuarios.findOne(ciEmailQuery(email));
    if (existing) throw new Error('El usuario ya existe.');
    const doc = {
      email,
      gmail: email,
      contraseña: password,
      role: role === 'professor' ? 'professor' : 'alumno',
      nombre,
      apellidos,
      dni: dni || undefined,
      fechaNacimiento: fechaNacimiento || undefined,
      createdAt: new Date(),
    };
    const res = await usuarios.insertOne(doc);
    return { ok: true, id: String(res.insertedId) };
  },
  asignarTokenNFC,
  getUsuarioByTokenNFC,
  registrarNFC,
  guardarNFCToken,
  listAllUsersSimple,
  disableUserNfc,
};
