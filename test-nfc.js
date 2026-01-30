const { NFC } = require('nfc-pcsc');
const nfc = new NFC();

nfc.on('reader', reader => {
  console.log(`Lector detectado: ${reader.name}`);
  reader.on('card', card => {
    console.log('Tarjeta detectada:', card);
  });
  reader.on('error', err => console.error('Error lector:', err));
  reader.on('end', () => console.log('Lector desconectado.'));
});
nfc.on('error', err => console.error('Error NFC:', err));
nfc.on('error', err => {
    console.error('Error general:', err);
});
