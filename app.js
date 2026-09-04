
const $ = id => document.getElementById(id);
const API_URL = window.GSP_CONFIG?.SCRIPT_URL || '';
let chamados = [];
let operador = {};
let deferredInstallPrompt = null;
let selectedId = '';
let statusFiltroAtivo = 'Todos';
let tempoTimer = null;
let carregandoChamados = false;
let sessaoOperadorAtiva = false;
let refreshSeq = 0;
let ultimaAtualizacaoPainel = '';
const OPERADOR_KEY='gsp_operador_logado_v20';
const CHAMADOS_CACHE_KEY='gsp_operador_chamados_cache_v20';
const STATUS_QUEUE_KEY='gsp_status_queue_v20';
const CONFIG_CACHE_KEY='gsp_configuracoes_cache_v30';
let opTiposSolicitacao=['Conferência','Acompanhamento','Boletim de Ocorrência'];
let opPrioridades=['Normal','Urgente','Emergencial'];
let opTurnos=['Alpha','Bravo','Charlie','Delta'];

function initCustomSelects(scope=document){
  scope.querySelectorAll('select').forEach(select=>{
    if(!select.dataset.customized){
      select.dataset.customized='1';
      select.classList.add('native-select');
      const trigger=document.createElement('button');
      trigger.type='button';
      trigger.className='select-display';
      trigger.addEventListener('click',()=>openSelectModal(select));
      trigger.addEventListener('keydown',e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openSelectModal(select); } });
      select.insertAdjacentElement('afterend', trigger);
      select.addEventListener('change',()=>updateCustomSelect(null,select));
    }
    updateCustomSelect(null,select);
  });
}
function updateCustomSelect(id,selectEl=null){
  const select = selectEl || $(id); if(!select) return;
  const trigger = select.parentElement ? select.parentElement.querySelector('.select-display') : null;
  if(!trigger) return;
  const opt = select.options[select.selectedIndex];
  const txt = opt ? String(opt.textContent||'').trim() : 'Selecione';
  const showPlaceholder = !String(select.value||'').trim() && /selecione/i.test(txt);
  trigger.innerHTML = `<span>${txt || 'Selecione'}</span><span class="select-arrow">⌄</span>`;
  trigger.classList.toggle('placeholder', showPlaceholder);
  trigger.disabled = !!select.disabled;
}
function openSelectModal(select){
  document.querySelectorAll('.select-modal-backdrop').forEach(m=>m.remove());
  const label = (select.closest('.field')?.querySelector('label')?.textContent || 'Selecione').replace('*','').trim();
  const options = [...select.options].map(o=>({value:o.value,label:(o.textContent||'').trim()})).filter(o=>o.label);
  const selected = String(select.value||'');
  const d = document.createElement('div');
  d.className='modal-backdrop select-modal-backdrop';
  d.innerHTML = `<div class="modal select-modal"><div class="select-modal-head"><h3>${label}</h3><button type="button" class="select-close">✕</button></div><div class="select-option-list">${options.map(o=>`<button type="button" class="select-option ${o.value===selected?'active':''}" data-value="${String(o.value).replace(/"/g,'&quot;')}">${o.label}</button>`).join('')}</div></div>`;
  d.addEventListener('click',e=>{ if(e.target===d || e.target.closest('.select-close')) d.remove(); });
  d.querySelectorAll('.select-option').forEach(btn=>btn.addEventListener('click',()=>{
    select.value = btn.dataset.value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    updateCustomSelect(null,select);
    d.remove();
  }));
  document.body.appendChild(d);
}
function fillSelectOptions(id,arr,opts={}){
  const el=$(id); if(!el) return;
  const atual=el.value;
  const first = opts.first ? `<option>${opts.first}</option>` : (opts.placeholder ? `<option value="">${opts.placeholder}</option>` : '');
  el.innerHTML = first + (arr||[]).map(v=>`<option>${v}</option>`).join('');
  if([...el.options].some(o=>o.value===atual)) el.value=atual;
  updateCustomSelect(null,el);
}
function applyConfiguracoes(cfg){
  if(!cfg || typeof cfg !== 'object') return;
  if(Array.isArray(cfg.TIPO_SOLICITACAO) && cfg.TIPO_SOLICITACAO.length) opTiposSolicitacao = cfg.TIPO_SOLICITACAO;
  if(Array.isArray(cfg.PRIORIDADE) && cfg.PRIORIDADE.length) opPrioridades = cfg.PRIORIDADE;
  if(Array.isArray(cfg.TURNO) && cfg.TURNO.length) opTurnos = cfg.TURNO;
  fillSelectOptions('opTurno',opTurnos);
  fillSelectOptions('fTipo',opTiposSolicitacao,{first:'Todos'});
  initCustomSelects();
  if($('view-dashboard')?.classList.contains('active')) render();
  if($('view-status')?.classList.contains('active')) renderStatusView();
}
async function carregarConfiguracoes(){
  try{ const cache=JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY)||'null'); if(cache) applyConfiguracoes(cache); }catch(e){}
  if(!API_URL || !navigator.onLine) return;
  try{
    const res=await apiGet({acao:'configuracoes'});
    if(res && res.sucesso && res.configuracoes){
      localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(res.configuracoes));
      applyConfiguracoes(res.configuracoes);
    }
  }catch(e){ console.warn('Não foi possível carregar CONFIGURACOES', e); }
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const b = $('installBtn');
  if (b) b.classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const b = $('installBtn');
  if (b) b.classList.add('hidden');
  showModal('Aplicativo instalado','O app foi instalado no aparelho.','✅');
});
async function installApp(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    const b=$('installBtn'); if(b)b.classList.add('hidden');
    return;
  }
  showModal('Instalar aplicativo','No Chrome, toque no menu ⋮ e escolha <strong>Instalar app</strong>. Se a opção ainda não aparecer, atualize a página e aguarde alguns segundos.','⬇️');
}

function setOfflineState(){
  document.body.classList.toggle('offline', !navigator.onLine);
}
function ensureOfflineBanner(){
  if(document.getElementById('offlineBanner')) return;
  const d=document.createElement('div');
  d.id='offlineBanner';
  d.className='offline-banner';
  d.textContent='Sem internet: as alterações serão guardadas e sincronizadas automaticamente ao voltar o sinal.';
  document.body.appendChild(d);
}
function readQueue(){ try{return JSON.parse(localStorage.getItem(STATUS_QUEUE_KEY)||'[]');}catch(e){return [];} }
function saveQueue(q){ localStorage.setItem(STATUS_QUEUE_KEY, JSON.stringify(q)); }
function loadCachedChamados(){
  try{
    const cache = JSON.parse(localStorage.getItem(CHAMADOS_CACHE_KEY)||'[]');
    if(Array.isArray(cache) && cache.length){ chamados = cache; return true; }
  }catch(e){}
  return false;
}
function setRefreshState(active){
  carregandoChamados = !!active;
  document.body.classList.toggle('refreshing-data', carregandoChamados);
  const btn = document.querySelector('[data-refresh-btn]');
  if(btn){ btn.textContent = carregandoChamados ? 'Atualizando...' : 'Atualizar'; btn.disabled = carregandoChamados; }
  const info = document.getElementById('painelSyncInfo');
  if(info){
    if(carregandoChamados) info.textContent = chamados.length ? 'Atualizando em segundo plano...' : 'Carregando chamados...';
    else info.textContent = ultimaAtualizacaoPainel ? 'Atualizado: ' + ultimaAtualizacaoPainel : '';
  }
}
function queueStatus(payload){ const q=readQueue(); q.push({...payload,queuedAt:new Date().toISOString()}); saveQueue(q); }
async function processStatusQueue(){
  if(!navigator.onLine) return;
  const q=readQueue();
  if(!q.length) return;
  const pending=[];
  for(const item of q){
    try{ const res=await apiPost(item); if(!res || !res.sucesso) pending.push(item); }
    catch(e){ pending.push(item); }
  }
  saveQueue(pending);
  if(q.length && !pending.length){ showModal('Sincronização concluída','As alterações pendentes foram enviadas para a planilha.','✅'); carregarChamados({silent:true}); }
}
function persistOperador(){ localStorage.setItem(OPERADOR_KEY, JSON.stringify(operador)); }
function bootOperador(){
  ensureOfflineBanner();
  setOfflineState();
  applyConfiguracoes({TIPO_SOLICITACAO:opTiposSolicitacao,PRIORIDADE:opPrioridades,TURNO:opTurnos});
  carregarConfiguracoes();
  const saved=localStorage.getItem(OPERADOR_KEY);
  if(saved){
    try{ operador=JSON.parse(saved)||{}; }catch(e){ operador={}; }
    if(operador && operador.nome){
      sessaoOperadorAtiva = true;
      $('opNome').value=operador.nome||''; $('opRegistro').value=operador.registro||''; $('opTurno').value=operador.turno||'Alpha';
      $('userPill').textContent=`${operador.nome} • ${operador.turno||''}`;
      $('navOp').classList.remove('hidden');
      loadCachedChamados();
      go('view-dashboard',document.querySelector('.navbtn'));
      return;
    }
  }
  initCustomSelects();
}
window.addEventListener('online',()=>{setOfflineState();processStatusQueue();carregarChamados({silent:true});});
window.addEventListener('offline',setOfflineState);

function go(id,btn){
  if(id==='view-dashboard' && !sessaoOperadorAtiva && !(operador && operador.nome)){ id='view-login'; }
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $(id).classList.add('active');
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>initCustomSelects($(id)||document),60);
  if(id==='view-dashboard'){
    if(chamados.length){ render(); carregarChamados({silent:true}); }
    else { loadCachedChamados(); if(chamados.length) render(); carregarChamados({silent:chamados.length>0}); }
  }
  if(id==='view-status') renderStatusView();
}
function entrar(){
  operador={nome:$('opNome').value.trim()||'Operador GSP',registro:$('opRegistro').value.trim(),turno:$('opTurno').value};
  sessaoOperadorAtiva = true;
  persistOperador();
  $('userPill').textContent=`${operador.nome} • ${operador.turno}`;
  $('navOp').classList.remove('hidden');
  go('view-dashboard',document.querySelector('.navbtn'));
}
function encerrarTurno(){
  try{
    localStorage.setItem(CHAMADOS_CACHE_KEY, JSON.stringify(chamados||[]));
    saveQueue(readQueue());
  }catch(e){}

  sessaoOperadorAtiva = false;
  refreshSeq++;
  operador = {};
  selectedId = '';
  localStorage.removeItem(OPERADOR_KEY);

  const nav = $('navOp');
  if(nav) nav.classList.add('hidden');
  const pill = $('userPill');
  if(pill) pill.textContent = 'Operador GSP';
  const nome = $('opNome'); if(nome) nome.value = '';
  const reg = $('opRegistro'); if(reg) reg.value = '';
  const turno = $('opTurno'); if(turno) turno.value = 'Alpha';

  setRefreshState(false);
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const login = $('view-login');
  if(login) login.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  showToastSafe('Turno encerrado. Os chamados foram mantidos e o login foi apagado.');
}
function sair(){ encerrarTurno(); }
function showToastSafe(msg){
  try{
    document.querySelectorAll('.toast-msg').forEach(t=>t.remove());
    const d=document.createElement('div');
    d.className='toast-msg';
    d.textContent=msg;
    document.body.appendChild(d);
    setTimeout(()=>d.remove(),3500);
  }catch(e){}
}
async function parseJsonResponse(r){
  const txt=await r.text();
  try{return JSON.parse(txt);}catch(e){
    if(txt.trim().startsWith('<'))throw new Error('O Apps Script retornou uma página HTML. Verifique se a implantação está como Qualquer pessoa e se o link /exec está atualizado.');
    throw new Error(txt.slice(0,180)||e.message);
  }
}
function jsonpRequest(params){
  return new Promise((resolve,reject)=>{
    const cb='gsp_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    const url=API_URL+'?'+new URLSearchParams({...params,callback:cb,_:Date.now()}).toString();
    const timer=setTimeout(()=>{cleanup();reject(new Error('Tempo esgotado ao consultar a planilha. Atualize o Apps Script com suporte JSONP.'));},15000);
    function cleanup(){clearTimeout(timer);delete window[cb];script.remove();}
    window[cb]=(data)=>{cleanup();resolve(data);};
    script.onerror=()=>{cleanup();reject(new Error('Falha ao conectar na planilha. Verifique o link /exec, a permissão Qualquer pessoa e se a implantação foi atualizada.'));};
    script.src=url;
    document.body.appendChild(script);
  });
}
async function apiGet(params){
  try{
    return await jsonpRequest(params);
  }catch(jsonpError){
    const r=await fetch(API_URL+'?'+new URLSearchParams({...params,_:Date.now()}).toString(),{cache:'no-store',redirect:'follow'});
    return await parseJsonResponse(r);
  }
}
async function apiPost(payload){
  try{
    const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    return await parseJsonResponse(r);
  }catch(e){
    return await jsonpRequest({acao:'atualizarStatusGet',dados:JSON.stringify(payload)});
  }
}
async function carregarChamados(options={}){
  if(!sessaoOperadorAtiva && !(operador && operador.nome)) return;
  const seq = ++refreshSeq;
  const lista=$('lista');
  const silent = !!options.silent;
  if(carregandoChamados) return;
  if(!navigator.onLine){
    setOfflineState();
    const hadCache = loadCachedChamados();
    render();
    if(lista && !hadCache) lista.innerHTML='<div class="card">Sem internet. Nenhum chamado em cache neste aparelho.</div>';
    return;
  }
  if(!silent || !chamados.length){
    if(lista && !chamados.length) lista.innerHTML='<div class="card loading">Carregando chamados...</div>';
  }
  setRefreshState(true);
  try{
    if(!API_URL) throw new Error('O link do Apps Script não foi configurado no arquivo config.js.');
    const res=await apiGet({acao:'listar'});
    if(seq !== refreshSeq || (!sessaoOperadorAtiva && !(operador && operador.nome))) return;
    if(!res.sucesso)throw new Error(res.mensagem||'Falha ao listar chamados.');
    chamados=Array.isArray(res.chamados)?res.chamados:[];
    localStorage.setItem(CHAMADOS_CACHE_KEY, JSON.stringify(chamados));
    ultimaAtualizacaoPainel = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    render();
    renderStatusView();
    processStatusQueue();
  }catch(e){
    if(!chamados.length) loadCachedChamados();
    render();
    const aviso=`<div class="card sync-warning">Erro ao atualizar planilha: ${e.message||e}<br><span class="mini-note">Mantive as informações já carregadas na tela.</span></div>`;
    if(lista && !lista.querySelector('.sync-warning')) lista.insertAdjacentHTML('afterbegin', aviso);
  }finally{
    if(seq === refreshSeq) setRefreshState(false);
  }
}
function norm(v){return String(v||'').toLowerCase();}
function get(c,k){return c[k]??'';}
function safeAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function aplicarFiltros(){
  const st=statusFiltroAtivo || 'Todos', t=$('fTipo')?.value || 'Todos', b=norm($('fBusca')?.value || '');
  return chamados.filter(c=>{
    if(st!=='Todos'&&get(c,'STATUS')!==st)return false;
    if(t!=='Todos'&&get(c,'TIPO_SOLICITACAO')!==t)return false;
    if(b){const texto=norm([get(c,'ID_CHAMADO'),get(c,'NOME_SOLICITANTE'),get(c,'REGISTRO'),get(c,'SETOR_AREA'),get(c,'GALPAO'),get(c,'REFERENCIA'),get(c,'DESCRICAO')].join(' '));if(!texto.includes(b))return false;}
    return true;
  });
}
function statusCount(nome){ return chamados.filter(c=>get(c,'STATUS')===nome).length; }
function setStatusFilter(status){
  statusFiltroAtivo = (statusFiltroAtivo === status) ? 'Todos' : (status || 'Todos');
  render();
  setTimeout(()=>{ const lista=$('lista'); if(lista) lista.scrollIntoView({behavior:'smooth', block:'start'}); },80);
}
function limparFiltroStatus(){ statusFiltroAtivo='Todos'; render(); }
function renderStats(){
  const atualFiltro = statusFiltroAtivo || 'Todos';
  const data=[
    ['Recebidos',statusCount('Recebido'),'status-recebido','Recebido'],
    ['Em desloc.',statusCount('Em deslocamento'),'status-deslocamento','Em deslocamento'],
    ['Em atend.',statusCount('Em atendimento'),'status-atendimento','Em atendimento'],
    ['Aguard.',statusCount('Aguardando'),'status-aguardando','Aguardando'],
    ['Finaliz.',statusCount('Finalizado'),'status-finalizado','Finalizado'],
    ['Cancel.',statusCount('Cancelado'),'status-cancelado','Cancelado']
  ];
  $('stats').className='stats-status';
  $('stats').innerHTML=data.map(([label,total,cls,status])=>`<button type="button" class="card stat-mini stat-filter ${cls} ${atualFiltro===status?'active':''}" onclick="setStatusFilter('${status}')"><span>${label}</span><strong>${total}</strong></button>`).join('') + `<div class="filter-chip-row"><span>${atualFiltro==='Todos'?'Mostrando todos os status':'Filtro: '+atualFiltro}</span>${atualFiltro==='Todos'?'':`<button type="button" onclick="limparFiltroStatus()">Limpar filtro</button>`}</div>`;
}
function render(){
  renderStats();
  const arr=aplicarFiltros();
  $('lista').innerHTML=arr.length?arr.map(cardChamado).join(''):'<div class="card">Nenhum chamado encontrado.</div>';
  initCustomSelects();
}
function detalheChamado(c){return get(c,'CATEGORIA_CONFERENCIA')||get(c,'CARACTERISTICA_OCORRENCIA')||get(c,'TIPO_ACOMPANHAMENTO')||'-';}
function localChamado(c){
  const gal=get(c,'GALPAO')?`G${get(c,'GALPAO')}`:'-';
  const col=get(c,'COLUNA')||'-';
  const sala=get(c,'SALA')||'-';
  return `${gal} • Coluna ${col} • Sala ${sala}`;
}
function statusClass(status){
  const s=String(status||'').toLowerCase();
  if(s==='recebido')return 'status-recebido';
  if(s==='em deslocamento')return 'status-deslocamento';
  if(s==='em atendimento')return 'status-atendimento';
  if(s==='aguardando')return 'status-aguardando';
  if(s==='finalizado')return 'status-finalizado';
  if(s==='cancelado')return 'status-cancelado';
  return '';
}

function dataRecebimento(c){ return get(c,'DATA_HORA_RECEBIDO') || get(c,'DATA_HORA_ABERTURA') || ''; }
function dataFimChamado(c){
  const st=get(c,'STATUS');
  if(st==='Finalizado') return get(c,'DATA_HORA_FINALIZADO') || get(c,'DATA_HORA_ATUALIZACAO') || '';
  if(st==='Cancelado') return get(c,'DATA_HORA_CANCELADO') || get(c,'DATA_HORA_ATUALIZACAO') || '';
  return '';
}
function parseData(v){ if(!v)return null; const d=new Date(v); return isNaN(d.getTime())?null:d; }
function formatarDataHora(v){ const d=parseData(v); return d?d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'-'; }
function minutosDesde(inicio,fim=''){
  const di=parseData(inicio); if(!di)return null;
  const df=parseData(fim) || new Date();
  return Math.max(0, Math.floor((df.getTime()-di.getTime())/60000));
}
function formatarDuracao(min){
  if(min===null||min===undefined) return '-';
  if(min<60) return `${min} min`;
  const h=Math.floor(min/60), m=min%60;
  return `${h}h ${String(m).padStart(2,'0')}min`;
}
function esperaInfo(c){
  const ini=dataRecebimento(c), fim=dataFimChamado(c), min=minutosDesde(ini,fim);
  const st=get(c,'STATUS');
  const rot=(st==='Finalizado'||st==='Cancelado')?'Tempo total':'Tempo de espera';
  const cls=min===null?'':(min>20?'wait-crit':(min>10?'wait-alert':'wait-ok'));
  return {ini,fim,min,rot,cls};
}
function cardChamado(c){
  const id=get(c,'ID_CHAMADO');
  const espera=esperaInfo(c);
  return `<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 6px">${id} • ${get(c,'TIPO_SOLICITACAO')||'-'}</h3><p class="muted" style="margin:0">${get(c,'NOME_SOLICITANTE')||'-'} / ${get(c,'REGISTRO')||'-'} • ${get(c,'SETOR_AREA')||'-'}</p></div><span class="status-pill ${statusClass(get(c,'STATUS'))}">${get(c,'STATUS')||'-'}</span></div><div class="summary-grid"><div class="status-box"><span class="muted">Recebido em</span><br><strong>${formatarDataHora(espera.ini)}</strong></div><div class="status-box ${espera.cls}"><span class="muted">${espera.rot}</span><br><strong>${formatarDuracao(espera.min)}</strong></div><div class="status-box"><span class="muted">Prioridade operacional</span><br><strong>${get(c,'PRIORIDADE')||'A definir'}</strong></div><div class="status-box"><span class="muted">Detalhe</span><br><strong>${detalheChamado(c)}</strong></div><div class="status-box"><span class="muted">Local</span><br><strong>${localChamado(c)}</strong></div></div><div class="status-box"><span class="muted">Descrição</span><br>${get(c,'DESCRICAO')||'-'}</div><div class="summary-actions"><button class="btn" onclick="abrirStatus('${id}')">Abrir status</button></div></div>`;
}
function obterChamado(id){ return chamados.find(c=>get(c,'ID_CHAMADO')===id) || null; }
function abrirStatus(id){ selectedId=id; renderStatusView(); go('view-status'); }
function renderStatusView(){
  const el=$('statusContent'); if(!el) return;
  const c = obterChamado(selectedId);
  if(!c){ el.innerHTML='<div class="card empty-state">Selecione um chamado no painel para atualizar o status.</div>'; return; }
  const atual = get(c,'STATUS')||'-';
  const prioridade = get(c,'PRIORIDADE') || '';
  const espera = esperaInfo(c);
  const prOpts=['',...opPrioridades].map(v=>`<option value="${v}" ${prioridade===v?'selected':''}>${v||'A definir'}</option>`).join('');
  el.innerHTML = `<div class="card"><div class="backline"><div><h3 style="margin:0">${get(c,'ID_CHAMADO')} • ${get(c,'TIPO_SOLICITACAO')||'-'}</h3><div class="mini-note">Solicitante: ${get(c,'NOME_SOLICITANTE')||'-'} / ${get(c,'REGISTRO')||'-'}</div></div><button class="btn secondary" onclick="go('view-dashboard',document.querySelectorAll('.navbtn')[0])">Voltar ao painel</button></div><div class="current-status-box"><span class="status-pill ${statusClass(atual)}">Status atual: ${atual}</span><span class="mini-note">Os horários são gravados automaticamente na planilha.</span></div><div class="grid grid-3"><div class="status-box"><span class="muted">Recebido em</span><br><strong>${formatarDataHora(espera.ini)}</strong></div><div class="status-box ${espera.cls}"><span class="muted">${espera.rot}</span><br><strong>${formatarDuracao(espera.min)}</strong></div><div class="status-box"><span class="muted">Local</span><br><strong>${localChamado(c)}</strong></div><div class="status-box"><span class="muted">Detalhe</span><br><strong>${detalheChamado(c)}</strong></div></div><div class="status-box"><span class="muted">Referência</span><br>${get(c,'REFERENCIA')||'-'}</div><div class="status-box"><span class="muted">Descrição</span><br>${get(c,'DESCRICAO')||'-'}</div><div class="form" style="margin-top:12px"><div class="field"><label>Prioridade operacional</label><select id="statusPrioridade">${prOpts}</select></div><div class="field"><label>Responsável GSP</label><input id="statusResp" value="${safeAttr(operador.nome||get(c,'RESPONSAVEL_GSP')||'')}"></div><div class="field"><label>Observação</label><input id="statusObs" value="${safeAttr(get(c,'OBSERVACAO_GSP')||'')}" placeholder="Ex.: divergência de local, aguardando responsável"></div><div class="field"><label>Vigilante em deslocamento</label><input id="statusVigNome" value="${safeAttr(get(c,'VIGILANTE_NOME')||'')}" placeholder="Será solicitado ao marcar Em deslocamento" readonly></div><div class="field"><label>Registro do vigilante</label><input id="statusVigRegistro" value="${safeAttr(get(c,'VIGILANTE_REGISTRO')||'')}" placeholder="Será solicitado ao marcar Em deslocamento" readonly></div></div><div class="status-actions"><button class="btn status-recebido" onclick="atualizarFluxo('Recebido')">Recebido</button><button class="btn status-deslocamento" onclick="solicitarDeslocamento()">Em deslocamento</button><button class="btn status-atendimento" onclick="atualizarFluxo('Em atendimento')">Em atendimento</button><button class="btn status-aguardando" onclick="atualizarFluxo('Aguardando')">Aguardando</button><button class="btn status-finalizado" onclick="atualizarFluxo('Finalizado')">Finalizado</button><button class="btn status-cancelado" onclick="solicitarCancelamento()">Cancelado</button></div></div>`;
  initCustomSelects(el);
}
function statusAtualSelecionado(){
  const c = obterChamado(selectedId);
  return String(get(c || {}, 'STATUS') || '').trim();
}
function estaFinalizado(){ return statusAtualSelecionado() === 'Finalizado'; }
function solicitarCancelamento(){
  if(!selectedId) return;
  if(estaFinalizado()){
    showModal('Ação não permitida','Este chamado já foi finalizado e não pode mais ser cancelado.','⚠️');
    return;
  }
  showCustomModal(`
    <h3>⚠️ Cancelar chamado</h3>
    <p>Tem certeza que deseja cancelar?</p>
    <p class="mini-note">Essa ação irá registrar o status <strong>Cancelado</strong> e salvar o horário na planilha.</p>
    <div class="actions"><button class="btn status-cancelado" id="confirmCancelBtn">Sim, cancelar</button><button class="btn secondary" onclick="closeCustomModal()">Não</button></div>
  `, ()=>{
    $('confirmCancelBtn').onclick=async()=>{
      closeCustomModal();
      await atualizarFluxo('Cancelado');
    };
  });
}
function solicitarDeslocamento(){
  if(!selectedId) return;
  const c=obterChamado(selectedId)||{};
  showCustomModal(`
    <h3>🚓 Em deslocamento</h3>
    <p>Informe os dados do vigilante que está indo ao local.</p>
    <div class="form" style="grid-template-columns:1fr; margin-top:12px">
      <div class="field"><label>Nome do vigilante</label><input id="modalVigNome" value="${safeAttr(get(c,'VIGILANTE_NOME')||'')}" placeholder="Nome do vigilante"></div>
      <div class="field"><label>Registro do vigilante</label><input id="modalVigRegistro" value="${safeAttr(get(c,'VIGILANTE_REGISTRO')||'')}" placeholder="Registro do vigilante"></div>
    </div>
    <div class="actions"><button class="btn status-deslocamento" id="confirmModalBtn">Salvar deslocamento</button><button class="btn secondary" onclick="closeCustomModal()">Cancelar</button></div>
  `, ()=>{
    $('confirmModalBtn').onclick=async()=>{
      const nome=$('modalVigNome').value.trim();
      const registro=$('modalVigRegistro').value.trim();
      if(!nome || !registro){ alert('Informe o nome e o registro do vigilante.'); return; }
      closeCustomModal();
      await atualizarFluxo('Em deslocamento',{vigilanteNome:nome,vigilanteRegistro:registro});
    };
  });
}
async function atualizarFluxo(status,extras={}){
  if(!selectedId) return;
  if(status === 'Cancelado' && estaFinalizado()){
    showModal('Ação não permitida','Este chamado já foi finalizado e não pode mais ser cancelado.','⚠️');
    return;
  }
  const payload={
    acao:'atualizarStatus',
    id:selectedId,
    idChamado:selectedId,
    status,
    prioridade:$('statusPrioridade')?.value || '',
    responsavel:$('statusResp')?.value?.trim() || operador.nome || '',
    observacao:$('statusObs')?.value?.trim() || '',
    operadorNome:operador.nome || '',
    operadorRegistro:operador.registro || '',
    operadorTurno:operador.turno || '',
    vigilanteNome:extras.vigilanteNome || $('statusVigNome')?.value?.trim() || '',
    vigilanteRegistro:extras.vigilanteRegistro || $('statusVigRegistro')?.value?.trim() || '',
    dataHoraStatus:new Date().toISOString()
  };
  const local = obterChamado(selectedId);
  if(local){
    local.STATUS=status;
    if(payload.prioridade) local.PRIORIDADE=payload.prioridade;
    local.RESPONSAVEL_GSP=payload.responsavel;
    local.OBSERVACAO_GSP=payload.observacao;
    if(payload.vigilanteNome) local.VIGILANTE_NOME=payload.vigilanteNome;
    if(payload.vigilanteRegistro) local.VIGILANTE_REGISTRO=payload.vigilanteRegistro;
    local.DATA_HORA_ATUALIZACAO=payload.dataHoraStatus;
    if(status==='Recebido') local.DATA_HORA_RECEBIDO = local.DATA_HORA_RECEBIDO || payload.dataHoraStatus;
    if(status==='Em deslocamento') local.DATA_HORA_DESLOCAMENTO = payload.dataHoraStatus;
    if(status==='Em atendimento') local.DATA_HORA_ATENDIMENTO = payload.dataHoraStatus;
    if(status==='Aguardando') local.DATA_HORA_AGUARDANDO = payload.dataHoraStatus;
    if(status==='Finalizado') local.DATA_HORA_FINALIZADO = payload.dataHoraStatus;
    if(status==='Cancelado') local.DATA_HORA_CANCELADO = payload.dataHoraStatus;
    localStorage.setItem(CHAMADOS_CACHE_KEY, JSON.stringify(chamados));
  }
  if(!navigator.onLine){
    queueStatus(payload); setOfflineState(); render(); renderStatusView();
    showModal('Sem internet','A alteração foi salva neste aparelho e será enviada automaticamente para a planilha quando o sinal voltar.','⚠️');
    return;
  }
  try{
    document.querySelectorAll('button').forEach(b=>b.disabled=true);
    const res=await apiPost(payload);
    if(!res.sucesso) throw new Error(res.mensagem||'Falha ao atualizar.');
    showModal('Atualizado',`Chamado ${selectedId} alterado para ${status}.`,'✅');
    await carregarChamados({silent:true});
    renderStatusView();
  }catch(e){
    queueStatus(payload); render(); renderStatusView();
    showModal('Salvo para sincronizar',`Não foi possível enviar agora. A alteração ficou salva neste aparelho e será sincronizada automaticamente.<br><br>${e.message||e}`,'⚠️');
  }finally{
    document.querySelectorAll('button').forEach(b=>b.disabled=false);
  }
}
function showModal(title,msg,icon='ℹ️'){document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove());const d=document.createElement('div');d.className='modal-backdrop';d.innerHTML=`<div class="modal"><h3>${icon} ${title}</h3><p>${msg}</p><div class="actions"><button class="btn" onclick="this.closest('.modal-backdrop').remove()">OK</button></div></div>`;document.body.appendChild(d);}
function showCustomModal(innerHtml,onReady){document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove());const d=document.createElement('div');d.className='modal-backdrop';d.innerHTML=`<div class="modal">${innerHtml}</div>`;document.body.appendChild(d); if(typeof onReady==='function') onReady();}
function closeCustomModal(){document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove());}
setInterval(()=>{if($('view-dashboard').classList.contains('active'))carregarChamados({silent:true});},60000);
setInterval(()=>{if($('view-dashboard').classList.contains('active') && chamados.length) render();},60000);
bootOperador();
processStatusQueue();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
