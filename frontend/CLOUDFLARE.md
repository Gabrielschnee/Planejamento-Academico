# Publicação do frontend na Cloudflare Pages

## Configuração do projeto

- Conecte o repositório `Gabrielschnee/Planejamento-Academico` à Cloudflare Pages.
- Diretório raiz do projeto: `frontend`
- Comando de build: `npm run build`
- Diretório de saída: `dist`
- Variável de ambiente de produção: `VITE_API_BASE=https://planejamento-academico-api.onrender.com/api`

O arquivo `public/_redirects` mantém o fallback da aplicação para rotas do frontend.

## Dependência da API

O frontend usa a API Django para autenticação e dados. O backend está configurado para produção com PostgreSQL, `DEBUG=0`, `SECRET_KEY` no ambiente e CORS para o domínio deste Pages.

O arquivo `.env.production` já define `VITE_API_BASE` para a API publicada no Render. O build local e os próximos deploys do Pages usarão esse endereço.
