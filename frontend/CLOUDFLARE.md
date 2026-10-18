# Publicação do frontend na Cloudflare Pages

## Configuração do projeto

- Projeto Cloudflare Pages: `careshield`
- URL publicada: `https://careshield-6l9.pages.dev`
- Diretório raiz do projeto: `frontend`
- Comando de build: `npm run build`
- Diretório de saída: `dist`
- Variável de ambiente de produção: `VITE_API_BASE=https://careshield-api.onrender.com/api`

O arquivo `public/_redirects` mantém o fallback da aplicação para rotas do frontend.
O frontend foi publicado diretamente com Wrangler; alterações locais futuras exigem um novo build e deploy (`npx wrangler pages deploy dist --project-name careshield --branch main`).

## Dependência da API

O frontend usa a API Django para autenticação e dados. O backend está configurado para produção com PostgreSQL, `DEBUG=0`, `SECRET_KEY` no ambiente e CORS para os domínios Pages antigo e atual.

O arquivo `.env.production` já define `VITE_API_BASE` para a API publicada no Render. O build local e os próximos deploys do Pages usarão esse endereço.
