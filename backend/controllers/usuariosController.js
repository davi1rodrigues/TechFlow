const pool = require('../database/conexao');

async function listar(req, res, next) {
  try {
    const [usuarios] = await pool.execute(
      `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.criado_em,
        (SELECT JSON_ARRAYAGG(e.categoria_id) FROM tecnico_especialidades e WHERE e.tecnico_id = u.id) AS categorias
       FROM usuarios u ORDER BY u.criado_em DESC`,
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

async function painel(req, res, next) {
  try {
    const [[totais]] = await pool.execute(
      `SELECT COUNT(*) AS total,
        SUM(status = 'aberto') AS abertos,
        SUM(status = 'em_atendimento') AS em_atendimento,
        SUM(status = 'aguardando_usuario') AS aguardando_usuario,
        SUM(status IN ('resolvido', 'fechado')) AS concluidos
       FROM chamados`,
    );
    const [[avaliacoes]] = await pool.execute('SELECT ROUND(AVG(nota), 1) AS media, COUNT(*) AS quantidade FROM avaliacoes_chamados');
    const [categorias] = await pool.execute(
      'SELECT cat.nome, COUNT(c.id) AS quantidade FROM categorias cat LEFT JOIN chamados c ON c.categoria_id = cat.id GROUP BY cat.id, cat.nome ORDER BY quantidade DESC, cat.nome',
    );
    const [equipe] = await pool.execute(
      `SELECT u.id, u.nome, COUNT(c.id) AS ativos FROM usuarios u
       LEFT JOIN chamados c ON c.tecnico_id = u.id AND c.status IN ('aberto','em_atendimento','aguardando_usuario')
       WHERE u.perfil = 'tecnico' AND u.ativo = TRUE GROUP BY u.id, u.nome ORDER BY ativos DESC, u.nome`,
    );
    return res.json({ totais, avaliacoes, categorias, equipe });
  } catch (erro) { return next(erro); }
}

async function atualizarEspecialidades(req, res, next) {
  let conexao;
  try {
    conexao = await pool.getConnection();
    const id = Number(req.params.id);
    const categorias = req.body.categorias;
    if (!Number.isSafeInteger(id) || id < 1 || !Array.isArray(categorias) || categorias.some((valor) => !Number.isSafeInteger(Number(valor)) || Number(valor) < 1)) {
      return res.status(400).json({ erro: 'Informe uma lista válida de identificadores de categoria.' });
    }
    const unicas = [...new Set(categorias.map(Number))];
    await conexao.beginTransaction();
    const [usuarios] = await conexao.execute("SELECT id FROM usuarios WHERE id = ? AND perfil = 'tecnico' AND ativo = TRUE FOR UPDATE", [id]);
    if (!usuarios.length) { await conexao.rollback(); return res.status(404).json({ erro: 'Técnico ativo não encontrado.' }); }
    if (unicas.length) {
      const placeholders = unicas.map(() => '?').join(',');
      const [existentes] = await conexao.execute(`SELECT id FROM categorias WHERE ativa = TRUE AND id IN (${placeholders})`, unicas);
      if (existentes.length !== unicas.length) { await conexao.rollback(); return res.status(400).json({ erro: 'Uma ou mais categorias não estão disponíveis.' }); }
    }
    await conexao.execute('DELETE FROM tecnico_especialidades WHERE tecnico_id = ?', [id]);
    if (unicas.length) await conexao.query('INSERT INTO tecnico_especialidades (tecnico_id, categoria_id) VALUES ?', [unicas.map((categoriaId) => [id, categoriaId])]);
    await conexao.commit();
    return res.json({ mensagem: 'Especialidades atualizadas.', categorias: unicas });
  } catch (erro) {
    if (conexao) await conexao.rollback();
    return next(erro);
  } finally { if (conexao) conexao.release(); }
}

module.exports = { listar, atualizarPerfil, painel, atualizarEspecialidades };
