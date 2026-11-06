# TechFlow

Central de atendimento de suporte de TI. O sistema organiza solicitações, permite acompanhar os chamados e prevê a distribuição de trabalho entre técnicos habilitados.

## Entrega 2: banco de dados e autenticação

Esta etapa inclui o esquema relacional MySQL, cadastro e login, armazenamento de senhas com hash bcrypt, emissão e validação de JWT e controle de rotas por perfil. O cadastro público cria somente solicitantes; técnicos e administradores devem ser criados por um administrador/operador autorizado.

### Perfis

- `solicitante`: registra e acompanha os próprios chamados.
- `tecnico`: atende chamados atribuídos e atua conforme suas permissões.
- `admin`: gerencia usuários e acompanha o sistema.

## Tecnologias

- Node.js 20 ou superior, Express e JavaScript
- MySQL 8.0.16 ou superior
- bcryptjs para hash de senha
- JSON Web Token para autenticação

## Estrutura

```text
backend/
  controllers/       Regras de autenticação e consulta de usuários
  database/          Pool de conexão MySQL
  middlewares/       Autenticação JWT e autorização por perfil
  routes/            Rotas da API
  scripts/           Criação segura do primeiro administrador
  server.js
sql/
  techflow.sql       Banco e tabelas relacionadas
frontend/            Interface (próximas etapas)
```

## Configuração e execução

1. Instale MySQL 8 e crie um usuário de banco com permissão sobre `techflow`.
2. Execute `sql/techflow.sql` no MySQL (por exemplo, `mysql -u root -p < sql/techflow.sql`).
3. Copie `backend/.env.example` para `backend/.env` e ajuste as credenciais do banco. Defina `JWT_SECRET` com um segredo aleatório de pelo menos 32 caracteres. Mantenha `.env` fora do Git.
4. No diretório `backend`, instale e inicie:

   ```bash
   npm install
   npm run criar-admin
   npm run dev
   ```

   O script solicita nome, e-mail e senha sem gravar credenciais no repositório. Ele cria o primeiro administrador com senha protegida por bcrypt. Para executar sem modo de desenvolvimento, use `npm start`.

Por padrão, a API fica em `http://localhost:3000`. O CORS aceita `http://localhost:5500`; ajuste `FRONTEND_ORIGIN` para a origem usada pelo frontend. O endpoint `/api/health` verifica a conexão com o banco.

## Rotas desta etapa

| Método | Rota | Acesso | Uso |
|---|---|---|---|
| `POST` | `/api/auth/cadastro` | Público | Cadastra solicitante; recebe `nome`, `email` e `senha` |
| `POST` | `/api/auth/login` | Público | Autentica; recebe `email` e `senha` |
| `GET` | `/api/auth/me` | Autenticado | Retorna o perfil do usuário do token |
| `GET` | `/api/usuarios` | Admin | Lista usuários sem retornar hashes de senha |
| `PATCH` | `/api/usuarios/:id/perfil` | Admin | Altera o perfil para `solicitante`, `tecnico` ou `admin` |
| `GET` | `/api/health` | Público | Verifica API e conexão MySQL |

Para rotas protegidas, envie `Authorization: Bearer <token>`. O cadastro público não aceita perfil enviado pelo cliente. Respostas de login/cadastro incluem o token e os dados públicos do usuário.

O administrador pode atribuir ou remover o perfil de técnico pela rota `PATCH /api/usuarios/:id/perfil`, enviando `{"perfil":"tecnico"}`. A API impede que o administrador altere o próprio perfil.

Exemplo de cadastro:

```json
{
  "nome": "Ana Souza",
  "email": "ana@example.com",
  "senha": "uma-senha-forte"
}
```

## Modelo de dados

- `usuarios`: credenciais, perfil e estado da conta.
- `categorias`: categorias dos atendimentos.
- `tecnico_especialidades`: relação muitos-para-muitos entre técnicos e categorias.
- `chamados`: solicitante, técnico atribuído, categoria, prioridade, situação e solução.

As chaves estrangeiras e índices ficam definidos em `sql/techflow.sql`. O banco registra apenas hash bcrypt; a senha original não é armazenada. Tokens JWT expiram conforme `JWT_EXPIRES_IN` (padrão: `1h`).

## Segurança e limites desta entrega

- Segredos e credenciais são lidos de variáveis de ambiente e `.env` está ignorado pelo Git.
- Consultas usam parâmetros para evitar concatenação de valores fornecidos pelo usuário.
- A API valida token e consulta novamente a conta no banco, então contas desativadas perdem acesso.
- Autorização por perfil é aplicada na API, não depende de esconder elementos de interface.
- O CRUD de chamados, a interface integrada e a distribuição automática serão desenvolvidos nas próximas etapas.
