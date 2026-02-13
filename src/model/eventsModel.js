export class EventsModel {
  static #BASE_URL = 'http://localhost:8080/api/eventos';

  static #getToken() {
    try {
      return localStorage.getItem('wf_jwt');
    } catch {
      return null;
    }
  }

  static #authHeaders() {
    const token = this.#getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  static #fromApi(ev) {
    if (!ev) return null;
    return {
      id: ev.id,
      title: ev.titulo,
      description: ev.descripcion || '',
      date: ev.fecha, // 'YYYY-MM-DD'
      start: ev.horaInicio || '08:00',
      duration: ev.duracionMinutos || 60,
      type: (ev.tipo || 'OTRO').toUpperCase(),
    };
  }

  static async listMonth(year, monthIndex) {
    const month = monthIndex + 1; // JS 0-11 -> API 1-12
    const url = `${this.#BASE_URL}?year=${year}&month=${month}`;
    const res = await fetch(url, { method: 'GET', headers: this.#authHeaders() });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* noop */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return Array.isArray(data) ? data.map(this.#fromApi) : [];
  }

  static async create(event) {
    const body = {
      titulo: event.title,
      descripcion: event.description,
      fecha: event.date,
      horaInicio: event.start,
      duracionMinutos: event.duration,
      tipo: event.type,
    };
    const res = await fetch(this.#BASE_URL, {
      method: 'POST',
      headers: this.#authHeaders(),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* noop */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return this.#fromApi(data);
  }

  static async update(id, event) {
    const body = {
      titulo: event.title,
      descripcion: event.description,
      fecha: event.date,
      horaInicio: event.start,
      duracionMinutos: event.duration,
      tipo: event.type,
    };
    const res = await fetch(`${this.#BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: this.#authHeaders(),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* noop */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return this.#fromApi(data);
  }

  static async remove(id) {
    const res = await fetch(`${this.#BASE_URL}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.#authHeaders(),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* noop */ }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || (text && text.trim()) || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }
}
