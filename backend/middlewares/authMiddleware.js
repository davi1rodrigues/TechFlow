const jwt = require('jsonwebtoken');
const pool = require('../database/conexao');

async function autenticar(req, res, next) {
  const cabecalho = req.get('authorization') || '';
  const [esquema, token] = cabecalho.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token de acesso não informado.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'techflow-api',
      audience: 'techflow-client',
    });

    const [usuarios] = await pool.execute(
      'SELECT id, nome, email, perfil, ativo FROM usuarios WHERE id = ? LIMIT 1',
      [payload.sub],
    );

    const usuario = usuarios[0];
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: 'Usuário inválido ou desativado.' });
    }

    req.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    };
    return next();
  } catch (erro) {
    if (erro.name === 'JsonWebTokenError' || erro.name === 'TokenExpiredError') {
      return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
    return next(erro);
  }
}

module.exports = autenticar;
