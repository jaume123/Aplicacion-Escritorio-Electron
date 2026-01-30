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
  // Gestión NFC (estado y filtros)
  #nfcUsers = [];
  #nfcFilter = { role: 'all', status: 'all', q: '' };
  #menuItems = {
    alumno: [
      { id: 'mi-perfil', label: 'Mi Perfil' },
      { id: 'asistencias', label: 'Asistencias' },
      { id: 'horario', label: 'Horario' },
      { id: 'contactar', label: 'Contactar' },
    ],
    professor: [
      { id: 'mi-perfil', label: 'Mi Perfil' },
      { id: 'asistencias', label: 'Asistencias' },
      { id: 'alumnos', label: 'Alumnos' },
      { id: 'anadir-evento', label: 'Añadir Evento' },
      { id: 'crear-alumno', label: 'Crear Alumno' },
      { id: 'horario', label: 'Horario' },
      { id: 'contactar', label: 'Contactar' },
    ],
    admin: [
      { id: 'mi-perfil', label: 'Mi Perfil' },
      { id: 'asistencias', label: 'Asistencias' },
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
              <div class="avatar" aria-hidden="true"></div>
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
                <h2>${this.#state.section === 'horario' ? 'Horario' : 'Panel'}</h2>
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
              ${this.#state.section === 'horario' ? this.#renderHorario() : this.#state.section === 'gestion-nfc' ? this.#renderGestionNFC() : `
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
              <h3>NFC ya habilitado</h3>
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
        const result = await ipcRenderer.invoke('nfc:leer', this.#user);
        if (result && result.ok) {
          floatMenu.querySelector('#nfc-status').textContent = '¡NFC guardado! UID: ' + result.uid;
        } else {
          floatMenu.querySelector('#nfc-status').textContent = 'No se pudo guardar el NFC.';
        }
      } catch (err) {
        document.querySelector('#nfc-status').textContent = 'Error: ' + (err.message || err);
      }
    });

    const prev = this.#root.querySelector('#cal-prev');
    const next = this.#root.querySelector('#cal-next');
    if (prev) prev.addEventListener('click', () => { this.#shiftMonth(-1); });
    if (next) next.addEventListener('click', () => { this.#shiftMonth(1); });

    const clearBtn = this.#root.querySelector('#btn-clear-session');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      try {
        localStorage.removeItem('wf_saved_session');
        this.#toast('Sesión guardada eliminada.', 'ok');
      } catch {}
    });

    this.#bindMenu();
    if (this.#state.section === 'horario') this.#bindHorarioEvents();
    if (this.#state.section === 'gestion-nfc' && this.#user?.role === 'admin') this.#bindGestionNFC();
  }

  #monthLabel() {
    const date = new Date(this.#state.year, this.#state.month, 1);
    const month = date.toLocaleString('es-ES', { month: 'long' });
    const label = month.charAt(0).toUpperCase() + month.slice(1);
    return `${label} ${this.#state.year}`;
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
    let dayCounter = 0; // track for matching day numbers only in current month
    const body = weeks.flat().map((val) => {
      if (!val) return '<div class="cal-cell empty"></div>';
      dayCounter += 1;
      const isToday = isThisMonth && Number(val) === today.getDate();
      return `<div class="cal-cell${isToday ? ' today' : ''}">${val}</div>`;
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
    this.render();
  }

  #bindMenu() {
    const menu = this.#root.querySelectorAll('.menu .btn');
    menu.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id === 'horario') {
          this.#state.section = 'horario';
          this.render();
        } else if (id === 'gestion-nfc' && this.#user?.role === 'admin') {
          this.#state.section = 'gestion-nfc';
          this.render();
        } else {
          this.#state.section = 'panel';
          if (id !== 'mi-perfil') this.#toast('Sección en construcción: ' + id, 'warn');
          this.render();
        }
      });
    });
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
      return `
        <div class="nfc-row" data-id="${u._id}">
          <div class="nfc-row-info">
            <div class="user-card small">
              <div class="avatar" aria-hidden="true"></div>
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
      const res = await ipcRenderer.invoke('nfc:leer', { _id: user._id, email: user.email, nombre: user.nombre });
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
                    const re = await ipcRenderer.invoke('nfc:leer', { _id: user._id, email: user.email, nombre: user.nombre });
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
              const re = await ipcRenderer.invoke('nfc:leer', { _id: user._id, email: user.email, nombre: user.nombre });
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
