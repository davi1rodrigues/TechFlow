const pool = require('../database/conexao');

const statusValidos = ['aberto', 'em_atendimento', 'aguardando_usuario', 'resolvido', 'fechado'];
const prioridadesValidas = ['baixa', 'media', 'alta', 'urgente'];
const camposChamado = `c.id, c.solicitante_id, c.tecnico_id, c.categoria_id, c.titulo,
  c.descricao, c.prioridade, c.status, c.solucao, c.criado_em, c.atualizado_em,
  cat.nome AS categoria, s.nome AS solicitante, t.nome AS tecnico,
  (SELECT a.nota FROM avaliacoes_chamados a WHERE a.chamado_id = c.id) AS avaliacao_nota`;
const joins = `FROM chamados c JOIN categorias cat ON cat.id = c.categoria_id
  JOIN usuarios s ON s.id = c.solicitante_id LEFT JOIN usuarios t ON t.id = c.tecnico_id`;

function texto(valor, maximo) {
  return typeof valor === 'string' ? valor.trim().slice(0, maximo) : '';
}

async function listarCategorias(req, res, next) {
  try {
    const [categorias] = await pool.execute('SELECT id, nome, descricao FROM categorias WHERE ativa = TRUE ORDER BY nome');
    return res.json({ categorias });
  } catch (erro) { return next(erro); }
}

async function criarCategoria(req, res, next) {
  try {
    const nome = texto(req.body.nome, 80);
    const descricao = texto(req.body.descricao, 255);
    if (nome.length < 2) return res.status(400).json({ erro: 'O nome da categoria deve ter pelo menos 2 caracteres.' });
    const [resultado] = await pool.execute('INSERT INTO categorias (nome, descricao) VALUES (?, ?)', [nome, descricao || null]);
    return res.status(201).json({ mensagem: 'Categoria criada.', categoria: { id: resultado.insertId, nome, descricao } });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe uma categoria com esse nome.' });
    return next(erro);
  }
}

async function listar(req, res, next) {
  try {
    let filtro = '';
    const parametros = [];
    if (req.usuario.perfil === 'solicitante') { filtro = ' WHERE c.solicitante_id = ?'; parametros.push(req.usuario.id); }
    if (req.usuario.perfil === 'tecnico') { filtro = ' WHERE c.tecnico_id = ?'; parametros.push(req.usuario.id); }
    const [chamados] = await pool.execute(`SELECT ${camposChamado} ${joins}${filtro} ORDER BY c.atualizado_em DESC`, parametros);
    return res.json({ chamados });
  } catch (erro) { return next(erro); }
}

async function obter(req, res, next) {
  try {
    const [rows] = await pool.execute(`SELECT ${camposChamado} ${joins} WHERE c.id = ? LIMIT 1`, [req.params.id]);
    const chamado = rows[0];
    if (!chamado) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    if (req.usuario.perfil === 'solicitante' && String(chamado.solicitante_id) !== String(req.usuario.id)) return res.status(403).json({ erro: 'Você só pode consultar seus próprios chamados.' });
    if (req.usuario.perfil === 'tecnico' && String(chamado.tecnico_id) !== String(req.usuario.id)) return res.status(403).json({ erro: 'Você só pode consultar chamados atribuídos a você.' });
    return res.json({ chamado });
  } catch (erro) { return next(erro); }
}

async function criar(req, res, next) {
  try {
    if (req.usuario.perfil !== 'solicitante') return res.status(403).json({ erro: 'Somente solicitantes podem abrir chamados.' });
    const titulo = texto(req.body.titulo, 160);
    const descricao = texto(req.body.descricao, 5000);
    const categoriaId = Number(req.body.categoria_id);
    const prioridade = req.body.prioridade || 'media';
    if (titulo.length < 4) return res.status(400).json({ erro: 'O título deve ter pelo menos 4 caracteres.' });
    if (descricao.length < 10) return res.status(400).json({ erro: 'A descrição deve ter pelo menos 10 caracteres.' });
    if (!Number.isSafeInteger(categoriaId) || categoriaId < 1) return res.status(400).json({ erro: 'Selecione uma categoria válida.' });
    if (!prioridadesValidas.includes(prioridade)) return res.status(400).json({ erro: 'Prioridade inválida.' });
    const [categorias] = await pool.execute('SELECT id FROM categorias WHERE id = ? AND ativa = TRUE', [categoriaId]);
    if (!categorias.length) return res.status(400).json({ erro: 'A categoria selecionada não está disponível.' });

    // Distribui para o técnico habilitado com menos chamados ativos.
    const [tecnicos] = await pool.execute(
      `SELECT u.id FROM usuarios u JOIN tecnico_especialidades e ON e.tecnico_id = u.id
       WHERE u.perfil = 'tecnico' AND u.ativo = TRUE AND e.categoria_id = ?
       ORDER BY (SELECT COUNT(*) FROM chamados c WHERE c.tecnico_id = u.id AND c.status IN ('aberto','em_atendimento','aguardando_usuario')),
       u.id LIMIT 1`, [categoriaId],
    );
    const tecnicoId = tecnicos[0]?.id || null;
    const [resultado] = await pool.execute(
      'INSERT INTO chamados (solicitante_id, tecnico_id, categoria_id, titulo, descricao, prioridade) VALUES (?, ?, ?, ?, ?, ?)',
      [req.usuario.id, tecnicoId, categoriaId, titulo, descricao, prioridade],
    );
    await pool.execute(
      'INSERT INTO historico_chamados (chamado_id, usuario_id, acao, detalhes) VALUES (?, ?, ?, ?)',
      [resultado.insertId, req.usuario.id, 'criado', JSON.stringify({ status: 'aberto', tecnico_id: tecnicoId })],
    );
    const [rows] = await pool.execute(`SELECT ${camposChamado} ${joins} WHERE c.id = ?`, [resultado.insertId]);
    return res.status(201).json({ mensagem: 'Chamado criado com sucesso.', chamado: rows[0] });
  } catch (erro) { return next(erro); }
}

async function atualizar(req, res, next) {
  let conexao;
  try {
    conexao = await pool.getConnection();
    await conexao.beginTransaction();
    const [rows] = await conexao.execute('SELECT * FROM chamados WHERE id = ? FOR UPDATE', [req.params.id]);
    const atual = rows[0];
    if (!atual) { await conexao.rollback(); return res.status(404).json({ erro: 'Chamado não encontrado.' }); }
    const perfil = req.usuario.perfil;
    const dono = String(atual.solicitante_id) === String(req.usuario.id);
    const atribuido = String(atual.tecnico_id) === String(req.usuario.id);
    if (perfil === 'solicitante' && (!dono || atual.status !== 'aberto')) { await conexao.rollback(); return res.status(403).json({ erro: 'Você só pode editar seus chamados enquanto estiverem abertos.' }); }
    if (perfil === 'tecnico' && !atribuido) { await conexao.rollback(); return res.status(403).json({ erro: 'Você só pode atualizar chamados atribuídos a você.' }); }

    let { titulo, descricao, categoria_id: categoriaId, prioridade, status, solucao, tecnico_id: tecnicoId } = req.body;
    titulo = titulo === undefined ? atual.titulo : texto(titulo, 160);
    descricao = descricao === undefined ? atual.descricao : texto(descricao, 5000);
    prioridade = prioridade === undefined ? atual.prioridade : prioridade;
    categoriaId = categoriaId === undefined ? atual.categoria_id : Number(categoriaId);
    status = status === undefined ? atual.status : status;
    solucao = solucao === undefined ? atual.solucao : texto(solucao, 5000);
    tecnicoId = tecnicoId === undefined ? atual.tecnico_id : (tecnicoId === null || tecnicoId === '' ? null : Number(tecnicoId));

    if (titulo.length < 4 || descricao.length < 10) { await conexao.rollback(); return res.status(400).json({ erro: 'Título e descrição devem ter pelo menos 4 e 10 caracteres.' }); }
    if (!Number.isSafeInteger(Number(categoriaId)) || !prioridadesValidas.includes(prioridade) || !statusValidos.includes(status)) { await conexao.rollback(); return res.status(400).json({ erro: 'Categoria, prioridade ou situação inválida.' }); }
    if (['resolvido', 'fechado'].includes(status) && (!solucao || solucao.length < 5)) { await conexao.rollback(); return res.status(400).json({ erro: 'Informe uma solução com pelo menos 5 caracteres para concluir o chamado.' }); }
    if (perfil === 'solicitante' && (status !== atual.status || solucao !== atual.solucao || Number(categoriaId) !== Number(atual.categoria_id) && atual.status !== 'aberto')) { await conexao.rollback(); return res.status(403).json({ erro: 'Solicitantes não podem alterar situação ou solução.' }); }
    if (perfil === 'tecnico' && (titulo !== atual.titulo || descricao !== atual.descricao || Number(categoriaId) !== Number(atual.categoria_id) || prioridade !== atual.prioridade)) { await conexao.rollback(); return res.status(403).json({ erro: 'Técnicos podem atualizar situação e solução do chamado.' }); }
    if (perfil !== 'admin' && String(tecnicoId) !== String(atual.tecnico_id)) { await conexao.rollback(); return res.status(403).json({ erro: 'Somente administradores podem reatribuir chamados.' }); }
    if (perfil === 'admin' && tecnicoId !== null) {
      if (!Number.isSafeInteger(tecnicoId) || tecnicoId < 1) { await conexao.rollback(); return res.status(400).json({ erro: 'Técnico inválido.' }); }
      const [habilitados] = await conexao.execute(
        `SELECT u.id FROM usuarios u JOIN tecnico_especialidades e ON e.tecnico_id = u.id
         WHERE u.id = ? AND u.perfil = 'tecnico' AND u.ativo = TRUE AND e.categoria_id = ?`, [tecnicoId, categoriaId],
      );
      if (!habilitados.length) { await conexao.rollback(); return res.status(400).json({ erro: 'O técnico precisa estar ativo e habilitado para a categoria.' }); }
    }
    const [cats] = await conexao.execute('SELECT id FROM categorias WHERE id = ? AND ativa = TRUE', [categoriaId]);
    if (!cats.length) { await conexao.rollback(); return res.status(400).json({ erro: 'A categoria selecionada não está disponível.' }); }

    await conexao.execute(
      `UPDATE chamados SET titulo = ?, descricao = ?, categoria_id = ?, prioridade = ?, status = ?, solucao = ?, tecnico_id = ? WHERE id = ?`,
      [titulo, descricao, categoriaId, prioridade, status, solucao || null, tecnicoId, req.params.id],
    );
    await conexao.execute(
      'INSERT INTO historico_chamados (chamado_id, usuario_id, acao, detalhes) VALUES (?, ?, ?, ?)',
      [req.params.id, req.usuario.id, String(tecnicoId) !== String(atual.tecnico_id) ? 'reatribuido' : 'atualizado', JSON.stringify({ status_anterior: atual.status, status, tecnico_anterior_id: atual.tecnico_id, tecnico_id: tecnicoId })],
    );
    await conexao.commit();
    const [atualizado] = await pool.execute(`SELECT ${camposChamado} ${joins} WHERE c.id = ?`, [req.params.id]);
    return res.json({ mensagem: 'Chamado atualizado com sucesso.', chamado: atualizado[0] });
  } catch (erro) {
    await conexao.rollback();
    return next(erro);
  } finally { if (conexao) conexao.release(); }
}

async function excluir(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT solicitante_id, status FROM chamados WHERE id = ?', [req.params.id]);
    const chamado = rows[0];
    if (!chamado) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    if (req.usuario.perfil !== 'admin' && !(req.usuario.perfil === 'solicitante' && String(chamado.solicitante_id) === String(req.usuario.id) && chamado.status === 'aberto')) {
      return res.status(403).json({ erro: 'Somente administradores ou o solicitante de um chamado aberto podem excluí-lo.' });
    }
    await pool.execute('DELETE FROM chamados WHERE id = ?', [req.params.id]);
    return res.json({ mensagem: 'Chamado excluído com sucesso.' });
  } catch (erro) { return next(erro); }
}

async function historico(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT solicitante_id, tecnico_id FROM chamados WHERE id = ?', [req.params.id]);
    const chamado = rows[0];
    if (!chamado) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    if (req.usuario.perfil === 'solicitante' && String(chamado.solicitante_id) !== String(req.usuario.id)) return res.status(403).json({ erro: 'Você só pode consultar seus próprios chamados.' });
    if (req.usuario.perfil === 'tecnico' && String(chamado.tecnico_id) !== String(req.usuario.id)) return res.status(403).json({ erro: 'Você só pode consultar chamados atribuídos a você.' });
    const [eventos] = await pool.execute(
      `SELECT h.id, h.acao, h.detalhes, h.criado_em, u.nome AS usuario
       FROM historico_chamados h LEFT JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.chamado_id = ? ORDER BY h.criado_em DESC, h.id DESC`, [req.params.id],
    );
    return res.json({ historico: eventos });
  } catch (erro) { return next(erro); }
}

async function avaliar(req, res, next) {
  try {
    const id = Number(req.params.id);
    const nota = Number(req.body.nota);
    const comentario = typeof req.body.comentario === 'string' ? req.body.comentario.trim().slice(0, 1000) : '';
    if (!Number.isSafeInteger(nota) || nota < 1 || nota > 5) return res.status(400).json({ erro: 'A nota deve ser um número inteiro de 1 a 5.' });
    const [rows] = await pool.execute('SELECT solicitante_id, status FROM chamados WHERE id = ?', [id]);
    const chamado = rows[0];
    if (!chamado) return res.status(404).json({ erro: 'Chamado não encontrado.' });
    if (req.usuario.perfil !== 'solicitante' || String(chamado.solicitante_id) !== String(req.usuario.id)) return res.status(403).json({ erro: 'Somente o solicitante pode avaliar o próprio chamado.' });
    if (!['resolvido', 'fechado'].includes(chamado.status)) return res.status(400).json({ erro: 'A avaliação fica disponível após a conclusão do chamado.' });
    await pool.execute('INSERT INTO avaliacoes_chamados (chamado_id, solicitante_id, nota, comentario) VALUES (?, ?, ?, ?)', [id, req.usuario.id, nota, comentario || null]);
    await pool.execute('INSERT INTO historico_chamados (chamado_id, usuario_id, acao, detalhes) VALUES (?, ?, ?, ?)', [id, req.usuario.id, 'avaliado', JSON.stringify({ nota, comentario: comentario || null })]);
    return res.status(201).json({ mensagem: 'Avaliação registrada. Obrigado pelo retorno.' });
  } catch (erro) {
    if (erro.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Este chamado já foi avaliado.' });
    return next(erro);
  }
}

module.exports = { listarCategorias, criarCategoria, listar, obter, criar, atualizar, excluir, historico, avaliar };
