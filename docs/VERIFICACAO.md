# Verificação executada — 11/10/2026

Ambiente: Linux x86_64, Node.js 24.19.0, npm 11.9.0, SQLite embarcado no Node. O sistema usa pg, proj4 e Leaflet; versões exatas em package-lock.json.

## Automação da API

`npm test`: três grupos de teste passaram, com múltiplas asserções para:

- território Manaus/São Paulo, campos obrigatórios, tipo e calendário;
- fórmula controlada, recorrência, janela antiga e células sem dados;
- envio autenticado e anônimo, ocultação antes da aprovação;
- proibição de moderação/edição/exclusão para cidadão ou gestor;
- aprovação, rejeição de duplicidade, nova moderação após edição;
- filtros por bairro, tipo e datas;
- relatórios JSON, CSV e GeoJSON e proteção de contatos;
- origem de escrita, logout e auditoria;
- 1.000 registros, 30 execuções de filtro, p95 de 63,6 ms na verificação final; repetições anteriores variaram de 66,4 a 129,5 ms.

O ensaio mediu API e transferência em loopback, sem latência de internet e sem servidor cartográfico. Não generalizar esse tempo para a hospedagem.

## Integração no navegador

Playwright 1.51.1 com Chromium Headless 134.0.6998.35 no Linux:

- Início, Registro, Criticidade, Gestão, Perfil e Login em 360, 768 e 1.920 px;
- sem rolagem horizontal do documento nessas páginas;
- login administrativo → envio → aprovação → mapa → detalhes;
- zero erros de JavaScript no fluxo;
- inspeção visual do login em 360 px e dos detalhes em 1.920 px; ajuste dos botões móveis após a primeira inspeção.

## Verificações antes da entrega acadêmica / implantação

1. Rodar no computador da equipe e verificar persistência após reiniciar.
2. Testar PostgreSQL/PostGIS com uma base descartável; esse adaptador não foi validado ponta a ponta neste ambiente.
3. Conferir Chrome, Edge, Firefox e Chrome Android reais; anotar versões e dispositivo.
4. Medir carregamento de mapas em conexão real e confirmar atribuição/políticas do provedor.
5. Executar navegação por teclado e avaliação de usuários prevista no artigo.
6. Configurar HTTPS, origem pública, cookie Secure, backup e restauração quando houver hospedagem.
7. Validar os parâmetros provisórios com dados históricos independentes. Não apresentar dados sintéticos como ocorrências reais.

Base entregue sem ocorrências fictícias, senhas, cookies ou registros dos ensaios. A versão 1.1 adiciona foto opcional por solicitação do usuário.

## Revisão 1.1 — 11/10/2026, horário de Manaus

- Quatro grupos de testes da API passaram, incluindo imagem real, formatos inválidos, acesso privado antes da aprovação, publicação, exclusão do arquivo, remoção de EXIF/ICC e alteração de nome/e-mail/senha com verificação da senha atual.
- Inicialização idempotente da nova tabela de anexos verificada sem apagar usuários ou ocorrências.
- Layouts de registro, criticidade, perfil, login e cadastro em 360, 768, 1.440 e 1.920 px sem overflow horizontal do documento.
- Fluxo Chromium 134: cadastro com confirmação inválida/válida, login automático, edição do nome, prévia/remoção/reanexo de foto, envio, histórico, aprovação administrativa, detalhes com imagem e acesso público após aprovação. Zero erros de JavaScript.
- No ensaio de layout do navegador, imagens de fundo do mapa foram substituídas por um fixture local para respeitar as restrições do provedor sobre testes headless. A política de referência e o hostname canônico do OpenStreetMap foram corrigidos; a disponibilidade real do serviço no navegador do usuário depende da rede/provedor.
- Limitações anteriores de PostgreSQL/PostGIS e compatibilidade em dispositivos reais continuam aplicáveis.
