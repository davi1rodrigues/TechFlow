const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const obrigatorias = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET'];
const ausentes = obrigatorias.filter((nome) => !process.env[nome]);

if (ausentes.length > 0) {
  throw new Error(
    `Configure backend/.env antes de iniciar. Variáveis ausentes: ${ausentes.join(', ')}. ` +
      'Use backend/.env.example como modelo.',
  );
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET em backend/.env deve ter pelo menos 32 caracteres.');
}

const express = require('express');
const cors = require('cors');
const pool = require('./database/conexao');
const authRoutes = require('./routes/authRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');

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
