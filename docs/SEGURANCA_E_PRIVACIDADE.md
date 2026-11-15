# Segurança e privacidade — AlagaManaus

## Controles implementados no código

- Senhas armazenadas como hashes `scrypt` com salt individual.
- Sessões com tokens aleatórios, hash no banco e cookies `HttpOnly` e `SameSite=Strict`.
- Cookies com atributo `Secure` automaticamente quando `PUBLIC_ORIGIN` usa HTTPS; também configurável por `COOKIE_SECURE=true`.
- Inicialização em `NODE_ENV=production` bloqueada sem `PUBLIC_ORIGIN=https://...`, com cookies inseguros ou com senha administrativa de exemplo.
- Verificação de `Origin` e rejeição de `Sec-Fetch-Site: cross-site` em operações de escrita.
- Cabeçalhos `X-Frame-Options`, `X-Content-Type-Options`, CSP, `Permissions-Policy` e HSTS para origem HTTPS.
- Permissões por perfil, moderação antes da publicação e limite básico de requisições em memória.

## Configuração recomendada de produção

```env
NODE_ENV=production
HOST=127.0.0.1
PUBLIC_ORIGIN=https://seu-dominio.example
COOKIE_SECURE=true
ADMIN_EMAIL=administrador@seu-dominio.example
ADMIN_PASSWORD=USE_UMA_SENHA_FORTE_E_UNICA
```

A publicação requer um proxy reverso ou plataforma que forneça TLS/HTTPS. Não inclua `.env`, banco de dados ou arquivos privados no repositório. Configure backup criptografado, monitoramento e atualização das dependências na hospedagem.

## Pendências para disponibilização pública

1. Realizar testes completos do back-end com Node.js 24+ e dependências instaladas; testes estáticos não substituem testes de integração.
2. Implementar e validar processo de solicitação de acesso, correção e exclusão de dados pessoais, com regras de retenção.
3. Publicar política de privacidade que informe finalidade, base legal, dados coletados, compartilhamento, prazo de retenção e contato responsável.
4. Avaliar o risco de identificação de pessoas por coordenadas e fotos; revisar metadados, rostos, placas e informações de contato.
5. Migrar limitação de requisições para armazenamento compartilhado se usar múltiplas instâncias; revisar proteção contra abuso e realizar avaliação de vulnerabilidades.
6. Testar restauração de backups e definir processo de resposta a incidentes.

**Atenção:** essas medidas reforçam o projeto, mas não constituem certificação de segurança nem garantem conformidade integral com a LGPD.
