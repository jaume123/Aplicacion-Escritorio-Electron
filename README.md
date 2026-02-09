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
- Login por DNI + contraseña con JWT; persistencia en `localStorage` y uso en IPC.
- Login por NFC (público) y asignación/gestión de NFC (admin) con unicidad de UID.
- Registrar entrada/salida alterna; listado de asistencias por usuario.
- Listas admin: alumnos y profesores con búsqueda y filtros.
- Crear usuarios: admin puede crear alumnos/profesores; profesor puede crear alumnos.
- Editar perfil (admin): actualización de `dni`, `nombre`, `apellidos`, `gmail`, `rol`, etc.
- UI: cabeceras tipo card, listas en cards, formularios con validación (DNI/email) y feedback.

## Arquitectura y Flujos Clave
- Proceso Principal [index.js](index.js):
  - Ventana principal y lectores NFC.
  - IPCs relevantes: `nfc:leer`, `nfc:login`, `nfc:get-owner`, `nfc:registrar-entrada-salida`, `nfc:list-registros`, `nfc:list-users-with-nfc`, `nfc:disable`, `admin:update-user`, `users:create`.
- Datos de Escritorio [src/main/db.js](src/main/db.js):
  - Conexión Mongo, helpers: `guardarNFCToken`, `getUsuarioByTokenNFC`, `listAllUsersSimple`, `disableUserNfc`, `createUserSimple`.
- API Spring Boot [api/api/src/main/java/com/intermodular/jcc](api/api/src/main/java/com/intermodular/jcc):
  - Controlador `UsuarioController`: `/api/usuarios/login`, `/login-nfc`, `/asignar-nfc`, `/registrar-entrada-salida`, `/registros`, `/actualizar`.
  - Seguridad `WebSecurityConfig`: permite `/login-nfc` y protege el resto con JWT.

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
- POST `/api/usuarios/login-nfc` → body `{ uid }` → login por NFC.
- POST `/api/usuarios/asignar-nfc` → body `{ uid, userId }` (JWT requerido) → asigna NFC.
- POST `/api/usuarios/registrar-entrada-salida` → body `{ uid, userId }` (JWT) → alterna entrada/salida.
- GET  `/api/usuarios/registros?userId=...&limit=50` (JWT) → listado asistencias.
- POST `/api/usuarios/actualizar` → body `{ id, ...fields }` (JWT) → actualiza perfil.

## Uso en la App
- El JWT se guarda en `wf_jwt` y se añade a los IPC que llaman a la API.
- Las listas se actualizan al momento tras editar/crear.
- Validación en formularios: DNI (7–8 dígitos + letra, mayúscula) y email.
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

## Próximos pasos sugeridos
- Validación NIF con cálculo de letra de control.
- Más tests de seguridad y errores (JWT expirado, 401/403).
- Exportación de asistencias (CSV).

---
Proyecto-provisional-ESCRITORIO — Aplicación nativa de escritorio para la gestión del alumnado (IES Abastos).
