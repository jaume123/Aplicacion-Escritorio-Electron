export class AuthModel {
  #isLoggedIn = false;
  #user = null;
  #ipc = null;
  #token = null; // Variable para almacenar el token JWT

  get isLoggedIn() {
    return this.#isLoggedIn;
  }
  get user() {
    return this.#user;
  }

  #ensureIPC() {
    if (this.#ipc) return;
    // Renderer: access ipcRenderer via nodeIntegration
    try {
      this.#ipc = window.require("electron").ipcRenderer;
    } catch (err) {
      throw new Error("IPC no disponible en el renderer.");
    }
  }

  async login(dni, password) {
    const dniNorm = String(dni || "").trim().toUpperCase();
    const pass = String(password || "").trim();
    if (!dniNorm || !pass) throw new Error("Credenciales inválidas");
    try {
      const response = await fetch("http://localhost:8080/api/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni: dniNorm, password: pass }),
      });
      const result = await response.json();
      if (response.ok) {
        this.#isLoggedIn = true;
        // Normaliza el usuario que llega de la API (nombres de campos y rol)
        const raw = result.usuario || {};
        const roleMap = {
          ALUMNO: "alumno",
          PROFESOR: "professor",
          ADMIN: "admin",
        };
        const normalized = {
          ...raw,
          email: raw.gmail || raw.email || "",
          role: roleMap[String(raw.rol || raw.role || "").toUpperCase()] || String(raw.rol || raw.role || "alumno").toLowerCase(),
        };
        this.#user = normalized;
        this.#token = result.token; // Almacenar el token
        try { localStorage.setItem('wf_jwt', String(this.#token||'')); } catch {}
        // Registrar entrada de sesión en la app
        this.registrarAccesoApp('entrada');
        return { ...result, usuario: normalized };
      }
      throw new Error(result.error || "Error de acceso");
    } catch (err) {
      throw new Error(err.message || "Error de acceso");
    }
  }

  async fetchWithAuth(url, options = {}) {
    if (!this.#token)
      throw new Error("No se encontró un token de autenticación.");

    const headers = options.headers || {};
    headers["Authorization"] = `Bearer ${this.#token}`;
    options.headers = headers;

    const response = await fetch(url, options);
    if (!response.ok) {
      const errorResponse = await response.text();
      try {
        const errorJson = JSON.parse(errorResponse);
        throw new Error(errorJson.error || "Error desconocido");
      } catch (e) {
        throw new Error(errorResponse || "Error desconocido");
      }
    }
    return response.json();
  }

  // Permite fijar sesión desde un token (por ejemplo, login NFC)
  setSession(user, token) {
    const raw = user || {};
    const roleMap = { ALUMNO: 'alumno', PROFESOR: 'professor', ADMIN: 'admin' };
    const normalized = {
      ...raw,
      email: raw.gmail || raw.email || '',
      role: roleMap[String(raw.rol || raw.role || '').toUpperCase()] || String(raw.rol || raw.role || 'alumno').toLowerCase(),
    };
    this.#isLoggedIn = true;
    this.#user = normalized;
    this.#token = token || null;
    try { localStorage.setItem('wf_jwt', String(this.#token||'')); } catch {}
    // Registrar entrada también cuando el login es por NFC
    this.registrarAccesoApp('entrada');
    return { usuario: normalized, token: this.#token };
  }

  // Registro de entrada/salida asociado a la sesión actual de la app
  async registrarAccesoApp(tipo = 'entrada') {
    return AuthModel.registrarAccesoAppForUser(this.#user, tipo);
  }

  // Helper estático reutilizable (desde HomeController, etc.)
  static async registrarAccesoAppForUser(user, tipo = 'salida') {
    if (!user) return;
    const userId = user.id || user._id;
    if (!userId) return;
    let token = null;
    try { token = localStorage.getItem('wf_jwt'); } catch {
      token = null;
    }
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    try {
      await fetch('http://localhost:8080/api/usuarios/registrar-entrada-salida-app', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, tipo }),
        keepalive: true,
      });
    } catch {
      // Silenciar errores: no bloquear flujo de login/logout
    }
  }

  async registerAlumno(payload) {
    const emailNorm = String(payload.email || "")
      .trim()
      .toLowerCase();
    const pass = String(payload.password || "").trim();
    if (!emailNorm || !pass) throw new Error("Completa correo y contraseña.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm))
      throw new Error("El correo no es válido.");
    payload.email = emailNorm;
    payload.password = pass;
    payload.nombre = String(payload.nombre || "").trim();
    payload.apellidos = String(payload.apellidos || "").trim();
    payload.dni = String(payload.dni || "")
      .trim()
      .toUpperCase();
    payload.fechaNacimiento = String(payload.fechaNacimiento || "").trim();
    payload.rol = "ALUMNO"; // Asignar rol predeterminado
    try {
      const response = await fetch(
        "http://localhost:8080/api/usuarios/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();
      if (response.ok) {
        return result;
      }
      throw new Error(result.message || "Error al registrar alumno");
    } catch (err) {
      throw new Error(err.message || "Error al registrar alumno");
    }
  }

  // Registro de usuario desde panel admin/profesor (alumno o profesor)
  static async registerUsuarioAdmin(params) {
    const {
      nombre,
      apellidos,
      dni,
      email,
      fechaNacimiento,
      password,
      role,
    } = params || {};

    const emailNorm = String(email || "").trim().toLowerCase();
    const pass = String(password || "123456").trim();
    if (!emailNorm || !pass) throw new Error("Completa correo y contraseña.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      throw new Error("El correo no es válido.");
    }

    const body = {
      nombre: String(nombre || "").trim(),
      apellidos: String(apellidos || "").trim(),
      dni: String(dni || "").trim().toUpperCase(),
      gmail: emailNorm,
      fechaNacimiento: String(fechaNacimiento || "").trim(),
      password: pass,
      rol: String(role === "professor" ? "PROFESOR" : "ALUMNO"),
    };

    try {
      const response = await fetch(
        "http://localhost:8080/api/usuarios/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* noop */ }

      if (!response.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          (text && text.trim()) ||
          `HTTP ${response.status}`;
        return { ok: false, error: msg };
      }

      const usuario = data && (data.usuario || data.user || null);
      const id = usuario && (usuario.id || usuario._id || usuario.userId || null);
      return {
        ok: true,
        id: id ? String(id) : undefined,
        usuario,
        nfcToken: data ? data.nfcToken : undefined,
      };
    } catch (err) {
      return { ok: false, error: err.message || "Error creando usuario" };
    }
  }

  logout() {
    this.#isLoggedIn = false;
    this.#user = null;
    this.#token = null;
    try { localStorage.removeItem('wf_jwt'); } catch {}
  }
}
