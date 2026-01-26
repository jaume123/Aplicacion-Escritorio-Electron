export class LoadingView {
  #root;

  constructor(rootSelector = '#app') {
    this.#root = document.querySelector(rootSelector);
  }

  render() {
    if (!this.#root) throw new Error('No se encontró el contenedor raíz #app');
    this.#root.innerHTML = `
      <section class="splash" aria-label="Cargando">
        <div class="splash-bg"></div>
        <div class="splash-content">
          <div class="logo">WF</div>
          <div class="spinner">
            <span></span><span></span><span></span><span></span>
          </div>
          <p class="hint">Preparando tu panel...</p>
        </div>
      </section>
    `;
  }

  fadeOut() {
    const el = this.#root?.querySelector('.splash');
    if (el) {
      el.classList.add('splash-leave');
    }
  }

  clear() {
    if (this.#root) this.#root.innerHTML = '';
  }
}
