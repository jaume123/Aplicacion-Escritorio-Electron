// Modelo de Autenticación (MVC)
// - Gestiona estado de sesión (stub temporal)
// - En el futuro delegará a API REST (ADA)

export class AuthModel {
  #isLoggedIn = false;
  #user = null;

  get isLoggedIn() { return this.#isLoggedIn; }
  get user() { return this.#user; }

  // Simula login (se reemplazará por llamada al backend)
  async login(email, password) {
    // Simulación de latencia
    await new Promise((r) => setTimeout(r, 400));
    // Regla mínima para demo: aceptar cualquier combinación válida
    if (!email || !password) throw new Error('Credenciales inválidas');
    // Estado de sesión
    this.#isLoggedIn = true;
    this.#user = { email };
    return { ok: true, user: this.#user };
  }

  // Placeholder del registro (siguiente paso futuro)
  async register() {
    await new Promise((r) => setTimeout(r, 200));
    return { ok: false, message: 'Registro pendiente de implementar.' };
  }

  logout() {
    this.#isLoggedIn = false;
    this.#user = null;
  }
}
