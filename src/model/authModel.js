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

  async login(username, password) {
    const usernameNorm = String(username || "").trim();
    const pass = String(password || "").trim();
    if (!usernameNorm || !pass) throw new Error("Credenciales inválidas");
    try {
      const response = await fetch("http://localhost:8080/api/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameNorm, password: pass }),
      });
      const result = await response.json();
      if (response.ok) {
        this.#isLoggedIn = true;
        this.#user = result.usuario;
        this.#token = result.token; // Almacenar el token
        return result;
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

  logout() {
    this.#isLoggedIn = false;
    this.#user = null;
  }
}
