const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/conexao');

const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function criarToken(usuario) {
  return jwt.sign(
    { perfil: usuario.perfil },
    process.env.JWT_SECRET,
    {
      subject: String(usuario.id),
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      issuer: 'techflow-api',
      audience: 'techflow-client',
    },
  );
}

async function cadastrar(req, res, next) {
  try {
    const nome = typeof req.body.nome === 'string' ? req.body.nome.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const senha = typeof req.body.senha === 'string' ? req.body.senha : '';

    if (nome.length < 2 || nome.length > 120) {
      return res.status(400).json({ erro: 'O nome deve ter entre 2 e 120 caracteres.' });
    }
    if (email.length > 254 || !emailValido.test(email)) {
      return res.status(400).json({ erro: 'Informe um e-mail válido.' });
    }
    if (senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) {
      return res.status(400).json({ erro: 'A senha deve ter entre 8 e 72 caracteres.' });
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    const [resultado] = await pool.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
      [nome, email, senhaHash, 'solicitante'],
    );

    const usuario = { id: resultado.insertId, nome, email, perfil: 'solicitante' };
    const token = criarToken(usuario);
    return res.status(201).json({ mensagem: 'Cadastro realizado com sucesso.', usuario, token });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
    }
    return next(erro);
  }
}

async function login(req, res, next) {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const senha = typeof req.body.senha === 'string' ? req.body.senha : '';

    if (!emailValido.test(email) || !senha) {
      return res.status(400).json({ erro: 'Informe e-mail e senha válidos.' });
    }

    const [usuarios] = await pool.execute(
      'SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email = ? LIMIT 1',
      [email],
    );
    const usuario = usuarios[0];

    if (!usuario || !usuario.ativo || !(await bcrypt.compare(senha, usuario.senha_hash))) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const dadosPublicos = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    return res.json({ mensagem: 'Login realizado com sucesso.', usuario: dadosPublicos, token: criarToken(dadosPublicos) });
  } catch (erro) {
    return next(erro);
  }
}

async function perfilAtual(req, res, next) {
  try {
    const [usuarios] = await pool.execute(
      'SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios WHERE id = ? LIMIT 1',
      [req.usuario.id],
    );
    if (!usuarios[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    return res.json({ usuario: usuarios[0] });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { cadastrar, login, perfilAtual };
