import { HomeView } from '../view/homeView.js';
import { LoadingView } from '../view/loadingView.js';

export class HomeController {
  #view;
  #loading;
  #user;

  constructor(user) {
    this.#user = user;
    this.#view = new HomeView('#app', user);
    this.#loading = new LoadingView('#app');
  }

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

  #bind() {
    // Cerrar sesión: volver a la pantalla de login
    const btnLogout = document.querySelector('#btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        import('./authController.js').then(({ AuthController }) => {
          const auth = new AuthController();
          auth.init();
        }).catch(() => {
          // Fallback simple: recargar la página para volver al flujo inicial
          window.location.reload();
        });
      });
    }
  }
}
