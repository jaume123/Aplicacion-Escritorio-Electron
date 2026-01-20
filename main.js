// Arranque del renderer con el controlador de autenticación
import { AuthController } from './src/controller/authController.js';

const controller = new AuthController();

window.onload = () => {
         
  // addEventListeners de la aplicacion
  //document.getElementById('').addEventListener('', () => controller.promptWindow());

  // Inicializa el flujo de login (MVC)
  controller.init();

  // Placeholder del futuro consumo de API
  // const url = "http://<ip>:<puerto>/api/";
  // fetch(url).then(r => r.json()).then(console.log);
}