# Publicação do frontend na Cloudflare Pages

## Configuração do projeto

- Conecte o repositório `Gabrielschnee/Planejamento-Academico` à Cloudflare Pages.
- Diretório raiz do projeto: `frontend`
- Comando de build: `npm run build`
- Diretório de saída: `dist`
- Variável de ambiente de produção: `VITE_API_BASE=https://<dominio-da-api>/api`

O arquivo `public/_redirects` mantém o fallback da aplicação para rotas do frontend.

## Dependência da API

O frontend precisa da API Django para autenticação e dados. A API deve estar publicada com PostgreSQL, `DEBUG=0`, `SECRET_KEY` seguro e `ALLOWED_HOSTS` restrito ao domínio da API. Como a API será chamada de outro domínio, o Django também precisa permitir o domínio `*.pages.dev` (e o domínio personalizado, se houver) via CORS. A configuração atual do backend ainda não implementa CORS.

Depois de criar o projeto Pages, configure `VITE_API_BASE` com a URL pública real da API e faça um novo deploy para compilar o endereço no frontend.
