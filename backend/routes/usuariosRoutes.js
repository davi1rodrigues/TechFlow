const express = require('express');
const { listar, atualizarPerfil } = require('../controllers/usuariosController');
const autenticar = require('../middlewares/authMiddleware');
const permitirPerfis = require('../middlewares/permissaoMiddleware');

const router = express.Router();

router.get('/', autenticar, permitirPerfis('admin'), listar);
router.patch('/:id/perfil', autenticar, permitirPerfis('admin'), atualizarPerfil);

module.exports = router;
