// 1.
const { app, BrowserWindow } = require('electron');

// 2.
let window;

// 3.
app.on('ready', () => {
  // 4.
  window = new BrowserWindow({
    resizable : false,
    width: 1360 ,
    height: 890,
    webPreferences: { 
     contextIsolation: false,
     nodeIntegration: true
    }
  });
  window.loadFile('index.html');
});