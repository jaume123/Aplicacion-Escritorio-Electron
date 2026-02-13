import { HomeView } from '../view/homeView.js';
import { LoadingView } from '../view/loadingView.js';
import { AuthModel } from '../model/authModel.js';

/**
 * Controlador de la pantalla principal (Home)
 * - Muestra splash, renderiza HomeView y maneja acciones globales (logout)
 */
export class HomeController {
  #view;
  #loading;
  #user;

  constructor(user) {
    this.#user = user;
    this.#view = new HomeView('#app', user);
    this.#loading = new LoadingView('#app');
  }

  /**
   * Inicializa la pantalla con un breve splash y luego renderiza HomeView.
   */
  init() {
    // Salimos del modo login: quitar clase de centrado
    try { document.querySelector('#app')?.classList.remove('is-login'); } catch {}
    // Splash de carga breve antes de mostrar el menú principal
    this.#loading.render();
    setTimeout(() => {
      this.#loading.fadeOut();
      setTimeout(() => {
        this.#loading.clear();
        this.#view.render();
        this.#bind();
      }, 600);
    }, 1200);
  }

  /**
   * Vincula manejadores globales (delegación de cierre de sesión con confirmación).
   */
  #bind() {
    // Cerrar sesión: delegación global para que funcione tras re-render
    const handler = async (ev) => {
      const btn = ev.target?.closest?.('#btn-logout');
      if (!btn) return;
      // Modal de confirmación estilizado (reutiliza clases del HomeView)
      const confirmLogout = () => new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'app-modal-backdrop';
        modal.innerHTML = `
          <div class="app-modal">
            <div class="app-modal-title">Cerrar sesión</div>
            <div class="app-modal-body">¿Seguro que quieres cerrar sesión?</div>
            <div class="app-modal-actions">
              <button class="btn btn-ghost" id="modal-cancel">Cancelar</button>
              <button class="btn" id="modal-ok">Cerrar sesión</button>
            </div>
          </div>`;
        document.body.appendChild(modal);
        const cleanup = () => { try { modal.remove(); } catch {} };
        modal.querySelector('#modal-cancel').onclick = () => { cleanup(); resolve(false); };
        modal.querySelector('#modal-ok').onclick = () => { cleanup(); resolve(true); };
        modal.addEventListener('click', (e) => { if (e.target === modal) { cleanup(); resolve(false); } });
      });
      const ok = await confirmLogout();
      if (!ok) return;
      // Registrar salida de la sesión cuando el usuario cierra sesión explícitamente
      AuthModel.registrarAccesoAppForUser(this.#user, 'salida');
      import('./authController.js').then(({ AuthController }) => {
        const auth = new AuthController();
        auth.init();
      }).catch(() => {
        // Fallback simple: recargar la página para volver al flujo inicial
        window.location.reload();
      });
    };
    // Registrar una sola vez; si ya existe, evitar duplicados
    if (!window.__wfLogoutBound) {
      document.addEventListener('click', handler);
      window.__wfLogoutBound = true;
    }

    // Registrar salida también cuando el usuario cierra la ventana de la app
    if (!window.__wfUnloadBound) {
      window.addEventListener('beforeunload', () => {
        AuthModel.registrarAccesoAppForUser(this.#user, 'salida');
      });
      window.__wfUnloadBound = true;
    }
  }
}
