const pool = require('../database/conexao');

async function listar(req, res, next) {
  try {
    const [usuarios] = await pool.execute(
      'SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios ORDER BY criado_em DESC',
    );
    return res.json({ usuarios });
  } catch (erro) {
    return next(erro);
  }
}

async function atualizarPerfil(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { perfil } = req.body;
    const perfisValidos = ['solicitante', 'tecnico', 'admin'];

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ erro: 'Identificador de usuário inválido.' });
    }
    if (!perfisValidos.includes(perfil)) {
      return res.status(400).json({ erro: 'Perfil deve ser solicitante, tecnico ou admin.' });
    }
    if (id === req.usuario.id) {
      return res.status(400).json({ erro: 'O administrador não pode alterar o próprio perfil.' });
    }

    const [existentes] = await pool.execute('SELECT id FROM usuarios WHERE id = ? LIMIT 1', [id]);
    if (!existentes[0]) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    await pool.execute(
      'UPDATE usuarios SET perfil = ? WHERE id = ?',
      [perfil, id],
    );
    const [usuarios] = await pool.execute(
      'SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios WHERE id = ? LIMIT 1',
      [id],
    );
    return res.json({ mensagem: 'Perfil atualizado com sucesso.', usuario: usuarios[0] });
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { listar, atualizarPerfil };
