// Cliente de API Spring para el proceso principal de Electron
// Ajusta BASE_URL y rutas según tu API real

const BASE_URL = process.env.SPRING_API_URL || 'http://localhost:8080/api';
const LOGIN_PATH = process.env.SPRING_LOGIN_PATH || '/usuarios/login'; // GET ?email=&password=
const REGISTER_PATH = process.env.SPRING_REGISTER_PATH || '/alumnos'; // POST JSON body

async function http(method, path, { query, body } = {}) {
  const url = new URL((BASE_URL.replace(/\/$/, '')) + path);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([k, v]) => url.searchParams.append(k, String(v)));
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

async function login(email, password) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const pass = String(password || '').trim();
  if (!emailNorm || !pass) throw new Error('Credenciales inválidas');
  const data = await http('GET', LOGIN_PATH, { query: { email: emailNorm, password: pass } });
  // Normaliza respuesta a contrato interno
  // Esperamos algún objeto usuario desde la API
  const user = {
    _id: String(data.id || data._id || data.userId || ''),
    email: data.email || emailNorm,
    role: data.role || data.rol || 'alumno',
    nombre: data.nombre || data.name || undefined,
    apellidos: data.apellidos || data.surname || undefined,
  };
  return { ok: true, user };
}

async function registerAlumno(payload) {
  const p = { ...payload };
  p.email = String(p.email || '').trim().toLowerCase();
  p.password = String(p.password || '').trim();
  if (!p.email || !p.password) throw new Error('Completa correo y contraseña.');
  // Mapea a nombres que la API pueda aceptar (ajústalo si difiere)
  const body = {
    nombre: p.nombre,
    apellidos: p.apellidos,
    dni: p.dni,
    fechaNacimiento: p.fechaNacimiento,
    email: p.email,
    password: p.password,
    role: 'alumno',
  };
  const data = await http('POST', REGISTER_PATH, { body });
  const id = String((data && (data.id || data._id)) || '');
  return { ok: true, id };
}

module.exports = { login, registerAlumno };
