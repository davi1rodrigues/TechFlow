# TechFlow

Central de atendimento de suporte de TI. O TechFlow reúne solicitações, acompanha o trabalho da equipe e distribui chamados novos para técnicos habilitados com menos atendimentos ativos.

## Entrega 4 — projeto completo e apresentação

A versão final inclui cadastro e login, autenticação JWT, perfis com autorização validada na API, banco MySQL, CRUD integrado de chamados, distribuição automática, histórico, avaliação do atendimento e painel administrativo. O painel permite gerenciar perfis, especialidades dos técnicos e categorias; administradores também podem reatribuir chamados a técnicos habilitados para a categoria.

## Tecnologias

- Node.js 20 ou superior, Express e JavaScript
- MySQL 8.0.16 ou superior
- HTML, CSS e JavaScript no frontend
- Fetch API para integração com a API REST
- bcryptjs para proteger senhas e JSON Web Token para autenticação

## Estrutura

```text
backend/
  controllers/       Regras de autenticação, usuários e chamados
  database/          Pool de conexão MySQL
  middlewares/       Autenticação JWT e autorização por perfil
  routes/            Rotas da API
  scripts/           Criação segura do primeiro administrador
  server.js
frontend/            Interface web integrada
sql/techflow.sql     Banco, tabelas, chaves e categorias iniciais
docs/apresentacao.md Roteiro da demonstração final
```

## Instalação e execução

1. Instale Node.js 20+ e MySQL 8.0.16+.
2. Execute o script SQL para criar o banco e suas tabelas. Se já configurou uma versão anterior do projeto, execute o script novamente para incluir as tabelas de histórico e avaliações:

   ```bash
   mysql -u root -p < sql/techflow.sql
   ```

3. Crie `backend/.env` a partir de `backend/.env.example`. Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`. Substitua `JWT_SECRET` por um segredo aleatório com pelo menos 32 caracteres. Não envie `.env` ao GitHub.

   No PowerShell:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   ```

4. Instale as dependências e crie o primeiro administrador:

   ```powershell
   cd backend
   npm.cmd install
   npm.cmd run criar-admin
   npm.cmd run dev
   ```

   O script solicita nome, e-mail e senha do administrador. Para iniciar sem modo de desenvolvimento, use `npm.cmd start`.

5. Sirva a pasta `frontend` com Live Server (porta 5500 ou 5501) e acesse a página exibida pelo servidor. A API fica em `http://localhost:3000`; `GET /api/health` informa se ela e o MySQL estão acessíveis.

O backend carrega `backend/.env` com base no caminho do próprio arquivo. A configuração padrão de CORS aceita `localhost` e `127.0.0.1` nas portas 5500 e 5501; use `FRONTEND_ORIGIN` para outra origem de desenvolvimento.

## Fluxos principais

- **Solicitante:** cria conta, abre chamados, consulta os próprios registros e pode editá-los ou excluí-los enquanto estiverem abertos. Depois da conclusão, pode deixar uma avaliação de 1 a 5 e um comentário.
- **Técnico:** tem uma fila própria dos chamados atribuídos a si, com atualização automática a cada 20 segundos e botão para atualizar na hora. Pode filtrar ativos e concluídos e atualizar a situação e a solução. Para receber chamados de uma categoria, precisa estar habilitado nela.
- **Administrador:** acompanha os chamados, indicadores, avaliações e carga ativa da equipe; altera perfis, administra categorias e especialidades, e reatribui chamados somente a técnicos ativos e habilitados para a categoria.
- **Distribuição automática:** um chamado novo é enviado ao técnico ativo e habilitado na categoria que tem menos chamados ativos. Sem técnico elegível, fica sem atribuição até a administração encaminhá-lo.
- **Histórico:** registra abertura, atualizações, reatribuições e avaliações. Solicitantes veem o histórico dos próprios chamados; técnicos veem os que estão atribuídos a eles; administradores consultam todos.

## Rotas da API

As rotas marcadas como autenticadas exigem `Authorization: Bearer <token>`.

| Método | Rota | Acesso | Uso |
|---|---|---|---|
| `GET` | `/api/health` | Público | Estado da API e conexão MySQL |
| `POST` | `/api/auth/cadastro` | Público | Criar conta de solicitante |
| `POST` | `/api/auth/login` | Público | Entrar e receber JWT |
| `GET` | `/api/auth/me` | Autenticado | Consultar a conta do token |
| `GET` | `/api/chamados/categorias` | Autenticado | Listar categorias ativas |
| `POST` | `/api/chamados/categorias` | Admin | Cadastrar categoria |
| `GET` | `/api/chamados` | Autenticado | Listar chamados visíveis ao perfil |
| `GET` | `/api/chamados/:id` | Autenticado | Consultar um chamado dentro do escopo do perfil |
| `POST` | `/api/chamados` | Solicitante | Abrir chamado; a API escolhe o técnico elegível |
| `PUT` | `/api/chamados/:id` | Conforme perfil | Atualizar campos permitidos; admin pode reatribuir |
| `DELETE` | `/api/chamados/:id` | Admin ou dono aberto | Excluir chamado conforme as regras de acesso |
| `GET` | `/api/chamados/:id/historico` | Autenticado | Consultar histórico conforme o escopo do perfil |
| `POST` | `/api/chamados/:id/avaliacao` | Solicitante dono | Avaliar chamado concluído, uma única vez |
| `GET` | `/api/usuarios` | Admin | Listar dados públicos dos usuários e especialidades |
| `GET` | `/api/usuarios/painel` | Admin | Indicadores, avaliações, categorias e carga por técnico |
| `PATCH` | `/api/usuarios/:id/perfil` | Admin | Alterar perfil sem permitir autoalteração |
| `PATCH` | `/api/usuarios/:id/especialidades` | Admin | Definir as categorias atendidas pelo técnico |

## Regras e segurança

- Cadastro público cria somente solicitantes. O primeiro administrador é criado pelo script local.
- As senhas são armazenadas como hash bcrypt. A API valida JWT e confirma a conta no banco em cada requisição protegida.
- As permissões são verificadas no backend; esconder um botão no navegador não substitui autorização.
- Chamados resolvidos ou fechados precisam ter uma solução registrada. Solicitantes só atuam nos próprios chamados abertos, e técnicos só nos que estão atribuídos a eles.
- As consultas ao banco usam parâmetros preparados; o código não guarda credenciais.
- O `.gitignore` deve manter `backend/.env` e `node_modules` fora do repositório.

## Apresentação e demonstração

Use o roteiro em [docs/apresentacao.md](docs/apresentacao.md). Ele cobre o problema, a solução, a arquitetura, os perfis, a demonstração do sistema e perguntas que podem surgir.

## GitHub

Mantenha as quatro entregas no mesmo repositório. Atualize este README quando a solução mudar, mantenha o script SQL e registre alterações em commits que descrevam o trabalho realizado. Não publique dependências instaladas localmente, arquivos `.env`, senhas, tokens ou credenciais.
