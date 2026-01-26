// Vista de Login (MVC)
// - Encargada de renderizar el formulario y emitir eventos
// - No contiene lógica de negocio

export class LoginView {
  #root;
  #onLogin;
  #onRegister;
  #elements = {};
  #mode = 'login'; // 'login' | 'register'

  constructor(rootSelector = '#app') {
    this.#root = document.querySelector(rootSelector);
  }

  // Asigna callbacks del controlador
  bind({ onLogin, onRegister }) {
    this.#onLogin = onLogin;
    this.#onRegister = onRegister;
  }

  // Renderiza la tarjeta según el modo actual
  render() {
    if (!this.#root) throw new Error('No se encontró el contenedor raíz #app');
    const isRegister = this.#mode === 'register';
    const cardClass = isRegister ? 'login-card register' : 'login-card';
    const title = isRegister ? 'Crear cuenta (Alumno)' : 'Web Familia · Escritorio';
    const subtitle = isRegister ? 'Completa tus datos para registrarte' : 'Accede con tu usuario y contraseña';

    this.#root.innerHTML = `
      <section class="${cardClass}" aria-label="${isRegister ? 'Registro' : 'Acceso'}">
        <div class="header">
          <div class="logo" aria-hidden="true">WF</div>
          <div class="title">${title}</div>
        </div>
        <p class="subtitle">${subtitle.replace('usuario', 'correo')}</p>
        <form id="login-form" novalidate>
          ${isRegister ? `
          <div class="form-group">
            <div class="field">
              <input class="input" id="nombre" name="nombre" type="text" placeholder=" " required />
              <label class="label" for="nombre">Nombre</label>
              <span class="focus-bg"></span>
            </div>
          </div>
          <div class="form-group">
            <div class="field">
              <input class="input" id="apellidos" name="apellidos" type="text" placeholder=" " required />
              <label class="label" for="apellidos">Apellidos</label>
              <span class="focus-bg"></span>
            </div>
          </div>
          <div class="form-group">
            <div class="field">
              <input class="input" id="dni" name="dni" type="text" placeholder=" " required />
              <label class="label" for="dni">DNI</label>
              <span class="focus-bg"></span>
            </div>
          </div>
          <div class="form-group">
            <div class="field">
              <input class="input" id="fechaNacimiento" name="fechaNacimiento" type="date" placeholder=" " required />
              <label class="label" for="fechaNacimiento">Fecha de nacimiento</label>
              <span class="focus-bg"></span>
            </div>
          </div>
          ` : ''}
          <div class="form-group">
            <div class="field">
              <input class="input" id="email" name="email" type="email" placeholder=" " autocomplete="email" required />
              <label class="label" for="email">Correo</label>
              <span class="focus-bg"></span>
            </div>
          </div>
          <div class="form-group">
            <div class="field">
              <input class="input" id="password" name="password" type="password" placeholder=" " autocomplete="current-password" required />
              <label class="label" for="password">Contraseña</label>
              <span class="focus-bg"></span>
            </div>
          </div>
          <div class="actions">
            ${isRegister ? `
              <button id="btn-submit-register" class="btn btn-primary" type="submit">Crear cuenta</button>
              <button id="btn-back" class="btn btn-secondary" type="button">Volver a Login</button>
            ` : `
              <button id="btn-login" class="btn btn-primary" type="submit">Login</button>
              <button id="btn-register" class="btn btn-secondary" type="button">Register</button>
            `}
          </div>
          <div id="error" class="error" role="alert" aria-live="polite" hidden></div>
          ${isRegister ? '<div class="helper">Los profesores y admin se crean desde la base de datos.</div>' : '<div class="helper">Si no tienes cuenta, pulsa Register</div>'}
        </form>
      </section>
    `;

    // Cache de elementos
    this.#elements.form = this.#root.querySelector('#login-form');
    this.#elements.email = this.#root.querySelector('#email');
    this.#elements.password = this.#root.querySelector('#password');
    this.#elements.btnLogin = this.#root.querySelector('#btn-login');
    this.#elements.btnRegister = this.#root.querySelector('#btn-register');
    this.#elements.btnSubmitRegister = this.#root.querySelector('#btn-submit-register');
    this.#elements.btnBack = this.#root.querySelector('#btn-back');
    this.#elements.error = this.#root.querySelector('#error');

    // Eventos UI → Controller
    this.#elements.form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (this.#mode === 'login') {
        const email = this.#elements.email.value.trim();
        const password = this.#elements.password.value.trim();
        const validation = this.#validateLogin(email, password);
        if (!validation.ok) return this.#showError(validation.message);
        this.#clearError();
        if (typeof this.#onLogin === 'function') this.#onLogin({ email, password });
      } else {
        const payload = this.#collectRegisterPayload();
        const validation = this.#validateRegister(payload);
        if (!validation.ok) return this.#showError(validation.message);
        this.#clearError();
        if (typeof this.#onRegister === 'function') this.#onRegister(payload);
      }
    });

    if (this.#elements.btnRegister) {
      this.#elements.btnRegister.addEventListener('click', () => {
        this.#mode = 'register';
        this.render();
      });
    }

    if (this.#elements.btnBack) {
      this.#elements.btnBack.addEventListener('click', () => {
        this.#mode = 'login';
        this.render();
      });
    }

    // Animación de entrada de la tarjeta
    const card = this.#root.querySelector('.login-card');
    if (card) {
      requestAnimationFrame(() => {
        card.classList.add('mounted');
      });
    }

    // Efecto luminoso: la "focus-bg" sigue el puntero (mejora visual futurista)
    this.#root.querySelectorAll('.field').forEach((field) => {
      const bg = field.querySelector('.focus-bg');
      if (!bg) return;
      const update = (ev) => {
        const rect = field.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 100;
        const y = ((ev.clientY - rect.top) / rect.height) * 100;
        bg.style.setProperty('--x', `${x}%`);
        bg.style.setProperty('--y', `${y}%`);
      };
      field.addEventListener('pointermove', update);
      field.addEventListener('pointerenter', update);
    });
  }

  // Validación Login
  #validateLogin(email, password) {
    if (!email || !password) {
      return { ok: false, message: 'Completa correo y contraseña.' };
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      return { ok: false, message: 'El correo no es válido.' };
    }
    return { ok: true };
  }

  // Recolecta datos del formulario de registro
  #collectRegisterPayload() {
    const get = (id) => this.#root.querySelector('#' + id)?.value.trim() || '';
    return {
      nombre: get('nombre'),
      apellidos: get('apellidos'),
      dni: get('dni'),
      fechaNacimiento: get('fechaNacimiento'),
      email: get('email'),
      password: get('password'),
    };
  }

  // Validación Registro
  #validateRegister(p) {
    if (!p.nombre || !p.apellidos) return { ok: false, message: 'Nombre y apellidos son obligatorios.' };
    const dniRe = /^[0-9]{7,8}[A-Za-z]?$/; // formato básico
    if (!dniRe.test(p.dni)) return { ok: false, message: 'DNI no válido.' };
    if (!p.fechaNacimiento) return { ok: false, message: 'Fecha de nacimiento es obligatoria.' };
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(p.email)) return { ok: false, message: 'El correo no es válido.' };
    if (!p.password) return { ok: false, message: 'La contraseña es obligatoria.' };
    return { ok: true };
  }

  // Mensajes de error accesibles
  #showError(msg) {
    this.#elements.error.textContent = msg;
    this.#elements.error.hidden = false;
    this.#elements.error.classList.remove('shake');
    // Reinicia animación de sacudida
    void this.#elements.error.offsetWidth;
    this.#elements.error.classList.add('shake');
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
