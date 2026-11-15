import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { calculate, civilDate } from '../backend/domain.js';

test('Gestão e criticidade: aprovação, janela, áreas únicas e filtros coerentes', () => {
  const today=civilDate();
  const row={id:'pending',title:'Rua Bromélia',description:'Simulação de alagamento.',neighborhood:'Redenção',date:today,lat:-3.0937,lng:-60.0212,type:'alagamento',status:'em_analise',moderation:'pending',score:14,criticality:'baixo'};
  let rows=[row,{...row,id:'historical',date:'2020-03-23',moderation:'approved'},...Array.from({length:5},(_,i)=>({...row,id:'a'+i,moderation:'approved'}))];
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:''});return nodes.get(id)};
  const source=fs.readFileSync(new URL('../src/js/app.js',import.meta.url),'utf8');
  const context=vm.createContext({$:node,civilDate,formatDate:x=>x,neighborhoodKey:x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),esc:x=>String(x).replaceAll('<','&lt;'),badge:x=>`Índice ${x.score}`,decisions:{pending:'Pendente',approved:'Aprovado',rejected:'Rejeitado'},statuses:{em_analise:'Em análise',resolvido:'Resolvido'},user:{role:'admin'},items:rows.filter(x=>x.moderation==='approved'),areas:calculate(rows),adminItems:rows});
  vm.runInContext(source.slice(source.indexOf('function occurrencePreview('),source.indexOf('function openPhotoPreview(')) + source.slice(source.indexOf('function analysisWindow()'),source.indexOf('async function route()')),context);
  context.updateAnalysisSummary();context.adminTable();
  assert.equal(node('adminAnalysis').textContent,1);
  assert.match(node('adminTableBody').innerHTML,/Simulação de alagamento/);
  assert.match(node('adminTableBody').innerHTML,/Sem foto anexada/);
  row.imageUrl='/api/images/pending';context.adminTable();
  assert.match(node('adminTableBody').innerHTML,/data-preview="pending"/);
  assert.match(node('adminTableBody').innerHTML,/src="\/api\/images\/pending"/);
  assert.match(context.occurrencePreview({...row,description:'<script>teste</script>'}),/&lt;script>/);
  assert(!context.occurrencePreview({...row,description:'<script>teste</script>'}).includes('<script>'));

  assert.equal(node('adminApproved').textContent,5);
  assert.equal(node('analysisIncluded').textContent,5);
  assert.equal(node('analysisHistorical').textContent,1);
  assert.equal(node('adminPriority').textContent,1); // 5 relatos na mesma área, não 5 áreas.
  assert.equal(node('analysisAreas').textContent,1);
  assert.match(context.adminContribution(row),/Não participa/);
  assert.match(context.adminContribution(rows[1]),/Registro histórico/);
  assert.match(context.adminContribution(rows[2]),/Incluído no cálculo/);
  node('adminModeration').value='pending';context.adminTable();
  assert.equal(node('adminResultCount').textContent,'1 de 7 relato(s)');
  assert.equal(node('adminPriority').textContent,1); // Filtrar a lista não altera indicadores globais.
  row.moderation='approved';context.items=rows.filter(x=>x.moderation==='approved');context.areas=calculate(rows);
  context.adminTable();context.updateAnalysisSummary();
  assert.equal(node('adminApproved').textContent,6);assert.equal(node('analysisIncluded').textContent,6);
  assert.equal(node('adminAnalysis').textContent,0);
  assert.equal(context.areas[0].score,70); // limite da parcela de alagamentos.
  row.status='resolvido';context.adminTable();assert.equal(node('adminResolved').textContent,1);
  assert.equal(calculate(rows)[0].score,70); // resolver não retira o evento do histórico.
  rows=rows.map(x=>({...x,moderation:'rejected'}));context.adminItems=rows;context.items=[];context.areas=calculate(rows);
  context.adminTable();context.updateAnalysisSummary();assert.equal(node('analysisIncluded').textContent,0);assert.equal(node('adminPriority').textContent,0);
});
