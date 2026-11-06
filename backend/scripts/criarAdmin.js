require('dotenv').config();

const readline = require('node:readline/promises');
const { stdin: input, stdout: output } = require('node:process');
const bcrypt = require('bcryptjs');
const pool = require('../database/conexao');

async function executar() {
  const rl = readline.createInterface({ input, output });
  try {
    const nome = (await rl.question('Nome do administrador: ')).trim();
    const email = (await rl.question('E-mail: ')).trim().toLowerCase();
    const senha = await rl.question('Senha (mínimo 8 caracteres): ');

    if (nome.length < 2 || nome.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || senha.length < 8 || Buffer.byteLength(senha, 'utf8') > 72) {
      throw new Error('Dados inválidos. Confira nome, e-mail e tamanho da senha.');
    }

    const hash = await bcrypt.hash(senha, 12);
    await pool.execute(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)',
      [nome, email, hash, 'admin'],
    );
    console.log('Administrador criado com sucesso.');
  } finally {
    rl.close();
    await pool.end();
  }
}

executar().catch((erro) => {
  console.error(`Não foi possível criar o administrador: ${erro.code === 'ER_DUP_ENTRY' ? 'e-mail já cadastrado.' : erro.message}`);
  process.exitCode = 1;
});
