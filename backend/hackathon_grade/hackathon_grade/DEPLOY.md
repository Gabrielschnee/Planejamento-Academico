# Publicação da API Django no Render

## Serviço Web

- Repositório: `Gabrielschnee/Planejamento-Academico`
- Diretório raiz: `backend/hackathon_grade/hackathon_grade`
- Build: `./build.sh`
- Start: `python manage.py migrate --noinput && python manage.py bootstrap_admin && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`

## Variáveis de ambiente

- `DEBUG=0`
- `SECRET_KEY`: gere um segredo forte e mantenha-o somente no painel do Render.
- `DATABASE_URL`: URL interna do PostgreSQL do Render.
- `CORS_ALLOWED_ORIGINS=https://planejamento-academico.pages.dev`
- `CSRF_TRUSTED_ORIGINS=https://planejamento-academico.pages.dev`
- `DJANGO_SUPERUSER_USERNAME=admin`
- `DJANGO_SUPERUSER_EMAIL=admin@planejamento-academico.invalid`
- `DJANGO_SUPERUSER_PASSWORD`: segredo gerado pelo Blueprint.

O Render fornece `RENDER_EXTERNAL_HOSTNAME`, que o Django adiciona à lista de hosts permitidos. Ao usar domínio próprio no frontend, inclua a origem em ambas as variáveis CORS/CSRF.

Depois que a API estiver no ar, configure `VITE_API_BASE=https://<servico>.onrender.com/api` no projeto Cloudflare Pages e faça um novo deploy do frontend.

O PostgreSQL gratuito do Render é temporário: expira após 30 dias e os dados podem ser apagados. Para manter os dados além desse período, será necessário migrar para um plano persistente antes da expiração.

O Blueprint cria automaticamente um superusuário `admin` com senha gerada pelo Render. A senha fica em `DJANGO_SUPERUSER_PASSWORD` na página **Environment** do serviço. O comando de inicialização cria o usuário somente se ele ainda não existir; ele não redefine a senha em reinicializações.
