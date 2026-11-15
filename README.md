# AlagaManaus

Sistema acadêmico georreferenciado para registrar e analisar ocorrências de alagamento e descarte irregular de resíduos em Manaus.

## Como executar

1. Instale o **Node.js 24 ou superior**.
2. Abra um terminal nesta pasta e execute `npm ci`.
3. Copie `.env.example` para `.env` e configure as variáveis necessárias **sem publicar credenciais**.
4. Execute `npm start` e abra `http://127.0.0.1:3000`.
5. Para executar os testes automatizados, use `npm test`.

> Não publique `.env`, `node_modules` nem arquivos locais do banco..

## Estrutura do código

| Local | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura semântica de todas as telas e navegação por rotas hash |
| `src/css/base.css` | Estilos de base e componentes legados |
| `src/css/main.css` | Composição dos estilos-base |
| `src/css/home.css` | Página inicial |
| `src/css/account.css` | Login, cadastro e perfil |
| `src/css/operations.css` | Painel operacional |
| `src/css/design-system.css` | **Camada final de tokens, consistência, responsividade e acessibilidade** |
| `src/js/app.js` | Estado da interface, rotas e interações com API |
| `src/js/account-ui.js` | Interações de autenticação e cadastro |
| `backend/server.js` | Servidor HTTP e endpoints |
| `backend/db.js` | Persistência de dados |
| `backend/domain.js` | Regras de negócio e criticidade |
| `backend/images.js` | Processamento de imagens |
| `tests/` | Testes automatizados |
| `docs/` | API, requisitos, UX e verificação |

## Percurso para demonstração

1. **Início** — apresentar a finalidade do projeto e os indicadores.
2. **Mapa** — consultar registros aprovados e aplicar filtros.
3. **Registrar ocorrência** — informar localização, descrição e foto opcional.
4. **Gestão** — analisar relatos pendentes e aprovar/rejeitar.
5. **Criticidade** — explicar os índices e as prioridades calculadas.
6. **Perfil** — acompanhar relatos e dados da conta.

## Sobre a reformulação visual

O redesign adota azul profundo e azul-petróleo como identidade institucional, reservando cores quentes e verdes semânticos para os níveis de criticidade. A camada `design-system.css` foi aplicada globalmente e contempla as rotas de início, mapa, registro, criticidade, gestão, perfil, login, cadastro, detalhes e ajuda. A implementação original da API e as regras de criticidade foram preservadas.

## Segurança e validação

- O envio de registros continua sujeito à moderação.
- Não considere o protótipo uma plataforma oficial de emergência.
- Consulte `docs/VERIFICACAO.md` para as verificações existentes.
- Execute os testes em um ambiente com as dependências instaladas. A revisão de CSS **não equivale** à validação integral da API ou à homologação em navegador.

## Segurança e privacidade

Consulte [`docs/SEGURANCA_E_PRIVACIDADE.md`](docs/SEGURANCA_E_PRIVACIDADE.md) para controles implementados, configuração de produção e pendências antes de disponibilizar o sistema publicamente.
