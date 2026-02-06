@PostMapping("/register")
public ResponseEntity<?> registrarUsuario(@RequestBody Usuario usuario) {
    if (usuario.getDni() == null || usuario.getPassword() == null || usuario.getNombre() == null
            || usuario.getApellidos() == null || usuario.getGmail() == null) {
        return ResponseEntity.badRequest()
                .body(Map.of("error", "Todos los campos obligatorios deben ser completados."));
    }

    // Verificar si el usuario ya existe
    Usuario usuarioExistente = usuarioDAO.buscarPorEmail(usuario.getGmail());
    if (usuarioExistente != null) {
        return ResponseEntity.status(409).body(Map.of("error", "El usuario ya está registrado."));
    }

    // Encriptar la contraseña antes de guardar el usuario
    usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));

    // Generar un token NFC único para el usuario
    String nfcToken = "NFC" + System.currentTimeMillis();
    usuario.setNfcToken(nfcToken);

    // Asignar rol predeterminado
    if (usuario.getRol() == null) {
        usuario.setRol(Rol.ALUMNO); // Asignar rol predeterminado
    }

    // Guardar el nuevo usuario
    Usuario nuevoUsuario = usuarioDAO.guardarUsuario(usuario);
    return ResponseEntity.ok(Map.of("usuario", nuevoUsuario, "nfcToken", nfcToken));
}