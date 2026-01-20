import { Controller } from './src/controller/controller.js';

const controller = new Controller();

window.onload = () => {
         
  // addEventListeners de la aplicacion
  //document.getElementById('').addEventListener('', () => controller.promptWindow());

  controller.init();

  let url="http://<ip>:<puerto>/api/";

  fetch (url, {
    method: 'GET',// 'POST', 'PUT', 'DELETE'
    headers: {
      'Content-Type': 'application/json',
      //'Autorization': 'Bearer TOKEN',
      //'x-api-key': 'API_KEY'
    }
  })
  .then((value) => value.json())
  .then((value) => console.log(value))
}