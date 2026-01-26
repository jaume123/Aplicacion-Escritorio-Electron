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
        onLogin: ({ email, password }) => this.#handleLogin(email, password),
        onRegister: (payload) => this.#handleRegister(payload),
      });
      this.#view.render();
    }
  }

  async #handleLogin(email, password) {
    try {
      const result = await this.#model.login(email, password);
      if (result.ok) {
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
