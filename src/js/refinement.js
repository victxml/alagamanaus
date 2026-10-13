/* Refinamentos da versão 2.0. Protótipo local, sem autenticação de produção. */
let pickerMap, pickerMarker, photoData = '', pendingItem, activeDetailId;
const $ = id => document.getElementById(id);
const originalStats = renderHomeStats;
const originalProfile = renderProfile;
const originalMarkers = renderMapMarkers;
const originalInitMap = initMap;
const originalCriticality = renderCriticality;
function readLocal(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function saveLocal(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { showToast('Não foi possível salvar. Libere espaço no navegador e tente novamente.'); return false; } }
getStoredOccurrences = function() { const rows = readLocal('alagaManausOccurrences', []); return Array.isArray(rows) ? rows : []; };
getAllOccurrences = function() { const updates = readLocal('alagaManausStatus', {}); return [...ALAGA_DATA,...getStoredOccurrences()].map(x => ({...x,status:updates[x.id]?.status || x.status})); };
renderHomeStats = function() {
  originalStats();
  if (!$('homePriorities')) return;
  const rows = [...getAllOccurrences()].filter(x=>x.score !== null).sort((a,b)=>b.score-a.score);
  $('homePriorities').innerHTML=rows.slice(1,4).map(x=>`<div class="board-row"><a href="#detalhe-${x.id}">${escapeHtml(x.title)}<small>${escapeHtml(x.neighborhood)}</small></a><b>${x.score}<span class="sr-only"> de 100</span></b></div>`).join('');
};
populateNeighborhoods = function() {
  const selected=$('filterNeighborhood').value;
  $('filterNeighborhood').innerHTML='<option value="">Todos os bairros</option>';
  [...new Set(getAllOccurrences().map(x=>x.neighborhood))].sort((a,b)=>a.localeCompare(b)).forEach(n=>{const option=new Option(n,n);$('filterNeighborhood').add(option)});
  $('filterNeighborhood').value=selected;
};
function occurrenceCards(rows) {
 return rows.length ? rows.map(x=>`<article class="occ-card"><span class="badge ${x.criticality}">${CRITICALITY_LABELS[x.criticality].label}${x.score===null?'':` · ${x.score}/100`}</span><h3><a href="#detalhe-${x.id}">${escapeHtml(x.title)}</a></h3><p>${escapeHtml(x.neighborhood)} · ${x.type==='alagamento'?'Alagamento':'Resíduos'}</p><p>${STATUS_LABELS[x.status]}</p></article>`).join('') : '<div class="empty-state">Nenhuma ocorrência encontrada. Altere os filtros para tentar novamente.</div>';
}
renderMapMarkers = function(rows) {
 if ($('mapResults')) $('mapResults').innerHTML=occurrenceCards(rows);
 originalMarkers(rows.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)));
 if (markersLayer) markersLayer.eachLayer(marker=>{const item=rows.find(x=>x.lat===marker.getLatLng().lat&&x.lng===marker.getLatLng().lng);if(item)marker.setPopupContent(`<strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.neighborhood)}<br>${CRITICALITY_LABELS[item.criticality].label} · ${STATUS_LABELS[item.status]}</p><a href="#detalhe-${item.id}">Ver detalhes e histórico</a>`)});
};
initMap = function() { currentMapData=getAllOccurrences(); originalInitMap(); applyFilters(); };
// Reconstrói a camada após uma falha de conexão.
document.addEventListener('DOMContentLoaded',()=>{$('retryMap').addEventListener('click',()=>{if(map){map.remove();map=null;markersLayer=null}initMap()})});
applyFilters = function() {
 const n=$('filterNeighborhood').value,t=$('filterType').value,c=$('filterCriticality').value,p=$('filterPeriod').value;
 const today=new Date(); today.setHours(23,59,59,999);
 currentMapData=getAllOccurrences().filter(x=>(!n||n===x.neighborhood)&&(!t||t===x.type)&&(!c||c===x.criticality)&&(!p||(today-new Date(x.date+'T00:00:00'))/86400000<=Number(p)));
 renderMapMarkers(currentMapData);$('filterResult').textContent=`${currentMapData.length} ocorrência(s) encontrada(s).`;
};
routeTo = function(route) {
 let detail=route.match(/^detalhe-(\d+)$/);if(detail){activeDetailId=Number(detail[1]);route='detalhe'}
 if (!$('page-'+route)) route='home';
 document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active-page',x.id==='page-'+route));
 document.querySelectorAll('[data-route]').forEach(x=>{x.classList.toggle('active',x.dataset.route===route);if(x.dataset.route===route)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
 $('mainNav').classList.remove('open');$('menuToggle').setAttribute('aria-expanded','false');
 window.scrollTo({top:0,behavior:'instant'});
 if(route==='mapa')setTimeout(initMap,60);
 if(route==='registrar')setTimeout(setupPicker,60);
 if(route==='gestao')renderAdminTable(getAllOccurrences());
 if(route==='perfil')renderProfile();
 if(route==='criticidade')renderCriticality();
 if(route==='detalhe')renderDetail(activeDetailId);
 document.title=($('page-'+route).querySelector('h1')?.textContent||'Início')+' | AlagaManaus';
 $('main-content').focus({preventScroll:true});
};
function setupPicker() {
 if(typeof L==='undefined'){$('locationPicker').textContent='Mapa indisponível. Informe latitude e longitude nos campos acima.';return}
 if(!pickerMap){$('locationPicker').textContent='';pickerMap=L.map('locationPicker').setView([-3.0937,-60.0212],12);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(pickerMap);pickerMap.on('click',e=>setCoordinates(e.latlng.lat,e.latlng.lng));}
 pickerMap.invalidateSize();
}
function setCoordinates(lat,lng) { $('latitude').value=lat.toFixed(6);$('longitude').value=lng.toFixed(6);if(pickerMap){if(pickerMarker)pickerMarker.setLatLng([lat,lng]);else pickerMarker=L.marker([lat,lng],{draggable:true,title:'Local da ocorrência'}).addTo(pickerMap).on('dragend',()=>{const p=pickerMarker.getLatLng();setCoordinates(p.lat,p.lng)});pickerMap.panTo([lat,lng])} }
useGeolocation = function() {
 if(!navigator.geolocation){showToast('Localização indisponível. Informe as coordenadas manualmente.');return}
 const b=$('geoButton');b.disabled=true;b.textContent='Localizando…';
 navigator.geolocation.getCurrentPosition(p=>{setCoordinates(p.coords.latitude,p.coords.longitude);b.disabled=false;b.textContent='Usar minha localização';showToast('Coordenadas capturadas. Confira o endereço antes de enviar.')},()=>{b.disabled=false;b.textContent='Usar minha localização';showToast('Não foi possível obter sua localização. Use o mapa ou as coordenadas.')},{timeout:8000});
};
validateField = function(field) {
 const mapping={locationText:['locationError','Informe a rua ou um ponto de referência.'],occurrenceType:['typeError','Selecione alagamento ou descarte irregular.'],occurrenceNeighborhood:['neighborhoodError','Informe o bairro da ocorrência.'],occurrenceDescription:['descriptionError','Descreva o ocorrido com pelo menos 10 caracteres.']};
 const [error,text]=mapping[field.id];const invalid=field.value.trim().length<(field.id==='occurrenceDescription'?10:1);
 $(error).textContent=invalid?text:'';field.setAttribute('aria-invalid',String(invalid));field.setAttribute('aria-describedby',error);field.classList.toggle('invalid',invalid);return !invalid;
};
setupOccurrenceForm = function() {
 const form=$('occurrenceForm');
 ['locationText','occurrenceType','occurrenceNeighborhood','occurrenceDescription'].forEach(id=>$(id).addEventListener('input',()=>{validateField($(id));$('descriptionCount').textContent=$('occurrenceDescription').value.length}));
 $('geoButton').addEventListener('click',useGeolocation);
 $('occurrencePhoto').addEventListener('change',async()=>{
  photoData='';$('photoPreview').classList.add('hidden');const f=$('occurrencePhoto').files[0];if(!f)return;
  if(!/^image\/(jpeg|png|webp)$/.test(f.type)||f.size>3*1024*1024){showToast('Escolha uma imagem JPG, PNG ou WebP de até 3 MB.');$('occurrencePhoto').value='';return}
  const reader=new FileReader();reader.onload=()=>{photoData=reader.result;$('photoPreview').src=photoData;$('photoPreview').classList.remove('hidden')};reader.onerror=()=>showToast('Não foi possível ler a imagem. Escolha outra foto.');reader.readAsDataURL(f);
 });
 form.addEventListener('reset',()=>{photoData='';$('photoPreview').classList.add('hidden');document.querySelectorAll('.field-error').forEach(x=>x.textContent='');form.querySelectorAll('[aria-invalid]').forEach(x=>{x.setAttribute('aria-invalid','false');x.classList.remove('invalid')});$('descriptionCount').textContent='0';if(pickerMarker){pickerMarker.remove();pickerMarker=null}});
 form.addEventListener('submit',e=>{
  e.preventDefault();$('successMessage').classList.add('hidden');
  const invalid=['locationText','occurrenceType','occurrenceNeighborhood','occurrenceDescription'].map($).filter(x=>!validateField(x));
  if(invalid.length){invalid[0].focus();return}
  const lat=Number($('latitude').value),lng=Number($('longitude').value);
  if(!$('latitude').value||!$('longitude').value||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){$('coordinateError').textContent='Informe latitude entre -90 e 90 e longitude entre -180 e 180, ou selecione no mapa.';$('latitude').focus();return}
  $('coordinateError').textContent='';
  pendingItem={id:Date.now(),title:$('locationText').value.trim(),neighborhood:$('occurrenceNeighborhood').value.trim(),type:$('occurrenceType').value,criticality:'pendente',score:null,lat,lng,date:new Date().toISOString().slice(0,10),status:'em_analise',description:$('occurrenceDescription').value.trim(),photo:photoData,userCreated:true};
  $('reviewContent').innerHTML=`<h2 id="reviewTitle">Confira sua ocorrência</h2><p><strong>${escapeHtml(pendingItem.title)}</strong><br>${escapeHtml(pendingItem.neighborhood)}</p><p>${pendingItem.type==='alagamento'?'Alagamento':'Descarte irregular'} · ${lat.toFixed(5)}, ${lng.toFixed(5)}</p><p>${escapeHtml(pendingItem.description)}</p><p>O registro será salvo neste navegador, com criticidade pendente de avaliação.</p>`;
  $('reviewDialog').showModal();
 });
};
updateStatus = function(id,status) {
 const changes=readLocal('alagaManausStatus',{});const previous=getAllOccurrences().find(x=>x.id===id);if(!previous)return;
 changes[id]={status,history:[...(changes[id]?.history||[]),{status,date:new Date().toISOString()}]};
 if(!saveLocal('alagaManausStatus',changes))return;
 localStorage.removeItem('alagaManausNotificationsRead');renderAdminTable(getAllOccurrences());renderHomeStats();renderProfile();showToast('Status salvo: '+STATUS_LABELS[status]+'.');
};
renderProfile = function() {originalProfile();const items=getAllOccurrences().filter(x=>x.userCreated);if(items.length)$('profileOccurrences').innerHTML=occurrenceCards(items);const session=readLocal('alagaManausSession',null);$('profileTitle').textContent=session?.name||'Usuário demonstrativo';document.querySelector('#page-perfil .eyebrow').textContent=session?.role==='gestor'?'Perfil gestor · demonstração':'Perfil cidadão';};
renderNotifications = function() {
 const changes=readLocal('alagaManausStatus',{}),read=localStorage.getItem('alagaManausNotificationsRead')==='1';
 const items=getAllOccurrences().filter(x=>x.userCreated||changes[x.id]);
 $('notificationsList').innerHTML=items.length?items.map(x=>`<article class="notification-item ${read?'':'unread'}"><h3>${STATUS_LABELS[x.status]}</h3><p><a href="#detalhe-${x.id}">${escapeHtml(x.title)}</a>: consulte o histórico de atendimento.</p></article>`).join(''):'<div class="empty-state">Nenhuma atualização por enquanto.</div>';
};
renderCriticality = function(){originalCriticality();document.querySelectorAll('#rankingList small').forEach(x=>{if(x.textContent.includes('NaN'))x.textContent='Aguardando classificação'});};
function renderDetail(id) {
 const x=getAllOccurrences().find(x=>x.id===id);if(!x){$('detailBody').innerHTML='<p>Ocorrência não encontrada. <a href="#mapa">Voltar ao mapa</a></p>';return}
 const changes=readLocal('alagaManausStatus',{}),history=changes[id]?.history||[];
 $('detailBody').innerHTML=`<div class="section-heading"><div><span class="eyebrow">Ocorrência #${x.id}</span><h1>${escapeHtml(x.title)}</h1><p>${escapeHtml(x.neighborhood)} · ${x.type==='alagamento'?'Alagamento':'Resíduos'}</p></div><a href="#mapa" class="btn btn-secondary">Voltar ao mapa</a></div><div class="detail-summary"><article class="panel"><span class="badge ${x.criticality}">${CRITICALITY_LABELS[x.criticality].label}${x.score===null?'':` · ${x.score}/100`}</span><h2>Sobre o registro</h2><p>${escapeHtml(x.description)}</p>${x.photo?`<img class="photo-preview" src="${escapeHtml(x.photo)}" alt="Foto enviada da ocorrência em ${escapeHtml(x.title)}">`:'<p>Nenhuma foto anexada a este registro.</p>'}<p>Coordenadas: ${x.lat.toFixed(5)}, ${x.lng.toFixed(5)}</p><h2>Histórico de atendimento</h2><article class="timeline-item"><strong>Registro em ${x.date.split('-').reverse().join('/')}</strong><p>${STATUS_LABELS[x.status]} · situação atual</p></article>${history.map(h=>`<article class="timeline-item"><strong>${STATUS_LABELS[h.status]}</strong><p>${new Date(h.date).toLocaleString('pt-BR')}</p></article>`).join('')}</article><aside class="panel"><h2>Status atual</h2><strong>${STATUS_LABELS[x.status]}</strong><p>${{em_analise:'O registro está aguardando avaliação.',em_atendimento:'A ocorrência está em acompanhamento para atendimento.',resolvido:'O atendimento foi marcado como concluído.'}[x.status]}</p><h2>Sobre o índice</h2><p>${x.score===null?'A criticidade será definida após avaliação.':'Valor fictício da amostra acadêmica. Não representa uma avaliação oficial de risco.'}</p><a href="#criticidade">Entender os critérios</a></aside></div>`;
}
CRITICALITY_LABELS.pendente={label:'Aguardando avaliação',icon:'?'};
$('occurrenceForm').querySelector('.form-grid').insertAdjacentHTML('afterbegin',`<div class="form-group full"><div class="coordinate-grid"><div><label for="latitude">Latitude *</label><input id="latitude" type="number" step="any" min="-90" max="90" placeholder="Ex.: -3.0937" aria-describedby="coordinateError"></div><div><label for="longitude">Longitude *</label><input id="longitude" type="number" step="any" min="-180" max="180" placeholder="Ex.: -60.0212" aria-describedby="coordinateError"></div></div><div class="field-error" id="coordinateError" role="alert"></div><div id="locationPicker" class="location-picker" aria-label="Selecione o local da ocorrência">Carregando mapa de localização…</div></div>`);
// O endereço continua sendo a primeira informação do formulário.
const coords=$('latitude').closest('.form-group');const address=$('locationText').closest('.form-group');address.after(coords);
$('occurrencePhoto').accept='image/jpeg,image/png,image/webp';$('occurrencePhoto').nextElementSibling.textContent='JPG, PNG ou WebP, até 3 MB. A foto será salva apenas neste navegador.';
$('occurrencePhoto').parentElement.insertAdjacentHTML('beforeend','<img id="photoPreview" class="photo-preview hidden" alt="Prévia da foto selecionada">');
$('page-mapa').querySelector('.map-layout').insertAdjacentHTML('afterend','<h2 style="margin-top:30px;font-size:1.2rem">Ocorrências no território</h2><div id="mapResults" class="map-result-list" aria-live="polite"></div>');
$('filterCriticality').add(new Option('Aguardando avaliação','pendente'));
$('main-content').insertAdjacentHTML('beforeend',`
<section id="page-detalhe" class="page"><div id="detailBody" class="container section-block"></div></section>
<section id="page-login" class="page"><div class="container section-block"><div class="section-heading"><div><span class="eyebrow">Seu espaço no AlagaManaus</span><h1>Acessar demonstração</h1></div></div><div class="form-card auth-card"><p>Experimente os perfis de cidadão e gestor. Este acesso é simulado; não utilize uma senha real.</p><div class="auth-tabs"><button class="btn btn-secondary" id="loginTab">Entrar</button><button class="btn btn-secondary" id="signupTab">Criar perfil</button></div><form id="authForm"><label for="authName">Nome de exibição</label><input id="authName" required autocomplete="nickname" placeholder="Como podemos chamar você?"><label for="authEmail">E-mail</label><input id="authEmail" type="email" required autocomplete="email" placeholder="nome@exemplo.com"><label for="authRole">Perfil de demonstração</label><select id="authRole"><option value="cidadao">Cidadão</option><option value="gestor">Gestor público</option></select><label for="authPassword">Senha de teste (mínimo de 8 caracteres)</label><input id="authPassword" type="password" required minlength="8" autocomplete="off" aria-describedby="authHelp"><small id="authHelp">A senha não é armazenada ou verificada contra um servidor.</small><button class="btn btn-primary" id="authSubmit">Entrar na demonstração</button><button type="button" class="link-button" id="recoverPassword">Recuperar senha</button><p id="authFeedback" role="status"></p></form></div></div></section>
<section id="page-ajuda" class="page"><div class="container section-block"><div class="section-heading"><div><span class="eyebrow">Orientações de uso</span><h1>Ajuda e acessibilidade</h1></div></div><div class="help-grid"><article class="panel"><h2>Como usar o AlagaManaus</h2><details open><summary>Como registrar uma ocorrência?</summary><p>Abra “Registrar ocorrência”, descreva o endereço, escolha o ponto no mapa ou informe coordenadas. Preencha os detalhes e revise antes de confirmar.</p></details><details><summary>O que significa cada status?</summary><p>Em análise: aguardando avaliação. Em atendimento: em acompanhamento para atendimento. Resolvido: atendimento marcado como concluído.</p></details><details><summary>Como funciona a criticidade?</summary><p>Os índices da amostra são fictícios. Recorrência, gravidade e população afetada ilustram a futura análise. Novos registros aguardam classificação.</p></details><details><summary>Meus dados são enviados à prefeitura?</summary><p>Não. Este é um protótipo acadêmico: os registros ficam apenas no navegador. Não há integração com órgãos públicos.</p></details></article><article class="panel"><h2>Navegação acessível</h2><p>Use Tab e Shift + Tab para percorrer os controles; Enter para ativar links e botões; Escape para fechar a revisão. O primeiro link permite pular a navegação.</p><p>As ocorrências também aparecem em lista. Os níveis têm rótulos em texto e os campos de coordenadas oferecem uma alternativa ao uso do mapa.</p><p>Você pode ampliar o navegador com Ctrl + “+”. A interface se adapta a telas menores e respeita a preferência de movimento reduzido.</p><h2>Sem conexão?</h2><p>Os mapas dependem da internet. Os registros locais podem ser consultados pela lista e pelo perfil. Para usar geolocalização, abra em localhost ou HTTPS.</p></article></div></div></section>
<section id="page-design" class="page"><div class="container section-block"><div class="section-heading"><div><span class="eyebrow">AlagaManaus / 2.0</span><h1>Guia visual da interface</h1></div></div><div class="panel"><h2>Cores e identidade</h2><div class="swatches"><div class="swatch"><span style="background:#102f40"></span><p>Azul institucional<br>#102F40</p></div><div class="swatch"><span style="background:#075b65"></span><p>Verde de ação<br>#075B65</p></div><div class="swatch"><span style="background:#536675"></span><p>Texto secundário<br>#536675</p></div><div class="swatch"><span style="background:#f5f7f8"></span><p>Fundo<br>#F5F7F8</p></div></div><h2>Tipografia e ritmo</h2><p>Segoe UI / Arial / sans-serif. Texto-base de 16 px; títulos fluidos; espaçamentos de 8, 16, 24 e 32 px. Bordas discretas e sombras contidas.</p><h2>Criticidade</h2><div class="hero-actions"><span class="badge critico">Crítico</span><span class="badge alto">Alto</span><span class="badge medio">Médio</span><span class="badge baixo">Baixo</span><span class="badge pendente">Aguardando avaliação</span></div><h2>Ações</h2><div class="hero-actions"><a href="#registrar" class="btn btn-primary">Registrar ocorrência</a><a href="#mapa" class="btn btn-secondary">Consultar mapa</a><a href="#ajuda" class="btn btn-ghost">Ajuda</a></div><h2>Consistência e foco</h2><p>As mesmas cores, botões, rótulos e cartões aparecem em todas as telas (H4). Hierarquia e espaçamento destacam a ação principal (H8). Tab mostra o contorno de foco dos controles.</p></div></div></section>`);
document.body.insertAdjacentHTML('beforeend','<dialog id="reviewDialog" aria-labelledby="reviewTitle"><div id="reviewContent"></div><div class="form-actions"><button class="btn btn-secondary" id="editReview">Voltar e corrigir</button><button class="btn btn-primary" id="confirmReview">Confirmar registro</button></div></dialog>');
$('editReview').onclick=()=>$('reviewDialog').close();
$('confirmReview').onclick=()=>{if(!pendingItem)return;if(!saveLocal('alagaManausOccurrences',[pendingItem,...getStoredOccurrences()]))return;pendingItem=null;localStorage.removeItem('alagaManausNotificationsRead');$('reviewDialog').close();$('occurrenceForm').reset();$('successMessage').classList.remove('hidden');$('successMessage').scrollIntoView({block:'center'});renderHomeStats();populateNeighborhoods();renderProfile();showToast('Ocorrência salva. Acompanhe o registro no seu perfil.')};
$('signupTab').onclick=()=>{$('authSubmit').textContent='Criar perfil demonstrativo';$('authName').focus()};
$('loginTab').onclick=()=>{$('authSubmit').textContent='Entrar na demonstração';$('authEmail').focus()};
$('authForm').onsubmit=e=>{e.preventDefault();if(!saveLocal('alagaManausSession',{name:$('authName').value.trim(),role:$('authRole').value}))return;$('authPassword').value='';location.hash=$('authRole').value==='gestor'?'gestao':'perfil';showToast('Perfil demonstrativo ativado.')};
$('recoverPassword').onclick=()=>{$('authFeedback').textContent='Recuperação simulada: em produção, um link seria enviado ao e-mail informado. Nenhuma mensagem foi enviada.'};
function updateConnection(){if(!navigator.onLine){$('systemStatus').textContent='Sem conexão · consulte os registros locais pela lista';$('systemStatus').classList.add('offline-banner')}else{$('systemStatus').textContent='Ambiente de demonstração · registros fictícios para avaliação acadêmica';$('systemStatus').classList.remove('offline-banner')}}
window.addEventListener('online',updateConnection);window.addEventListener('offline',updateConnection);updateConnection();
