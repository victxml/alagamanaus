# API — versão 1

Origem única: a API fica em `/api` no mesmo servidor das telas. JSON UTF-8, coordenadas WGS 84. Sessão em cookie HttpOnly com validade de oito horas. Falhas retornam `{ "error": "mensagem" }` com HTTP 400/401/403/404/409/413/429/500.

| Método e rota | Permissão | Função |
|---|---|---|
| GET /api/health | Pública | Saúde do serviço |
| GET /api/auth/me | Pública | Perfil da sessão, ou null |
| POST /api/auth/register | Pública | Cria cidadão: name, email, password |
| POST /api/auth/login | Pública | Autentica: email, password |
| PATCH /api/auth/profile | Autenticada | Atualiza name/email, currentPassword e newPassword opcionais |
| GET /api/images/:id | Pública se aprovada | Imagem JPEG; pendente apenas para autor/gestão |
| POST /api/auth/logout | Pública | Invalida sessão |
| GET /api/occurrences | Pública | Apenas aprovadas, com índice associado |
| POST /api/occurrences | Pública | Envia ocorrência pendente |
| GET /api/occurrences/:id | Pública se aprovada | Detalhes; pendentes apenas para autor autenticado ou administrador |
| PATCH /api/occurrences/:id | Administrador | Edita e devolve à moderação |
| DELETE /api/occurrences/:id | Administrador | Exclui mantendo evento de auditoria |
| POST /api/occurrences/:id/moderate | Administrador | Decisão e justificativa |
| GET /api/areas | Pública | Células calculadas e parâmetros |
| GET /api/mine | Autenticada | Histórico do próprio autor |
| GET /api/admin/occurrences | Gestor / administrador | Consulta administrativa sem contatos |
| GET /api/reports | Gestor / administrador | JSON, CSV ou GeoJSON |
| GET /api/users | Administrador | Lista usuários sem hashes |
| POST /api/users | Administrador | Cria usuário e define perfil |
| PATCH /api/users/:id | Administrador | Define role e active (0/1); invalida sessões |
| GET /api/audit | Administrador | Últimos 200 eventos |

Filtros: `neighborhood`, `type=alagamento|residuo`, `criticality=baixo|medio|alto|sem_dados`, `start=YYYY-MM-DD`, `end=YYYY-MM-DD`. São compartilhados por `/occurrences` e `/reports`. Exemplo: `/api/reports?type=alagamento&start=2026-08-01&format=geojson`.

Envio:

```json
{"title":"Rua de exemplo","neighborhood":"Redenção","type":"alagamento","description":"Água acumulada após a chuva.","lat":-3.0937,"lng":-60.0212,"date":"2026-10-11","contact":""}
```

Use a data real do evento. Campos obrigatórios: title (3–160), neighborhood (2–100), description (10–2000), type, lat, lng, date. Data futura, calendário inválido e ponto fora de Manaus são rejeitados. `contact` é opcional, até 150 caracteres, restrito ao armazenamento. O servidor define id, autor e moderação; não aceita que o cidadão escolha aprovação ou índice.

Moderação:

```json
{"moderation":"approved","reason":"Registro coerente, sem duplicidade identificada."}
```

Estados: `pending`, `approved`, `rejected`. Justificativa: 3–500 caracteres. `status` é separado da decisão: `em_analise`, `em_atendimento`, `resolvido`. O autor pode consultar a justificativa em `/mine`.

Criação administrativa de usuário:

```json
{"name":"Gestor","email":"gestor@example.com","password":"UmaSenhaLonga123!","role":"manager"}
```

Perfis: `citizen`, `manager`, `admin`. O administrador não pode rebaixar/desativar a própria conta pela rota de gerenciamento. As senhas têm salt individual e scrypt. Não há recuperação de senha por e-mail nesta entrega.

Relatórios: `format=csv`, `format=geojson`; omitido resulta em JSON. JSON/GeoJSON incluem parâmetros, filtros, geração, áreas e ocorrências aprovadas. CSV inclui cabeçalhos de metadados e colunas de ocorrência/índice. Contatos e identificadores de autores são omitidos. Valores com prefixo de fórmula recebem proteção na exportação CSV.

## Anexo opcional — versão 1.1

`POST /api/occurrences` aceita `image` opcional como data URL base64 de JPG/PNG/WebP. Arquivo até 5 MB, imagem até 20 megapixels, corpo JSON até 7 MB. O servidor decodifica e normaliza o conteúdo em JPEG, remove EXIF/ICC e reduz para até 1.600 px no maior lado. GIF/SVG e conteúdo inválido são rejeitados. Não aceita URL externa ou nome de arquivo como caminho.

Respostas de ocorrência incluem `imageUrl` ou null. Essa rota aplica a permissão de visualização; uma imagem pendente não pode ser obtida por visitantes. Excluir a ocorrência remove o anexo do banco e do disco.

`PATCH /api/auth/profile` recebe `{name,email,currentPassword,newPassword}`. Nome/e-mail obrigatórios; newPassword vazio mantém a senha. Senha atual exigida para mudar e-mail ou senha; outras sessões são invalidadas. Identificação não aparece nas respostas públicas. Não há confirmação de e-mail por mensagem ou recuperação por e-mail nesta versão.
