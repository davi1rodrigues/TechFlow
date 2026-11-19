const express = require('express');
const { listar, atualizarPerfil, painel, atualizarEspecialidades } = require('../controllers/usuariosController');
const autenticar = require('../middlewares/authMiddleware');
const permitirPerfis = require('../middlewares/permissaoMiddleware');

const router = express.Router();

router.get('/painel', autenticar, permitirPerfis('admin'), painel);
router.get('/', autenticar, permitirPerfis('admin'), listar);
router.patch('/:id/perfil', autenticar, permitirPerfis('admin'), atualizarPerfil);
router.patch('/:id/especialidades', autenticar, permitirPerfis('admin'), atualizarEspecialidades);

module.exports = router;
