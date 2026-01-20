// hacer los imports de las clases del modelo
import { Modelo } from '../model/modelo.js';
//
//

// hacer imports de las clases de la vista
import { View } from '../view/view.js';

export class Controller {

    // Access to view and model classes as private fields
    #modelo1
    #view

    // Instantiating classes
    constructor() {
        this.#modelo1 = new Modelo();
        this.#view = new View();
    }

    // Initializing classes
    init() {
        this.#view.init();
    }

    // Controller methods...

    /**
     * Muestra y oculta la ventana de alta de productos llamando al metodo con el mismo nombre de la vista
     */ 
    promptWindow() {
        console.log("Hola!")
        //this.#view.promptWindow();
    }
}