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
    const taken = occupied.has(key);
    button.dataset.date = key;
    button.disabled = taken || key<today || key>limit;
    button.classList.toggle('occupied',taken);
    button.setAttribute('aria-label',dateLabel(key)+(taken ? ', reservado' : ''));
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
  const {error}=await db.auth.signUp({email,password,options:{data:{name,phone},emailRedirectTo:location.origin+'/agenda.html'}});
  notice.textContent=error?'Não foi possível cadastrar. Confira os dados e tente novamente.':'Confira seu e-mail para confirmar a conta.';
  if(!error) form.reset();
});
byId('logout').onclick=async()=>{const {error}=await db.auth.signOut();notice.textContent=error?'Não foi possível sair.':'';};

async function loadRequests() {
  if (!user) return;
  const container=byId('list');
  container.replaceChildren();
  const {data,error}=await db.from('booking_requests').select('*').order('event_date');
  if(!user) return;
  if(error || !data.length){
    container.textContent=error?'Não foi possível carregar as solicitações.':'Nenhuma solicitação ainda.';
    return;
  }
  const statuses={pending:'Pendente',confirmed:'Confirmada',declined:'Recusada ou encerrada',blocked:'Bloqueada'};
  for(const entry of data){
    const row=document.createElement('article');
    row.className='booking-row';
    const detail=document.createElement('p');
    detail.textContent=[dateLabel(entry.event_date),entry.event_type,statuses[entry.status],...(admin && entry.status!=='blocked' ? [entry.contact_name,entry.phone,entry.guests+' convidados'] : [])].join(' · ');
    row.append(detail);
    const actions=entry.status==='pending' ? [['Confirmar','confirmed'],['Recusar','declined']] : [['Liberar data','declined']];
    if(admin && entry.status!=='declined'){
      for(const [label,status] of actions){
        const button=document.createElement('button');
        button.className='button outline';
        button.textContent=label;
        button.onclick=async()=>{
          button.disabled=true;
          const {data: updated,error}=await db.from('booking_requests').update({status}).eq('id',entry.id).eq('status',entry.status).select('id');
          notice.textContent=error?.code==='23505'?'Já existe uma reserva ou bloqueio nessa data.':error||!updated?.length?'A alteração não pôde ser salva.':'Agenda atualizada.';
          await Promise.all([loadRequests(),renderCalendar()]);
        };
        row.append(button);
      }
    }
    container.append(row);
  }
}

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
    byId('auth').hidden=Boolean(user);
    byId('account').hidden=!user;
    byId('requests').hidden=!user;
    byId('block').hidden=true;
    byId('list').replaceChildren();
    if(!user) return;
    const activeId=user.id;
    byId('request').elements.contact_name.value=user.user_metadata.name??'';
    byId('request').elements.phone.value=user.user_metadata.phone??'';
    const {data}=await db.rpc('booking_is_admin');
    if (user?.id !== activeId) return;
    admin=data===true;
    byId('block').hidden=!admin;
    byId('list-title').textContent=admin?'Painel de reservas':'Minhas solicitações';
    loadRequests();
  },0);
});
renderCalendar();
