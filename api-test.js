(async () => {
  const email = "test@example.com"; // Cambia por un correo válido
  const password = "password123"; // Cambia por una contraseña válida
  const nombre = "NombrePrueba";
  const apellidos = "ApellidoPrueba";
  const dni = "12345678A";

  try {
    // Registro de usuario
    const registerResponse = await fetch(
      "http://localhost:8080/api/usuarios/register",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gmail: email,
          password,
          nombre,
          apellidos,
          dni,
          rol: "ALUMNO",
        }),
      },
    );

    if (!registerResponse.ok) {
      const error = await registerResponse.json();
      console.error("Error en el registro:", error);
      return;
    }

    console.log("Estado del registro:", registerResponse.status);
    const registerResult = await registerResponse.json();
    console.log("Registro exitoso:", registerResult);

    // Extraer el nfcToken del registro
    const nfcToken = registerResult.nfcToken;
    console.log("NFC Token generado:", nfcToken);

    // Login del usuario
    const loginResponse = await fetch(
      "http://localhost:8080/api/usuarios/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gmail: email, password }),
      },
    );

    console.log("Estado del login:", loginResponse.status);
    const loginResult = await loginResponse.json();
    console.log("Login exitoso. Token recibido:", loginResult.token);

    // Guardar el token para futuras solicitudes
    const token = loginResult.token;

    // Ejemplo de solicitud autenticada usando el token
    const protectedResponse = await fetch(
      "http://localhost:8080/api/protected-endpoint",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log("Estado de la solicitud protegida:", protectedResponse.status);
    const protectedResult = await protectedResponse.json();
    console.log("Respuesta de la API protegida:", protectedResult);
  } catch (error) {
    console.error("Error al realizar la solicitud:", error.message);
  }
})();
