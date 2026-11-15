"use strict";
// Progressive enhancement: existing API, validation and moderation remain authoritative.
document.addEventListener('DOMContentLoaded', () => {
  const icons = {
    home:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    mapa:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
    registrar:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 7v10M7 12h10"/>',
    criticidade:'<path d="M4 20V10M12 20V4M20 20v-7"/>',
    gestao:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M9 5V3h6v2M8 10h8M8 14h8M8 18h5"/>',
    perfil:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'
  };
  document.querySelectorAll('.main-nav [data-route]').forEach(link => {
    link.insertAdjacentHTML('afterbegin',`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[link.dataset.route] || ''}</svg>`);
  });
  const titles={home:'Visão geral',mapa:'Mapa de ocorrências',registrar:'Novo relato',criticidade:'Criticidade',gestao:'Gestão',perfil:'Minha conta',login:'Entrar',cadastro:'Criar conta',ajuda:'Ajuda e privacidade'};
  function updateSection(){const r=location.hash.slice(1)||'home';document.getElementById('currentSection').textContent=titles[r]||(r.startsWith('detalhe-')?'Detalhes do relato':'Visão geral');document.title=`${document.getElementById('currentSection').textContent} · AlagaManaus`;if(r==='home'||!location.hash)setTimeout(()=>overviewMap?.invalidateSize(),100);}
  let overviewMap, overviewMarkers, overviewTiles;
  updateSection();window.addEventListener('hashchange',updateSection);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('mainNav').classList.contains('open')){document.getElementById('mainNav').classList.remove('open');document.getElementById('menuToggle').setAttribute('aria-expanded','false');document.getElementById('menuToggle').focus();}});
  if(window.L){
    overviewMap=L.map('homeMap',{zoomControl:false,scrollWheelZoom:false,dragging:false,doubleClickZoom:false,touchZoom:false,boxZoom:false,keyboard:false}).setView([-3.075,-60.025],11);
    overviewTiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(overviewMap);
    overviewTiles.on('tileerror',()=>document.getElementById('homeMapFallback').classList.remove('hidden'));
    overviewMarkers=L.layerGroup().addTo(overviewMap);
    document.getElementById('retryHomeMap').addEventListener('click',()=>{document.getElementById('homeMapFallback').classList.add('hidden');overviewTiles.redraw();});
    new MutationObserver(()=>{overviewMarkers.clearLayers();if(typeof items!=='undefined')items.forEach(x=>L.circleMarker([x.lat,x.lng],{radius:6,color:color(x.criticality),weight:2,fillOpacity:.7}).bindTooltip(x.neighborhood?document.createTextNode(x.neighborhood):document.createTextNode('Ocorrência')).addTo(overviewMarkers));}).observe(document.getElementById('homePriorities'),{childList:true});
  }else document.getElementById('homeMapFallback').classList.remove('hidden');
  // Toggle the actual filtered results and map without maintaining a second data source.
  const mapHeading=document.querySelector('#page-mapa .section-heading');
  const switcher=document.createElement('div');switcher.className='view-switch';switcher.setAttribute('aria-label','Visualização de ocorrências');switcher.innerHTML='<button type="button" data-view="both" aria-pressed="true">Mapa e relatos</button><button type="button" data-view="list" aria-pressed="false">Só relatos</button>';
  mapHeading.appendChild(switcher);
  switcher.addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;switcher.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelector('.map-panel').dataset.view=button.dataset.view;if(button.dataset.view!=='list'&&typeof map!=='undefined')setTimeout(()=>map?.invalidateSize(),50);});
  const filterPanel=document.querySelector('.filter-panel');
  const filterToggle=document.createElement('button');filterToggle.type='button';filterToggle.className='mobile-filter-toggle';filterToggle.textContent='Filtros e legenda ＋';filterToggle.setAttribute('aria-expanded','false');
  filterPanel.prepend(filterToggle);
  filterToggle.addEventListener('click',()=>{const open=filterPanel.classList.toggle('filters-open');filterToggle.setAttribute('aria-expanded',String(open));filterToggle.textContent=open?'Fechar filtros −':'Filtros e legenda ＋';});
  // Reorganize existing controls; IDs, native validation, and submit listeners are retained.
  const form=document.getElementById('occurrenceForm'), originalGrid=form.querySelector('.form-grid');
  const groups=[...originalGrid.children];
  function section(number,title,description){const el=document.createElement('section');el.className='report-section';el.setAttribute('aria-labelledby',`report-section-${number}`);el.innerHTML=`<div class="report-section-heading"><span aria-hidden="true">${number}</span><div><h2 id="report-section-${number}">${title}</h2><p>${description}</p></div></div><div class="form-grid"></div>`;return el;}
  const local=section('01','Localize a ocorrência','Encontre o endereço e ajuste o ponto no mapa.');
  const details=section('02','Conte o que aconteceu','Uma descrição clara ajuda na análise do relato.');
  const localGrid=local.querySelector('.form-grid'),detailsGrid=details.querySelector('.form-grid');
  const byId=id=>groups.find(g=>g.querySelector('#'+id));
  ['postalCode','locationText','occurrenceNeighborhood','pickerMap'].forEach(id=>localGrid.appendChild(byId(id)));
  byId('occurrenceNeighborhood').classList.add('full');
  const coordinates=document.createElement('details');coordinates.className='coordinate-fields';coordinates.innerHTML='<summary>Coordenadas do ponto · ajuste manual</summary><div></div>';
  ['latitude','longitude'].forEach(id=>coordinates.lastElementChild.appendChild(byId(id)));localGrid.appendChild(coordinates);
  ['occurrenceType','eventDate','occurrenceDescription','occurrencePhoto','contact'].forEach(id=>detailsGrid.appendChild(byId(id)));
  byId('contact').classList.add('full');
  originalGrid.replaceWith(local,details);
  // A collapsed native details must open when one of its required inputs is invalid.
  form.addEventListener('invalid',e=>{if(coordinates.contains(e.target))coordinates.open=true;},true);
  const layout=document.createElement('div');layout.className='report-layout';form.before(layout);layout.appendChild(form);
  const companion=document.createElement('aside');companion.className='report-companion';companion.innerHTML='<span class="eyebrow">UM BOM RELATO FAZ DIFERENÇA</span><h2>Pequenos detalhes.<br>Informações melhores.</h2><ul><li>Marque o ponto mais próximo de onde aconteceu.</li><li>Descreva o impacto na rua e nas pessoas.</li><li>Inclua uma foto do local, se for seguro.</li></ul><p class="privacy-line">Você pode relatar sem criar uma conta. Seu contato é opcional e não será publicado.</p><span class="form-completion" id="completionLabel">Preencha os dados obrigatórios</span><div class="completion-track" aria-hidden="true"><span id="completionFill"></span></div>';
  layout.appendChild(companion);
  const required=[...form.querySelectorAll('[required]')];
  // validity.valid reads state without dispatching invalid events while typing.
  const progress=()=>{const done=required.filter(x=>x.value.trim()&&x.validity.valid).length;document.getElementById('completionLabel').textContent=`${done} de ${required.length} campos obrigatórios preenchidos`;document.getElementById('completionFill').style.width=`${done/required.length*100}%`;};
  form.addEventListener('locationupdated',progress);form.addEventListener('input',progress);form.addEventListener('change',progress);form.addEventListener('reset',()=>setTimeout(progress,0));
  new MutationObserver(progress).observe(document.getElementById('locationHelp'),{childList:true,subtree:true});
  setTimeout(progress,0);
});
