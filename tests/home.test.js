import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exerce a renderização real com respostas controladas, sem depender de APIs externas.
test('Página inicial: estado vazio, indicadores, prioridades e links dos registros', async () => {
  const source = fs.readFileSync(new URL('../src/js/app.js', import.meta.url), 'utf8');
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {textContent:'', innerHTML:'', className:'', attributes:{}, properties:{}, setAttribute(k,v){this.attributes[k]=v}, style:{setProperty(k,v){nodes.get(id).properties[k]=v}}});
    return nodes.get(id);
  };
  let rows=[], areas=[];
  const context=vm.createContext({
    $:node, document:{querySelector:node},
    api:async path=>({items:path==='/areas'?areas:rows}),
    populateNeighborhoods(){},updateAnalysisSummary(){},filters:async()=>{},
    labels:{alto:'Alta',baixo:'Baixa',medio:'Média',sem_dados:'Sem dados'},
    color:value=>({alto:'#b42318',sem_dados:'#64748b'})[value]||'#16794a',
    areaName:area=>area.name, badge:()=>'', formatDate:value=>value,
    esc:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),
  });
  vm.runInContext('let items=[], areas=[];'+source.slice(source.indexOf('async function refresh()'),source.indexOf('function queryFilters()')),context);
  await context.refresh();
  assert.match(node('homePriorities').innerHTML,/após a moderação/);
  assert.equal(node('heroPriorityName').textContent,'Sem dados');
  assert.equal(node('.priority-spotlight .badge').className,'badge sem_dados');
  assert.equal(node('statTotal').textContent,0);
  rows=[
    {id:'old',title:'Antigo',neighborhood:'União',date:'2020-03-23',type:'alagamento',status:'resolvido'},
    {id:'new',title:'<script>Teste</script>',neighborhood:'Redenção',date:'2026-10-26',type:'residuo'},
    {id:'third',title:'Terceiro',neighborhood:'União',date:'2026-10-24',type:'alagamento'},
    {id:'fourth',title:'Quarto',neighborhood:'União',date:'2026-10-23',type:'alagamento'},
  ];
  areas=[{name:'Área União',score:75,criticality:'alto',a:5,r:2,recurring:true}];
  await context.refresh();
  assert.equal(node('statTotal').textContent,4);
  assert.equal(node('statResolved').textContent,1);
  assert.equal(node('statCritical').textContent,1);
  assert.equal(node('statNeighborhood').textContent,'União');
  assert.equal(node('heroPriorityName').textContent,'Área União');
  assert.equal(node('.priority-spotlight .badge').className,'badge alto');
  assert.equal(node('.hero-score').properties['--home-score'],75);
  const html=node('homePriorities').innerHTML;
  assert.equal((html.match(/class="home-record"/g)||[]).length,3);
  assert(html.indexOf('#detalhe-new')<html.indexOf('#detalhe-third'));
  assert(!html.includes('#detalhe-old'));
  assert(!html.includes('<script>'));
  assert(html.includes('&lt;script&gt;'));
});
