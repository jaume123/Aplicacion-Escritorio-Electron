export class HomeView {
  #root;
  #user;
  #state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  };
  #menuItems = {
    alumno: [
      { id: 'mi-perfil', label: 'Mi Perfil' },
      { id: 'mi-calendario', label: 'Calendario' },
      { id: 'asistencias', label: 'Asistencias' },
    ],
    professor: [
      { id: 'panel-grupos', label: 'Grupos' },
      { id: 'asistencias', label: 'Asistencias' },
      { id: 'calendario', label: 'Calendario' },
      { id: 'reportes', label: 'Reportes' },
    ],
    admin: [
      { id: 'usuarios', label: 'Usuarios' },
      { id: 'grupos', label: 'Grupos' },
      { id: 'calendario', label: 'Calendario' },
      { id: 'config', label: 'Ajustes' },
      { id: 'reportes', label: 'Reportes' },
    ],
  };

  constructor(rootSelector = '#app', user) {
    this.#root = document.querySelector(rootSelector);
    this.#user = user;
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
              ${items.map(i => `<button class="btn btn-ghost" data-id="${i.id}" disabled>${i.label}</button>`).join('')}
            </nav>
          </aside>

          <main class="content">
            <header class="topbar">
              <div class="left">
                <h2>Panel</h2>
              </div>
              <div class="center">
                <input class="search" type="search" placeholder="Buscar..." aria-label="Buscar" disabled>
              </div>
              <div class="right">
                <button class="btn btn-ghost nfc" id="btn-nfc" title="Habilitar NFC">NFC</button>
                <button class="icon more" title="Más" disabled>⋮</button>
              </div>
            </header>

            <section class="panel">
              <div class="panel-header">
                <button class="icon" aria-label="Mes anterior" id="cal-prev">‹</button>
                <div class="month">${this.#monthLabel()}</div>
                <button class="icon" aria-label="Mes siguiente" id="cal-next">›</button>
              </div>
              <div class="calendar">
                ${this.#renderCalendar()}
              </div>
            </section>
          </main>
        </div>
      </section>
    `;

    // Listeners: NFC placeholder y navegación de calendario
    const nfcBtn = this.#root.querySelector('#btn-nfc');
    if (nfcBtn) nfcBtn.addEventListener('click', () => {
      alert('NFC: funcionalidad próximamente');
    });

    const prev = this.#root.querySelector('#cal-prev');
    const next = this.#root.querySelector('#cal-next');
    if (prev) prev.addEventListener('click', () => { this.#shiftMonth(-1); });
    if (next) next.addEventListener('click', () => { this.#shiftMonth(1); });
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
}
