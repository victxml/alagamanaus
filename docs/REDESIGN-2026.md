# Atualização visual — novembro de 2026

## Objetivo

Tornar a interface mais clara e consistente sem substituir os fluxos existentes nem alterar as regras de negócio.

## Alterações

- Nova camada de estilos compartilhados em `src/css/design-system.css`.
- Identidade azul profundo / azul-petróleo, fundo neutro e cartões brancos.
- Cabeçalho, navegação, formulários, botões, tabelas e painéis harmonizados.
- Página inicial redesenhada para combinar com o restante da aplicação.
- Filtros do mapa mais legíveis, mapa com maior protagonismo e ajustes em telas menores.
- Melhorias em foco visível, redução de movimento, alvos de toque e contraste de texto.
- README de arquitetura e roteiro de demonstração.

## O que não foi alterado

Endpoints, persistência, autenticação, pontuação de criticidade e lógica de moderação. Isso evita regressões de negócio por mudanças cosméticas.

## Pendências para validação final

- Rodar `npm ci` em Node 24+ e `npm test`.
- Abrir todas as rotas em desktop e celular, com e sem autenticação.
- Exercitar registro por CEP e GPS, foto opcional, moderação e publicação no mapa.
- Validar persistência em SQLite e, se usado, PostgreSQL.
- Fazer auditoria de contraste WCAG e testes manuais de teclado/leitor de tela.
