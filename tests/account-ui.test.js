import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Cadastro: orientação de senha, confirmação, redefinição e mostrar senha', () => {
  const nodes = new Map();
  const get = id => {
    if(!nodes.has(id))nodes.set(id,{value:'',type:'password',textContent:'',attributes:{},classes:new Set(),events:{},classList:{toggle(name,on){const node=nodes.get(id);on?node.classes.add(name):node.classes.delete(name)}},setCustomValidity(text){this.validityMessage=text},setAttribute(k,v){this.attributes[k]=v},addEventListener(k,fn){this.events[k]=fn}});
    return nodes.get(id);
  };
  const toggle=get('toggle');toggle.dataset={togglePassword:'registerPassword'};
  const context=vm.createContext({document:{getElementById:get,querySelectorAll:()=>[toggle],addEventListener:(name,fn)=>fn()},setTimeout:fn=>fn()});
  vm.runInContext(fs.readFileSync(new URL('../src/js/account-ui.js',import.meta.url),'utf8'),context);
  const password=get('registerPassword'),confirm=get('registerConfirm');
  password.value='abc';password.events.input();
  assert.match(get('passwordHint').textContent,/Faltam 7/);
  password.value='UmaSenha123!';password.events.input();
  assert(get('passwordHint').classes.has('requirement-met'));
  confirm.value='diferente';confirm.events.input();
  assert.equal(confirm.attributes['aria-invalid'],'true');
  assert.equal(confirm.validityMessage,'As senhas precisam ser iguais.');
  confirm.value=password.value;confirm.events.input();
  assert.equal(confirm.validityMessage,'');assert.equal(confirm.attributes['aria-invalid'],'false');
  assert.equal(get('confirmHint').textContent,'As senhas coincidem.');
  password.type='text';toggle.events.click();assert.equal(toggle.attributes['aria-pressed'],'true');
  password.value='';confirm.value='';get('registerForm').events.reset();
  assert.equal(confirm.validityMessage,'');assert.equal(get('confirmHint').textContent,'Repita a senha escolhida.');
  assert.equal(get('passwordHint').textContent,'Use pelo menos 10 caracteres.');
});
