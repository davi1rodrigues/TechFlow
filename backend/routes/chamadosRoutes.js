const express = require('express');
const chamados = require('../controllers/chamadosController');
const autenticar = require('../middlewares/authMiddleware');
const permitirPerfis = require('../middlewares/permissaoMiddleware');

const router = express.Router();
router.use(autenticar);
router.get('/categorias', chamados.listarCategorias);
router.post('/categorias', permitirPerfis('admin'), chamados.criarCategoria);
router.get('/:id/historico', chamados.historico);
router.post('/:id/avaliacao', chamados.avaliar);
router.get('/', chamados.listar);
router.get('/:id', chamados.obter);
router.post('/', chamados.criar);
router.put('/:id', chamados.atualizar);
router.delete('/:id', chamados.excluir);

module.exports = router;
