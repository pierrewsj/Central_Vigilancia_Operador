
const ABA_CHAMADOS = 'CHAMADOS';
const ABA_STATUS = 'STATUS';
const ABA_CONFIG = 'CONFIGURACOES';

const CABECALHOS_CHAMADOS = [
  'ID_CHAMADO','DATA_HORA_ABERTURA','DATA_HORA_ATUALIZACAO','STATUS','TIPO_SOLICITACAO','PRIORIDADE','ORIGEM',
  'NOME_SOLICITANTE','REGISTRO','TELEFONE','POSSUI_RAMAL','RAMAL','TIPO_EMPRESA','DIRETORIA','OUTRA_DIRETORIA','NOME_EMPRESA',
  'SETOR_AREA','GALPAO','POSSUI_COLUNA','COLUNA','POSSUI_SALA','SALA','REFERENCIA','CATEGORIA_CONFERENCIA','CARACTERISTICA_OCORRENCIA',
  'TIPO_ACOMPANHAMENTO','DESCRICAO','RESPONSAVEL_GSP','OBSERVACAO_GSP','LIDER_NOME','LIDER_REGISTRO',
  'DATA_HORA_RECEBIDO','DATA_HORA_DESLOCAMENTO','DATA_HORA_ATENDIMENTO','DATA_HORA_AGUARDANDO','DATA_HORA_FINALIZADO','DATA_HORA_CANCELADO',
  'VIGILANTE_NOME','VIGILANTE_REGISTRO','OPERADOR_NOME','OPERADOR_REGISTRO','OPERADOR_TURNO'
];

const CABECALHOS_STATUS = [
  'DATA_HORA','ID_CHAMADO','STATUS','RESPONSAVEL_GSP','OBSERVACAO','OPERADOR_NOME','OPERADOR_REGISTRO','OPERADOR_TURNO','VIGILANTE_NOME','VIGILANTE_REGISTRO'
];

function doGet(e){
  const p = e && e.parameter ? e.parameter : {};
  const acao = p.acao || 'ping';
  try{
    let resp;
    if (acao === 'criarGet') resp = criarChamado(JSON.parse(p.dados || '{}'));
    else if (acao === 'listar') resp = listarChamados();
    else if (acao === 'consultar') resp = consultarChamado(p.id || p.idChamado || '');
    else if (acao === 'atualizarStatusGet') resp = atualizarStatus(JSON.parse(p.dados || '{}'));
    else resp = {sucesso:true,mensagem:'API GSP ativa'};
    return resposta(resp, p.callback);
  }catch(err){
    return resposta({sucesso:false,mensagem:String(err)}, p.callback);
  }
}

function doPost(e){
  try{
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    let resp;
    if (payload.acao === 'atualizarStatus') resp = atualizarStatus(payload);
    else if (payload.acao === 'criar') resp = criarChamado(payload);
    else resp = {sucesso:false,mensagem:'Ação POST inválida.'};
    return resposta(resp);
  }catch(err){
    return resposta({sucesso:false,mensagem:String(err)});
  }
}

function obterAba(nome, cabecalhos){
  const ss = SpreadsheetApp.getActive();
  let aba = ss.getSheetByName(nome);
  if (!aba) aba = ss.insertSheet(nome);
  garantirCabecalho(aba, cabecalhos);
  return aba;
}

function garantirCabecalho(aba, cabecalhos){
  const range = aba.getRange(1,1,1,cabecalhos.length);
  const atual = range.getValues()[0];
  const vazio = atual.every(v => !String(v).trim());
  if (vazio) {
    range.setValues([cabecalhos]);
    return;
  }
  const faltando = cabecalhos.some((h,i) => atual[i] !== h);
  if (faltando) {
    range.clearContent();
    range.setValues([cabecalhos]);
  }
}

function montarLinha(obj, headers){
  return headers.map(h => obj[h] !== undefined ? obj[h] : '');
}

function gerarIdChamado(aba){
  const lr = aba.getLastRow();
  if (lr < 2) return 'GSP-0001';
  const ids = aba.getRange(2,1,lr-1,1).getValues().flat().filter(String);
  let max = 0;
  ids.forEach(id => {
    const m = String(id).match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return 'GSP-' + Utilities.formatString('%04d', max + 1);
}

function criarChamado(dados){
  const aba = obterAba(ABA_CHAMADOS, CABECALHOS_CHAMADOS);
  obterAba(ABA_STATUS, CABECALHOS_STATUS);
  const agora = new Date();
  const id = gerarIdChamado(aba);
  const linha = {
    ID_CHAMADO:id,
    DATA_HORA_ABERTURA:agora,
    DATA_HORA_ATUALIZACAO:agora,
    STATUS:'Recebido',
    TIPO_SOLICITACAO:dados.tipo || dados.tipoSolicitacao || '',
    PRIORIDADE:dados.prioridade || 'Normal',
    ORIGEM:dados.origem || 'Solicitante',
    NOME_SOLICITANTE:dados.nome || '',
    REGISTRO:dados.registro || '',
    TELEFONE:dados.telefone || '',
    POSSUI_RAMAL:dados.possuiRamal || (dados.ramal && dados.ramal !== 'Não possui' ? 'Sim' : 'Não'),
    RAMAL:dados.ramal || '',
    TIPO_EMPRESA:dados.tipoEmpresa || '',
    DIRETORIA:dados.diretoria || '',
    OUTRA_DIRETORIA:dados.outraDiretoria || '',
    NOME_EMPRESA:dados.empresa || dados.terceira || '',
    SETOR_AREA:dados.setor || '',
    GALPAO:dados.galpao || '',
    POSSUI_COLUNA:dados.possuiColuna || (dados.coluna && dados.coluna !== 'Não possui' ? 'Sim' : 'Não'),
    COLUNA:dados.coluna || '',
    POSSUI_SALA:dados.possuiSala || (dados.sala && dados.sala !== 'Não possui' ? 'Sim' : 'Não'),
    SALA:dados.sala || '',
    REFERENCIA:dados.referencia || '',
    CATEGORIA_CONFERENCIA:dados.categoria || '',
    CARACTERISTICA_OCORRENCIA:dados.ocorrencia || '',
    TIPO_ACOMPANHAMENTO:dados.acompanhamento || '',
    DESCRICAO:dados.descricao || '',
    RESPONSAVEL_GSP:'',
    OBSERVACAO_GSP:'',
    LIDER_NOME:dados.liderNome || '',
    LIDER_REGISTRO:dados.liderRegistro || '',
    DATA_HORA_RECEBIDO:agora,
    DATA_HORA_DESLOCAMENTO:'',
    DATA_HORA_ATENDIMENTO:'',
    DATA_HORA_AGUARDANDO:'',
    DATA_HORA_FINALIZADO:'',
    DATA_HORA_CANCELADO:'',
    VIGILANTE_NOME:'',
    VIGILANTE_REGISTRO:'',
    OPERADOR_NOME:'',
    OPERADOR_REGISTRO:'',
    OPERADOR_TURNO:''
  };
  aba.appendRow(montarLinha(linha, CABECALHOS_CHAMADOS));
  registrarStatus({idChamado:id,status:'Recebido',responsavel:'',observacao:'Abertura do chamado',operadorNome:'',operadorRegistro:'',operadorTurno:'',vigilanteNome:'',vigilanteRegistro:''}, agora);
  return {sucesso:true,id:id,idChamado:id,status:'Recebido'};
}

function listarChamados(){
  const aba = obterAba(ABA_CHAMADOS, CABECALHOS_CHAMADOS);
  const lr = aba.getLastRow();
  if (lr < 2) return {sucesso:true,chamados:[]};
  const dados = aba.getRange(2,1,lr-1,CABECALHOS_CHAMADOS.length).getValues();
  const chamados = dados.map(l => CABECALHOS_CHAMADOS.reduce((o,h,i)=>(o[h]=l[i],o),{}));
  chamados.sort((a,b)=> new Date(b.DATA_HORA_ABERTURA || 0) - new Date(a.DATA_HORA_ABERTURA || 0));
  return {sucesso:true,chamados:chamados};
}

function consultarChamado(id){
  const aba = obterAba(ABA_CHAMADOS, CABECALHOS_CHAMADOS);
  const lr = aba.getLastRow();
  if (lr < 2) return {sucesso:false,mensagem:'Nenhum chamado encontrado.'};
  const ids = aba.getRange(2,1,lr-1,1).getValues().flat();
  const idx = ids.findIndex(v => String(v).trim() === String(id).trim());
  if (idx < 0) return {sucesso:false,mensagem:'Chamado não encontrado.'};
  const linha = aba.getRange(idx+2,1,1,CABECALHOS_CHAMADOS.length).getValues()[0];
  const chamado = CABECALHOS_CHAMADOS.reduce((o,h,i)=>(o[h]=linha[i],o),{});
  return {sucesso:true,chamado:chamado};
}

function atualizarStatus(payload){
  const aba = obterAba(ABA_CHAMADOS, CABECALHOS_CHAMADOS);
  obterAba(ABA_STATUS, CABECALHOS_STATUS);
  const id = payload.idChamado || payload.id || '';
  const lr = aba.getLastRow();
  if (lr < 2) return {sucesso:false,mensagem:'Nenhum chamado encontrado.'};
  const ids = aba.getRange(2,1,lr-1,1).getValues().flat();
  const idx = ids.findIndex(v => String(v).trim() === String(id).trim());
  if (idx < 0) return {sucesso:false,mensagem:'Chamado não encontrado.'};

  const rowIndex = idx + 2;
  const dados = aba.getRange(rowIndex,1,1,CABECALHOS_CHAMADOS.length).getValues()[0];
  const atual = CABECALHOS_CHAMADOS.reduce((o,h,i)=>(o[h]=dados[i],o),{});
  const agora = payload.dataHoraStatus ? new Date(payload.dataHoraStatus) : new Date();
  atual.STATUS = payload.status || atual.STATUS;
  atual.DATA_HORA_ATUALIZACAO = agora;
  atual.RESPONSAVEL_GSP = payload.responsavel || atual.RESPONSAVEL_GSP || '';
  atual.OBSERVACAO_GSP = payload.observacao || '';
  atual.OPERADOR_NOME = payload.operadorNome || atual.OPERADOR_NOME || '';
  atual.OPERADOR_REGISTRO = payload.operadorRegistro || atual.OPERADOR_REGISTRO || '';
  atual.OPERADOR_TURNO = payload.operadorTurno || atual.OPERADOR_TURNO || '';
  if (payload.vigilanteNome) atual.VIGILANTE_NOME = payload.vigilanteNome;
  if (payload.vigilanteRegistro) atual.VIGILANTE_REGISTRO = payload.vigilanteRegistro;

  if (payload.status === 'Recebido') atual.DATA_HORA_RECEBIDO = agora;
  if (payload.status === 'Em deslocamento') {
    atual.DATA_HORA_DESLOCAMENTO = agora;
    atual.VIGILANTE_NOME = payload.vigilanteNome || atual.VIGILANTE_NOME || '';
    atual.VIGILANTE_REGISTRO = payload.vigilanteRegistro || atual.VIGILANTE_REGISTRO || '';
  }
  if (payload.status === 'Em atendimento') atual.DATA_HORA_ATENDIMENTO = agora;
  if (payload.status === 'Aguardando') atual.DATA_HORA_AGUARDANDO = agora;
  if (payload.status === 'Finalizado') atual.DATA_HORA_FINALIZADO = agora;
  if (payload.status === 'Cancelado') atual.DATA_HORA_CANCELADO = agora;

  aba.getRange(rowIndex,1,1,CABECALHOS_CHAMADOS.length).setValues([montarLinha(atual, CABECALHOS_CHAMADOS)]);
  registrarStatus(payload, agora);
  return {sucesso:true,mensagem:'Status atualizado.',status:payload.status};
}

function registrarStatus(payload, dataHora){
  const aba = obterAba(ABA_STATUS, CABECALHOS_STATUS);
  const linha = {
    DATA_HORA:dataHora || new Date(),
    ID_CHAMADO:payload.idChamado || payload.id || '',
    STATUS:payload.status || '',
    RESPONSAVEL_GSP:payload.responsavel || '',
    OBSERVACAO:payload.observacao || '',
    OPERADOR_NOME:payload.operadorNome || '',
    OPERADOR_REGISTRO:payload.operadorRegistro || '',
    OPERADOR_TURNO:payload.operadorTurno || '',
    VIGILANTE_NOME:payload.vigilanteNome || '',
    VIGILANTE_REGISTRO:payload.vigilanteRegistro || ''
  };
  aba.appendRow(montarLinha(linha, CABECALHOS_STATUS));
}

function resposta(obj, callback){
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(`${callback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
