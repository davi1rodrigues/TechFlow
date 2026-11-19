const API_HOST = window.location.hostname || 'localhost';
const API_PROTOCOL = window.location.protocol === 'https:' ? 'https:' : 'http:';
const API = `${API_PROTOCOL}//${API_HOST}:3000/api`;
const $ = (selector) => document.querySelector(selector);
const authView = $('#auth-view');
const appView = $('#app-view');
const authForm = $('#auth-form');
const ticketForm = $('#ticket-form');
let mode = 'login';
let usuario = null;
let categorias = [];
let chamadosAtuais = [];
let filtroTecnico = 'ativos';
let atualizacaoTecnico = null;
let carregandoChamados = false;
let paginaSolicitante = 'inicio';

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
function showAuth() { authView.hidden = false; appView.hidden = true; $('#user-area').hidden = true; }
function setRequesterPage(page) {
  if (usuario?.perfil !== 'solicitante') return;
  paginaSolicitante = page;
  $('#requester-home').hidden = page !== 'inicio';
  $('#form-panel').hidden = page !== 'novo';
  $('#ticket-list').hidden = page !== 'chamados';
  $('#page-heading').hidden = true;
  document.querySelectorAll('[data-requester-page]').forEach((button) => {
    const selected = button.dataset.requesterPage === page;
    if (button.classList.contains('section-tab')) {
      button.classList.toggle('active', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  });
}
async function startApp(user) {
  usuario = user;
  authView.hidden = true; appView.hidden = false; $('#user-area').hidden = false;
  $('#user-label').textContent = `${user.nome} · ${user.perfil}`;
  $('#welcome').textContent = `Olá, ${user.nome.split(' ')[0]}. Aqui estão as solicitações de suporte.`;
  const isTechnician = user.perfil === 'tecnico';
  const isRequester = user.perfil === 'solicitante';
  $('#requester-nav').hidden = !isRequester;
  $('#home-first-name').textContent = user.nome.split(' ')[0];
  $('#page-heading').hidden = isRequester;
  $('#page-title').textContent = isTechnician ? 'Área do técnico' : 'Chamados';
  $('#technician-workspace').hidden = !isTechnician;
  if (atualizacaoTecnico) clearInterval(atualizacaoTecnico);
  $('#novo-chamado').hidden = true;
  $('#admin-dashboard').hidden = user.perfil !== 'admin';
  $('#user-management').hidden = user.perfil !== 'admin';
  if (isRequester) setRequesterPage('inicio');
  else { $('#requester-home').hidden = true; $('#form-panel').hidden = true; $('#ticket-list').hidden = false; }
  try {
    const dados = await api('/chamados/categorias');
    categorias = dados.categorias;
    ticketForm.elements.categoria_id.innerHTML = categorias.map((cat) => `<option value="${cat.id}">${escapeHTML(cat.nome)}</option>`).join('');
    await loadTickets();
    if (user.perfil === 'admin') await loadDashboard();
    if (isTechnician) atualizacaoTecnico = setInterval(() => loadTickets().catch((error) => setMessage($('#list-message'), error.message)), 20000);
  } catch (error) { setMessage($('#list-message'), error.message); }
}
async function loadDashboard() {
  const [data, usersData] = await Promise.all([api('/usuarios/painel'), api('/usuarios')]);
  const technicians = usersData.usuarios.filter((item) => item.perfil === 'tecnico' && item.ativo);
  ticketForm.elements.tecnico_id.innerHTML = '<option value="">Sem atribuição</option>' + technicians.map((item) => `<option value="${item.id}">${escapeHTML(item.nome)}</option>`).join('');
  $('#user-list').innerHTML = usersData.usuarios.map((item) => `<div class="user-row"><span><b>${escapeHTML(item.nome)}</b><small>${escapeHTML(item.email)}</small></span><select data-profile="${item.id}" aria-label="Perfil de ${escapeHTML(item.nome)}" ${String(item.id) === String(usuario.id) ? 'disabled' : ''}><option value="solicitante" ${item.perfil === 'solicitante' ? 'selected' : ''}>Solicitante</option><option value="tecnico" ${item.perfil === 'tecnico' ? 'selected' : ''}>Técnico</option><option value="admin" ${item.perfil === 'admin' ? 'selected' : ''}>Administrador</option></select>${item.perfil === 'tecnico' ? `<select multiple data-specialties="${item.id}" aria-label="Especialidades de ${escapeHTML(item.nome)}">${categorias.map((cat) => `<option value="${cat.id}" ${(item.categorias || []).map(Number).includes(Number(cat.id)) ? 'selected' : ''}>${escapeHTML(cat.nome)}</option>`).join('')}</select>` : ''}</div>`).join('');
  $('#user-list').querySelectorAll('[data-profile]').forEach((select) => select.addEventListener('change', async () => {
    try { await api(`/usuarios/${select.dataset.profile}/perfil`, { method: 'PATCH', body: JSON.stringify({ perfil: select.value }) }); setMessage($('#list-message'), 'Perfil atualizado.', true); await loadDashboard(); }
    catch (error) { setMessage($('#list-message'), error.message); await loadDashboard(); }
  }));
  $('#user-list').querySelectorAll('[data-specialties]').forEach((select) => select.addEventListener('change', async () => {
    try {
      const values = [...select.selectedOptions].map((option) => Number(option.value));
      await api(`/usuarios/${select.dataset.specialties}/especialidades`, { method: 'PATCH', body: JSON.stringify({ categorias: values }) });
      setMessage($('#list-message'), 'Especialidades do técnico atualizadas.', true);
    } catch (error) { setMessage($('#list-message'), error.message); }
  }));
  const total = data.totais;
  $('#dashboard-stats').innerHTML = [
    ['Total', total.total], ['Abertos', total.abertos || 0], ['Em atendimento', total.em_atendimento || 0],
    ['Aguardando', total.aguardando_usuario || 0], ['Concluídos', total.concluidos || 0],
    ['Avaliação média', data.avaliacoes.media ?? '—'],
  ].map(([label, value]) => `<div class="stat-card"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong></div>`).join('');
  $('#category-stats').innerHTML = data.categorias.map((row) => `<p class="stat-row"><span>${escapeHTML(row.nome)}</span><b>${escapeHTML(row.quantidade)}</b></p>`).join('') || '<p>Sem dados.</p>';
  $('#technician-stats').innerHTML = data.equipe.map((row) => `<p class="stat-row"><span>${escapeHTML(row.nome)}</span><b>${escapeHTML(row.ativos)}</b></p>`).join('') || '<p>Nenhum técnico ativo.</p>';
}
async function loadTickets() {
  if (carregandoChamados) return;
  carregandoChamados = true;
  try {
  const { chamados } = await api('/chamados');
  chamadosAtuais = chamados;
  if (usuario?.perfil === 'solicitante') {
    $('#home-total').textContent = String(chamados.length);
    $('#home-active').textContent = String(chamados.filter((item) => !['resolvido', 'fechado'].includes(item.status)).length);
  }
  if (usuario?.perfil === 'tecnico') {
    const ativos = chamados.filter((item) => !['resolvido', 'fechado'].includes(item.status)).length;
    const concluidos = chamados.length - ativos;
    $('#tech-queue-stats').innerHTML = [['Ativos', ativos], ['Concluídos', concluidos], ['Total atribuídos', chamados.length]]
      .map(([label, value]) => `<div class="stat-card"><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong></div>`).join('');
    $('#queue-updated').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
  }
  const filtro = usuario?.perfil === 'tecnico' ? filtroTecnico : 'todos';
  const chamadosVisiveis = chamados.filter((item) => filtro === 'todos'
    || (filtro === 'ativos' && !['resolvido', 'fechado'].includes(item.status))
    || (filtro === 'concluidos' && ['resolvido', 'fechado'].includes(item.status)));
  const list = $('#ticket-list');
  if (!chamadosVisiveis.length) {
    list.innerHTML = '<div class="empty-state"><b>Nenhum chamado nesta fila</b>Chamados atribuídos a você aparecerão aqui.</div>';
    return;
  }
  list.innerHTML = chamadosVisiveis.map((item) => {
    const requester = usuario.perfil === 'solicitante';
    const canEdit = usuario.perfil === 'admin' || (requester && item.status === 'aberto') || usuario.perfil === 'tecnico';
    const canDelete = usuario.perfil === 'admin' || (requester && item.status === 'aberto');
    const details = usuario.perfil === 'admin'
      ? `Solicitante: ${escapeHTML(item.solicitante)} · Técnico: ${escapeHTML(item.tecnico || 'Não atribuído')}`
      : requester ? `Técnico: ${escapeHTML(item.tecnico || 'Aguardando atribuição')}` : `Solicitante: ${escapeHTML(item.solicitante)}`;
    const canRate = requester && ['resolvido', 'fechado'].includes(item.status) && !item.avaliacao_nota;
    const rating = item.avaliacao_nota ? `<span class="badge">Avaliação: ${escapeHTML(item.avaliacao_nota)}/5</span>` : '';
    return `<article class="ticket"><div><div class="ticket-top"><h3>${escapeHTML(item.titulo)}</h3><span class="badge status-${escapeHTML(item.status)}">${escapeHTML(labelStatus(item.status))}</span><span class="badge priority-${escapeHTML(item.prioridade)}">${escapeHTML(item.prioridade)}</span>${rating}</div><p>${escapeHTML(item.descricao)}</p><div class="ticket-meta"><span>${escapeHTML(item.categoria)}</span><span>${details}</span><span>Atualizado em ${new Date(item.atualizado_em).toLocaleDateString('pt-BR')}</span></div>${item.solucao ? `<p><b>Solução:</b> ${escapeHTML(item.solucao)}</p>` : ''}<div id="history-${item.id}" class="history-list" hidden></div></div><div class="ticket-actions"><button class="button button-secondary" data-history="${item.id}">Histórico</button>${canRate ? `<button class="button button-secondary" data-rate="${item.id}">Avaliar</button>` : ''}${canEdit ? `<button class="button button-secondary" data-edit="${item.id}">Editar</button>` : ''}${canDelete ? `<button class="button button-quiet" data-delete="${item.id}">Excluir</button>` : ''}</div></article>`;
  }).join('');
  list.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => editTicket(chamadosAtuais.find((item) => String(item.id) === button.dataset.edit))));
  list.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteTicket(button.dataset.delete)));
  list.querySelectorAll('[data-history]').forEach((button) => button.addEventListener('click', () => showHistory(button.dataset.history)));
  list.querySelectorAll('[data-rate]').forEach((button) => button.addEventListener('click', () => rateTicket(button.dataset.rate)));
  } finally { carregandoChamados = false; }
}
async function showHistory(id) {
  const target = $(`#history-${id}`);
  if (!target.hidden) { target.hidden = true; return; }
  try {
    const { historico } = await api(`/chamados/${id}/historico`);
    target.innerHTML = historico.length ? historico.map((entry) => {
      let info = {};
      try { info = typeof entry.detalhes === 'string' ? JSON.parse(entry.detalhes) : (entry.detalhes || {}); } catch {}
      let detail = '';
      if (entry.acao === 'atualizado' && info.status) detail = ` · ${labelStatus(info.status_anterior)} → ${labelStatus(info.status)}`;
      if (entry.acao === 'avaliado') detail = ` · Nota ${info.nota}/5`;
      return `<p>${escapeHTML(new Date(entry.criado_em).toLocaleString('pt-BR'))} · ${escapeHTML(entry.usuario || 'Sistema')} · ${escapeHTML(entry.acao)}${escapeHTML(detail)}</p>`;
    }).join('') : '<p>Nenhuma alteração registrada.</p>';
    target.hidden = false;
  } catch (error) { setMessage($('#list-message'), error.message); }
}
async function rateTicket(id) {
  const raw = window.prompt('Que nota você dá ao atendimento? Digite de 1 a 5.');
  if (raw === null) return;
  const nota = Number(raw);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) { setMessage($('#list-message'), 'Informe uma nota inteira de 1 a 5.'); return; }
  const comentario = window.prompt('Comentário (opcional):') || '';
  try {
    await api(`/chamados/${id}/avaliacao`, { method: 'POST', body: JSON.stringify({ nota, comentario }) });
    setMessage($('#list-message'), 'Obrigado pela avaliação!', true);
    await loadTickets(); await loadDashboardIfAdmin();
  } catch (error) { setMessage($('#list-message'), error.message); }
}
async function loadDashboardIfAdmin() { if (usuario.perfil === 'admin') await loadDashboard(); }
function openForm(item = null) {
  ticketForm.reset(); ticketForm.elements.id.value = item?.id || '';
  $('#ticket-form-title').textContent = item ? 'Editar chamado' : 'Abrir chamado';
  ticketForm.elements.titulo.value = item?.titulo || '';
  ticketForm.elements.descricao.value = item?.descricao || '';
  ticketForm.elements.categoria_id.value = item?.categoria_id || categorias[0]?.id || '';
  ticketForm.elements.prioridade.value = item?.prioridade || 'media';
  ticketForm.elements.status.value = item?.status || 'aberto';
  ticketForm.elements.solucao.value = item?.solucao || '';
  ticketForm.elements.tecnico_id.value = item?.tecnico_id || '';
  const techOrAdmin = usuario.perfil === 'tecnico' || usuario.perfil === 'admin';
  $('#status-field').hidden = !item || !techOrAdmin;
  $('#solution-field').hidden = !item || !techOrAdmin;
  $('#technician-field').hidden = !item || usuario.perfil !== 'admin';
  for (const name of ['titulo', 'descricao', 'categoria_id', 'prioridade']) ticketForm.elements[name].disabled = usuario.perfil === 'tecnico';
  if (usuario.perfil === 'solicitante') setRequesterPage('novo');
  $('#form-panel').hidden = false;
  $('#form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function editTicket(item) { openForm(item); }
async function deleteTicket(id) {
  if (!window.confirm('Excluir este chamado? Esta ação não pode ser desfeita.')) return;
  try { await api(`/chamados/${id}`, { method: 'DELETE' }); setMessage($('#list-message'), 'Chamado excluído.', true); await loadTickets(); await loadDashboardIfAdmin(); }
  catch (error) { setMessage($('#list-message'), error.message); }
}
function logout(clear = true) {
  if (atualizacaoTecnico) clearInterval(atualizacaoTecnico);
  atualizacaoTecnico = null;
  if (clear) { localStorage.removeItem('techflow_token'); localStorage.removeItem('techflow_user'); }
  usuario = null; $('#form-panel').hidden = true; $('#requester-nav').hidden = true; $('#requester-home').hidden = true; showAuth();
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
    const data = await api(`/auth/${mode === 'cadastro' ? 'cadastro' : 'login'}`, { method: 'POST', body: JSON.stringify(body) });
    localStorage.setItem('techflow_token', data.token); localStorage.setItem('techflow_user', JSON.stringify(data.usuario));
    await startApp(data.usuario);
  } catch (error) { setMessage($('#auth-message'), error.message); }
});
ticketForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(ticketForm);
  const id = form.get('id');
  const content = { titulo: form.get('titulo'), descricao: form.get('descricao'), categoria_id: Number(form.get('categoria_id')), prioridade: form.get('prioridade') };
  const body = !id ? content : usuario.perfil === 'tecnico'
    ? { status: form.get('status'), solucao: form.get('solucao') }
    : usuario.perfil === 'admin' ? { ...content, status: form.get('status'), solucao: form.get('solucao'), tecnico_id: form.get('tecnico_id') || null } : content;
  try {
    await api(id ? `/chamados/${id}` : '/chamados', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    $('#form-panel').hidden = true; setMessage($('#list-message'), id ? 'Chamado atualizado.' : 'Chamado criado.', true);
    await loadTickets(); await loadDashboardIfAdmin();
    if (usuario.perfil === 'solicitante') setRequesterPage('chamados');
  } catch (error) { setMessage($('#ticket-message'), error.message); }
});
$('#novo-chamado').addEventListener('click', () => openForm());
document.querySelectorAll('[data-requester-page]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.requesterPage === 'novo') openForm();
  else setRequesterPage(button.dataset.requesterPage);
}));
$('#cancelar-edicao').addEventListener('click', () => usuario?.perfil === 'solicitante' ? setRequesterPage('chamados') : ($('#form-panel').hidden = true));
$('#cancelar-form').addEventListener('click', () => usuario?.perfil === 'solicitante' ? setRequesterPage('chamados') : ($('#form-panel').hidden = true));
$('#sair').addEventListener('click', () => logout());
$('#refresh-technician-queue').addEventListener('click', () => loadTickets().catch((error) => setMessage($('#list-message'), error.message)));
$('#technician-filter').addEventListener('change', (event) => { filtroTecnico = event.currentTarget.value; loadTickets().catch((error) => setMessage($('#list-message'), error.message)); });
$('#category-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api('/chamados/categorias', { method: 'POST', body: JSON.stringify({ nome: form.get('nome'), descricao: form.get('descricao') }) });
    setMessage($('#list-message'), 'Categoria criada.', true);
    event.currentTarget.reset();
    const result = await api('/chamados/categorias');
    categorias = result.categorias;
    ticketForm.elements.categoria_id.innerHTML = categorias.map((cat) => `<option value="${cat.id}">${escapeHTML(cat.nome)}</option>`).join('');
    await loadDashboard();
  } catch (error) { setMessage($('#list-message'), error.message); }
});

try {
  if (localStorage.getItem('techflow_token')) api('/auth/me').then((data) => {
    localStorage.setItem('techflow_user', JSON.stringify(data.usuario));
    return startApp(data.usuario);
  }).catch(() => logout());
  else showAuth();
} catch { logout(); }
