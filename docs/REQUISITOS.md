# Rastreabilidade — artigo recebido em 11/10/2026

| Requisito | Implementação | Evidência / limite |
|---|---|---|
| RF01 mapa | Leaflet, pontos aprovados e grade colorida | Fluxo de navegador automatizado |
| RF02 filtros | API por bairro, período, tipo e classe | Testes de integração |
| RF03 detalhes | Tela por id, tipo, data, descrição, posição e classe da célula | Fluxo de navegador |
| RF04 registro | Formulário, seleção no mapa, coordenadas e validação territorial | API e navegador |
| RF05 moderação | Pendente → aprovação/rejeição com justificativa e auditoria | Testes: pendentes não publicados |
| RF06 criticidade | Grade UTM 250 m, janela 90 dias, fórmula AM-1.0, recorrência por datas | Base controlada: índice 34, classe moderada |
| RF07 relatórios | CSV/JSON/GeoJSON, filtros, geração, versão, sem contatos | Integração e coordenadas GeoJSON |
| RF08 gerenciamento | Criar usuários, definir perfil, desativar; editar/excluir ocorrências | Testes de autorização e telas |
| RNF01 desempenho | Índice SQL, teste com 1.000 registros e 30 consultas | p95 local 63,6 ms na verificação final; mapa externo ≤5 s ainda não comprovado |
| RNF02 segurança | scrypt, cookies, autorização, validação, SQL parametrizado, CSP, limites | Testes de perfis/origem; HTTPS precisa ser configurado na hospedagem |
| RNF03 usabilidade | Layout adaptativo, rótulos, mensagens, coordenadas sem mouse e foco | 360/768/1920 px sem overflow global; avaliação com usuários pendente |
| RNF04 compatibilidade | APIs web e Leaflet local | Chromium 134 automatizado; Chrome/Edge/Firefox/Android reais ainda devem ser conferidos |
| RNF05 integração | WGS 84, JSON, GeoJSON; geometria PostGIS no adaptador PostgreSQL | Exportação preserva [longitude, latitude] |
| RNF06 privacidade | Contato opcional; autor/contato excluídos da saída pública | Testes verificam ausência de contato nos relatórios |
| RNF07 manutenção | Camadas separadas, lockfile, configuração, documentação e testes | Reproduzível com npm ci; versionamento Git a cargo da equipe |

| Regra | Aplicação |
|---|---|
| RN01 | Teste do ponto contra o polígono IBGE, não apenas retângulo |
| RN02 | Apenas alagamento/residuo, validação e constraint no banco |
| RN03 | Somente moderation=approved alimenta o cálculo e o mapa |
| RN04 | Dois eventos de alagamento em datas distintas por célula/janela |
| RN05 | Fórmula e parâmetros publicados; sem dados separado das classes |
| RN06 | Moderação/edição/exclusão/usuários apenas administrador; gestor consulta/exporta |
| RN07 | Registro anônimo permitido; contato opcional e privado |

A implementação funcional não comprova automaticamente todos os RNF. A pesquisa com usuários, validação territorial do índice, ambientes de navegador reais e implantação HTTPS permanecem atividades de avaliação previstas no artigo.

Revisão 1.1: RF04 ampliado com foto opcional; RF03 mostra o anexo nos detalhes. RNF06 inclui remoção de metadados e restrição de acesso enquanto pendente. Usabilidade revista com cadastro/login separados, histórico real, edição de conta, remoção das etapas decorativas e explicação didática da criticidade. O modelo AM-1.0 não foi alterado.
