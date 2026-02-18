# Memoria del Proyecto Web Familia (Escritorio + API)

Esta memoria recoge de forma estructurada la información necesaria para documentar el proyecto Web Familia en su versión de aplicación de escritorio con backend Spring Boot.

## 1. Introducción

### 1.1. Contexto
- Centro educativo: IES Abastos.
- Necesidad: gestionar alumnado, asistencias y comunicación interna utilizando una solución moderna que combine escritorio y servicios web.
- Proyecto compuesto por:
  - Aplicación de escritorio (Electron + Node.js).
  - API REST (Spring Boot + MongoDB).
  - Integración con tarjetas NFC para control de acceso y asistencias.

### 1.2. Objetivos generales
- Facilitar el control de asistencias (entradas/salidas) de alumnos y profesores.
- Permitir la gestión de usuarios (altas, edición de perfil, roles, foto de perfil).
- Disponer de un calendario unificado de eventos académicos (exámenes, viajes, eventos de centro).
- Mantener una arquitectura segura basada en JWT y roles (Alumno, Profesor, Admin).

### 1.3. Objetivos específicos
- Implementar login por DNI + contraseña y login por NFC.
- Registrar asistencias tanto desde el uso de la app como desde el lector NFC físico.
- Permitir al profesorado y a la administración consultar, editar y eliminar asistencias.
- Crear una interfaz moderna y coherente (tema futurista) que mejore la experiencia de uso.

---

## 2. Descripción general del sistema

### 2.1. Componentes principales
- **Aplicación de escritorio (Electron)**
  - Lógica de presentación (HTML/JS/CSS).
  - Arquitectura MVC en el renderer: carpetas `src/controller`, `src/model`, `src/view`.
  - Comunicación con el proceso principal mediante IPC.
  - Integración con lectores NFC (módulo `nfc-pcsc`).
- **Proceso principal Electron** ([index.js](index.js))
  - Lanza la ventana principal.
  - Gestiona los lectores NFC: detección de tarjetas, lectura UID.
  - Expone canales IPC: login NFC, asignación NFC, listado de registros, actualización de usuarios, etc.
- **API Spring Boot** ([api/api](api/api))
  - Controlador `UsuarioController`: autenticación, registro, gestión de usuarios, asistencias.
  - Controlador `EventoController`: eventos de calendario.
  - Controlador `AccesoController`: validación de accesos físicos por NFC (torniquete).
  - Configuración de seguridad `WebSecurityConfig` con JWT.
- **Base de datos MongoDB**
  - Colección `usuarios`: datos básicos, rol, curso, fotoPerfil, nfcToken, etc.
  - Colección `registrosEntradaSalida`: asistencias (entradas/salidas) por usuario.
  - Colección `nfctokens`: mapeo UID NFC → usuario (en la parte Node antiga).
  - Colección `eventos`: eventos de calendario (Spring).

### 2.2. Roles de usuario
- **Alumno**
  - Puede iniciar sesión (DNI + contraseña) o mediante NFC.
  - Visualiza:
    - Panel de calendario con eventos.
    - Sección "Asistencias" con su propio calendario de asistencias.
    - Sección "Mi Perfil" y foto de perfil.
    - Horario.
- **Profesor**
  - Puede:
    - Ver calendario de eventos y crear/editar/borrar eventos.
    - Crear alumnos desde el panel.
    - Ver listas de alumnos.
    - Gestionar asistencias de sus alumnos (consulta y edición/borrado de fichajes).
- **Administrador**
  - Tiene acceso completo a:
    - Gestión NFC (asignación y deshabilitar tokens).
    - Listas de alumnos y profesores.
    - Creación de alumnos y profesores.
    - Gestión de asistencias de alumnos y profesores.
    - Edición de perfiles de usuario.

---

## 3. Arquitectura técnica

### 3.1. Escritorio (Electron)

- **Entrada principal**: [main.js](main.js) → carga `AuthController`.
- **Controladores (renderer)**: carpeta `src/controller`.
  - `authController.js`: flujo de login/registro y arranque del `HomeController`.
  - `homeController.js`: inicializa `HomeView` tras el splash de carga.
- **Modelos (renderer)**: carpeta `src/model`.
  - `authModel.js`: login/registro vía API Spring, gestión de JWT, registro de accesos de la app.
  - `eventsModel.js`: consumo de `/api/eventos` con el JWT.
  - Otros modelos legacy (attendanceModel.js, etc.) para Mongo local (parte antigua Electron).
- **Vistas**: carpeta `src/view`.
  - `loginView.js` (no listado aquí pero parte del flujo): formulario de login.
  - `homeView.js`: vista principal con menú lateral, panel, calendario, perfil, horario, NFC y asistencias.
  - `homeView.js` contiene la lógica de interacción (renderizado + bindings de eventos de UI).
- **Estilos**: carpeta `css`.
  - `home.css`: tema futurista (gradientes, cards, modales, calendario, horario, listas de usuarios, asistencias).
  - `login.css`, `bootstrap.css`: estilos base/login.

### 3.2. Proceso principal Electron

- Archivo: [index.js](index.js)
- Responsabilidades:
  - Crear la ventana principal de la app.
  - Inicializar lectores NFC (`nfc-pcsc`).
  - Exponer canales IPC, por ejemplo:
    - `nfc:leer`: leer un UID NFC para asignarlo a un usuario.
    - `nfc:login`: login automático por NFC, delegando en `/api/usuarios/login-nfc`.
    - `nfc:get-owner`: obtener el usuario propietario de un UID.
    - `nfc:list-registros`: consultar `/api/usuarios/registros`.
    - `admin:update-user`: actualizar datos de usuario en la API.
    - `asistencias:update-registro` y `asistencias:delete-registro`: actualizar y eliminar registros de asistencia.

### 3.3. Backend Spring Boot

- Proyecto en [api/api](api/api).
- **Controlador `UsuarioController`**:
  - `/api/usuarios/login` — login por DNI + contraseña, devuelve `{ usuario, token }`.
  - `/api/usuarios/register` — registro de usuarios (alumnos, profesores, admin).
  - `/api/usuarios/login-nfc` — login por NFC.
  - `/api/usuarios/asignar-nfc` — asignar UID NFC a un usuario (uniqueness de UID).
  - `/api/usuarios/registrar-entrada-salida` — registra entrada/salida alterna por NFC.
  - `/api/usuarios/registrar-entrada-salida-app` — registra entrada/salida desde la app (sin NFC, solo por sesión).
  - `/api/usuarios/registros` — listado de registros de entrada/salida de un usuario.
  - `/api/usuarios/registros/actualizar` — actualización puntual de un registro de asistencia.
  - `/api/usuarios/registros/eliminar` — eliminación de un registro de asistencia.
  - `/api/usuarios/actualizar` — actualización del perfil (dni, nombre, apellidos, gmail, rol, fotoPerfil, baja, verificado).
- **Controlador `EventoController`**:
  - `/api/eventos` (GET/POST) — listar y crear eventos.
  - `/api/eventos/{id}` (PUT/DELETE) — actualizar y eliminar eventos.
- **Controlador `AccesoController`**:
  - `/api/acceso/validar` — validación de acceso por NFC para el torniquete, sin JWT.
- **Seguridad (`WebSecurityConfig`)**:
  - Permite sin autenticación: `/api/usuarios/login`, `/api/usuarios/register`, `/api/usuarios/login-nfc`, `/api/acceso/validar`.
  - Protege el resto de endpoints usando JWT como resource server.

---

## 4. Gestión de asistencias

### 4.1. Registro de asistencias

1. **Desde el torniquete (NFC físico)**
   - El lector NFC envía el UID al endpoint `/api/acceso/validar`.
   - Se comprueba:
     - Que el token NFC está asociado a un usuario.
     - Que el usuario no está de baja/expulsado.
     - Que tiene clase en ese momento (según `HorarioDAO`).
   - Dependiendo del contexto se registra el acceso en `RegistroAcceso` y se devuelve un mensaje al dispositivo físico.

2. **Desde la app de escritorio (inicio/cierre de sesión)**
   - `AuthModel.login`:
     - Tras login correcto, se llama a `AuthModel.registrarAccesoAppForUser(user, "entrada")`.
     - La API (`/api/usuarios/registrar-entrada-salida-app`) inserta un registro con `tipo="entrada"` y `uid="APP"`.
   - `HomeController` en logout y `beforeunload`:
     - Llama a `AuthModel.registrarAccesoAppForUser(user, "salida")`.
     - Se inserta un registro con `tipo="salida"`.

3. **Desde NFC vía API `/registrar-entrada-salida`**
   - El endpoint alterna entrada/salida según el último registro de ese usuario.

### 4.2. Vista de asistencias en la app

Implementada en [src/view/homeView.js](src/view/homeView.js), sección `#renderAsistencias()` y métodos asociados.

- **Estado interno para asistencias**:
  - `#asistYear`, `#asistMonth`: año y mes que se muestran en el calendario de asistencias.
  - `#asistSelectedUser`: usuario cuyas asistencias se consultan (por defecto, el usuario logueado).
  - `#asistByDate`: índice por día con resumen de fichajes (primera entrada, última salida, flag asistió).
- **Carga de datos**:
  - `#loadRegistros(targetUser?)` pide a `ipcMain` → `nfc:list-registros` → `/api/usuarios/registros`.
  - Se cargan hasta 300 registros y se reconstruye el índice por día.
- **Construcción del índice**:
  - `#buildAsistenciasIndex()` agrupa registros del mes/año actual:
    - Separa entradas y salidas.
    - Calcula `primeraEntrada` y `ultimaSalida` por día.
    - Marca `asistio = true` cuando hay al menos una entrada.
- **Calendario de asistencias**:
  - `#renderAsistenciasCalendar()` genera una grid similar al calendario principal:
    - Días con asistencia muestran chip "Asistió" y la franja horaria `HH:MM - HH:MM`.
    - Días sin fichajes aparecen sin chip.
    - El día actual se resalta con la clase `today`.
- **Detalle diario**:
  - Al hacer clic en un día se abre `#openAsistDayModal(dateIso)`:
    - Se muestra una tabla con todas las entradas/salidas de ese día.
    - Columnas: Hora, Tipo (entrada/salida), Origen (UID/APP) y acciones.

### 4.3. Permisos según rol

- **Alumno**
  - Menú → "Asistencias".
  - Ve únicamente sus propias asistencias.
  - Puede abrir el detalle de un día, pero sin botones de edición ni borrado.

- **Profesor**
  - Menú → "Asistencias".
  - Sidebar con lista de alumnos (filtrable por nombre/email).
  - Al seleccionar un alumno, se muestra su calendario de asistencias.
  - En el detalle de día puede:
    - Editar hora/fecha/tipo de un fichaje.
    - Borrar fichajes erróneos.

- **Administrador**
  - Menú → "Asistencias".
  - Sidebar con selector de rol (Alumnos/Profesores) y buscador.
  - Puede ver y gestionar asistencias de ambos colectivos.

### 4.4. Edición y borrado de registros

- **En la vista**:
  - `#openAsistDayModal()` construye una tabla con botones "Editar" y "Borrar" si el rol lo permite.
  - `#deleteRegistro(id)` llama a `ipcRenderer.invoke('asistencias:delete-registro', ...)`.
  - `#openEditRegistroModal(reg)` muestra un formulario para cambiar fecha, hora y tipo.
  - `#updateRegistro(reg, fechaHoraIso, tipo)` llama a `ipcRenderer.invoke('asistencias:update-registro', ...)`.
- **En el proceso principal** ([index.js](index.js)):
  - Handler `asistencias:update-registro` → `POST /api/usuarios/registros/actualizar`.
  - Handler `asistencias:delete-registro` → `POST /api/usuarios/registros/eliminar`.
- **En la API Spring** (`UsuarioController`):
  - `POST /api/usuarios/registros/actualizar` actualiza `tipo` y `fechaHora` de un documento en `registrosEntradaSalida`.
  - `POST /api/usuarios/registros/eliminar` borra un documento por `_id`.

---

## 5. Gestión de usuarios y NFC

### 5.1. Gestión de usuarios

- Registro de alumnos desde pantalla de login (`/api/usuarios/register`).
- Creación de alumnos/profesores desde el panel (admin/profesor) reutilizando el mismo endpoint.
- Edición de perfil del propio usuario en "Mi Perfil" (nombre, apellidos, DNI, email, foto de perfil).
- Edición de perfil avanzada (admin) para cualquier usuario vía `/api/usuarios/actualizar`.

### 5.2. Gestión de NFC

- Asignación de tokens NFC únicos a usuarios: `/api/usuarios/asignar-nfc`.
- Búsqueda y resolución de conflictos de UID (ya asignados a otro usuario).
- Login automático por NFC (`/api/usuarios/login-nfc`) y propagación del JWT a la app.
- Integración con la app para guardar el UID en la colección `usuarios` (`nfcToken`).

---

## 6. Calendario y horario

### 6.1. Calendario de eventos

- Vista principal en `HomeView` (sección "panel").
- Tipos de evento: EXAMEN, EVENTO, VIAJE, OTRO.
- Interacción:
  - Alumnos: sólo lectura.
  - Profesores/Admin: pueden crear, editar y eliminar eventos haciendo clic en los días.

### 6.2. Horario

- Vista "Horario" en `HomeView`.
- Estructura de tabla con días L–V y franjas configurables.
- Utiliza un layout "timetable" estilizado en `home.css`.

---

## 7. Diseño e interfaz de usuario

- Tema futurista con gradientes en fondo y cards.
- Menú lateral con avatar y rol del usuario.
- Cabeceras de panel con navegación de mes, botones Ghost y botones principales.
- Modales (`.app-modal`) reutilizados para confirmaciones, detalles y formularios.
- Toasters (`.app-toast`) para feedback rápido (ok, warn, error).
- Asistencias integradas visualmente:
  - Sidebar de usuarios en tarjetas pequeñas.
  - Calendario con chips "Asistió" y franjas horarias.
  - Tablas minimalistas en los modales de detalle.

---

## 8. Puesta en marcha y despliegue

### 8.1. Requisitos
- Node.js 18+
- npm
- Java 17+
- Maven
- MongoDB en `mongodb://localhost:27017`

### 8.2. Arranque de la API

```bash
cd api/api
mvnw.cmd spring-boot:run   # Windows
# ./mvnw spring-boot:run   # Linux/macOS
```

La API se expone en `http://localhost:8080`.

### 8.3. Arranque de la aplicación de escritorio

```bash
npm install
npm start
```

La aplicación Electron se abrirá con la ventana principal y conectará con la API y MongoDB.

---

## 9. Conclusiones y posibles mejoras

### 9.1. Conclusiones
- Se ha conseguido una solución integrada que combina:
  - Escritorio (Electron) + Web API (Spring Boot).
  - Control de asistencias automático (login/logout) y por NFC.
  - Gestión avanzada de perfiles, roles y fotos de usuario.
  - Herramientas de administración (NFC, creación de usuarios, edición de asistencias).
- La interfaz futurista mejora la usabilidad y da coherencia visual a todas las secciones.

### 9.2. Mejoras futuras
- Exportación de asistencias a CSV/Excel para tutorías y justificaciones.
- Panel de estadísticas de asistencia (por curso, por alumno, por periodo).
- Notificaciones (email o push) para avisos de ausencias repetidas.
- Soporte para otros métodos de autenticación (OIDC, SSO del centro).
- Tests automáticos más completos (unitarios e integración) tanto en la API como en la capa de renderer.

---

> Nota: este documento sirve como base para elaborar la memoria final del proyecto. Se puede ampliar cada sección con capturas de pantalla, diagramas UML (casos de uso, clases y secuencia) y ejemplos reales de flujos (p. ej. "Alumno ficha entrada con NFC", "Profesor corrige una asistencia").
