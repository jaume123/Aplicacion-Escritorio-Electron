// Controlador de Autenticación (MVC)
// - Orquesta LoginView y AuthModel
// - No renderiza HTML ni persiste directamente

import { LoginView } from "../view/loginView.js";
import { AuthModel } from "../model/authModel.js";
import { HomeController } from "./homeController.js";

/**
 * Controlador de autenticación
 * - Orquesta LoginView y AuthModel
 * - Gestiona login/registro y transición a HomeController
 */
export class AuthController {
  #view;
  #model;

  constructor() {
    this.#view = new LoginView("#app");
    this.#model = new AuthModel();
  }

  /**
   * Renderiza la vista de login y conecta callbacks.
   */
  init() {
    // Si no hay sesión, mostrar login
    if (!this.#model.isLoggedIn) {
      this.#view.bind({
        // Acepta login normal (dni/password) o directo por NFC (token)
        onLogin: (payload) => {
          if (payload?.nfcAuth) {
            this.#handleNfcLogin(payload.nfcAuth);
          } else {
            const { dni, username, email, password, remember } = payload || {};
            this.#handleLogin(dni || username || email, password, remember);
          }
        },
        onRegister: (payload) => {
          payload.gmail = payload.email; // Copiar email a gmail para el registro
          this.#handleRegister(payload);
        },
      });
      this.#view.render();
    }
  }

  /**
   * Maneja el envío de login: valida, guarda preferencia y navega a Home.
   */
  async #handleLogin(dni, password, remember = false) {
    try {
      const result = await this.#model.login(dni, password);
      if (result && result.usuario) {
        // Guardar/limpiar sesión recordada según la preferencia
        try {
          if (remember) {
            const payload = {
              dni: dni,
              password,
              autoLogin: true,
              ts: Date.now(),
            };
            localStorage.setItem("wf_saved_session", JSON.stringify(payload));
          } else {
            localStorage.removeItem("wf_saved_session");
          }
        } catch {}
        // Navegar a Home/Dashboard según rol (MVC)
        const home = new HomeController(result.usuario);
        home.init();
        // Asegurar que la escucha NFC del login se detiene
        try { const { ipcRenderer } = window.require ? window.require('electron') : {}; ipcRenderer?.send('nfc:detener-escucha'); } catch {}
      }
    } catch (e) {
      // Re-render y mostrar error simple en la vista
      this.#view.render();
      const el = document.querySelector("#error");
      if (el) {
        el.textContent = e.message || "Error de acceso";
        el.hidden = false;
      }
    }
  }

  // Maneja sesión directa tras autenticación por NFC (ya con JWT)
  #handleNfcLogin(auth) {
    try {
      const { usuario, token } = auth || {};
      const sess = this.#model.setSession(usuario, token);
      const home = new HomeController(sess.usuario);
      home.init();
      try { const { ipcRenderer } = window.require ? window.require('electron') : {}; ipcRenderer?.send('nfc:detener-escucha'); } catch {}
    } catch (e) {
      this.#view.render();
      const el = document.querySelector('#error');
      if (el) {
        el.textContent = e.message || 'Error en login NFC';
        el.hidden = false;
      }
    }
  }

  /**
   * Maneja el envío de registro de alumno y vuelve a la vista de login.
   */
  async #handleRegister(payload) {
    try {
      const res = await this.#model.registerAlumno(payload);
      console.log("Respuesta de la API:", res); // Log para depuración
      if (res?.usuario) {
        // Validar si la respuesta contiene la propiedad 'usuario'
        console.log("Registro exitoso, mostrando popup"); // Log para depuración
        this.#view.render();
        this.#view.showPopup("Usuario registrado con éxito", "success", () => {
          console.log("Redirigiendo al login"); // Log para depuración
          this.#view.switchToLogin();
        });
      } else {
        throw new Error("La respuesta de la API no es válida");
      }
    } catch (e) {
      console.error("Error durante el registro:", e.message); // Log para depuración
      this.#view.render();
      const el = document.querySelector("#error");
      if (el) {
        el.textContent = e.message || "Error al registrar alumno";
        el.hidden = false;
      }
    }
  }

  // Pequeño helper de toast para evitar alert nativo
  #showToast(text, type = "info") {
    const wrap =
      document.querySelector(".app-toast-wrap") ||
      (() => {
        const w = document.createElement("div");
        w.className = "app-toast-wrap";
        document.body.appendChild(w);
        return w;
      })();
    const el = document.createElement("div");
    el.className = `app-toast ${type}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add("show");
    }, 10);
    setTimeout(() => {
      el.classList.remove("show");
      el.addEventListener("transitionend", () => el.remove(), { once: true });
    }, 3200);
  }
}
