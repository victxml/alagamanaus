import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
test('Produção exige HTTPS e cookies seguros', () => {
  assert.match(server, /checkProductionConfiguration\(\)/);
  assert.match(server, /PUBLIC_ORIGIN com HTTPS/);
  assert.match(server, /sessionCookie\(t, 28800\)/);
  assert.match(server, /sessionCookie\("", 0\)/);
});
test('Requisições entre sites são bloqueadas e cabeçalhos de proteção existem', () => {
  assert.match(server, /sec-fetch-site/);
  assert.match(server, /X-Frame-Options/);
  assert.match(server, /Permissions-Policy/);
  assert.match(server, /Strict-Transport-Security/);
});
