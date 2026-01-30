# Web Familia · Escritorio (Resumen técnico)

Este proyecto es una aplicación de escritorio construida con Electron para la gestión del alumnado (IES Abastos). Integra lectura NFC para login automático y administración de tarjetas por parte de usuarios con rol admin.

## Tecnologías Utilizadas
- Electron 38.x: shell de escritorio y comunicación IPC entre proceso principal y renderers.
- Node.js/npm: scripts de arranque y dependencias del proyecto.
- MongoDB (driver oficial): persistencia de usuarios, tokens NFC y registros de entrada/salida.
- nfc-pcsc: integración con lectores PC/SC (ACR1252U, etc.) para detectar UID de tarjetas.
- Arquitectura MVC en renderers: `controller`, `model`, `view` para separar responsabilidades.
- CSS propio: modales y toasts personalizados, diseño futurista, sección admin NFC, horario semanal.

## Qué Hemos Implementado
- Login por NFC en escucha continua: el proceso principal emite `nfc:uid` al detectar tarjetas; la vista de login auto-intenta el acceso y registra entrada/salida.
- Gestión de NFC (admin): sección dedicada a listar usuarios, filtrar por rol/estado/búsqueda y realizar acciones de habilitar, deshabilitar o modificar NFC.
- Regla de unicidad de UID: un mismo UID NFC no puede asignarse a más de un usuario; el sistema muestra el propietario en caso de conflicto y facilita acciones admin.
- Modales y toasts: reemplazo de `alert/confirm` nativos por componentes visuales consistentes en toda la app.
- Estabilidad de logout: uso de delegación global y modal de confirmación para evitar pérdida de eventos tras re-renders.

## Arquitectura y Flujos Clave
- Proceso Principal (`index.js`):
	- Ventana principal (Electron) y DevTools.
	- Lector NFC continuo: envía `nfc:uid` a renderers suscritos (`nfc:escuchar-login`/`nfc:detener-escucha`).
	- IPCs: `auth:login`, `auth:registerAlumno`, `nfc:leer`, `nfc:login`, `nfc:get-owner`, `nfc:registrar-entrada-salida`, `nfc:list-users-with-nfc`, `nfc:disable`.
- Capa de Datos (`src/main/db.js`):
	- Conexión singleton a MongoDB, colecciones `usuarios`, `nfctokens`, `registrosEntradaSalida`/`registros`.
	- `guardarNFCToken(uid, user)`: garantiza unicidad; sincroniza `usuarios.nfcToken` y `nfctokens`.
	- `getUsuarioByTokenNFC(token)`: resuelve usuario por `usuarios.nfcToken` o `nfctokens`.
	- `listAllUsersSimple()`, `disableUserNfc(userId)`: utilidades para la sección admin NFC.
- Renderers (MVC):
	- `LoginView`: renderiza login/registro y suscribe `nfc:uid` en modo login.
	- `AuthController`: orquesta la vista y modelo; guarda sesión opcional con `localStorage`.
	- `HomeView`: sección admin NFC, filtros y acciones; horario semanal editable; modales/toasts.
	- `HomeController`: splash, render de Home y logout con confirmación.

## Ejecución
```bash
npm install
npm start
```

## Nota sobre Comentarios en Código
Se han añadido comentarios y bloques JSDoc en archivos clave para facilitar el estudio y la explicación posterior:
- `index.js`: responsabilidades del proceso principal y cada IPC.
- `src/main/db.js`: funciones de acceso a datos y reglas de NFC.
- `src/view/loginView.js`: flujo de render, suscripción NFC y validaciones.
- `src/view/homeView.js`: métodos de renderizado, gestión NFC, horarios y helpers.
- `src/controller/authController.js`: flujo de login/registro y transición a Home.
- `src/controller/homeController.js`: splash, render y cierre de sesión.

Si quieres que añadamos comentarios más detallados en otros módulos o profundizar en tests/documentación adicional, dímelo y lo ampliamos.
# Proyecto-provisional-ESCRITORIO
<p>Aplicación nativa de escritorio para la gestión del alumnado de un centro educativo (IES Abastos)</p>
<p>(recordad hace <code>npm init</code> <code>npm install --save-dev</code></p>
