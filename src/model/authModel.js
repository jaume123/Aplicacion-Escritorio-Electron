export class AuthModel {
  #isLoggedIn = false;
  #user = null;
  #ipc = null;

  get isLoggedIn() { return this.#isLoggedIn; }
  get user() { return this.#user; }

  #ensureIPC() {
    if (this.#ipc) return;
    // Renderer: access ipcRenderer via nodeIntegration
    try {
      this.#ipc = window.require('electron').ipcRenderer;
    } catch (err) {
      throw new Error('IPC no disponible en el renderer.');
    }
  }

  async login(email, password) {
    this.#ensureIPC();
    const emailNorm = String(email || '').trim().toLowerCase();
    const pass = String(password || '').trim();
    if (!emailNorm || !pass) throw new Error('Credenciales inválidas');
    try {
      const result = await this.#ipc.invoke('auth:login', { email: emailNorm, password: pass });
      if (result?.ok) {
        this.#isLoggedIn = true;
        this.#user = result.user;
        return result;
      }
      throw new Error('Error de acceso');
    } catch (err) {
      throw new Error(err.message || 'Error de acceso');
    }
  }

  async registerAlumno(email, password) {
    this.#ensureIPC();
    // Permitir tanto (email, password) como objeto completo
    let payload;
    if (typeof email === 'object') {
      payload = { ...email };
    } else {
      payload = { email, password };
    }
    const emailNorm = String(payload.email || '').trim().toLowerCase();
    const pass = String(payload.password || '').trim();
    if (!emailNorm || !pass) throw new Error('Completa correo y contraseña.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) throw new Error('El correo no es válido.');
    // Normaliza campos adicionales
    payload.email = emailNorm;
    payload.password = pass;
    payload.nombre = String(payload.nombre || '').trim();
    payload.apellidos = String(payload.apellidos || '').trim();
    payload.dni = String(payload.dni || '').trim().toUpperCase();
    payload.fechaNacimiento = String(payload.fechaNacimiento || '').trim();
    try {
      const res = await this.#ipc.invoke('auth:registerAlumno', payload);
      return res;
    } catch (err) {
      throw new Error(err.message || 'Error al registrar alumno');
    }
  }

  logout() {
    this.#isLoggedIn = false;
    this.#user = null;
  }
}
