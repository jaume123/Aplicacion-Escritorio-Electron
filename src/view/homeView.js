import { AuthModel } from '../model/authModel.js';
import { EventsModel } from '../model/eventsModel.js';

export class HomeView {
  #root;
  #user;
  #state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    section: 'panel',
    horarioMode: 'manana',
  };
  #horario = [];
  #horarios = { manana: [], tarde: [] };
  #cfg = { startHour: 8, endHour: 18, hourHeight: 52, slotMinutes: 15 };
  #events = []; // Eventos de calendario (mes actual)
  #eventsLoaded = false;
  #eventsYear = null;
  #eventsMonth = null;
  #registros = [];
  #usersList = [];
  #usersFilter = { role: 'alumno', q: '' };
  // Gestión NFC (estado y filtros)
  #nfcUsers = [];
  #nfcFilter = { role: 'all', status: 'all', q: '' };
  #menuItems = {
    alumno: [
      { id: 'mi-perfil', label: 'Mi Perfil' },
      { id: 'calendario', label: 'Calendario' },
      { id: 'asistencias', label: 'Asistencias' },
      { id: 'horario', label: 'Horario' },
      { id: 'contactar', label: 'Contactar' },
    ],
    professor: [
      { id: 'mi-perfil', label: 'Mi Perfil' },
      { id: 'asistencias', label: 'Asistencias' },
      { id: 'alumnos', label: 'Lista Alumnos' },
      { id: 'anadir-evento', label: 'Añadir Evento' },
      { id: 'crear-alumno', label: 'Crear Alumno' },
      { id: 'horario', label: 'Horario' },
      { id: 'contactar', label: 'Contactar' },
    ],
    admin: [
      { id: 'mi-perfil', label: 'Mi Perfil' },
      { id: 'asistencias', label: 'Asistencias' },
      { id: 'anadir-evento', label: 'Añadir Evento' },
      { id: 'crear-alumnos', label: 'Crear Alumnos' },
      { id: 'crear-profesores', label: 'Crear Profesores' },
      { id: 'gestion-nfc', label: 'Gestión de NFC' },
      { id: 'lista-alumnos', label: 'Lista Alumnos' },
      { id: 'lista-profesores', label: 'Lista Profesores' },
      { id: 'departamentos', label: 'Departamentos' },
      { id: 'horario', label: 'Horario' },
    ],
  };

  constructor(rootSelector = '#app', user) {
    this.#root = document.querySelector(rootSelector);
    this.#user = user;
    this.#loadHorario('manana');
    this.#loadHorario('tarde');
    this.#horario = this.#horarios[this.#state.horarioMode] || [];
    this.#loadCfg(this.#state.horarioMode);
  }

  render() {
    if (!this.#root) throw new Error('No se encontró el contenedor raíz #app');

    const roleLabel = this.#user?.role || 'alumno';
    const items = this.#menuItems[roleLabel] || this.#menuItems.alumno;

    this.#root.innerHTML = `
      <section class="home" aria-label="Inicio">
        <div class="menu-layout">
          <aside class="sidebar">
            <div class="user-card">
              <div class="avatar avatar-main" aria-hidden="true"></div>
              <div class="user-info">
                <div class="name">${this.#user.nombre || 'Usuario'}</div>
                <div class="email">${this.#user.email}</div>
                <div class="role">Rol: ${roleLabel}</div>
              </div>
            </div>
            <nav class="menu">
              ${items.map(i => `<button class="btn btn-ghost" data-id="${i.id}">${i.label}</button>`).join('')}
            </nav>
          </aside>

          <main class="content">
            <header class="topbar">
              <div class="left">
                <h2>${this.#state.section === 'horario' ? 'Horario' : (this.#state.section === 'perfil' ? 'Mi Perfil' : 'Panel')}</h2>
              </div>
              <div class="center">
                <input class="search" type="search" placeholder="Buscar..." aria-label="Buscar" disabled>
              </div>
              <div class="right">
                <button class="btn btn-ghost nfc" id="btn-nfc" title="Habilitar NFC" anim="sheen">NFC</button>
                <button class="btn btn-ghost" id="btn-clear-session" title="Borrar sesión guardada">Borrar sesión</button>
                <button class="btn btn-ghost" id="btn-logout" title="Cerrar sesión">Cerrar sesión</button>
                <button class="icon more" title="Más" disabled>⋮</button>
              </div>
            </header>

            <section class="panel">
              ${this.#state.section === 'perfil' ? this.#renderPerfil() :
                this.#state.section === 'horario' ? this.#renderHorario() :
                this.#state.section === 'gestion-nfc' ? this.#renderGestionNFC() :
                this.#state.section === 'asistencias' ? this.#renderAsistencias() :
                this.#state.section === 'lista-alumnos' ? this.#renderListaUsuarios('alumno') :
                this.#state.section === 'lista-profesores' ? this.#renderListaUsuarios('professor') :
                this.#state.section === 'crear-alumno' ? this.#renderCrearUsuario('alumno') :
                this.#state.section === 'crear-profesor' ? this.#renderCrearUsuario('professor') : `
                <div class="panel-header">
                  <button class="icon" aria-label="Mes anterior" id="cal-prev">‹</button>
                  <div class="month">${this.#monthLabel()}</div>
                  <button class="icon" aria-label="Mes siguiente" id="cal-next">›</button>
                </div>
                <div class="calendar">
                  ${this.#renderCalendar()}
                </div>
              `}
            </section>
          </main>
        </div>
      </section>
    `;

    // Aplicar avatar personalizado si existe
    this.#applyAvatarFromStorage();

    // Listeners: NFC placeholder, navegación de calendario y menú
    const nfcBtn = this.#root.querySelector('#btn-nfc');
    if (nfcBtn) nfcBtn.addEventListener('click', async () => {
      // Comprobar si el usuario ya tiene un NFC asignado
      try {
        const { ipcRenderer } = window.require ? window.require('electron') : {};
        if (!ipcRenderer) return;
        const check = await ipcRenderer.invoke('nfc:check-user', this.#user);
        if (check && check.hasNFC) {
          // Mostrar mensaje de que ya tiene NFC
          if (document.querySelector('.nfc-float-menu')) return;
          const floatMenu = document.createElement('div');
          floatMenu.className = 'nfc-float-menu';
          floatMenu.innerHTML = `
            <div class="nfc-float-backdrop"></div>
            <div class="nfc-float-content">
              <h3>NFC ya activado</h3>
              <p>Ya tienes un NFC asignado a tu usuario.</p>
              <button class="btn btn-ghost" id="nfc-float-cancel">Cerrar</button>
            </div>
          `;
          document.body.appendChild(floatMenu);
          floatMenu.querySelector('#nfc-float-cancel').onclick = () => floatMenu.remove();
          floatMenu.querySelector('.nfc-float-backdrop').onclick = () => floatMenu.remove();
          return;
        }
      } catch {}

      nfcBtn.classList.toggle('toggled');
      if (document.querySelector('.nfc-float-menu')) return;
      const floatMenu = document.createElement('div');
      floatMenu.className = 'nfc-float-menu';
      floatMenu.innerHTML = `
        <div class="nfc-float-backdrop"></div>
        <div class="nfc-float-content">
          <h3>Activar NFC</h3>
          <p id="nfc-status">Acerque el móvil al lector de NFC</p>
          <button class="btn btn-ghost" id="nfc-float-cancel">Cancelar</button>
        </div>
      `;
      document.body.appendChild(floatMenu);
      floatMenu.querySelector('#nfc-float-cancel').onclick = () => floatMenu.remove();
      floatMenu.querySelector('.nfc-float-backdrop').onclick = () => floatMenu.remove();

      // Lógica de integración con backend (Electron)
      try {
        const { ipcRenderer } = window.require ? window.require('electron') : {};
        if (!ipcRenderer) {
          floatMenu.querySelector('#nfc-status').textContent = 'No disponible en este entorno.';
          return;
        }
        floatMenu.querySelector('#nfc-status').textContent = 'Esperando tarjeta...';
        const jwt = (()=>{ try { return localStorage.getItem('wf_jwt'); } catch { return null; } })();
        const result = await ipcRenderer.invoke('nfc:leer', { user: this.#user, token: jwt });
        if (result && result.ok) {
          floatMenu.querySelector('#nfc-status').textContent = '¡NFC guardado! UID: ' + result.uid;
        } else {
          const msg = (result && result.error) ? String(result.error) : 'No se pudo guardar el NFC.';
          // Mapear errores comunes a textos más claros
          let display = msg;
          if (/409|ya está asignado/i.test(msg)) display = 'Este NFC ya está asignado a otro usuario.';
          floatMenu.querySelector('#nfc-status').textContent = display;
        }
      } catch (err) {
        document.querySelector('#nfc-status').textContent = 'Error: ' + (err.message || err);
      }
    });

    const prev = this.#root.querySelector('#cal-prev');
    const next = this.#root.querySelector('#cal-next');
    if (prev) prev.addEventListener('click', () => { this.#shiftMonth(-1); });
    if (next) next.addEventListener('click', () => { this.#shiftMonth(1); });

    // Clicks en calendario: crear/editar/ver eventos
    if (this.#state.section === 'panel') {
      const cal = this.#root.querySelector('.calendar');
      if (cal) {
        cal.addEventListener('click', (ev) => {
          const target = ev.target.closest('.cal-event');
          const more = ev.target.closest('.cal-more-events');
          const cell = ev.target.closest('.cal-cell');
          const date = cell?.getAttribute('data-date');
          if (!date) return;
          if (target) {
            const id = target.getAttribute('data-id');
            const evObj = (this.#events||[]).find(e => e.id === id);
            if (!evObj) return;
            const canEdit = ['professor', 'admin'].includes(this.#user?.role);
            this.#openEventModal(evObj, { mode: canEdit ? 'edit' : 'view' });
          } else if (more) {
            this.#openDayEventsModal(date);
          } else {
            // Click en día vacío (o zona libre del día): solo profes/admin pueden crear
            if (!['professor','admin'].includes(this.#user?.role)) return;
            this.#openEventModal({ date }, { mode: 'create' });
          }
        });
      }
    }

    const clearBtn = this.#root.querySelector('#btn-clear-session');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      try {
        localStorage.removeItem('wf_saved_session');
        this.#toast('Sesión guardada eliminada.', 'ok');
      } catch {}
    });

    this.#bindMenu();
    if (this.#state.section === 'perfil') this.#bindPerfil();
    if (this.#state.section === 'horario') this.#bindHorarioEvents();
    if (this.#state.section === 'gestion-nfc' && this.#user?.role === 'admin') this.#bindGestionNFC();
    // Auto-cargar listas si ya estamos en la sección correspondiente
    if (this.#state.section === 'lista-alumnos' && this.#user?.role === 'admin') this.#loadUsers('alumno');
    if (this.#state.section === 'lista-profesores' && this.#user?.role === 'admin') this.#loadUsers('professor');
    if (this.#state.section === 'lista-alumnos' && this.#user?.role === 'professor') this.#loadUsers('alumno');
    if (this.#state.section === 'crear-alumno') this.#bindCrearUsuario('alumno');
    if (this.#state.section === 'crear-profesor') this.#bindCrearUsuario('professor');

    if (this.#state.section === 'panel') {
      const needsLoad = !this.#eventsLoaded ||
        this.#eventsYear !== this.#state.year ||
        this.#eventsMonth !== this.#state.month;
      if (needsLoad) {
        this.#eventsLoaded = true;
        this.#loadMonthEvents();
      }
    }
  }

  #monthLabel() {
    const date = new Date(this.#state.year, this.#state.month, 1);
    const month = date.toLocaleString('es-ES', { month: 'long' });
    const label = month.charAt(0).toUpperCase() + month.slice(1);
    return `${label} ${this.#state.year}`;
  }

  #applyAvatarFromStorage() {
    try {
      const u = this.#user || {};
      const keyBase = u._id || u.id || u.dni || 'default';
      const storageKey = 'wf_avatar_' + keyBase;
      // Prioridad: fotoPerfil recibida desde la API; fallback: localStorage
      let data = u.fotoPerfil || null;
      if (!data) {
        data = localStorage.getItem(storageKey);
      }
      if (!data) return;
      const targets = [];
      if (this.#root) {
        this.#root.querySelectorAll('.avatar-main, .profile-avatar').forEach(el => targets.push(el));
      }
      targets.forEach(el => {
        el.style.backgroundImage = `url(${data})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      });
    } catch {}
  }

  // ---------- Mi Perfil ----------
  #renderPerfil() {
    const rawRole = this.#user?.role || 'alumno';
    const roleLabel = rawRole;
    const email = this.#user?.email || this.#user?.gmail || '';
    const dni = this.#user?.dni || '';
    const nombre = this.#user?.nombre || '';
    const apellidos = this.#user?.apellidos || '';
    const rolePrettyMap = { alumno: 'Alumno', professor: 'Profesor', admin: 'Administrador' };
    const rolePretty = rolePrettyMap[roleLabel] || 'Alumno';
    let roleDesc = '';
    if (roleLabel === 'alumno') roleDesc = 'Eres un alumno del centro y puedes consultar tu calendario, tus asistencias y tu horario.';
    else if (roleLabel === 'professor') roleDesc = 'Eres un profesor: además de ver tu información, puedes gestionar alumnos, eventos y asistencias.';
    else if (roleLabel === 'admin') roleDesc = 'Eres administrador: tienes acceso completo a la gestión de usuarios, NFC y eventos.';
    return `
      <div class="profile-view">
        <div class="profile-card">
          <div class="profile-avatar-wrapper">
            <div class="profile-avatar" id="perfil-avatar" aria-label="Foto de perfil" role="button" tabindex="0"></div>
          </div>
          <div class="profile-main">
            <h3 class="profile-name">${nombre} ${apellidos}</h3>
            <p class="profile-role">Rol: ${rolePretty}</p>
            <p class="profile-role-desc">${roleDesc}</p>
          </div>
          <div class="profile-data">
            <div class="profile-row">
              <span class="label">Gmail</span>
              <span class="value">${email || 'No especificado'}</span>
            </div>
            <div class="profile-row">
              <span class="label">DNI</span>
              <span class="value">${dni || 'No especificado'}</span>
            </div>
            <div class="profile-row">
              <span class="label">Nombre</span>
              <span class="value">${nombre || 'No especificado'}</span>
            </div>
            <div class="profile-row">
              <span class="label">Apellidos</span>
              <span class="value">${apellidos || 'No especificado'}</span>
            </div>
            <div class="profile-row">
              <span class="label">Contraseña</span>
              <span class="value">******</span>
            </div>
          </div>
          <div class="profile-actions">
            <button class="btn btn-ghost" id="perfil-edit">Editar información</button>
          </div>
        </div>
      </div>
    `;
  }

  #bindPerfil() {
    const editBtn = this.#root.querySelector('#perfil-edit');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        this.#openEditSelf();
      });
    }
    const avatar = this.#root.querySelector('#perfil-avatar');
    if (avatar) {
      const open = () => this.#openAvatarModal();
      avatar.addEventListener('click', open);
      avatar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    }
  }

  #openAvatarModal() {
    const modal = document.createElement('div');
    modal.className = 'app-modal-backdrop';
    const user = this.#user || {};
    const nombreCompleto = `${user.nombre || ''} ${user.apellidos || ''}`.trim() || 'usuario';
    modal.innerHTML = `
      <div class="app-modal profile-avatar-modal">
        <div class="app-modal-title">Foto de perfil de ${nombreCompleto}</div>
        <div class="app-modal-body">
          <div class="profile-avatar-large"></div>
          <input type="file" id="avatar-input" accept="image/*" style="display:none" />
        </div>
        <div class="app-modal-actions">
          <button class="btn btn-ghost" id="avatar-change">Nueva foto</button>
          <button class="btn" id="avatar-close">Volver</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const cleanup = () => { try { modal.remove(); } catch {} };
    modal.addEventListener('click', (e)=>{ if (e.target===modal) cleanup(); });
    const closeBtn = modal.querySelector('#avatar-close');
    if (closeBtn) closeBtn.addEventListener('click', cleanup);

    const avatarEl = modal.querySelector('.profile-avatar-large');
    const fileInput = modal.querySelector('#avatar-input');
    const keyBase = (()=>{
      const u2 = this.#user || {};
      return u2._id || u2.id || u2.dni || 'default';
    })();
    const storageKey = 'wf_avatar_' + keyBase;

    // Cargar avatar existente si hay
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && avatarEl) {
        avatarEl.style.backgroundImage = `url(${stored})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
      }
    } catch {}

    const changeBtn = modal.querySelector('#avatar-change');
    if (changeBtn && fileInput && avatarEl) {
      changeBtn.addEventListener('click', () => {
        fileInput.click();
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (!file.type || !file.type.startsWith('image/')) {
          this.#toast('Selecciona una imagen válida.', 'warn');
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          const data = reader.result;
          try { localStorage.setItem(storageKey, data); } catch {}
          // Enviar a la API para que se guarde en la BD
          try {
            let token = null;
            try { token = localStorage.getItem('wf_jwt'); } catch { token = null; }
            const id = (this.#user && (this.#user.id || this.#user._id)) || null;
            if (id && token) {
              const res = await fetch('http://localhost:8080/api/usuarios/actualizar', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + token,
                },
                body: JSON.stringify({ id, fotoPerfil: data }),
              });
              const text = await res.text();
              let json = null;
              try { json = text ? JSON.parse(text) : null; } catch {}
              if (!res.ok) {
                const msg = (json && (json.error || json.message)) || (text && text.trim()) || `HTTP ${res.status}`;
                this.#toast(msg || 'No se pudo guardar la foto.', 'err');
              } else if (json && json.usuario) {
                // Actualizar usuario local con fotoPerfil
                this.#user = { ...this.#user, fotoPerfil: json.usuario.fotoPerfil || data };
              }
            }
          } catch (e) {
            this.#toast(e?.message || 'No se pudo guardar la foto en el servidor.', 'warn');
          }

          avatarEl.style.backgroundImage = `url(${data})`;
          avatarEl.style.backgroundSize = 'cover';
          avatarEl.style.backgroundPosition = 'center';
          // Actualizar avatar en la pantalla principal
          this.#applyAvatarFromStorage();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  #openEditSelf() {
    const user = this.#user || {};
    const modal = document.createElement('div');
    modal.className = 'app-modal-backdrop';
    const email = user.email || user.gmail || '';
    modal.innerHTML = `
      <div class="app-modal">
        <div class="app-modal-title">Editar mi información</div>
        <div class="app-modal-body">
          <div class="row two">
            <div><label>Nombre</label><input type="text" id="self-nombre" value="${user.nombre||''}"/></div>
            <div><label>Apellidos</label><input type="text" id="self-apellidos" value="${user.apellidos||''}"/></div>
          </div>
          <div class="row two">
            <div class="field-errors"><div class="field-error" id="err-self-nombre"></div></div>
            <div class="field-errors"><div class="field-error" id="err-self-apellidos"></div></div>
          </div>
          <div class="row two">
            <div><label>DNI</label><input type="text" id="self-dni" value="${user.dni||''}"/></div>
            <div><label>Gmail</label><input type="email" id="self-gmail" value="${email}"/></div>
          </div>
          <div class="row two">
            <div class="field-errors"><div class="field-error" id="err-self-dni"></div></div>
            <div class="field-errors"><div class="field-error" id="err-self-gmail"></div></div>
          </div>
        </div>
        <div class="app-modal-actions">
          <button class="btn btn-ghost" id="self-cancel">Cancelar</button>
          <button class="btn" id="self-ok">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const cleanup = () => { try { modal.remove(); } catch {} };
    modal.addEventListener('click', (e)=>{ if (e.target===modal) cleanup(); });
    const cancel = modal.querySelector('#self-cancel');
    if (cancel) cancel.addEventListener('click', cleanup);

    const clearErrors = () => {
      ['nombre','apellidos','dni','gmail'].forEach(k => {
        const input = modal.querySelector('#self-'+k);
        const err = modal.querySelector('#err-self-'+k);
        if (input) input.style.borderColor = '';
        if (err) err.textContent = '';
      });
    };
    const validate = () => {
      clearErrors();
      let ok = true;
      const nombre = modal.querySelector('#self-nombre').value.trim();
      const apellidos = modal.querySelector('#self-apellidos').value.trim();
      let dni = modal.querySelector('#self-dni').value.trim();
      const gmail = modal.querySelector('#self-gmail').value.trim();
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
      const dniRe = /^[0-9]{7,8}[A-Za-z]$/;
      if (!nombre) { ok=false; const err = modal.querySelector('#err-self-nombre'); if (err) err.textContent = 'Nombre es obligatorio.'; const el = modal.querySelector('#self-nombre'); if (el) el.style.borderColor = '#f66'; }
      if (!apellidos) { ok=false; const err = modal.querySelector('#err-self-apellidos'); if (err) err.textContent = 'Apellidos son obligatorios.'; const el = modal.querySelector('#self-apellidos'); if (el) el.style.borderColor = '#f66'; }
      if (!dni || !dniRe.test(dni)) { ok=false; const err = modal.querySelector('#err-self-dni'); if (err) err.textContent = 'DNI inválido (7-8 dígitos + letra).'; const el = modal.querySelector('#self-dni'); if (el) el.style.borderColor = '#f66'; }
      if (!gmail || !emailRe.test(gmail)) { ok=false; const err = modal.querySelector('#err-self-gmail'); if (err) err.textContent = 'Email inválido.'; const el = modal.querySelector('#self-gmail'); if (el) el.style.borderColor = '#f66'; }
      return ok;
    };
    ['self-nombre','self-apellidos','self-dni','self-gmail'].forEach(id => {
      const el = modal.querySelector('#'+id);
      if (el) el.addEventListener('input', () => {
        const k = id.replace('self-','');
        const err = modal.querySelector('#err-self-'+k);
        if (err) err.textContent = '';
        el.style.borderColor = '';
      });
    });

    const okBtn = modal.querySelector('#self-ok');
    if (okBtn) okBtn.addEventListener('click', async () => {
      if (!validate()) return;
      const updates = {
        nombre: modal.querySelector('#self-nombre').value.trim(),
        apellidos: modal.querySelector('#self-apellidos').value.trim(),
        dni: modal.querySelector('#self-dni').value.trim().toUpperCase(),
        gmail: modal.querySelector('#self-gmail').value.trim(),
      };
      try {
        const { ipcRenderer } = window.require ? window.require('electron') : {};
        const jwt = (()=>{ try { return localStorage.getItem('wf_jwt'); } catch { return null; } })();
        const id = user._id || user.id;
        if (!ipcRenderer || !id) {
          this.#toast('No se pudo actualizar el perfil en este entorno.', 'warn');
          cleanup();
          return;
        }
        const res = await ipcRenderer.invoke('admin:update-user', { id, updates, token: jwt });
        if (res && res.ok && res.usuario) {
          this.#user = {
            ...this.#user,
            nombre: res.usuario.nombre,
            apellidos: res.usuario.apellidos,
            dni: res.usuario.dni,
            email: res.usuario.gmail || res.usuario.email,
          };
          // Actualizar sesión guardada si existe
          try {
            const raw = localStorage.getItem('wf_saved_session');
            if (raw) {
              const data = JSON.parse(raw);
              if (data && data.dni) {
                data.dni = this.#user.dni || data.dni;
              }
              localStorage.setItem('wf_saved_session', JSON.stringify(data));
            }
          } catch {}
          this.#toast('Perfil actualizado.', 'ok');
          this.render();
        } else {
          this.#toast(res?.error || 'No se pudo actualizar.', 'err');
        }
      } catch (e) {
        this.#toast(e?.message || 'Error actualizando.', 'err');
      } finally {
        cleanup();
      }
    });
  }

  #renderCalendar() {
    const now = new Date();
    const year = this.#state.year;
    const month = this.#state.month;
    const firstDay = new Date(year, month, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; // lunes=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push('');
    for (let d = 1; d <= daysInMonth; d++) cells.push(String(d));
    while (cells.length % 7 !== 0) cells.push('');

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

    const today = new Date();
    const isThisMonth = (today.getFullYear() === year && today.getMonth() === month);

    // Mapear eventos por fecha 'YYYY-MM-DD' para pintarlos en cada día
    const eventsByDate = new Map();
    (this.#events || []).forEach(ev => {
      if (!ev?.date) return;
      const list = eventsByDate.get(ev.date) || [];
      list.push(ev);
      eventsByDate.set(ev.date, list);
    });

    const body = weeks.flat().map((val, idx) => {
      if (!val) return '<div class="cal-cell empty"></div>';
      const dayNum = Number(val);
      const isToday = isThisMonth && dayNum === today.getDate();
      const dateObj = new Date(year, month, dayNum);
      const iso = dateObj.toISOString().slice(0, 10); // YYYY-MM-DD
      const dayEvents = eventsByDate.get(iso) || [];
      const typeMap = {
        EXAMEN: { label: 'Examen', cls: 'exam' },
        EVENTO: { label: 'Evento', cls: 'event' },
        VIAJE:  { label: 'Viaje', cls: 'trip' },
        OTRO:   { label: 'Otro', cls: 'other' },
      };
      let eventsHtml = '';
      if (dayEvents.length === 1) {
        const ev = dayEvents[0];
        const type = ev.type || 'EVENTO';
        const meta = typeMap[type] || typeMap.EVENTO;
        const title = (ev.title || meta.label).toString();
        const shortTitle = title.length > 18 ? title.slice(0, 17) + '…' : title;
        eventsHtml = `<div class="cal-event cal-event--${meta.cls}" data-id="${ev.id}" data-date="${iso}">
          <div class="cal-event-pill">
            <span class="cal-event-type">${meta.label}</span>
            <span class="cal-event-title">${shortTitle}</span>
          </div>
        </div>`;
      } else if (dayEvents.length > 1) {
        const ev = dayEvents[0];
        const type = ev.type || 'EVENTO';
        const meta = typeMap[type] || typeMap.EVENTO;
        const title = (ev.title || meta.label).toString();
        const shortTitle = title.length > 18 ? title.slice(0, 17) + '…' : title;
        const extraCount = dayEvents.length - 1;
        eventsHtml = `
          <div class="cal-event cal-event--${meta.cls}" data-id="${ev.id}" data-date="${iso}">
            <div class="cal-event-pill">
              <span class="cal-event-type">${meta.label}</span>
              <span class="cal-event-title">${shortTitle}</span>
            </div>
          </div>
          <button class="cal-more-events" data-date="${iso}" data-count="${dayEvents.length}">+${extraCount} más</button>
        `;
      }
      return `<div class="cal-cell${isToday ? ' today' : ''}" data-date="${iso}">
        <div class="cal-day-num">${val}</div>
        <div class="cal-events">${eventsHtml}</div>
      </div>`;
    }).join('');
    return `
      <div class="cal-grid">
        ${weekDays.map(w => `<div class="cal-head">${w}</div>`).join('')}
        ${body}
      </div>
    `;
  }

  #shiftMonth(delta) {
    let m = this.#state.month + delta;
    let y = this.#state.year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    this.#state.month = m;
    this.#state.year = y;
    // Forzar recarga de eventos del nuevo mes
    this.#eventsLoaded = false;
    this.render();
  }

  async #loadMonthEvents() {
    try {
      const events = await EventsModel.listMonth(this.#state.year, this.#state.month);
      this.#events = Array.isArray(events) ? events : [];
      // Guardar mes/año cargados
      this.#eventsYear = this.#state.year;
      this.#eventsMonth = this.#state.month;
      // Re-render solo si seguimos en el panel (calendario)
      if (this.#state.section === 'panel') {
        this.render();
      }
    } catch (e) {
      // Solo mostrar error a profes/admin para no molestar a alumnos
      if (['professor','admin'].includes(this.#user?.role)) {
        this.#toast(e?.message || 'No se pudieron cargar los eventos.', 'err');
      }
    }
  }

  #bindMenu() {
    const menu = this.#root.querySelectorAll('.menu .btn');
    menu.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id === 'calendario') {
          this.#state.section = 'panel';
          this.render();
        } else if (id === 'mi-perfil') {
          this.#state.section = 'perfil';
          this.render();
        } else if (id === 'horario') {
          this.#state.section = 'horario';
          this.render();
        } else if (id === 'gestion-nfc' && this.#user?.role === 'admin') {
          this.#state.section = 'gestion-nfc';
          this.render();
        } else if (id === 'asistencias') {
          this.#state.section = 'asistencias';
          this.render();
          this.#loadRegistros();
        } else if (id === 'alumnos' && this.#user?.role === 'professor') {
          this.#state.section = 'lista-alumnos';
          this.render();
          this.#loadUsers('alumno');
        } else if (id === 'lista-alumnos' && this.#user?.role === 'admin') {
          this.#state.section = 'lista-alumnos';
          this.render();
          this.#loadUsers('alumno');
        } else if (id === 'lista-profesores' && this.#user?.role === 'admin') {
          this.#state.section = 'lista-profesores';
          this.render();
          this.#loadUsers('professor');
        } else if ((id === 'crear-alumno' && this.#user?.role === 'professor') || (id === 'crear-alumnos' && this.#user?.role === 'admin')) {
          this.#state.section = 'crear-alumno';
          this.render();
        } else if (id === 'crear-profesores' && this.#user?.role === 'admin') {
          this.#state.section = 'crear-profesor';
          this.render();
        } else if (id === 'anadir-evento' && ['professor','admin'].includes(this.#user?.role)) {
          // Ir al panel (calendario) y abrir ayuda para eventos
          this.#state.section = 'panel';
          this.render();
          this.#toast('Haz clic en un día para crear un evento.', 'info');
        } else {
          this.#state.section = 'panel';
          this.render();
        }
      });
    });
  }

  // ---------- Crear Usuario (Admin/Profesor) ----------
  #renderCrearUsuario(role='alumno'){
    const title = role==='professor' ? 'Crear Profesor' : 'Crear Alumno';
    return `
      <div class="create-user">
        <div class="cu-header">
          <h3>${title}</h3>
          <p>Introduce los datos para crear un ${role==='professor'?'profesor':'alumno'}.</p>
        </div>
        <div class="form-card">
          <div class="row two">
            <div><label>Nombre</label><input type="text" id="cu-nombre" placeholder="Nombre"/></div>
            <div><label>Apellidos</label><input type="text" id="cu-apellidos" placeholder="Apellidos"/></div>
          </div>
          <div class="row two">
            <div><label>DNI</label><input type="text" id="cu-dni" placeholder="DNI"/></div>
            <div><label>Gmail</label><input type="email" id="cu-email" placeholder="email@dominio.com"/></div>
          </div>
          <div class="row two">
            <div><label>Fecha de nacimiento</label><input type="date" id="cu-fecha"/></div>
            <div><label>Contraseña</label><input type="password" id="cu-pass" placeholder="Mínimo 6 caracteres"/></div>
          </div>
          <div class="row">
            <button class="btn" id="cu-submit">Crear</button>
          </div>
          <div class="row">
            <small>Si no indicas contraseña, se usará "123456".</small>
          </div>
          <div class="row">
            <div class="field-error" id="cu-error"></div>
          </div>
        </div>
      </div>
    `;
  }

  #bindCrearUsuario(role='alumno'){
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    const dniRe = /^[0-9]{7,8}[A-Za-z]$/;
    const btn = this.#root.querySelector('#cu-submit');
    const errEl = this.#root.querySelector('#cu-error');
    if (!btn) return;
    btn.addEventListener('click', async ()=>{
      if (errEl) errEl.textContent='';
      const nombre = (this.#root.querySelector('#cu-nombre')?.value||'').trim();
      const apellidos = (this.#root.querySelector('#cu-apellidos')?.value||'').trim();
      let dni = (this.#root.querySelector('#cu-dni')?.value||'').trim();
      const email = (this.#root.querySelector('#cu-email')?.value||'').trim().toLowerCase();
      const fechaNacimiento = (this.#root.querySelector('#cu-fecha')?.value||'').trim();
      const password = (this.#root.querySelector('#cu-pass')?.value||'').trim();
      if (!nombre || !apellidos || !email) { if (errEl) errEl.textContent='Nombre, apellidos y email son obligatorios.'; return; }
      if (!emailRe.test(email)) { if (errEl) errEl.textContent='Email inválido.'; return; }
      if (dni && !dniRe.test(dni)) { if (errEl) errEl.textContent='DNI inválido.'; return; }
      if (!fechaNacimiento) { if (errEl) errEl.textContent='Fecha de nacimiento es obligatoria.'; return; }
      if (password && password.length < 6) { if (errEl) errEl.textContent='La contraseña debe tener al menos 6 caracteres.'; return; }
      dni = dni ? dni.toUpperCase() : '';
      try {
        const res = await AuthModel.registerUsuarioAdmin({ nombre, apellidos, dni, email, fechaNacimiento, password, role });
        if (res && res.ok) {
          this.#toast('Usuario creado correctamente.', 'ok');
          // Actualizar listas si estamos en sección correspondiente
          if (role==='alumno') { this.#state.section='lista-alumnos'; this.render(); this.#loadUsers('alumno', true); }
          else { this.#state.section='lista-profesores'; this.render(); this.#loadUsers('professor', true); }
        } else {
          this.#toast(res?.error || 'No se pudo crear el usuario.', 'err');
          if (errEl) errEl.textContent = res?.error || 'Error creando usuario.';
        }
      } catch (e) {
        this.#toast(e?.message || 'Error creando usuario.', 'err');
        if (errEl) errEl.textContent = e?.message || 'Error creando usuario.';
      }
    });
  }

  // ---------- Asistencias (registros E/S) ----------
  #renderAsistencias(){
    const rows = (this.#registros||[]).map(r=>{
      const dt = new Date(r.fechaHora);
      const d = dt.toLocaleDateString('es-ES');
      const t = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const tipo = String(r.tipo||'').toLowerCase();
      return `<tr><td>${d}</td><td>${t}</td><td class="${tipo==='entrada'?'ok':'warn'}">${tipo}</td><td>${r.uid||''}</td></tr>`;
    }).join('');
    return `
      <div class="asistencias">
        <div class="panel-header">
          <h3>Mis fichajes</h3>
          <button class="btn btn-ghost" id="reload-reg">Recargar</button>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>UID</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" class="empty">Sin registros</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  async #loadRegistros(){
    try {
      const { ipcRenderer } = window.require ? window.require('electron') : {};
      if (!ipcRenderer) return;
      const jwt = (()=>{ try { return localStorage.getItem('wf_jwt'); } catch { return null; } })();
      const res = await ipcRenderer.invoke('nfc:list-registros', { userId: this.#user?._id, token: jwt, limit: 50 });
      if (res && res.ok) {
        this.#registros = res.registros || [];
        // Re-render sección asistencias para mostrar los datos
        if (this.#state.section === 'asistencias') this.render();
      } else {
        this.#toast(res?.error || 'No se pudieron cargar los registros.', 'err');
      }
    } catch (e) {
      this.#toast(e?.message || 'Error cargando registros.', 'err');
    }
  }

  // ---------- Lista Alumnos/Profesores (Admin) ----------
  #renderListaUsuarios(role='alumno'){
    this.#usersFilter.role = role;
    const title = role==='professor' ? 'Lista Profesores' : 'Lista Alumnos';
    const rows = (this.#usersList||[]).filter(u=>String(u.role||'alumno')===role).filter(u=>{
      const q = (this.#usersFilter.q||'').toLowerCase();
      if (!q) return true;
      return (String(u.nombre||'').toLowerCase().includes(q) || String(u.email||'').toLowerCase().includes(q));
    }).map(u=>{
      const has = !!u.nfcToken;
      return `<div class="user-row" data-id="${u._id}">
        <div class="user-card small">
          <div class="avatar" aria-hidden="true"></div>
          <div class="user-info">
            <div class="name">${u.nombre||'Usuario'}</div>
            <div class="email">${u.email||''}</div>
            <div class="role">Rol: ${u.role||'alumno'}</div>
          </div>
        </div>
        <div class="user-row-status"><span class="status-pill ${has?'ok':'warn'}">${has?'Con NFC':'Sin NFC'}</span></div>
      </div>`;
    }).join('');
    return `
      <div class="users-admin">
        <div class="nfc-admin-header">
          <h3>${title}</h3>
          <p class="users-count">${rows ? '' : 'Listado filtrado por rol. Usa buscar para localizar.'}</p>
        </div>
        <div class="nfc-filters">
          <div class="row grow">
            <label>Buscar</label>
            <input type="search" id="users-filter-q" placeholder="Nombre o email..." />
          </div>
        </div>
        <div id="users-admin-list" class="nfc-admin-list">
          <div class="loading">Cargando usuarios...</div>
        </div>
      </div>
    `;
  }

  async #loadUsers(role='alumno', force=false){
    try {
      const { ipcRenderer } = window.require ? window.require('electron') : {};
      if (!ipcRenderer) return;
      const listEl = this.#root.querySelector('#users-admin-list');
      if (!listEl) return;
      if (!this.#usersList.length || force) {
        const list = await ipcRenderer.invoke('nfc:list-users-with-nfc');
        this.#usersList = (list||[]).map(u=>({
          ...u,
          role: String(u.role||'alumno'),
          email: u.email || u.gmail || '',
          apellidos: u.apellidos || '',
          dni: u.dni || ''
        }));
      }
      this.#usersFilter.role = role;
      this.#applyUsersFiltersAndRender(listEl);
      const qInput = this.#root.querySelector('#users-filter-q');
      if (qInput) { let t=null; qInput.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(()=>{ this.#usersFilter.q = (qInput.value||'').trim().toLowerCase(); this.#applyUsersFiltersAndRender(listEl); }, 180); }); }
      // Actualizar contador
      const countEl = this.#root.querySelector('.users-count');
      if (countEl) {
        const count = (this.#usersList||[]).filter(u=>String(u.role||'alumno')===role).length;
        countEl.textContent = `Total: ${count}`;
      }
    } catch (e) {
      const listEl = this.#root.querySelector('#users-admin-list');
      if (listEl) listEl.innerHTML = '<div class="error">Error cargando usuarios: '+(e?.message||e)+'</div>';
    }
  }

  #applyUsersFiltersAndRender(listEl){
    const role = this.#usersFilter.role;
    const q = (this.#usersFilter.q||'').toLowerCase();
    const filtered = (this.#usersList||[]).filter(u=>String(u.role||'alumno')===role).filter(u=>{
      if (!q) return true; return (String(u.nombre||'').toLowerCase().includes(q) || String(u.email||'').toLowerCase().includes(q));
    });
    listEl.innerHTML = this.#renderUserRows(filtered) || '<div class="empty">No hay usuarios.</div>';
    this.#bindUsersRowActions(listEl);
  }

  #renderUserRows(users){
    return (users||[]).map(u=>{
      const has = !!u.nfcToken;
      const tokenLabel = has ? `UID: ${u.nfcToken}` : 'Sin NFC';
      const avatarStyle = u.fotoPerfil ? ` style="background-image:url('${u.fotoPerfil}');background-size:cover;background-position:center;"` : '';
      return `
        <div class="nfc-row" data-id="${u._id}">
          <div class="nfc-row-info">
            <div class="user-card small">
              <div class="avatar" aria-hidden="true"${avatarStyle}></div>
              <div class="user-info">
                <div class="name">${u.nombre || 'Usuario'}</div>
                <div class="email">${u.email || ''}</div>
                <div class="role">Rol: ${u.role || 'alumno'}</div>
                <div class="extra">DNI: ${u.dni || ''}${u.apellidos? ' · Apellidos: '+u.apellidos : ''}</div>
              </div>
            </div>
          </div>
          <div class="nfc-row-status">
            <span class="status-pill ${has?'ok':'warn'}">${tokenLabel}</span>
          </div>
          ${this.#user?.role==='admin' ? `
          <div class="nfc-row-actions">
            <button class="btn btn-ghost" data-act="view">Ver</button>
            <button class="btn" data-act="edit">Editar</button>
          </div>
          ` : ''}
        </div>`;
    }).join('');
  }

  // Bind acciones en listas (ver/editar)
  #bindUsersRowActions(listEl){
    listEl.querySelectorAll('.nfc-row .btn').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const row = ev.currentTarget.closest('.nfc-row');
        const id = row?.getAttribute('data-id');
        const act = ev.currentTarget.getAttribute('data-act');
        const user = (this.#usersList||[]).find(x=>x._id===id);
        if (!user) return;
        if (act==='view') {
          const html = `<b>Nombre:</b> ${user.nombre||''}<br><b>Apellidos:</b> ${user.apellidos||''}<br><b>Email:</b> ${user.email||''}<br><b>DNI:</b> ${user.dni||''}<br><b>Rol:</b> ${user.role||'alumno'}<br>${user.nfcToken?('<b>UID:</b> '+user.nfcToken):''}`;
          await this.#confirmDialog('Perfil', html, 'Cerrar', 'Cancelar');
        } else if (act==='edit') {
          this.#openEditUser(user);
        }
      });
    });
  }

  #openEditUser(user){
    const modal = document.createElement('div');
    modal.className = 'app-modal-backdrop';
    modal.innerHTML = `
      <div class="app-modal">
        <div class="app-modal-title">Editar Perfil</div>
        <div class="app-modal-body">
          <div class="row two">
            <div><label>Nombre</label><input type="text" id="ed-nombre" value="${user.nombre||''}"/></div>
            <div><label>Apellidos</label><input type="text" id="ed-apellidos" value="${user.apellidos||''}"/></div>
          </div>
          <div class="row two">
            <div class="field-errors"><div class="field-error" id="err-nombre"></div></div>
            <div class="field-errors"><div class="field-error" id="err-apellidos"></div></div>
          </div>
          <div class="row two">
            <div><label>DNI</label><input type="text" id="ed-dni" value="${user.dni||''}"/></div>
            <div><label>Email</label><input type="email" id="ed-gmail" value="${user.email||''}"/></div>
          </div>
          <div class="row two">
            <div class="field-errors"><div class="field-error" id="err-dni"></div></div>
            <div class="field-errors"><div class="field-error" id="err-gmail"></div></div>
          </div>
          <div class="row">
            <label>Rol</label>
            <select id="ed-rol">
              <option value="ALUMNO" ${user.role==='alumno'?'selected':''}>Alumno</option>
              <option value="PROFESOR" ${user.role==='professor'?'selected':''}>Profesor</option>
              <option value="ADMIN" ${user.role==='admin'?'selected':''}>Admin</option>
            </select>
          </div>
        </div>
        <div class="app-modal-actions">
          <button class="btn btn-ghost" id="modal-cancel">Cancelar</button>
          <button class="btn" id="modal-ok">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const cleanup = () => { try { modal.remove(); } catch {} };
    modal.addEventListener('click', (e)=>{ if (e.target===modal) cleanup(); });
    modal.querySelector('#modal-cancel').onclick = cleanup;
    const clearErrors = () => {
      ['nombre','apellidos','dni','gmail'].forEach(k=>{
        const el = modal.querySelector('#ed-'+k);
        const err = modal.querySelector('#err-'+k);
        if (el) el.style.borderColor = '';
        if (err) err.textContent = '';
      });
    };
    const validate = () => {
      clearErrors();
      let ok = true;
      const nombre = modal.querySelector('#ed-nombre').value.trim();
      const apellidos = modal.querySelector('#ed-apellidos').value.trim();
      let dni = modal.querySelector('#ed-dni').value.trim();
      const gmail = modal.querySelector('#ed-gmail').value.trim();
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
      const dniRe = /^[0-9]{7,8}[A-Za-z]$/;
      if (!nombre) { ok=false; const err = modal.querySelector('#err-nombre'); if (err) err.textContent = 'Nombre es obligatorio.'; const el = modal.querySelector('#ed-nombre'); if (el) el.style.borderColor = '#f66'; }
      if (!apellidos) { ok=false; const err = modal.querySelector('#err-apellidos'); if (err) err.textContent = 'Apellidos son obligatorios.'; const el = modal.querySelector('#ed-apellidos'); if (el) el.style.borderColor = '#f66'; }
      if (!dni || !dniRe.test(dni)) { ok=false; const err = modal.querySelector('#err-dni'); if (err) err.textContent = 'DNI inválido (7-8 dígitos + letra).'; const el = modal.querySelector('#ed-dni'); if (el) el.style.borderColor = '#f66'; }
      if (!gmail || !emailRe.test(gmail)) { ok=false; const err = modal.querySelector('#err-gmail'); if (err) err.textContent = 'Email inválido.'; const el = modal.querySelector('#ed-gmail'); if (el) el.style.borderColor = '#f66'; }
      return ok;
    };
    ['ed-nombre','ed-apellidos','ed-dni','ed-gmail'].forEach(id=>{
      const el = modal.querySelector('#'+id);
      if (el) el.addEventListener('input', ()=>{ const k = id.replace('ed-',''); const err = modal.querySelector('#err-'+k); if (err) err.textContent = ''; el.style.borderColor = ''; });
    });
    modal.querySelector('#modal-ok').onclick = async () => {
      if (!validate()) return;
      const updates = {
        nombre: modal.querySelector('#ed-nombre').value.trim(),
        apellidos: modal.querySelector('#ed-apellidos').value.trim(),
        dni: modal.querySelector('#ed-dni').value.trim().toUpperCase(),
        gmail: modal.querySelector('#ed-gmail').value.trim(),
        rol: modal.querySelector('#ed-rol').value,
      };
      try {
        const { ipcRenderer } = window.require ? window.require('electron') : {};
        const jwt = (()=>{ try { return localStorage.getItem('wf_jwt'); } catch { return null; } })();
        const res = await ipcRenderer.invoke('admin:update-user', { id: user._id, updates, token: jwt });
        if (res && res.ok && res.usuario) {
          // Actualizar en memoria y re-render
          const roleMap = { ALUMNO:'alumno', PROFESOR:'professor', ADMIN:'admin' };
          const idx = (this.#usersList||[]).findIndex(x=>x._id===user._id);
          if (idx>=0) {
            this.#usersList[idx] = {
              ...this.#usersList[idx],
              nombre: res.usuario.nombre,
              apellidos: res.usuario.apellidos,
              dni: res.usuario.dni,
              email: res.usuario.gmail || res.usuario.email,
              role: roleMap[String(res.usuario.rol||'ALUMNO')] || 'alumno',
              nfcToken: res.usuario.nfcToken || this.#usersList[idx].nfcToken,
            };
          }
          // Refrescar la lista en vivo sin necesidad de re-navegar
          const listEl = this.#root.querySelector('#users-admin-list');
          if (listEl && (this.#state.section==='lista-alumnos' || this.#state.section==='lista-profesores')) {
            this.#applyUsersFiltersAndRender(listEl);
            const countEl = this.#root.querySelector('.users-count');
            if (countEl) {
              const role = this.#usersFilter.role;
              const count = (this.#usersList||[]).filter(u=>String(u.role||'alumno')===role).length;
              countEl.textContent = `Total: ${count}`;
            }
          } else {
            this.render();
            if (this.#state.section==='lista-alumnos' && this.#user?.role==='admin') this.#loadUsers('alumno');
            if (this.#state.section==='lista-profesores' && this.#user?.role==='admin') this.#loadUsers('professor');
          }
          this.#toast('Perfil actualizado.', 'ok');
        } else {
          this.#toast(res?.error || 'No se pudo actualizar.', 'err');
        }
      } catch (e) {
        this.#toast(e?.message || 'Error actualizando.', 'err');
      } finally {
        cleanup();
      }
    };
  }

  // ---------- Gestión de NFC (Admin) ----------
  /**
   * Renderiza la sección de Gestión de NFC para admin.
   * Incluye filtros por rol/estado y buscador.
   */
  #renderGestionNFC() {
    return `
      <div class="nfc-admin">
        <div class="nfc-admin-header">
          <h3>Gestión de NFC</h3>
          <p>Habilita, deshabilita o modifica los NFC asignados a usuarios.</p>
        </div>
        <div class="nfc-filters">
          <div class="row">
            <label>Rol</label>
            <select id="nfc-filter-role">
              <option value="all">Todos</option>
              <option value="alumno">Alumno</option>
              <option value="professor">Profesor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="row">
            <label>Estado</label>
            <select id="nfc-filter-status">
              <option value="all">Todos</option>
              <option value="with">Con NFC</option>
              <option value="without">Sin NFC</option>
            </select>
          </div>
          <div class="row grow">
            <label>Buscar</label>
            <input type="search" id="nfc-filter-q" placeholder="Nombre o email..." />
          </div>
        </div>
        <div id="nfc-admin-list" class="nfc-admin-list">
          <div class="loading">Cargando usuarios...</div>
        </div>
      </div>
    `;
  }

  /**
   * Carga usuarios (IPC) y vincula los filtros/botones de la sección.
   */
  #bindGestionNFC() {
    try {
      const { ipcRenderer } = window.require ? window.require('electron') : {};
      if (!ipcRenderer) return;
      const listEl = this.#root.querySelector('#nfc-admin-list');
      if (!listEl) return;
      ipcRenderer.invoke('nfc:list-users-with-nfc').then((users) => {
        this.#nfcUsers = users || [];
        this.#applyNfcFiltersAndRender(listEl);
        // Bind filter controls
        const roleSel = this.#root.querySelector('#nfc-filter-role');
        const statusSel = this.#root.querySelector('#nfc-filter-status');
        const qInput = this.#root.querySelector('#nfc-filter-q');
        if (roleSel) roleSel.addEventListener('change', ()=>{ this.#nfcFilter.role = roleSel.value; this.#applyNfcFiltersAndRender(listEl); });
        if (statusSel) statusSel.addEventListener('change', ()=>{ this.#nfcFilter.status = statusSel.value; this.#applyNfcFiltersAndRender(listEl); });
        if (qInput) {
          let t=null; qInput.addEventListener('input', ()=>{ clearTimeout(t); t=setTimeout(()=>{ this.#nfcFilter.q = (qInput.value||'').trim().toLowerCase(); this.#applyNfcFiltersAndRender(listEl); }, 180); });
        }
      }).catch(err => {
        listEl.innerHTML = '<div class="error">Error cargando usuarios: '+(err?.message||err)+'</div>';
      });
    } catch {}
  }

  /**
   * Aplica filtros y renderiza filas con sus acciones.
   */
  #applyNfcFiltersAndRender(listEl) {
    const f = this.#nfcFilter;
    const filtered = (this.#nfcUsers||[]).filter(u => {
      const roleOk = f.role==='all' ? true : (String(u.role||'alumno')===f.role);
      const statusOk = f.status==='all' ? true : (f.status==='with' ? !!u.nfcToken : !u.nfcToken);
      const q = f.q || '';
      const qOk = !q ? true : ((u.nombre||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q));
      return roleOk && statusOk && qOk;
    });
    listEl.innerHTML = this.#renderNfcRows(filtered) || '<div class="empty">No hay usuarios.</div>';
    this.#bindRowActions(listEl, filtered);
  }

  /**
   * Renderiza filas de usuarios con estado NFC y acciones.
   */
  #renderNfcRows(users) {
    return (users||[]).map(u=>{
      const has = !!u.nfcToken;
      const tokenLabel = has ? `UID: ${u.nfcToken}` : 'Sin NFC';
      const avatarStyle = u.fotoPerfil ? ` style="background-image:url('${u.fotoPerfil}');background-size:cover;background-position:center;"` : '';
      return `
        <div class="nfc-row" data-id="${u._id}">
          <div class="nfc-row-info">
            <div class="user-card small">
              <div class="avatar" aria-hidden="true"${avatarStyle}></div>
              <div class="user-info">
                <div class="name">${u.nombre || 'Usuario'}</div>
                <div class="email">${u.email || ''}</div>
                <div class="role">Rol: ${u.role || 'alumno'}</div>
              </div>
            </div>
          </div>
          <div class="nfc-row-status">
            <span class="status-pill ${has?'ok':'warn'}">${tokenLabel}</span>
          </div>
          <div class="nfc-row-actions">
            ${has ? `<button class="btn btn-ghost" data-act="disable"><span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none"/><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="2"/></svg></span>Deshabilitar NFC</button>` : `<button class="btn btn-ghost" data-act="enable"><span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none"/><line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" stroke-width="2"/><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" stroke-width="2"/></svg></span>Habilitar NFC</button>`}
            <button class="btn" data-act="modify"><span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M12.5 2.5l1 1c.7.7.7 1.8 0 2.5l-7 7-3 1 1-3 7-7c.7-.7 1.8-.7 2.5 0z"/></svg></span>Modificar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Vincula acciones de fila: deshabilitar, habilitar y modificar NFC.
   */
  #bindRowActions(listEl, users){
    listEl.querySelectorAll('.nfc-row .btn').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const row = ev.currentTarget.closest('.nfc-row');
        const userId = row?.getAttribute('data-id');
        const act = ev.currentTarget.getAttribute('data-act');
        const { ipcRenderer } = window.require ? window.require('electron') : {};
        const user = (users||[]).find(x=>x._id===userId) || { _id: userId };
        if (!ipcRenderer || !userId) return;
        try {
          if (act === 'disable') {
            const ok = await this.#confirmDialog('Deshabilitar NFC', '¿Deshabilitar NFC de este usuario?', 'Deshabilitar', 'Cancelar');
            if (!ok) return;
            const res = await ipcRenderer.invoke('nfc:disable', userId);
            if (res?.ok) this.#refreshGestionNFC();
          } else if (act === 'enable') {
            const ok = await this.#confirmDialog('Habilitar NFC', '¿Asignar un nuevo NFC a este usuario?', 'Habilitar', 'Cancelar');
            if (!ok) return;
            await this.#assignNfcToUser(ipcRenderer, user);
          } else if (act === 'modify') {
            const ok = await this.#confirmDialog('Modificar NFC', '¿Modificar y asignar otro NFC a este usuario?', 'Modificar', 'Cancelar');
            if (!ok) return;
            await this.#assignNfcToUser(ipcRenderer, user, true);
          }
        } catch (err) {
          this.#toast('Error NFC: ' + (err?.message || err), 'error');
        }
      });
    });
  }

  /**
   * Intenta asignar/modificar NFC a un usuario mostrando overlay.
   * Gestiona conflictos mostrando propietario y acciones admin.
   */
  async #assignNfcToUser(ipcRenderer, user, modify=false) {
    // Mostrar overlay temporal de lectura
    const overlay = document.createElement('div');
    overlay.className = 'nfc-float-menu';
    overlay.innerHTML = `
      <div class="nfc-float-backdrop"></div>
      <div class="nfc-float-content">
        <h3>${modify? 'Modificar NFC' : 'Habilitar NFC'}</h3>
        <p id="nfc-status">Acerque la tarjeta al lector...</p>
        <button class="btn btn-ghost" id="nfc-float-cancel">Cancelar</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#nfc-float-cancel').onclick = () => overlay.remove();
    overlay.querySelector('.nfc-float-backdrop').onclick = () => overlay.remove();
    try {
      const jwt = (()=>{ try { return localStorage.getItem('wf_jwt'); } catch { return null; } })();
      const res = await ipcRenderer.invoke('nfc:leer', { user: { _id: user._id, email: user.email, nombre: user.nombre }, token: jwt });
      if (res?.ok) {
        overlay.querySelector('#nfc-status').textContent = `Asignado UID: ${res.uid}`;
        setTimeout(()=> overlay.remove(), 1200);
        this.#refreshGestionNFC();
      } else {
        // Mostrar mensaje con detalle y propietario si existe
        let ownerInfo = null;
        if (res?.uid) {
          try {
            const owner = await ipcRenderer.invoke('nfc:get-owner', res.uid);
            if (owner?.ok && owner?.user) ownerInfo = owner.user;
          } catch {}
        }
        const content = overlay.querySelector('.nfc-float-content');
        const lines = [];
        if (ownerInfo) {
          lines.push(`<b>Este NFC ya está habilitado</b>`);
          lines.push(`<b>Pertenece a:</b> ${ownerInfo.nombre || ownerInfo.email}`);
          lines.push(`<b>Rol:</b> ${ownerInfo.role || 'alumno'}`);
          if (ownerInfo.email) lines.push(`<b>Email:</b> ${ownerInfo.email}`);
        } else {
          lines.push(res?.error || 'No se pudo asignar NFC.');
        }
        const isAdmin = this.#user?.role === 'admin';
        const actions = `
          <div class="nfc-owner-actions">
            ${ownerInfo ? `<button class="btn btn-ghost" id="nfc-owner-view"><span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3 4-4 6-4s6 1 6 4"/></svg></span>Ver perfil</button>` : ''}
            ${ownerInfo && isAdmin ? `<button class="btn" id="nfc-owner-disable"><span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" fill="none"/><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="2"/></svg></span>Deshabilitar NFC</button>` : ''}
            <button class="btn btn-ghost" id="nfc-owner-retry"><span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 3a5 5 0 1 0 4.9 6H11l3-3 3 3h-1.9A7 7 0 1 1 8 1v2z"/></svg></span>Reintentar asignación</button>
            <button class="btn btn-ghost" id="nfc-float-close"><span class="ico" aria-hidden="true"><svg viewBox="0 0 16 16" fill="currentColor"><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="2"/><line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" stroke-width="2"/></svg></span>Cerrar</button>
          </div>`;
        content.innerHTML = `
          <h3>NFC en uso</h3>
          <p id="nfc-status">${lines.join('<br>')}</p>
          ${actions}
        `;

        const close = () => overlay.remove();
        const viewBtn = content.querySelector('#nfc-owner-view');
        if (viewBtn && ownerInfo) {
          viewBtn.onclick = async () => {
            await this.#confirmDialog('Perfil del usuario', `<b>Nombre:</b> ${ownerInfo.nombre || ''}<br><b>Email:</b> ${ownerInfo.email || ''}<br><b>Rol:</b> ${ownerInfo.role || 'alumno'}`, 'Cerrar', 'Cancelar');
          };
        }
        const disableBtn = content.querySelector('#nfc-owner-disable');
        if (disableBtn && ownerInfo && isAdmin) {
          disableBtn.onclick = async () => {
            const ok = await this.#confirmDialog('Deshabilitar NFC', `¿Deshabilitar el NFC de ${ownerInfo.nombre || ownerInfo.email}?`, 'Deshabilitar', 'Cancelar');
            if (!ok) return;
            try {
              const resDisable = await ipcRenderer.invoke('nfc:disable', ownerInfo._id);
              if (resDisable?.ok) {
                content.querySelector('#nfc-status').innerHTML = 'NFC del propietario deshabilitado. Acerque la tarjeta de nuevo para asignar.';
                // Auto-reintento: escuchar temporalmente el mismo UID y asignar
                let done = false;
                const uidTarget = res?.uid;
                const handler = async (_event, uidNow) => {
                  if (done) return;
                  if (!uidTarget || uidNow !== uidTarget) return;
                  done = true;
                  try {
                    const jwt2 = (()=>{ try { return localStorage.getItem('wf_jwt'); } catch { return null; } })();
                    const re = await ipcRenderer.invoke('nfc:leer', { user: { _id: user._id, email: user.email, nombre: user.nombre }, token: jwt2 });
                    if (re?.ok) {
                      content.querySelector('#nfc-status').innerHTML = `Asignado UID: ${re.uid}`;
                      setTimeout(()=> overlay.remove(), 1200);
                      this.#refreshGestionNFC();
                    } else {
                      this.#toast(re?.error || 'Sigue sin poder asignar.', 'warn');
                    }
                  } catch (e) {
                    this.#toast('Error al auto-asignar: ' + (e?.message || e), 'error');
                  } finally {
                    ipcRenderer.removeListener('nfc:uid', handler);
                  }
                };
                ipcRenderer.on('nfc:uid', handler);
                setTimeout(() => { if (!done) ipcRenderer.removeListener('nfc:uid', handler); }, 8000);
              } else {
                this.#toast('No se pudo deshabilitar.', 'error');
              }
            } catch (e) {
              this.#toast('Error al deshabilitar: ' + (e?.message || e), 'error');
            }
          };
        }
        const retryBtn = content.querySelector('#nfc-owner-retry');
        if (retryBtn) {
          retryBtn.onclick = async () => {
            try {
              const jwt3 = (()=>{ try { return localStorage.getItem('wf_jwt'); } catch { return null; } })();
              const re = await ipcRenderer.invoke('nfc:leer', { user: { _id: user._id, email: user.email, nombre: user.nombre }, token: jwt3 });
              if (re?.ok) {
                content.querySelector('#nfc-status').innerHTML = `Asignado UID: ${re.uid}`;
                setTimeout(()=> overlay.remove(), 1200);
                this.#refreshGestionNFC();
              } else {
                this.#toast(re?.error || 'Sigue sin poder asignar.', 'warn');
              }
            } catch (e) {
              this.#toast('Error al reintentar: ' + (e?.message || e), 'error');
            }
          };
        }
        const closeBtn = content.querySelector('#nfc-float-close');
        if (closeBtn) closeBtn.onclick = close;
      }
    } catch (err) {
      overlay.querySelector('#nfc-status').textContent = 'Error: ' + (err?.message || err);
    }
  }

  /**
   * Re-renderiza la sección de gestión NFC y re-bindea eventos.
   */
  #refreshGestionNFC() {
    // Re-render y rebind sección
    this.#state.section = 'gestion-nfc';
    this.render();
  }

  // ---------- UI helpers: modal confirm y toast ----------
  /**
   * Modal de confirmación estilizado (promesa booleana).
   */
  async #confirmDialog(title, message, okLabel='Aceptar', cancelLabel='Cancelar') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'app-modal-backdrop';
      modal.innerHTML = `
        <div class="app-modal">
          <div class="app-modal-title">${title}</div>
          <div class="app-modal-body">${message}</div>
          <div class="app-modal-actions">
            <button class="btn btn-ghost" id="modal-cancel">${cancelLabel}</button>
            <button class="btn" id="modal-ok">${okLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const cleanup = () => { try { modal.remove(); } catch {} };
      modal.querySelector('#modal-cancel').onclick = () => { cleanup(); resolve(false); };
      modal.querySelector('#modal-ok').onclick = () => { cleanup(); resolve(true); };
      modal.addEventListener('click', (ev) => { if (ev.target === modal) { cleanup(); resolve(false); } });
    });
  }

  /**
   * Toast minimalista con autocierre.
   */
  #toast(text, type='info') {
    const wrap = document.querySelector('.app-toast-wrap') || (()=>{
      const w = document.createElement('div');
      w.className = 'app-toast-wrap';
      document.body.appendChild(w);
      return w;
    })();
    const el = document.createElement('div');
    el.className = `app-toast ${type}`;
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(()=>{ el.classList.add('show'); }, 10);
    setTimeout(()=>{ el.classList.remove('show'); el.addEventListener('transitionend', ()=> el.remove(), { once: true }); }, 3200);
  }

  // ---------- Horario (L-V) ----------
  #loadHorario(mode='manana') {
    try {
      const key = mode==='tarde' ? 'wf_horario_tarde' : 'wf_horario_manana';
      const raw = localStorage.getItem(key);
      this.#horarios[mode] = raw ? JSON.parse(raw) : [];
    } catch { this.#horarios[mode] = []; }
  }
  #saveHorario(mode='manana') {
    try {
      const key = mode==='tarde' ? 'wf_horario_tarde' : 'wf_horario_manana';
      localStorage.setItem(key, JSON.stringify(this.#horarios[mode] || []));
    } catch {}
  }

  /**
   * Renderiza horario (L-V) con modo mañana/tarde y configuración.
   */
  #renderHorario() {
    const canEdit = ['professor', 'admin'].includes(this.#user?.role);
    const mode = this.#state.horarioMode || 'manana';
    const days = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
    const bounds = mode === 'manana' ? { min: 8, max: 15 } : { min: 14, max: 21 };
    const startHour = Math.min(Math.max(bounds.min, this.#cfg.startHour ?? bounds.min), bounds.max-1);
    const endHour = Math.min(Math.max(startHour+1, this.#cfg.endHour ?? bounds.max), bounds.max);
    const hourRows = [];
    for (let h = startHour; h <= endHour; h++) hourRows.push(`${String(h).padStart(2,'0')}:00`);

    const eventsByDay = [0,1,2,3,4].map(d => (this.#horario||[]).filter(e => e.day === d).sort((a,b)=>this.#toMinutes(a.start)-this.#toMinutes(b.start)));

    return `
      <div class="timetable">
        <div class="tt-top">
          <div class="tt-modes">
            <button class="btn btn-ghost ${mode==='manana'?'active':''}" data-mode="manana">Mañanas</button>
            <button class="btn btn-ghost ${mode==='tarde'?'active':''}" data-mode="tarde">Tardes</button>
          </div>
          ${canEdit ? `
          <div class="tt-toolbar">
            <button class="btn" id="tt-add">Añadir asignatura</button>
          </div>
          `: ''}
        </div>
        ${canEdit ? `
        <div class="tt-config">
          <div>
            <label>Inicio (hora)</label>
            <select id="cfg-start">
              ${Array.from({length:bounds.max-bounds.min},(_,k)=>bounds.min+k).map(i=>`<option value="${i}" ${i===startHour?'selected':''}>${String(i).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Fin (hora)</label>
            <select id="cfg-end">
              ${Array.from({length:bounds.max-bounds.min+1},(_,k)=>bounds.min+k).map(i=>`<option value="${i}" ${i===endHour?'selected':''}>${String(i).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Intervalo (min)</label>
            <select id="cfg-slot">
              ${[15,30,60].map(m=>`<option value="${m}" ${m==this.#cfg.slotMinutes?'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Altura hora (px)</label>
            <input type="number" id="cfg-height" value="${this.#cfg.hourHeight}" min="32" max="120" step="2" />
          </div>
        </div>
        `: ''}
        <div class="tt-header">
          <div></div>
          ${days.map(d=>`<div class="tt-head">${d}</div>`).join('')}
        </div>
        <div class="tt-body">
          <div class="tt-grid" style="--hour-height: ${this.#cfg.hourHeight}px; --hours: ${endHour - startHour + 1};">
          <div class="tt-hours">
            ${hourRows.map(h=>`<div class="tt-hour">${h}</div>`).join('')}
          </div>
          ${eventsByDay.map((list, idx)=>`
            <div class="tt-day" data-day="${idx}">
              ${this.#renderDayEvents(list, startHour)}
            </div>
          `).join('')}
          </div>
        </div>
        ${canEdit ? this.#renderForm() : ''}
      </div>
    `;
  }

  /**
   * Renderiza eventos del día con posicionamiento en cuadrícula temporal.
   */
  #renderDayEvents(list, startHour){
    const pxPerMin = (this.#cfg.hourHeight||52)/60; // matches --hour-height
    return list.map(ev => {
      const top = Math.max(0, (this.#toMinutes(ev.start) - startHour*60) * pxPerMin);
      const height = Math.max(26, (ev.duration||60) * pxPerMin);
      return `<div class="tt-event" data-id="${ev.id}" style="top:${top}px;height:${height}px">
        <div class="tt-title">${ev.title}</div>
        <div class="tt-time">${ev.start} · ${this.#formatEnd(ev.start, ev.duration||60)}</div>
        ${['professor','admin'].includes(this.#user?.role) ? '<div class="tt-actions"><button class="mini edit" data-act="edit">✎</button><button class="mini del" data-act="del">✕</button></div>' : ''}
      </div>`;
    }).join('');
  }

  /**
   * Formulario de alta/edición de asignaturas en el horario.
   */
  #renderForm(edit=null){
    return `
      <form class="tt-form" id="tt-form" hidden>
        <div class="row">
          <label>Asignatura</label>
          <input type="text" id="f-title" required />
        </div>
        <div class="row two">
          <div>
            <label>Día</label>
            <select id="f-day">
              <option value="0">Lunes</option>
              <option value="1">Martes</option>
              <option value="2">Miércoles</option>
              <option value="3">Jueves</option>
              <option value="4">Viernes</option>
            </select>
          </div>
          <div>
            <label>Inicio</label>
            <input type="time" id="f-start" value="08:00" step="300" />
          </div>
          <div>
            <label>Duración (min)</label>
            <input type="number" id="f-duration" value="60" min="15" step="15" />
          </div>
        </div>
        <div class="row actions">
          <button class="btn" id="f-save">Guardar</button>
          <button class="btn btn-ghost" id="f-cancel" type="button">Cancelar</button>
        </div>
        <input type="hidden" id="f-id" />
      </form>
    `;
  }

  /**
   * Eventos para configurar horario y CRUD de asignaturas.
   */
  #bindHorarioEvents(){
    const canEdit = ['professor', 'admin'].includes(this.#user?.role);
    if (canEdit) {
      const btnAdd = this.#root.querySelector('#tt-add');
      const form = this.#root.querySelector('#tt-form');
      const fTitle = this.#root.querySelector('#f-title');
      const fDay = this.#root.querySelector('#f-day');
      const fStart = this.#root.querySelector('#f-start');
      const fDuration = this.#root.querySelector('#f-duration');
      const fId = this.#root.querySelector('#f-id');
      const btnSave = this.#root.querySelector('#f-save');
      const btnCancel = this.#root.querySelector('#f-cancel');

      const openForm = (ev=null)=>{
        form.hidden = false;
        if (ev){
          fId.value = ev.id;
          fTitle.value = ev.title;
          fDay.value = String(ev.day);
          fStart.value = ev.start;
          fDuration.value = String(ev.duration||60);
        } else {
          fId.value = '';
          fTitle.value = '';
          fDay.value = '0';
          const bounds = (this.#state.horarioMode==='tarde') ? { min:14 } : { min:8 };
          fStart.value = `${String(this.#cfg.startHour ?? bounds.min).padStart(2,'0')}:00`;
          fDuration.value = '60';
        }
        fTitle.focus();
      };
      const closeForm = ()=>{ form.hidden = true; };

      if (btnAdd) btnAdd.addEventListener('click', ()=> openForm());
      if (btnCancel) btnCancel.addEventListener('click', ()=> closeForm());
      if (btnSave) btnSave.addEventListener('click', (e)=>{
        e.preventDefault();
        const payload = {
          id: fId.value || ('e_' + Math.random().toString(36).slice(2,9)),
          title: (fTitle.value||'').trim() || 'Asignatura',
          day: Number(fDay.value||0),
          start: fStart.value||'08:00',
          duration: Math.max(15, Number(fDuration.value||60)),
        };
        const mode = this.#state.horarioMode || 'manana';
        const list = this.#horarios[mode] || [];
        const idx = list.findIndex(x=>x.id===payload.id);
        if (idx>=0) list[idx] = payload; else list.push(payload);
        this.#horarios[mode] = list;
        this.#horario = list;
        this.#saveHorario(mode);
        closeForm();
        this.#state.section = 'horario';
        this.render();
      });

      // Edit/Delete on event buttons
      this.#root.querySelectorAll('.tt-event .mini').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
          const el = e.currentTarget;
          const id = el.closest('.tt-event')?.getAttribute('data-id');
          const act = el.getAttribute('data-act');
          const ev = this.#horario.find(x=>x.id===id);
          if (!ev) return;
          if (act==='edit') {
            openForm(ev);
          } else if (act==='del') {
            (async () => {
              const ok = await this.#confirmDialog('Eliminar asignatura', '¿Eliminar asignatura?', 'Eliminar', 'Cancelar');
              if (!ok) return;
              const mode = this.#state.horarioMode || 'manana';
              this.#horarios[mode] = (this.#horarios[mode]||[]).filter(x=>x.id!==id);
              this.#horario = this.#horarios[mode];
              this.#saveHorario(mode);
              this.#state.section = 'horario';
              this.render();
            })();
          }
        });
      });
    }
    // Bind config controls (visible to canEdit)
    const cfgStart = this.#root.querySelector('#cfg-start');
    const cfgEnd = this.#root.querySelector('#cfg-end');
    const cfgSlot = this.#root.querySelector('#cfg-slot');
    const cfgHeight = this.#root.querySelector('#cfg-height');
    if (cfgStart) cfgStart.addEventListener('change', () => {
      this.#cfg.startHour = Number(cfgStart.value||8);
      if (this.#cfg.endHour <= this.#cfg.startHour) this.#cfg.endHour = Math.min(24, this.#cfg.startHour+1);
      this.#saveCfg(this.#state.horarioMode); this.#state.section = 'horario'; this.render();
    });
    if (cfgEnd) cfgEnd.addEventListener('change', () => {
      this.#cfg.endHour = Number(cfgEnd.value||18);
      if (this.#cfg.endHour <= this.#cfg.startHour) this.#cfg.endHour = Math.min(24, this.#cfg.startHour+1);
      this.#saveCfg(this.#state.horarioMode); this.#state.section = 'horario'; this.render();
    });
    if (cfgSlot) cfgSlot.addEventListener('change', () => {
      this.#cfg.slotMinutes = Number(cfgSlot.value||15);
      const timeInput = this.#root.querySelector('#f-start');
      if (timeInput) timeInput.step = Math.max(60, this.#cfg.slotMinutes*60);
      this.#saveCfg(this.#state.horarioMode); this.#state.section = 'horario';
    });
    if (cfgHeight) cfgHeight.addEventListener('change', () => {
      this.#cfg.hourHeight = Math.min(120, Math.max(32, Number(cfgHeight.value||52)));
      this.#saveCfg(this.#state.horarioMode); this.#state.section = 'horario'; this.render();
    });

    // Mode switchers
    this.#root.querySelectorAll('.tt-modes .btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (!mode) return;
        this.#state.horarioMode = mode;
        this.#horario = this.#horarios[mode] || [];
        this.#loadCfg(mode);
        this.#state.section = 'horario';
        this.render();
      });
    });

    // Usar scroll nativo del contenedor principal; sin interceptar la rueda
  }

  // Scroll nativo: no se calcula altura dinámica

  /** Convierte HH:mm a minutos. */
  #toMinutes(hhmm){
    const [h,m] = (hhmm||'08:00').split(':').map(Number);
    return h*60 + (m||0);
  }
  /** Calcula hora de fin formateada a partir de inicio+duración. */
  #formatEnd(start, duration){
    const endMin = this.#toMinutes(start) + (duration||60);
    const h = Math.floor(endMin/60), m = endMin%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // ---------- Eventos de calendario (modal CRUD) ----------

  async #openDayEventsModal(dateIso) {
    const events = (this.#events || []).filter(e => e.date === dateIso);
    if (!events.length) return;

    const typeMeta = {
      EXAMEN: { label: 'Examen', cls: 'exam' },
      EVENTO: { label: 'Evento', cls: 'event' },
      VIAJE:  { label: 'Viaje', cls: 'trip' },
      OTRO:   { label: 'Otro', cls: 'other' },
    };

    const safe = (txt) => String(txt || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const dateObj = new Date(dateIso + 'T00:00:00');
    const dateLabel = isNaN(dateObj.getTime())
      ? dateIso
      : dateObj.toLocaleDateString('es-ES', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

    const items = events.map(ev => {
      const meta = typeMeta[ev.type] || typeMeta.EVENTO;
      const title = safe(ev.title || meta.label);
      const time = safe(ev.start || '');
      const desc = safe((ev.description || '').slice(0, 80));
      return `
        <button class="event-list-item event-list-item--${meta.cls}" data-id="${ev.id}">
          <div class="event-list-main">
            <div class="event-list-title-row">
              <span class="event-list-title">${title}</span>
              <span class="event-list-time">${time}</span>
            </div>
            <div class="event-list-meta-row">
              <span class="event-chip event-chip--${meta.cls}">${meta.label}</span>
              ${desc ? `<span class="event-list-desc">${desc}${ev.description && ev.description.length > 80 ? '…' : ''}</span>` : ''}
            </div>
          </div>
        </button>`;
    }).join('');

    const html = `
      <div class="app-modal-backdrop">
        <div class="app-modal event-list-modal">
          <div class="event-modal-header">
            <h3 class="event-modal-title">Eventos del ${safe(dateLabel)}</h3>
          </div>
          <div class="event-list-body">
            ${items}
          </div>
          <div class="app-modal-actions">
            <button class="btn btn-ghost" id="ev-list-close">Cerrar</button>
          </div>
        </div>
      </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const modal = wrapper.firstElementChild;
    document.body.appendChild(modal);

    const cleanup = () => { try { modal.remove(); } catch {} };
    modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(); });
    modal.querySelector('#ev-list-close')?.addEventListener('click', cleanup);

    modal.querySelectorAll('.event-list-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const evObj = (this.#events || []).find(e => e.id === id);
        if (!evObj) return;
        const canEdit = ['professor', 'admin'].includes(this.#user?.role);
        cleanup();
        this.#openEventModal(evObj, { mode: canEdit ? 'edit' : 'view' });
      });
    });
  }

  async #openEventModal(ev = {}, { mode = 'view' } = {}) {
    const canEdit = ['professor', 'admin'].includes(this.#user?.role);
    const isCreate = mode === 'create';
    const isEdit = mode === 'edit';
    const readOnly = !canEdit || mode === 'view';
    const baseDate = ev.date || (new Date(this.#state.year, this.#state.month, 1).toISOString().slice(0,10));

    // Meta de tipo para etiquetas y estilos
    const typeMeta = {
      EXAMEN: { label: 'Examen', cls: 'exam' },
      EVENTO: { label: 'Evento', cls: 'event' },
      VIAJE:  { label: 'Viaje', cls: 'trip' },
      OTRO:   { label: 'Otro', cls: 'other' },
    };
    const meta = typeMeta[ev.type] || typeMeta.EVENTO;

    // Vista bonita solo lectura para alumnos
    if (readOnly && !canEdit) {
      const title = (ev.title || meta.label || 'Evento').toString();
      const safeText = (txt) => String(txt || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const dateObj = baseDate ? new Date(baseDate + 'T00:00:00') : new Date();
      const dateLabel = isNaN(dateObj.getTime())
        ? baseDate
        : dateObj.toLocaleDateString('es-ES', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

      const startStr = ev.start || '08:00';
      const durationMin = Number(ev.duration || 60);
      let durLabel;
      if (!durationMin || durationMin < 60) {
        durLabel = `${durationMin || 60} min`;
      } else {
        const h = Math.floor(durationMin / 60);
        const m = durationMin % 60;
        durLabel = m ? `${h} h ${m} min` : `${h} h`;
      }

      const htmlView = `
        <div class="app-modal-backdrop">
          <div class="app-modal event-modal event-modal--${meta.cls}">
            <div class="event-modal-header">
              <span class="event-chip event-chip--${meta.cls}">${meta.label}</span>
              <h3 class="event-modal-title">${safeText(title)}</h3>
            </div>
            <div class="event-modal-body">
              <dl class="event-meta">
                <div class="event-meta-row">
                  <dt>Fecha</dt>
                  <dd>${safeText(dateLabel)}</dd>
                </div>
                <div class="event-meta-row">
                  <dt>Hora de inicio</dt>
                  <dd>${safeText(startStr)}</dd>
                </div>
                <div class="event-meta-row">
                  <dt>Duración</dt>
                  <dd>${safeText(durLabel)}</dd>
                </div>
              </dl>
              <div class="event-desc">
                <h4>Descripción</h4>
                <p>${safeText(ev.description || 'Sin descripción adicional.')}</p>
              </div>
            </div>
            <div class="app-modal-actions">
              <button class="btn btn-ghost" id="ev-cancel">Cerrar</button>
            </div>
          </div>
        </div>`;

      const wrapView = document.createElement('div');
      wrapView.innerHTML = htmlView;
      const modalView = wrapView.firstElementChild;
      document.body.appendChild(modalView);
      const cleanupView = () => { try { modalView.remove(); } catch {} };
      modalView.addEventListener('click', (e) => { if (e.target === modalView) cleanupView(); });
      modalView.querySelector('#ev-cancel')?.addEventListener('click', cleanupView);
      return;
    }

    const html = `
      <div class="app-modal-backdrop">
        <div class="app-modal app-modal-wide event-modal event-modal--${meta.cls}">
          <div class="app-modal-title">${isCreate ? 'Nuevo evento' : (isEdit ? 'Editar evento' : 'Detalle de evento')}</div>
          <div class="app-modal-body">
            <div class="form-grid">
              <label>Título
                <input type="text" id="ev-title" value="${ev.title || ''}" ${readOnly ? 'disabled' : ''} />
              </label>
              <label>Tipo
                <select id="ev-type" ${readOnly ? 'disabled' : ''}>
                  <option value="EXAMEN" ${ev.type === 'EXAMEN' ? 'selected' : ''}>Examen</option>
                  <option value="EVENTO" ${!ev.type || ev.type === 'EVENTO' ? 'selected' : ''}>Evento</option>
                  <option value="VIAJE" ${ev.type === 'VIAJE' ? 'selected' : ''}>Viaje</option>
                  <option value="OTRO" ${ev.type === 'OTRO' ? 'selected' : ''}>Otro</option>
                </select>
              </label>
              <label>Fecha
                <input type="date" id="ev-date" value="${baseDate}" ${readOnly ? 'disabled' : ''} />
              </label>
              <label>Hora inicio
                <input type="time" id="ev-start" value="${ev.start || '08:00'}" ${readOnly ? 'disabled' : ''} />
              </label>
              <label>Duración (min)
                <input type="number" id="ev-duration" value="${ev.duration || 60}" min="15" step="15" ${readOnly ? 'disabled' : ''} />
              </label>
            </div>
            <label>Descripción
              <textarea id="ev-desc" rows="4" ${readOnly ? 'disabled' : ''}>${ev.description || ''}</textarea>
            </label>
          </div>
          <div class="app-modal-actions">
            <button class="btn btn-ghost" id="ev-cancel">Cerrar</button>
            ${canEdit && (isCreate || isEdit) ? '<button class="btn" id="ev-save">Guardar</button>' : ''}
            ${canEdit && isEdit ? '<button class="btn btn-ghost" id="ev-delete">Eliminar</button>' : ''}
          </div>
        </div>
      </div>`;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const modal = wrapper.firstElementChild;
    document.body.appendChild(modal);

    const cleanup = () => { try { modal.remove(); } catch {} };
    modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(); });
    modal.querySelector('#ev-cancel')?.addEventListener('click', cleanup);

    if (canEdit && (isCreate || isEdit)) {
      modal.querySelector('#ev-save')?.addEventListener('click', async () => {
        const payload = {
          id: ev.id,
          title: modal.querySelector('#ev-title')?.value?.trim() || 'Evento',
          type: modal.querySelector('#ev-type')?.value || 'EVENTO',
          date: modal.querySelector('#ev-date')?.value,
          start: modal.querySelector('#ev-start')?.value || '08:00',
          duration: Math.max(15, Number(modal.querySelector('#ev-duration')?.value || 60)),
          description: modal.querySelector('#ev-desc')?.value || '',
        };
        try {
          if (!payload.date) throw new Error('La fecha es obligatoria.');
          if (isCreate) {
            await EventsModel.create(payload);
          } else {
            await EventsModel.update(String(ev.id), payload);
          }
          cleanup();
          this.#toast('Evento guardado correctamente.', 'ok');
          await this.#loadMonthEvents();
        } catch (err) {
          this.#toast(err?.message || 'No se pudo guardar el evento.', 'err');
        }
      });

      if (isEdit) {
        modal.querySelector('#ev-delete')?.addEventListener('click', async () => {
          const ok = await this.#confirmDialog('Eliminar evento', '¿Seguro que quieres eliminar este evento?', 'Eliminar', 'Cancelar');
          if (!ok) return;
          try {
            await EventsModel.remove(String(ev.id));
            cleanup();
            this.#toast('Evento eliminado.', 'ok');
            await this.#loadMonthEvents();
          } catch (err) {
            this.#toast(err?.message || 'No se pudo eliminar el evento.', 'err');
          }
        });
      }
    }
  }

  // ---------- Config persistence ----------
  /**
   * Carga configuración persistida del horario para el modo dado.
   */
  #loadCfg(mode='manana'){
    try {
      const key = mode==='tarde' ? 'wf_horario_cfg_tarde' : 'wf_horario_cfg_manana';
      const raw = localStorage.getItem(key);
      const fallback = localStorage.getItem('wf_horario_cfg');
      const cfg = raw ? JSON.parse(raw) : (fallback ? JSON.parse(fallback) : null);
      if (cfg && typeof cfg === 'object') {
        this.#cfg = { startHour: (mode==='tarde'?14:8), endHour: (mode==='tarde'?21:15), hourHeight: 52, slotMinutes: 15, ...cfg };
      } else {
        this.#cfg = { startHour: (mode==='tarde'?14:8), endHour: (mode==='tarde'?21:15), hourHeight: 52, slotMinutes: 15 };
      }
    } catch { this.#cfg = { startHour: (mode==='tarde'?14:8), endHour: (mode==='tarde'?21:15), hourHeight: 52, slotMinutes: 15 }; }
  }
  /**
   * Guarda configuración del horario para el modo dado.
   */
  #saveCfg(mode='manana'){
    try {
      const key = mode==='tarde' ? 'wf_horario_cfg_tarde' : 'wf_horario_cfg_manana';
      localStorage.setItem(key, JSON.stringify(this.#cfg));
    } catch {}
  }
}
