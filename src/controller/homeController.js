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
    // Splash de carga breve antes de mostrar el menú principal
    this.#loading.render();
    setTimeout(() => {
      this.#loading.fadeOut();
      setTimeout(() => {
        this.#loading.clear();
        this.#view.render();
      }, 600);
    }, 1200);
  }
}
