# TechFlow — roteiro de apresentação final

## 1. Problema e proposta

Explique que pedidos de suporte recebidos por mensagens, e-mails e conversas ficam espalhados, difíceis de acompanhar e desequilibrados entre técnicos. O TechFlow centraliza o atendimento e direciona cada solicitação a uma pessoa habilitada com menor carga ativa.

## 2. Perfis e acesso

Mostre os três perfis: solicitante, técnico e administrador. Explique que as regras são verificadas na API, além dos controles apresentados na interface. Um solicitante só vê seus chamados; um técnico vê os atribuídos; o administrador gerencia o conjunto.

## 3. Arquitetura e dados

Apresente o frontend em HTML, CSS e JavaScript, que conversa via Fetch com uma API REST em Node.js/Express. A API usa MySQL, bcrypt para senhas, JWT para sessões e middlewares para autenticação e autorização. Mostre as relações entre usuários, categorias, especialidades, chamados, histórico e avaliações no script SQL.

## 4. Demonstração sugerida

Prepare contas de demonstração antes de apresentar; não use senhas reais. Associe um técnico a uma ou mais categorias pela área administrativa.

1. Cadastre e autentique um solicitante.
2. Abra um chamado com categoria e prioridade; mostre a atribuição automática.
3. Entre como técnico e mostre a fila de chamados atribuídos, a atualização automática e os filtros; atualize o status e registre a solução ao concluir.
4. Retorne ao solicitante, consulte o histórico e registre uma avaliação.
5. Entre como administrador e mostre indicadores, perfis, especialidades e reatribuição de chamados.
6. Tente acessar um chamado fora do escopo do perfil, quando houver um segundo usuário de demonstração, e explique que a API bloqueia a operação.

## 5. Fechamento

Retome como a centralização, o acompanhamento por situação, o histórico e a distribuição por especialidade/carga atendem ao problema inicial. Mostre o README, o script SQL e a estrutura do repositório.

## 6. Perguntas para revisar

- Como a API impede um solicitante de alterar o chamado de outra pessoa?
- Como é escolhido o técnico ao abrir um chamado?
- Por que a senha não é salva em texto puro?
- O que acontece se não existir técnico habilitado para uma categoria?
- Que campos são necessários para concluir um chamado?
