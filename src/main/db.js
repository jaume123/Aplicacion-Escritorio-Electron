// Servicios de DB para proceso principal de Electron
// Estructura unificada de usuarios con roles y gestión de asistencias

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'appdb';
const COLLECTION_USUARIOS = 'usuarios';

let client = null;
let db = null;

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 3000, directConnection: true });
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

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

module.exports = { connect, login, registerAlumno };
