// Vista de Login (MVC)
// - Encargada de renderizar el formulario y emitir eventos
// - No contiene lógica de negocio

export class LoginView {
  #root;
  #onLogin;
  #onRegister;
  #elements = {};

  constructor(rootSelector = '#app') {
    this.#root = document.querySelector(rootSelector);
  }

  // Asigna callbacks del controlador
  bind({ onLogin, onRegister }) {
    this.#onLogin = onLogin;
    this.#onRegister = onRegister;
  }

  // Renderiza la tarjeta de login
  render() {
    if (!this.#root) throw new Error('No se encontró el contenedor raíz #app');

    this.#root.innerHTML = `
      <section class="login-card" aria-label="Acceso">
        <div class="header">
          <div class="logo" aria-hidden="true">WF</div>
          <div class="title">Web Familia · Escritorio</div>
        </div>
        <p class="subtitle">Accede con tu correo y contraseña</p>
        <form id="login-form" novalidate>
          <div class="form-group">
            <label class="label" for="email">Correo</label>
            <input class="input" id="email" name="email" type="email" placeholder="tu@correo.com" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label class="label" for="password">Contraseña</label>
            <input class="input" id="password" name="password" type="password" placeholder="••••••••" autocomplete="current-password" required />
          </div>
          <div class="actions">
            <button id="btn-login" class="btn btn-primary" type="submit">Login</button>
            <button id="btn-register" class="btn btn-secondary" type="button">Register</button>
          </div>
          <div id="error" class="error" role="alert" aria-live="polite" hidden></div>
          <div class="helper">Si no tienes cuenta, pulsa Register</div>
        </form>
      </section>
    `;

    // Cache de elementos
    this.#elements.form = this.#root.querySelector('#login-form');
    this.#elements.email = this.#root.querySelector('#email');
    this.#elements.password = this.#root.querySelector('#password');
    this.#elements.btnLogin = this.#root.querySelector('#btn-login');
    this.#elements.btnRegister = this.#root.querySelector('#btn-register');
    this.#elements.error = this.#root.querySelector('#error');

    // Eventos UI → Controller
    this.#elements.form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const email = this.#elements.email.value.trim();
      const password = this.#elements.password.value.trim();
      const validation = this.#validate(email, password);
      if (!validation.ok) {
        this.#showError(validation.message);
        return;
      }
      this.#clearError();
      if (typeof this.#onLogin === 'function') {
        this.#onLogin({ email, password });
      }
    });

    this.#elements.btnRegister.addEventListener('click', () => {
      if (typeof this.#onRegister === 'function') {
        this.#onRegister();
      }
    });
  }

  // Validación simple en la vista (usabilidad)
  #validate(email, password) {
    if (!email || !password) {
      return { ok: false, message: 'Completa correo y contraseña.' };
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return { ok: false, message: 'El correo no es válido.' };
    }
    if (password.length < 6) {
      return { ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
    }
    return { ok: true };
  }

  // Mensajes de error accesibles
  #showError(msg) {
    this.#elements.error.textContent = msg;
    this.#elements.error.hidden = false;
  }

  #clearError() {
    this.#elements.error.textContent = '';
    this.#elements.error.hidden = true;
  }

  // API pública de la vista, por si se necesita limpiar
  clear() {
    if (this.#root) this.#root.innerHTML = '';
  }
}
