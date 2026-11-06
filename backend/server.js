require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./database/conexao');
const authRoutes = require('./routes/authRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres no arquivo .env.');
}

const app = express();
const porta = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5500' }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', banco: 'conectado' });
  } catch (erro) {
    return next(erro);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

app.use((erro, req, res, next) => {
  console.error(erro);
  if (res.headersSent) return next(erro);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
});

app.listen(porta, () => console.log(`TechFlow API disponível em http://localhost:${porta}`));
