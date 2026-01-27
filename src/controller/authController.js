// Controlador de Autenticación (MVC)
// - Orquesta LoginView y AuthModel
// - No renderiza HTML ni persiste directamente

import { LoginView } from '../view/loginView.js';
import { AuthModel } from '../model/authModel.js';
import { HomeController } from './homeController.js';

export class AuthController {
  #view;
  #model;

  constructor() {
    this.#view = new LoginView('#app');
    this.#model = new AuthModel();
  }

  init() {
    // Si no hay sesión, mostrar login
    if (!this.#model.isLoggedIn) {
      this.#view.bind({
        onLogin: ({ email, password, remember }) => this.#handleLogin(email, password, remember),
        onRegister: (payload) => this.#handleRegister(payload),
      });
      this.#view.render();
    }
  }

  async #handleLogin(email, password, remember = false) {
    try {
      const result = await this.#model.login(email, password);
      if (result.ok) {
        // Guardar/limpiar sesión recordada según la preferencia
        try {
          if (remember) {
            const payload = { email, password, autoLogin: true, ts: Date.now() };
            localStorage.setItem('wf_saved_session', JSON.stringify(payload));
          } else {
            localStorage.removeItem('wf_saved_session');
          }
        } catch {}
        // Navegar a Home/Dashboard según rol (MVC)
        const home = new HomeController(result.user);
        home.init();
      }
    } catch (e) {
      // Re-render y mostrar error simple en la vista
      this.#view.render();
      const el = document.querySelector('#error');
      if (el) {
        el.textContent = e.message || 'Error de acceso';
        el.hidden = false;
      }
    }
  }

  async #handleRegister(payload) {
    try {
      const res = await this.#model.registerAlumno(payload);
      if (res?.ok) {
        // Tras registrarse como alumno, volver al login
        alert('Alumno registrado correctamente. Ya puedes iniciar sesión.');
        this.#view.render();
      }
    } catch (e) {
      this.#view.render();
      const el = document.querySelector('#error');
      if (el) {
        el.textContent = e.message || 'Error al registrar alumno';
        el.hidden = false;
      }
    }
  }
}
