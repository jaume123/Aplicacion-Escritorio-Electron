
// Modelo para consultar registros de entrada/salida por NFC
const { registrarNFC, getUsuarioByTokenNFC } = require('../main/api');

class AttendanceModel {
  // Consulta los registros de un usuario
  static async getRegistrosPorUsuario(userId) {
    const db = require('../main/db');
    const database = await db.connect();
    return await database.collection('registros').find({ userId: String(userId) }).sort({ fechaHora: -1 }).toArray();
  }

  // Consulta los registros por token
  static async getRegistrosPorToken(token) {
    const db = require('../main/db');
    const database = await db.connect();
    return await database.collection('registros').find({ token }).sort({ fechaHora: -1 }).toArray();
  }
}

module.exports = AttendanceModel;
