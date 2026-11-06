const express = require('express');
const { cadastrar, login, perfilAtual } = require('../controllers/authController');
const autenticar = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/cadastro', cadastrar);
router.post('/login', login);
router.get('/me', autenticar, perfilAtual);

module.exports = router;
