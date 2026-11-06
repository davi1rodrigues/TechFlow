const mysql = require('mysql2/promise');

const obrigatorias = ['DB_HOST', 'DB_NAME', 'DB_USER'];
const ausentes = obrigatorias.filter((nome) => !process.env[nome]);

if (ausentes.length > 0) {
  throw new Error(`Variáveis de banco ausentes: ${ausentes.join(', ')}`);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
});

module.exports = pool;
