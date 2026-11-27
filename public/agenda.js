import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.52.0/+esm';

const db = createClient('https://ddtcafhckklxfzfrdvzy.supabase.co', 'sb_publishable_SU6tuYv4Jeuk4eACbE1kpA_Y8_bS5jl');
const byId = (id) => document.getElementById(id);
const notice = byId('notice');
const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Sao_Paulo',dateStyle:'short'}).format(new Date());
const dateKey = (date) => date.toISOString().slice(0,10);
const dateLabel = (key) => new Date(key+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC'});
const limitDate = new Date(today+'T00:00:00Z');
limitDate.setUTCDate(limitDate.getUTCDate()+730);
const limit = dateKey(limitDate);
let month = new Date(today.slice(0,7)+'-01T00:00:00Z');
let chosen;
let user;
let admin;
let availabilityCall = 0;
let requestCall = 0;
const updating = new Set();
const filters = byId("booking-filters");
const listNotice = byId("list-notice");

function selectDate(key) {
  chosen = key;
  byId('selection').textContent = key ? dateLabel(key)+' · 10h às 21h' : 'Selecione uma data';
  byId('send').disabled = !key;
  byId('block').disabled = !key;
  for (const button of byId('calendar').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.date === key));
  }
}

async function renderCalendar() {
  const call = ++availabilityCall;
  const year = month.getUTCFullYear();
  const index = month.getUTCMonth();
  const last = new Date(Date.UTC(year,index+1,0));
  const grid = byId('calendar');
  grid.replaceChildren();
  byId('calendar-status').textContent = 'Carregando datas…';
  byId('month').textContent = month.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
  byId('prev').disabled = dateKey(month).slice(0,7) <= today.slice(0,7);
  byId('next').disabled = dateKey(month).slice(0,7) >= limit.slice(0,7);
  const {data,error} = await db.rpc('booking_occupied',{start_date:dateKey(month),end_date:dateKey(last)});
  if (call !== availabilityCall) return;
  byId('calendar-status').textContent = error ? 'Não foi possível carregar as datas. Tente novamente.' : '';
  if (error) return selectDate(undefined);
  const occupied = new Set(data);
  for (const day of ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']) {
    const label = document.createElement('span');
    label.textContent = day;
    grid.append(label);
  }
  for(let i=0;i<month.getUTCDay();i++) grid.append(document.createElement('span'));
  for(let day=1;day<=last.getUTCDate();day++){
    const key = dateKey(new Date(Date.UTC(year,index,day)));
    const button = document.createElement('button');
    button.textContent = day;
    const state = key < today ? 'past' : occupied.has(key) ? 'reserved' : key > limit ? 'unavailable' : 'free';
    const labels = { past: 'Já passou', reserved: 'Reservada', unavailable: 'Fora do prazo', free: 'Livre' };
    button.dataset.date = key;
    button.disabled = state !== 'free';
    button.classList.add('is-' + state);
    button.setAttribute('aria-label', dateLabel(key) + ', ' + labels[state]);
    if (state !== 'unavailable') {
      const label = document.createElement('span');
      label.textContent = labels[state];
      label.setAttribute('aria-hidden', 'true');
      button.append(label);
    }
    button.addEventListener('click',()=>selectDate(key));
    grid.append(button);
  }
  selectDate(occupied.has(chosen) ? undefined : chosen);
}

function moveMonth(step) {
  month = new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+step,1));
  selectDate(undefined);
  renderCalendar();
}
byId('prev').onclick = () => moveMonth(-1);
byId('next').onclick = () => moveMonth(1);

function showAuthForm(signup) {
  byId('confirm-panel').hidden = true;
  byId('login-panel').hidden = signup;
  byId('signup-panel').hidden = !signup;
  notice.textContent = '';
  byId(signup ? 'signup' : 'login').querySelector('input').focus();
}
byId('show-signup').onclick = () => showAuthForm(true);
byId('show-login').onclick = () => showAuthForm(false);
byId('confirm-login').onclick = () => showAuthForm(false);

const values = (form) => Object.fromEntries(new FormData(form));
function submit(id, action) {
  byId(id).addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    try { await action(values(form),form); }
    catch { notice.textContent = 'Não foi possível concluir. Tente novamente.'; }
    finally { button.disabled = id === 'request' && !chosen; }
  });
}
submit('login',async ({email,password},form)=>{
  const {error}=await db.auth.signInWithPassword({email,password});
  notice.textContent=error?'Confira o e-mail, a senha e a confirmação do cadastro.':'Sessão iniciada.';
  if(!error) form.reset();
});
submit('signup',async ({email,password,name,phone},form)=>{
  const {data,error}=await db.auth.signUp({email,password,options:{data:{name,phone},emailRedirectTo:location.origin+'/agenda.html'}});
  if (error) {
    notice.textContent = 'Não foi possível cadastrar. Confira os dados e tente novamente.';
    notice.scrollIntoView({block:'nearest'});
    return;
  }
  form.reset();
  if (data.session) {
    notice.textContent = 'Conta criada. Você já pode solicitar uma reserva.';
    return;
  }
  notice.textContent = '';
  byId('login-panel').hidden = true;
  byId('signup-panel').hidden = true;
  byId('confirm-address').textContent = email.trim();
  const panel = byId('confirm-panel');
  panel.hidden = false;
  byId('confirm-title').focus({preventScroll:true});
  panel.scrollIntoView({block:'nearest'});
});
byId('logout').onclick=async()=>{const {error}=await db.auth.signOut();notice.textContent=error?'Não foi possível sair.':'';};

const statuses = {
  pending: 'Pendente',
  confirmed: 'Confirmada',
  declined: 'Recusada ou encerrada',
  blocked: 'Bloqueada'
};
const bookingActions = {
  pending: [
    { label: 'Confirmar evento', status: 'confirmed', tone: 'confirm' },
    { label: 'Recusar pedido', status: 'declined', tone: 'danger', prompt: 'Recusar este pedido?' }
  ],
  confirmed: [
    { label: 'Cancelar evento', status: 'declined', tone: 'danger', prompt: 'Cancelar este evento e liberar a data?' }
  ],
  blocked: [
    { label: 'Remover bloqueio', status: 'declined', tone: 'neutral', prompt: 'Remover o bloqueio e liberar a data?' }
  ]
};

async function updateBooking(entry, action) {
  if (updating.has(entry.id)) return;
  if (action.prompt && !window.confirm(action.prompt)) return;
  updating.add(entry.id);
  try {
    for (const button of byId('list').querySelectorAll('[data-booking-id]')) {
      if (button.dataset.bookingId === entry.id) button.disabled = true;
    }
    const {data, error} = await db.from('booking_requests')
      .update({status: action.status}).eq('id', entry.id).eq('status', entry.status).select('id');
    if (error?.code === '23505') {
      listNotice.textContent = 'Esta data já tem um evento confirmado ou um bloqueio.';
    } else if (error || !data?.length) {
      listNotice.textContent = 'Não foi possível salvar. A solicitação pode ter sido alterada.';
    } else {
      listNotice.textContent = {
        pending: action.status === 'confirmed' ? 'Evento confirmado.' : 'Pedido recusado.',
        confirmed: 'Evento cancelado. A data foi liberada.',
        blocked: 'Bloqueio removido. A data foi liberada.'
      }[entry.status];
    }
  } catch {
    listNotice.textContent = 'Falha de conexão. Confira o status antes de tentar novamente.';
  } finally {
    updating.delete(entry.id);
    await Promise.all([loadRequests(), renderCalendar()]);
  }
}

function bookingCard(entry, canManage) {
  const row = document.createElement('article');
  row.className = 'booking-row';
  const heading = document.createElement('div');
  heading.className = 'booking-heading';
  const title = document.createElement('h3');
  title.textContent = entry.event_type;
  const badge = document.createElement('span');
  badge.className = 'booking-status status-' + entry.status;
  badge.textContent = statuses[entry.status] ?? entry.status;
  heading.append(title, badge);
  const date = document.createElement('p');
  date.className = 'booking-date';
  date.textContent = dateLabel(entry.event_date) + ' · 10h às 21h';
  row.append(heading, date);

  if (canManage && entry.status !== 'blocked') {
    const contact = document.createElement('p');
    contact.textContent = [entry.contact_name, entry.phone, entry.guests + ' convidados'].join(' · ');
    row.append(contact);
  }

  const actions = canManage ? bookingActions[entry.status] : undefined;
  if (actions) {
    const controls = document.createElement('div');
    controls.className = 'booking-actions';
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button booking-action action-' + action.tone;
      button.textContent = action.label;
      button.dataset.bookingId = entry.id;
      button.disabled = updating.has(entry.id);
      button.onclick = () => updateBooking(entry, action);
      controls.append(button);
    }
    row.append(controls);
  }
  return row;
}

async function loadRequests() {
  const call = ++requestCall;
  const activeId = user?.id;
  if (!activeId) return;
  const canManage = admin;
  const container = byId('list');
  const {from, to, status} = values(filters);
  if (canManage && from && to && from > to) {
    container.removeAttribute('aria-busy');
    container.textContent = 'A data final precisa ser igual ou posterior à inicial.';
    return;
  }
  container.setAttribute('aria-busy', 'true');
  let query = db.from('booking_requests').select('*').order('event_date').order('created_at').order('id');
  if (canManage) {
    if (from) query = query.gte('event_date', from);
    if (to) query = query.lte('event_date', to);
    if (status) query = query.eq('status', status);
  }
  const {data, error} = await query;
  if (call !== requestCall || user?.id !== activeId) return;
  container.removeAttribute('aria-busy');
  if (error || !data?.length) {
    container.textContent = error ? 'Não foi possível carregar as solicitações.' : 'Nenhuma solicitação encontrada.';
    return;
  }
  const unique = new Map(data.map((entry) => [entry.id, entry]));
  const cards = document.createDocumentFragment();
  for (const entry of unique.values()) cards.append(bookingCard(entry, canManage));
  container.replaceChildren(cards);
}

filters.addEventListener('submit', (event) => event.preventDefault());
filters.addEventListener('change', loadRequests);
filters.addEventListener('reset', () => setTimeout(loadRequests, 0));

async function saveRequest(entry) {
  if(!chosen) return;
  const {error}=await db.from('booking_requests').insert({...entry,event_date:chosen});
  notice.textContent=error?.code==='23505'?'Já existe um pedido seu ou um bloqueio para essa data.':error?.message==='Esta data já está indisponível.'?error.message:error?'Não foi possível salvar. Confira os dados e tente novamente.':entry.status==='blocked'?'Data bloqueada.':'Solicitação enviada. Aguarde a confirmação.';
  await Promise.all([loadRequests(),renderCalendar()]);
}
submit('request', (entry)=>saveRequest({...entry,guests:Number(entry.guests)}));
byId('block').onclick=async()=>{byId('block').disabled=true;await saveRequest({status:'blocked',event_type:'Bloqueio administrativo',guests:1,contact_name:'Bella Liz',phone:'0000000000'});};

db.auth.onAuthStateChange((_event,session)=>{
  setTimeout(async()=>{
    user=session?.user;
    admin=false;
    requestCall++;
    byId('auth').hidden=Boolean(user);
    byId('account').hidden=!user;
    byId('requests').hidden=!user;
    byId('admin-tools').hidden=true;
    byId('list').removeAttribute('aria-busy');
    listNotice.textContent='';
    byId('list').replaceChildren();
    if(!user) return;
    const activeId=user.id;
    byId('request').elements.contact_name.value=user.user_metadata.name??'';
    byId('request').elements.phone.value=user.user_metadata.phone??'';
    const {data}=await db.rpc('booking_is_admin');
    if (user?.id !== activeId) return;
    admin=data===true;
    byId('admin-tools').hidden=!admin;
    byId('list-title').textContent=admin?'Painel de reservas':'Minhas solicitações';
    loadRequests();
  },0);
});
renderCalendar();
