# Web Familia · Escritorio + API (Resumen técnico)

Aplicación de escritorio (Electron) con backend Spring Boot + MongoDB para gestión de alumnado (IES Abastos). Incluye lectura NFC, login por DNI, control de asistencias y herramientas de administración (NFC, perfiles y altas de usuarios).

## Tecnologías Utilizadas
- Electron 38.x: shell de escritorio y comunicación IPC.
- Node.js/npm: scripts de arranque y tooling.
- Spring Boot 3.x (API): controladores REST (`UsuarioController`), configuración de seguridad `WebSecurityConfig` (Resource Server JWT).
- JWT (Nimbus): emisión y validación de tokens para endpoints protegidos.
- MongoDB: colecciones `usuarios`, `nfctokens`, `registros`.
- nfc-pcsc: integración con lectores PC/SC (ACR1252U, etc.).
- Arquitectura MVC en renderer: `controller/`, `model/`, `view/`.
- CSS propio: cards, modales y toasts con tema futurista.

## Funcionalidades (estado actual)
- Login por DNI + contraseña contra la API Spring (`/api/usuarios/login`) usando BCrypt y JWT.
- Registro de alumno desde la pantalla de login (`/api/usuarios/register`).
- Login por NFC (público) y asignación/gestión de NFC (admin) con unicidad de UID.
- Registrar entrada/salida alterna mediante NFC; listado de asistencias por usuario.
- **Fichaje automático desde la app** (sin botón "Fichar"):
  - Al iniciar sesión (DNI o NFC) se registra automáticamente una **entrada** vía `/api/usuarios/registrar-entrada-salida-app`.
  - Al cerrar sesión o cerrar la ventana se registra automáticamente una **salida**.
- Listas admin: alumnos y profesores con búsqueda y filtros.
- Crear usuarios desde el panel (admin/profesor) usando la API Spring (mismo formato que registro).
- Editar perfil (admin): actualización de `dni`, `nombre`, `apellidos`, `gmail`, `rol`, etc.
- **Pantalla "Mi Perfil" para cualquier rol**:
  - Muestra tarjeta con avatar grande, nombre completo, Gmail, DNI, nombre, apellidos y contraseña enmascarada.
  - Texto descriptivo según rol (Alumno, Profesor, Administrador) explicando permisos básicos.
  - Botón "Editar información" para que el propio usuario actualice su nombre, apellidos, DNI y Gmail (usa `/api/usuarios/actualizar`).
  - El DNI recordado en `wf_saved_session` se sincroniza al cambiar el DNI desde aquí.
- **Foto de perfil conectada a la API**:
  - Al hacer clic en la foto se abre un popup con la imagen ampliada, mostrando el nombre del usuario.
  - Botón "Nueva foto" permite seleccionar una imagen local; se guarda como `fotoPerfil` en MongoDB a través de `/api/usuarios/actualizar` y se cachea también en `localStorage`.
  - La foto se reutiliza en: avatar lateral de la app, tarjeta de "Mi Perfil", listas de usuarios admin y gestión de NFC (avatars por usuario).
- Calendario mensual con eventos compartidos (exámenes, viajes, eventos de centro).
  - Profesores y admin pueden crear/editar/eliminar eventos.
  - Alumnos ven los eventos en su calendario y pueden abrir el detalle en un modal de solo lectura.
  - Tipos de evento con estilos diferenciados (Examen, Evento, Viaje, Otro) y chips de color.
  - En días con varios eventos se muestra un "+N más" que abre un listado estilizado de todos los eventos de ese día.
- Menú contextual según rol:
  - Alumnos tienen un botón específico "Calendario" para volver rápido al panel de calendario.
  - Profesores y admin disponen de accesos directos a "Añadir Evento", creación de alumnos/profesores y gestión NFC.
- UI: cabeceras tipo card, listas en cards, formularios con validación (DNI/email) y feedback.

## Arquitectura y Flujos Clave
- Proceso Principal [index.js](index.js):
  - Ventana principal y lectores NFC.
  - IPCs relevantes: `nfc:leer`, `nfc:login`, `nfc:get-owner`, `nfc:registrar-entrada-salida`, `nfc:list-registros`, `nfc:list-users-with-nfc`, `nfc:disable`, `admin:update-user`.
- Datos de Escritorio [src/main/db.js](src/main/db.js):
  - Conexión Mongo, helpers: `guardarNFCToken`, `getUsuarioByTokenNFC`, `listAllUsersSimple`, `disableUserNfc`.
  - `listAllUsersSimple` expone también `fotoPerfil` para que el renderer pueda mostrar avatares reales.
  - **Nota**: la creación de usuarios ahora se hace siempre vía API Spring, no directamente desde aquí.
- API Spring Boot [api/api/src/main/java/com/intermodular/jcc](api/api/src/main/java/com/intermodular/jcc):
  - Controlador `UsuarioController`: `/api/usuarios/login`, `/login-nfc`, `/register`, `/asignar-nfc`, `/registrar-entrada-salida`, `/registros`, `/actualizar`.
  - Controlador `EventoController`: `/api/eventos` (listar/crear) y `/api/eventos/{id}` (editar/borrar).
  - Controlador `AccesoController`: `/api/acceso/validar` para el torniquete NFC (sin JWT).
  - Seguridad `WebSecurityConfig`: permite `/api/usuarios/login`, `/api/usuarios/register`, `/api/usuarios/login-nfc`, protege `/api/eventos/**` y el resto de endpoints con JWT como resource server.

## Puesta en Marcha
Prerequisitos: Node.js 18+, Java 17+, MongoDB en `mongodb://localhost:27017`.

1) API (Spring Boot)
```bash
cd api/api
mvnw.cmd spring-boot:run   # Windows
# ./mvnw spring-boot:run   # macOS/Linux
```
La API arranca en `http://localhost:8080`.

2) Escritorio (Electron)
```bash
npm install
npm start
```

## Endpoints principales (API)
- POST `/api/usuarios/login` → body `{ dni, password }` → `{ usuario, token }`.
- POST `/api/usuarios/register` → body `{ dni, nombre, apellidos, gmail, fechaNacimiento, password, rol }` → `{ usuario, nfcToken? }`.
- POST `/api/usuarios/login-nfc` → body `{ uid }` → login por NFC.
- POST `/api/usuarios/asignar-nfc` → body `{ uid, userId }` (JWT requerido) → asigna NFC.
- POST `/api/usuarios/registrar-entrada-salida` → body `{ uid, userId }` (JWT) → alterna entrada/salida.
- POST `/api/usuarios/registrar-entrada-salida-app` → body `{ userId, tipo }` (JWT) → registra entrada/salida asociada a la sesión de la app (sin NFC).
- GET  `/api/usuarios/registros?userId=...&limit=50` (JWT) → listado asistencias.
- POST `/api/usuarios/actualizar` → body `{ id, ...fields }` (JWT) → actualiza perfil.
- GET  `/api/eventos?year=YYYY&month=MM` (JWT) → lista eventos del mes.
- POST `/api/eventos` (JWT, rol PROFESOR/ADMIN) → crea evento.
- PUT  `/api/eventos/{id}` (JWT, rol PROFESOR/ADMIN) → actualiza evento.
- DELETE `/api/eventos/{id}` (JWT, rol PROFESOR/ADMIN) → elimina evento.

## Uso en la App
- El JWT se guarda en `wf_jwt` y se añade a las llamadas HTTP/IPC que requieren autenticación.
- Login y registro de alumnos se realizan siempre contra la API Spring; las contraseñas se almacenan cifradas (BCrypt).
- La creación de usuarios desde el panel (admin/profesor) usa internamente el mismo endpoint de registro.
- Validación en formularios: DNI (7–8 dígitos + letra, mayúscula) y email.
- Asistencias automáticas desde la app:
  - Al iniciar sesión (DNI+contraseña o NFC) se registra automáticamente una **entrada** en `registrosEntradaSalida` con `uid="APP"`.
  - Al cerrar sesión o cerrar la ventana de la aplicación se registra automáticamente una **salida`.
- Calendario:
  - El panel inicial muestra un calendario mensual.
  - Profesores/admin pueden hacer clic en un día para crear un evento (examen, viaje, evento…).
  - Los eventos se guardan en la colección `eventos` vía `EventsModel` y se muestran como chips de color en cada día; si hay varios, se muestra el primero y un enlace `+N más` para ver el resto.
  - Al hacer clic en un evento se abre un popup con los detalles; alumnos lo ven solo lectura con diseño de tarjeta, profesores/admin pueden editar/eliminar.
- Conflictos NFC: se muestra el propietario y acciones para resolver.

## Estructura de carpetas (resumen)
- Escritorio:
  - [index.js](index.js), [src/main](src/main), [src/view](src/view), [src/controller](src/controller), [css](css).
- API:
  - [api/api](api/api) con `pom.xml`, `src/main/java/...`, `src/main/resources/application.properties`.

## Notas y Troubleshooting
- Parseo robusto de respuestas: el proceso principal usa `res.text()` + `JSON.parse` seguro.
- Doble creación corregida: se evita el doble binding del botón “Crear” en `HomeView`.
- Si el lector NFC no está disponible, la UI muestra un mensaje y evita bloquear.
- El antiguo botón manual de "Fichar" se ha eliminado: el fichaje se hace ahora de forma automática según login/logout/cierre de la app.

## Próximos pasos sugeridos
- Validación NIF con cálculo de letra de control.
- Más tests de seguridad y errores (JWT expirado, 401/403).
- Exportación de asistencias (CSV).

---
Proyecto-provisional-ESCRITORIO — Aplicación nativa de escritorio para la gestión del alumnado (IES Abastos).
