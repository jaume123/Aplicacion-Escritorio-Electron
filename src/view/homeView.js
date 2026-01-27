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
              ${this.#state.section === 'horario' ? this.#renderHorario() : `
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
    if (nfcBtn) nfcBtn.addEventListener('click', () => {
      // Alterna el brillo: activo cuando no tiene 'toggled'
      nfcBtn.classList.toggle('toggled');
      alert('NFC: funcionalidad próximamente');
    });

    const prev = this.#root.querySelector('#cal-prev');
    const next = this.#root.querySelector('#cal-next');
    if (prev) prev.addEventListener('click', () => { this.#shiftMonth(-1); });
    if (next) next.addEventListener('click', () => { this.#shiftMonth(1); });

    const clearBtn = this.#root.querySelector('#btn-clear-session');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      try {
        localStorage.removeItem('wf_saved_session');
        alert('Sesión guardada eliminada.');
      } catch {}
    });

    this.#bindMenu();
    if (this.#state.section === 'horario') this.#bindHorarioEvents();
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
        } else {
          this.#state.section = 'panel';
          if (id !== 'mi-perfil') alert('Sección en construcción: ' + id);
          this.render();
        }
      });
    });
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
            if (confirm('¿Eliminar asignatura?')){
              const mode = this.#state.horarioMode || 'manana';
              this.#horarios[mode] = (this.#horarios[mode]||[]).filter(x=>x.id!==id);
              this.#horario = this.#horarios[mode];
              this.#saveHorario(mode);
              this.#state.section = 'horario';
              this.render();
            }
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

  #toMinutes(hhmm){
    const [h,m] = (hhmm||'08:00').split(':').map(Number);
    return h*60 + (m||0);
  }
  #formatEnd(start, duration){
    const endMin = this.#toMinutes(start) + (duration||60);
    const h = Math.floor(endMin/60), m = endMin%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // ---------- Config persistence ----------
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
  #saveCfg(mode='manana'){
    try {
      const key = mode==='tarde' ? 'wf_horario_cfg_tarde' : 'wf_horario_cfg_manana';
      localStorage.setItem(key, JSON.stringify(this.#cfg));
    } catch {}
  }
}
