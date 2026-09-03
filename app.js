const $ = id => document.getElementById(id);
const API_URL = window.GSP_CONFIG?.SCRIPT_URL || '';
let chamados = [];
let operador = {};
let deferredInstallPrompt = null;

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
function go(id,btn){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.navbtn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>initCustomSelects($(id)||document),60);if(id==='view-dashboard')carregarChamados();}
function entrar(){operador={nome:$('opNome').value.trim()||'Operador GSP',registro:$('opRegistro').value.trim(),turno:$('opTurno').value};$('userPill').textContent=`${operador.nome} • ${operador.turno}`;$('navOp').classList.remove('hidden');go('view-dashboard',document.querySelector('.navbtn'));}
function sair(){operador={};$('navOp').classList.add('hidden');$('userPill').textContent='Operador GSP';go('view-login');}
async function parseJsonResponse(r){const txt=await r.text();try{return JSON.parse(txt);}catch(e){if(txt.trim().startsWith('<'))throw new Error('O Apps Script retornou uma página HTML. Verifique se a implantação está como Qualquer pessoa e se o link /exec está atualizado.');throw new Error(txt.slice(0,180)||e.message);}}
async function apiPost(payload){
  try{const r=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});return await parseJsonResponse(r);}catch(e){
    if(payload.acao==='atualizarStatus'){
      const url=API_URL+'?acao=atualizarStatusGet&_='+Date.now()+'&dados='+encodeURIComponent(JSON.stringify(payload));
      const r=await fetch(url,{method:'GET',cache:'no-store'});
      return await parseJsonResponse(r);
    }
    throw e;
  }
}
async function carregarChamados(){const lista=$('lista');lista.innerHTML='<div class="card loading">Carregando chamados...</div>';try{const r=await fetch(API_URL+'?acao=listar&_='+Date.now(),{cache:'no-store'});const res=await parseJsonResponse(r);if(!res.sucesso)throw new Error(res.mensagem||'Falha ao listar chamados.');chamados=res.chamados||[];render();}catch(e){lista.innerHTML=`<div class="card">Erro: ${e.message}</div>`;}}
function norm(v){return String(v||'').toLowerCase();}
function get(c,k){return c[k]??'';}
function aplicarFiltros(){const st=$('fStatus').value,t=$('fTipo').value,b=norm($('fBusca').value);return chamados.filter(c=>{if(st!=='Todos'&&get(c,'STATUS')!==st)return false;if(t!=='Todos'&&get(c,'TIPO_SOLICITACAO')!==t)return false;if(b){const texto=norm([get(c,'ID_CHAMADO'),get(c,'NOME_SOLICITANTE'),get(c,'REGISTRO'),get(c,'SETOR_AREA'),get(c,'GALPAO'),get(c,'REFERENCIA'),get(c,'DESCRICAO')].join(' '));if(!texto.includes(b))return false;}return true;});}
function renderStats(){const abertas=chamados.filter(c=>['Recebido','Em atendimento','Aguardando'].includes(get(c,'STATUS'))).length;const urg=chamados.filter(c=>['Urgente','Emergencial'].includes(get(c,'PRIORIDADE'))&&get(c,'STATUS')!=='Finalizado').length;const fin=chamados.filter(c=>get(c,'STATUS')==='Finalizado').length;$('stats').innerHTML=`<div class="card"><span class="muted">Abertos</span><h2>${abertas}</h2></div><div class="card"><span class="muted">Urgentes</span><h2>${urg}</h2></div><div class="card"><span class="muted">Finalizados</span><h2>${fin}</h2></div>`;}
function render(){renderStats();const arr=aplicarFiltros();$('lista').innerHTML=arr.length?arr.map(cardChamado).join(''):'<div class="card">Nenhum chamado encontrado.</div>'; initCustomSelects();}
function safeAttr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function cardChamado(c){const id=get(c,'ID_CHAMADO');const detalhe=get(c,'CATEGORIA_CONFERENCIA')||get(c,'CARACTERISTICA_OCORRENCIA')||get(c,'TIPO_ACOMPANHAMENTO')||'-';return `<div class="card"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 6px">${id} • ${get(c,'TIPO_SOLICITACAO')||'-'}</h3><p class="muted" style="margin:0">${get(c,'NOME_SOLICITANTE')||'-'} / ${get(c,'REGISTRO')||'-'} • ${get(c,'SETOR_AREA')||'-'}</p></div><span class="pill">${get(c,'STATUS')||'-'}</span></div><div class="grid grid-3" style="margin-top:12px"><div class="status-box"><span class="muted">Prioridade</span><br><strong>${get(c,'PRIORIDADE')||'-'}</strong></div><div class="status-box"><span class="muted">Detalhe</span><br><strong>${detalhe}</strong></div><div class="status-box"><span class="muted">Local</span><br><strong>G${get(c,'GALPAO')||'-'} • C ${get(c,'COLUNA')||'-'} • S ${get(c,'SALA')||'-'}</strong></div></div><div class="status-box"><span class="muted">Descrição</span><br>${get(c,'DESCRICAO')||'-'}</div><div class="form" style="margin-top:12px"><div class="field"><label>Responsável GSP</label><input id="resp_${id}" value="${safeAttr(operador.nome||get(c,'RESPONSAVEL_GSP')||'')}"></div><div class="field"><label>Observação</label><input id="obs_${id}" value="${safeAttr(get(c,'OBSERVACAO_GSP')||'')}"></div></div><div class="actions"><button class="btn" onclick="atualizar('${id}','Recebido')">Recebido</button><button class="btn" onclick="atualizar('${id}','Em atendimento')">Em atendimento</button><button class="btn secondary" onclick="atualizar('${id}','Aguardando')">Aguardando</button><button class="btn success" onclick="atualizar('${id}','Finalizado')">Finalizado</button><button class="btn danger" onclick="atualizar('${id}','Cancelado')">Cancelado</button></div></div>`;}
async function atualizar(id,status){try{document.querySelectorAll('button').forEach(b=>b.disabled=true);const payload={acao:'atualizarStatus',id,idChamado:id,status,responsavel:$('resp_'+id).value||operador.nome,observacao:$('obs_'+id).value||''};const res=await apiPost(payload);if(!res.sucesso)throw new Error(res.mensagem||'Falha ao atualizar.');showModal('Atualizado',`Chamado ${id} alterado para ${status}.`,'✅');carregarChamados();}catch(e){showModal('Erro',e.message,'❌');}finally{document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function showModal(title,msg,icon='ℹ️'){document.querySelectorAll('.modal-backdrop').forEach(m=>m.remove());const d=document.createElement('div');d.className='modal-backdrop';d.innerHTML=`<div class="modal"><h3>${icon} ${title}</h3><p>${msg}</p><div class="actions"><button class="btn" onclick="this.closest('.modal-backdrop').remove()">OK</button></div></div>`;document.body.appendChild(d);}
setInterval(()=>{if($('view-dashboard').classList.contains('active'))carregarChamados();},60000);

initCustomSelects();
