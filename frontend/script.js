const API = 'http://localhost:3000/api';
const $ = (selector) => document.querySelector(selector);
const authView = $('#auth-view');
const appView = $('#app-view');
const authForm = $('#auth-form');
const ticketForm = $('#ticket-form');
let mode = 'login';
let usuario = null;
let categorias = [];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function setMessage(target, message, success = false) {
  target.textContent = message;
  target.classList.toggle('success', success);
}
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = localStorage.getItem('techflow_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try { response = await fetch(`${API}${path}`, { ...options, headers }); }
  catch { throw new Error('Não foi possível conectar à API. Confira se o servidor está iniciado.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) logout(false);
    throw new Error(data.erro || 'Não foi possível concluir a solicitação.');
  }
  return data;
}
function labelStatus(status) {
  return ({ aberto: 'Aberto', em_atendimento: 'Em atendimento', aguardando_usuario: 'Aguardando usuário', resolvido: 'Resolvido', fechado: 'Fechado' })[status] || status;
}
function labelPriority(priority) {
  return ({ baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' })[priority] || priority;
}
function showAuth() {
  authView.hidden = false; appView.hidden = true; $('#user-area').hidden = true;
}
async function startApp(user) {
  usuario = user;
  authView.hidden = true; appView.hidden = false; $('#user-area').hidden = false;
  $('#user-label').textContent = `${user.nome} · ${user.perfil}`;
  $('#welcome').textContent = `Olá, ${user.nome.split(' ')[0]}. Aqui estão as solicitações de suporte.`;
  $('#novo-chamado').hidden = user.perfil !== 'solicitante';
  try {
    const dados = await api('/chamados/categorias');
    categorias = dados.categorias;
    ticketForm.elements.categoria_id.innerHTML = categorias.map((cat) => `<option value="${cat.id}">${escapeHTML(cat.nome)}</option>`).join('');
    await loadTickets();
  } catch (error) { setMessage($('#list-message'), error.message); }
}
async function loadTickets() {
  const { chamados } = await api('/chamados');
  const list = $('#ticket-list');
  if (!chamados.length) {
    list.innerHTML = '<div class="empty-state"><b>Nenhum chamado por aqui</b>Quando uma solicitação for registrada ou atribuída, ela aparecerá nesta lista.</div>';
    return;
  }
  list.innerHTML = chamados.map((item) => {
    const requester = usuario.perfil === 'solicitante';
    const canEdit = usuario.perfil === 'admin' || (requester && item.status === 'aberto') || usuario.perfil === 'tecnico';
    const canDelete = usuario.perfil === 'admin' || (requester && item.status === 'aberto');
    const details = usuario.perfil === 'admin' ? `Solicitante: ${escapeHTML(item.solicitante)} · Técnico: ${escapeHTML(item.tecnico || 'Não atribuído')}` : (requester ? `Técnico: ${escapeHTML(item.tecnico || 'Aguardando atribuição')}` : `Solicitante: ${escapeHTML(item.solicitante)}`);
    return `<article class="ticket"><div><div class="ticket-top"><h3>${escapeHTML(item.titulo)}</h3><span class="badge status-${escapeHTML(item.status)}">${escapeHTML(labelStatus(item.status))}</span><span class="badge priority-${escapeHTML(item.prioridade)}">${escapeHTML(labelPriority(item.prioridade))}</span></div><p>${escapeHTML(item.descricao)}</p><div class="ticket-meta"><span>${escapeHTML(item.categoria)}</span><span>${details}</span><span>Atualizado em ${new Date(item.atualizado_em).toLocaleDateString('pt-BR')}</span></div>${item.solucao ? `<p><b>Solução:</b> ${escapeHTML(item.solucao)}</p>` : ''}</div><div class="ticket-actions">${canEdit ? `<button class="button button-secondary" data-edit="${item.id}">Editar</button>` : ''}${canDelete ? `<button class="button button-quiet" data-delete="${item.id}">Excluir</button>` : ''}</div></article>`;
  }).join('');
  list.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => editTicket(chamados.find((item) => String(item.id) === button.dataset.edit))));
  list.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteTicket(button.dataset.delete)));
}
function openForm(item = null) {
  ticketForm.reset(); ticketForm.elements.id.value = item?.id || '';
  $('#ticket-form-title').textContent = item ? 'Editar chamado' : 'Abrir chamado';
  ticketForm.elements.titulo.value = item?.titulo || '';
  ticketForm.elements.descricao.value = item?.descricao || '';
  ticketForm.elements.categoria_id.value = item?.categoria_id || categorias[0]?.id || '';
  ticketForm.elements.prioridade.value = item?.prioridade || 'media';
  ticketForm.elements.status.value = item?.status || 'aberto';
  ticketForm.elements.solucao.value = item?.solucao || '';
  const techOrAdmin = usuario.perfil === 'tecnico' || usuario.perfil === 'admin';
  $('#status-field').hidden = !item || !techOrAdmin;
  $('#solution-field').hidden = !item || !techOrAdmin;
  for (const name of ['titulo', 'descricao', 'categoria_id', 'prioridade']) ticketForm.elements[name].disabled = usuario.perfil === 'tecnico';
  $('#form-panel').hidden = false;
  $('#form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function editTicket(item) { openForm(item); }
async function deleteTicket(id) {
  if (!window.confirm('Excluir este chamado? Esta ação não pode ser desfeita.')) return;
  try { await api(`/chamados/${id}`, { method: 'DELETE' }); setMessage($('#list-message'), 'Chamado excluído.', true); await loadTickets(); }
  catch (error) { setMessage($('#list-message'), error.message); }
}
function logout(clear = true) {
  if (clear) { localStorage.removeItem('techflow_token'); localStorage.removeItem('techflow_user'); }
  usuario = null; $('#form-panel').hidden = true; showAuth();
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  mode = tab.dataset.mode;
  document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab));
  $('#nome-field').hidden = mode !== 'cadastro';
  authForm.elements.nome.required = mode === 'cadastro';
  authForm.elements.senha.autocomplete = mode === 'cadastro' ? 'new-password' : 'current-password';
  $('#auth-title').textContent = mode === 'cadastro' ? 'Crie sua conta' : 'Acesse sua conta';
  authForm.querySelector('button[type="submit"]').textContent = mode === 'cadastro' ? 'Criar conta' : 'Entrar';
  setMessage($('#auth-message'), '');
}));
authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(authForm);
  const body = { email: form.get('email'), senha: form.get('senha') };
  if (mode === 'cadastro') body.nome = form.get('nome');
  try {
    const data = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(body) });
    localStorage.setItem('techflow_token', data.token); localStorage.setItem('techflow_user', JSON.stringify(data.usuario));
    await startApp(data.usuario);
  } catch (error) { setMessage($('#auth-message'), error.message); }
});
ticketForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(ticketForm);
  const id = form.get('id');
  const conteudo = { titulo: form.get('titulo'), descricao: form.get('descricao'), categoria_id: Number(form.get('categoria_id')), prioridade: form.get('prioridade') };
  const body = !id ? conteudo : usuario.perfil === 'tecnico'
    ? { status: form.get('status'), solucao: form.get('solucao') }
    : usuario.perfil === 'admin' ? { ...conteudo, status: form.get('status'), solucao: form.get('solucao') } : conteudo;
  try {
    await api(id ? `/chamados/${id}` : '/chamados', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    $('#form-panel').hidden = true; setMessage($('#list-message'), id ? 'Chamado atualizado.' : 'Chamado criado.', true); await loadTickets();
  } catch (error) { setMessage($('#ticket-message'), error.message); }
});
$('#novo-chamado').addEventListener('click', () => openForm());
$('#cancelar-edicao').addEventListener('click', () => { $('#form-panel').hidden = true; });
$('#cancelar-form').addEventListener('click', () => { $('#form-panel').hidden = true; });
$('#sair').addEventListener('click', () => logout());

try {
  const hasSession = Boolean(localStorage.getItem('techflow_token'));
  if (hasSession) api('/auth/me').then((data) => {
    localStorage.setItem('techflow_user', JSON.stringify(data.usuario));
    return startApp(data.usuario);
  }).catch(() => logout());
  else showAuth();
} catch { logout(); }
