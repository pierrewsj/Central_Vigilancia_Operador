
const $ = id => document.getElementById(id);
const API_URL = window.GSP_CONFIG?.SCRIPT_URL || '';
let chamados = [];
let operador = {};
let deferredInstallPrompt = null;
let selectedId = '';

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
function go(id,btn){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $(id).classList.add('active');
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  setTimeout(()=>initCustomSelects($(id)||document),60);
  if(id==='view-dashboard') carregarChamados();
  if(id==='view-status') renderStatusView();
}
function entrar(){
  operador={nome:$('opNome').value.trim()||'Operador GSP',registro:$('opRegistro').value.trim(),turno:$('opTurno').value};
  $('userPill').textContent=`${operador.nome} • ${operador.turno}`;
  $('navOp').classList.remove('hidden');
  go('view-dashboard',document.querySelector('.navbtn'));
}
function sair(){operador={}; selectedId=''; $('navOp').classList.add('hidden'); $('userPill').textContent='Operador GSP'; go('view-login');}
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
async function carregarChamados(){
  const lista=$('lista');
  lista.innerHTML='<div class="card loading">Carregando chamados...</div>';
  try{
    if(!API_URL) throw new Error('O link do Apps Script não foi configurado no arquivo config.js.');
    const res=await apiGet({acao:'listar'});
    if(!res.sucesso)throw new Error(res.mensagem||'Falha ao listar chamados.');
    chamados=Array.isArray(res.chamados)?res.chamados:[];
    render();
    renderStatusView();
  }catch(e){
    lista.innerHTML=`<div class="card">Erro: ${e.message||e}</div>`;
    $('stats').innerHTML='';
  }
}
function norm(v){return String(v||'').toLowerCase();}
function get(c,k){return c[k]??'';}
function safeAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function aplicarFiltros(){
  const st=$('fStatus').value,t=$('fTipo').value,b=norm($('fBusca').value);
  return chamados.filter(c=>{
    if(st!=='Todos'&&get(c,'STATUS')!==st)return false;
    if(t!=='Todos'&&get(c,'TIPO_SOLICITACAO')!==t)return false;
    if(b){const texto=norm([get(c,'ID_CHAMADO'),get(c,'NOME_SOLICITANTE'),get(c,'REGISTRO'),get(c,'SETOR_AREA'),get(c,'GALPAO'),get(c,'REFERENCIA'),get(c,'DESCRICAO')].join(' '));if(!texto.includes(b))return false;}
    return true;
  });
}
function renderStats(){
  const abertas=chamados.filter(c=>['Recebido','Em deslocamento','Em atendimento','Aguardando'].includes(get(c,'STATUS'))).length;
  const urg=chamados.filter(c=>['Urgente','Emergencial'].includes(get(c,'PRIORIDADE'))&&get(c,'STATUS')!=='Finalizado').length;
  const fin=chamados.filter(c=>get(c,'STATUS')==='Finalizado').length;
  $('stats').innerHTML=`<div class="card"><span class="muted">Abertos</span><h2>${abertas}</h2></div><div class="card"><span class="muted">Urgentes</span><h2>${urg}</h2></div><div class="card"><span class="muted">Finalizados</span><h2>${fin}</h2></div>`;
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
  return `${gal} • C ${col} • S ${sala}`;
}
function cardChamado(c){
  const id=get(c,'ID_CHAMADO');
  return `<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 6px">${id} • ${get(c,'TIPO_SOLICITACAO')||'-'}</h3><p class="muted" style="margin:0">${get(c,'NOME_SOLICITANTE')||'-'} / ${get(c,'REGISTRO')||'-'} • ${get(c,'SETOR_AREA')||'-'}</p></div><span class="pill">${get(c,'STATUS')||'-'}</span></div><div class="summary-grid"><div class="status-box"><span class="muted">Prioridade</span><br><strong>${get(c,'PRIORIDADE')||'-'}</strong></div><div class="status-box"><span class="muted">Detalhe</span><br><strong>${detalheChamado(c)}</strong></div><div class="status-box"><span class="muted">Local</span><br><strong>${localChamado(c)}</strong></div></div><div class="status-box"><span class="muted">Descrição</span><br>${get(c,'DESCRICAO')||'-'}</div><div class="summary-actions"><button class="btn" onclick="abrirStatus('${id}')">Abrir status</button></div></div>`;
}
function obterChamado(id){ return chamados.find(c=>get(c,'ID_CHAMADO')===id) || null; }
function abrirStatus(id){ selectedId=id; renderStatusView(); go('view-status',document.querySelectorAll('.navbtn')[1]); }
function renderStatusView(){
  const el=$('statusContent'); if(!el) return;
  const c = obterChamado(selectedId);
  if(!c){ el.innerHTML='<div class="card empty-state">Selecione um chamado no painel para atualizar o status.</div>'; return; }
  const atual = get(c,'STATUS')||'-';
  el.innerHTML = `<div class="card"><div class="backline"><div><h3 style="margin:0">${get(c,'ID_CHAMADO')} • ${get(c,'TIPO_SOLICITACAO')||'-'}</h3><div class="mini-note">Solicitante: ${get(c,'NOME_SOLICITANTE')||'-'} / ${get(c,'REGISTRO')||'-'}</div></div><button class="btn secondary" onclick="go('view-dashboard',document.querySelectorAll('.navbtn')[0])">Voltar ao painel</button></div><div class="current-status-box"><span class="pill">Status atual: ${atual}</span><span class="mini-note">Os horários são gravados automaticamente na planilha.</span></div><div class="grid grid-3"><div class="status-box"><span class="muted">Prioridade</span><br><strong>${get(c,'PRIORIDADE')||'-'}</strong></div><div class="status-box"><span class="muted">Detalhe</span><br><strong>${detalheChamado(c)}</strong></div><div class="status-box"><span class="muted">Local</span><br><strong>${localChamado(c)}</strong></div></div><div class="status-box"><span class="muted">Referência</span><br>${get(c,'REFERENCIA')||'-'}</div><div class="status-box"><span class="muted">Descrição</span><br>${get(c,'DESCRICAO')||'-'}</div><div class="form" style="margin-top:12px"><div class="field"><label>Responsável GSP</label><input id="statusResp" value="${safeAttr(operador.nome||get(c,'RESPONSAVEL_GSP')||'')}"></div><div class="field"><label>Observação</label><input id="statusObs" value="${safeAttr(get(c,'OBSERVACAO_GSP')||'')}" placeholder="Ex.: divergência de local, aguardando responsável"></div><div class="field"><label>Vigilante em deslocamento</label><input id="statusVigNome" value="${safeAttr(get(c,'VIGILANTE_NOME')||'')}" placeholder="Será solicitado ao marcar Em deslocamento" readonly></div><div class="field"><label>Registro do vigilante</label><input id="statusVigRegistro" value="${safeAttr(get(c,'VIGILANTE_REGISTRO')||'')}" placeholder="Será solicitado ao marcar Em deslocamento" readonly></div></div><div class="status-actions"><button class="btn" onclick="atualizarFluxo('Recebido')">Recebido</button><button class="btn info" onclick="solicitarDeslocamento()">Em deslocamento</button><button class="btn" onclick="atualizarFluxo('Em atendimento')">Em atendimento</button><button class="btn warning" onclick="atualizarFluxo('Aguardando')">Aguardando</button><button class="btn success" onclick="atualizarFluxo('Finalizado')">Finalizado</button><button class="btn danger" onclick="atualizarFluxo('Cancelado')">Cancelado</button></div></div>`;
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
    <div class="actions"><button class="btn info" id="confirmModalBtn">Salvar deslocamento</button><button class="btn secondary" onclick="closeCustomModal()">Cancelar</button></div>
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
  try{
    document.querySelectorAll('button').forEach(b=>b.disabled=true);
    const payload={
      acao:'atualizarStatus',
      id:selectedId,
      idChamado:selectedId,
      status,
      responsavel:$('statusResp')?.value?.trim() || operador.nome || '',
      observacao:$('statusObs')?.value?.trim() || '',
      operadorNome:operador.nome || '',
      operadorRegistro:operador.registro || '',
      operadorTurno:operador.turno || '',
      vigilanteNome:extras.vigilanteNome || $('statusVigNome')?.value?.trim() || '',
      vigilanteRegistro:extras.vigilanteRegistro || $('statusVigRegistro')?.value?.trim() || '',
      dataHoraStatus:new Date().toISOString()
    };
    const res=await apiPost(payload);
    if(!res.sucesso) throw new Error(res.mensagem||'Falha ao atualizar.');
    showModal('Atualizado',`Chamado ${selectedId} alterado para ${status}.`,'✅');
    await carregarChamados();
    selectedId = selectedId;
    renderStatusView();
  }catch(e){
    showModal('Erro',e.message||String(e),'❌');
  }finally{
    document.querySelectorAll('button').forEach(b=>b.disabled=false);
  }
}
function showModal(title,msg,icon='ℹ️'){document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove());const d=document.createElement('div');d.className='modal-backdrop';d.innerHTML=`<div class="modal"><h3>${icon} ${title}</h3><p>${msg}</p><div class="actions"><button class="btn" onclick="this.closest('.modal-backdrop').remove()">OK</button></div></div>`;document.body.appendChild(d);}
function showCustomModal(innerHtml,onReady){document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove());const d=document.createElement('div');d.className='modal-backdrop';d.innerHTML=`<div class="modal">${innerHtml}</div>`;document.body.appendChild(d); if(typeof onReady==='function') onReady();}
function closeCustomModal(){document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove());}
setInterval(()=>{if($('view-dashboard').classList.contains('active'))carregarChamados();},60000);
initCustomSelects();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
