const express = require('express');
const chamados = require('../controllers/chamadosController');
const autenticar = require('../middlewares/authMiddleware');

const router = express.Router();
router.use(autenticar);
router.get('/categorias', chamados.listarCategorias);
router.get('/', chamados.listar);
router.get('/:id', chamados.obter);
router.post('/', chamados.criar);
router.put('/:id', chamados.atualizar);
router.delete('/:id', chamados.excluir);

module.exports = router;
