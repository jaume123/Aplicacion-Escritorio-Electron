// Controlador de Autenticación (MVC)
// - Orquesta LoginView y AuthModel
// - No renderiza HTML ni persiste directamente

import { LoginView } from '../view/loginView.js';
import { AuthModel } from '../model/authModel.js';

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
        onRegister: () => this.#handleRegister(),
      });
      this.#view.render();
    }
  }

  async #handleLogin(email, password) {
    try {
      const result = await this.#model.login(email, password);
      if (result.ok) {
        // En futuro: navegar a dashboard; por ahora, mensaje mínimo
        const root = document.querySelector('#app');
        if (root) {
          root.innerHTML = `<div style="text-align:center; padding:24px;">\n            <h2>Bienvenido</h2>\n            <p>Has iniciado sesión como <strong>${result.user.email}</strong>.</p>\n            <p>(Siguiente paso: Home/Dashboard)</p>\n          </div>`;
        }
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

  async #handleRegister() {
    // Placeholder: se implementará en el siguiente paso
    alert('Registro: funcionalidad pendiente.');
  }
}
