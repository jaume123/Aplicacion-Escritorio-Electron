// Vista de Login (MVC)
// - Encargada de renderizar el formulario y emitir eventos
// - No contiene lógica de negocio

/**
 * Vista de Login
 * - Renderiza formulario de acceso/registro
 * - Suscribe escucha NFC continua en modo login para auto-login
 */
export class LoginView {
  #root;
  #onLogin;
  #onRegister;
  #elements = {};
  #mode = "login"; // 'login' | 'register'
  #nfcSubscribed = false;
  #nfcHandler = null;
  #nfcLogging = false;

  constructor(rootSelector = "#app") {
    this.#root = document.querySelector(rootSelector);
  }

  // Asigna callbacks del controlador
  /** Asigna callbacks del controlador. */
  bind({ onLogin, onRegister }) {
    this.#onLogin = onLogin;
    this.#onRegister = onRegister;
  }

  // Renderiza la tarjeta según el modo actual
  /**
   * Renderiza la tarjeta (login/register), vincula eventos y gestiona NFC.
   */
  render() {
    if (!this.#root) throw new Error("No se encontró el contenedor raíz #app");
    // Marca el contenedor raíz como modo login para centrar la tarjeta
    this.#root.classList.add("is-login");
    const isRegister = this.#mode === "register";
    const cardClass = isRegister ? "login-card register" : "login-card";
    const title = isRegister
      ? "Crear cuenta (Alumno)"
      : "Web Familia · Escritorio";
    const subtitle = isRegister
      ? "Completa tus datos para registrarte"
      : "Accede con tu DNI y contraseña";

    this.#root.innerHTML = `
      <section class="${cardClass}" aria-label="${isRegister ? "Registro" : "Acceso"}">
        <div class="header">
          <div class="logo" aria-hidden="true">WF</div>
          <div class="title">${title}</div>
        </div>
        <p class="subtitle">${subtitle.replace("usuario", "correo")}</p>
        <form id="login-form" novalidate>
          ${
            isRegister
              ? `
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
              <input class="input" id="gmail" name="gmail" type="email" placeholder=" " required />
              <label class="label" for="gmail">Gmail</label>
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
          `
              : ""
          }
          ${
            isRegister
              ? ""
              : `
          <div class="form-group">
            <div class="field">
              <input class="input" id="dni" name="dni" type="text" placeholder=" " required />
              <label class="label" for="dni">DNI</label>
              <span class="focus-bg"></span>
            </div>
          </div>
          `
          }
       
          <div class="form-group">
            <div class="field">
              <input class="input" id="password" name="password" type="password" placeholder=" " autocomplete="current-password" required />
              <label class="label" for="password">Contraseña</label>
              <span class="focus-bg"></span>
            </div>
          </div>
          ${
            isRegister
              ? ""
              : `
          <div class="form-group options">
            <label class="checkbox switch">
              <input type="checkbox" id="auto-login" />
              <span class="slider" aria-hidden="true"></span>
              <span class="label-text">Guardar inicio de sesión</span>
            </label>
          </div>
          `
          }
          <div class="actions">
            ${
              isRegister
                ? `
              <button id="btn-submit-register" class="btn btn-primary" type="submit">Crear cuenta</button>
              <button id="btn-back" class="btn btn-secondary" type="button">Volver a Login</button>
            `
                : `
              <button id="btn-login" class="btn btn-primary" type="submit">Iniciar sesión</button>
              <button id="btn-register" class="btn btn-secondary" type="button">Registrarse</button>
            `
            }
          </div>
          <div class="helper">${isRegister ? "Los profesores y admin se crean desde la base de datos." : "Pulsa Enter o el botón para iniciar sesión."}</div>
          <div id="error" class="error" role="alert" aria-live="polite" hidden></div>
        </form>
      </section>
    `;

    // Cache de elementos
    this.#elements.form = this.#root.querySelector("#login-form");
    this.#elements.dni = this.#root.querySelector("#dni");
    this.#elements.gmail = this.#root.querySelector("#gmail");
    this.#elements.password = this.#root.querySelector("#password");
    this.#elements.btnLogin = this.#root.querySelector("#btn-login");
    this.#elements.btnRegister = this.#root.querySelector("#btn-register");
    this.#elements.btnSubmitRegister = this.#root.querySelector(
      "#btn-submit-register",
    );
    this.#elements.btnBack = this.#root.querySelector("#btn-back");
    this.#elements.autoLogin = this.#root.querySelector("#auto-login");
    // Carga sesión guardada: auto-relleno y opcional auto-login
    this.#loadSavedSession();
    this.#elements.error = this.#root.querySelector("#error");

    // Eventos UI → Controller
    this.#elements.form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (this.#mode === "login") {
        const dni = this.#elements.dni.value.trim();
        const password = this.#elements.password.value.trim();
        const remember = !!this.#elements.autoLogin?.checked;
        const validation = this.#validateLogin(dni, password);
        if (!validation.ok) return this.#showError(validation.message);
        this.#clearError();
        if (typeof this.#onLogin === "function")
          this.#onLogin({ dni, password, remember });
      } else {
        const payload = this.#collectRegisterPayload();
        const validation = this.#validateRegister(payload);
        if (!validation.ok) return this.#showError(validation.message);
        this.#clearError();
        if (typeof this.#onRegister === "function") this.#onRegister(payload);
      }
    });

    // Enviar con Enter desde contraseña
    this.#elements.password.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        this.#elements.form.requestSubmit();
      }
    });

    if (this.#elements.btnRegister) {
      this.#elements.btnRegister.addEventListener("click", () => {
        this.#mode = "register";
        this.render();
      });
    }
    if (this.#elements.btnBack) {
      this.#elements.btnBack.addEventListener("click", () => {
        this.#mode = "login";
        this.render();
      });
    }

    // Animación de entrada de la tarjeta
    const card = this.#root.querySelector(".login-card");
    if (card) {
      requestAnimationFrame(() => {
        card.classList.add("mounted");
      });
    }

    // Efecto luminoso: la "focus-bg" sigue el puntero (mejora visual futurista)
    this.#root.querySelectorAll(".field").forEach((field) => {
      const bg = field.querySelector(".focus-bg");
      if (!bg) return;
      const update = (ev) => {
        const rect = field.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 100;
        const y = ((ev.clientY - rect.top) / rect.height) * 100;
        bg.style.setProperty("--x", `${x}%`);
        bg.style.setProperty("--y", `${y}%`);
      };
      field.addEventListener("pointermove", update);
      field.addEventListener("pointerenter", update);
    });

    // --- INICIO DE SESIÓN AUTOMÁTICO POR NFC (ESCUCHA CONTINUA) ---
    try {
      const { ipcRenderer } = window.require ? window.require("electron") : {};
      if (ipcRenderer) {
        // Si cambiamos a modo registro y había suscripción, limpiar
        if (this.#mode !== "login" && this.#nfcSubscribed) {
          ipcRenderer.send("nfc:detener-escucha");
          if (this.#nfcHandler)
            ipcRenderer.removeListener("nfc:uid", this.#nfcHandler);
          this.#nfcSubscribed = false;
          this.#nfcHandler = null;
          this.#nfcLogging = false;
        }

        if (this.#mode === "login" && !this.#nfcSubscribed) {
          this.#nfcHandler = async (_event, uid) => {
            if (this.#nfcLogging) return; // evitar reentradas
            this.#nfcLogging = true;
            try {
              const response = await ipcRenderer.invoke("nfc:login", uid);
              if (response && response.ok && response.auth) {
                // Registrar entrada/salida y continuar con sesión directa
                const jwt = (()=>{ try { return localStorage.getItem('wf_jwt'); } catch { return null; } })();
                await ipcRenderer.invoke("nfc:registrar-entrada-salida", { uid, token: jwt });
                if (typeof this.#onLogin === "function") {
                  this.#onLogin({ nfcAuth: response.auth });
                }
              } else {
                const msg = response?.error || "NFC no asociado a ningún usuario.";
                this.#showError(msg);
                this.#nfcLogging = false;
              }
            } catch (err) {
              this.#showError(err?.message || "Error en login por NFC");
              this.#nfcLogging = false;
            }
          };

          ipcRenderer.on("nfc:uid", this.#nfcHandler);
          ipcRenderer.send("nfc:escuchar-login");
          this.#nfcSubscribed = true;
        }
      }
    } catch {}
  }
  // Carga y aplica la sesión guardada
  /** Carga y aplica sesión guardada (email/password) si existe. */
  #loadSavedSession() {
    try {
      const raw = localStorage.getItem("wf_saved_session");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.dni && this.#elements.dni) this.#elements.dni.value = data.dni;
      if (data?.password && this.#elements.password) this.#elements.password.value = data.password;
      if (this.#elements.autoLogin)
        this.#elements.autoLogin.checked = !!data?.autoLogin;
      // Solo auto-rellenar; no iniciar sesión automáticamente
    } catch {}
  }

  // Validación Login
  /** Valida campos de login. */
  #validateLogin(dni, password) {
    if (!dni || !password) {
      return { ok: false, message: "Introduce DNI y contraseña." };
    }
    return { ok: true };
  }

  // Recolecta datos del formulario de registro
  /** Recolecta campos del formulario de registro. */
  #collectRegisterPayload() {
    const get = (id) => this.#root.querySelector("#" + id)?.value.trim() || "";
    return {
      nombre: get("nombre"),
      apellidos: get("apellidos"),
      dni: get("dni"),
      fechaNacimiento: get("fechaNacimiento"),
      email: get("gmail"), // Cambiado de 'email' a 'gmail'
      password: get("password"),
    };
  }

  // Validación Registro
  /** Valida formulario de registro de alumno. */
  #validateRegister(p) {
    if (!p.nombre || !p.apellidos)
      return { ok: false, message: "Nombre y apellidos son obligatorios." };
    const dniRe = /^[0-9]{7,8}[A-Za-z]?$/; // formato básico
    if (!dniRe.test(p.dni)) return { ok: false, message: "DNI no válido." };
    if (!p.fechaNacimiento)
      return { ok: false, message: "Fecha de nacimiento es obligatoria." };
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(p.email))
      return { ok: false, message: "El correo no es válido." };
    if (!p.password)
      return { ok: false, message: "La contraseña es obligatoria." };
    return { ok: true };
  }

  // Mensajes de error accesibles
  /** Muestra error accesible con animación. */
  #showError(msg) {
    this.#elements.error.textContent = msg;
    this.#elements.error.hidden = false;
    this.#elements.error.classList.remove("shake");
    // Reinicia animación de sacudida
    void this.#elements.error.offsetWidth;
    this.#elements.error.classList.add("shake");
  }

  /** Limpia error mostrado. */
  #clearError() {
    this.#elements.error.textContent = "";
    this.#elements.error.hidden = true;
  }

  // API pública de la vista, por si se necesita limpiar
  /** Limpia el contenedor raíz. */
  clear() {
    if (this.#root) this.#root.innerHTML = "";
  }

  /**
   * Muestra un mensaje emergente con un botón de confirmación.
   * @param {string} message - Mensaje a mostrar en el popup.
   * @param {string} type - Tipo de mensaje ('success', 'error', etc.).
   * @param {Function} onConfirm - Callback al hacer clic en 'OK'.
   */
  showPopup(message, type = "info", onConfirm) {
    console.log("showPopup ejecutado con mensaje:", message); // Log para depuración
    // Usa el mismo modal estilizado que el Home para coherencia visual
    const backdrop = document.createElement("div");
    backdrop.className = "app-modal-backdrop";
    backdrop.innerHTML = `
      <div class="app-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="app-modal-title" id="modal-title">Registro completado</div>
        <div class="app-modal-body">${message}</div>
        <div class="app-modal-actions">
          <button class="btn" id="modal-ok">Ir al login</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const cleanup = () => { try { backdrop.remove(); } catch {} };
    const okBtn = backdrop.querySelector("#modal-ok");
    okBtn?.addEventListener("click", () => {
      cleanup();
      if (typeof onConfirm === "function") onConfirm();
    });
    // Cerrar al hacer click fuera del cuadro
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop) cleanup();
    });
  }

  /**
   * Cambia al modo login y renderiza la vista.
   */
  switchToLogin() {
    this.#mode = "login";
    this.render();
  }
}
