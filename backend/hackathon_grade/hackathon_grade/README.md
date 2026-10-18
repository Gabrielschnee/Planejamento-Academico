# Portal do Professor — planejamento docente

Aplicação React + Vite consumindo uma API Django REST Framework. O Django é a fonte única de dados do planejamento; a interface não grava no Supabase.

## Desenvolvimento local

Em `backend/hackathon_grade/hackathon_grade`:

```powershell
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Em `frontend`:

```powershell
npm install
npm run dev
```

Abra `http://localhost:5173`. O Vite encaminha `/api` para `http://127.0.0.1:8000`. Entre com a conta criada pelo Django. Cadastros básicos (professores, disciplinas, cursos, períodos e salas) exigem uma conta staff; coordenadores vinculados a usuários podem manter as ofertas do próprio curso. Associe usuários a professores e cursos pelo Django Admin quando necessário.

## Modelo central

- `Curso`, `Professor`, `Disciplina`, `PeriodoLetivo`, `Turma` e `Sala` são cadastros compartilhados, com identificadores e unicidade no banco. O período pode registrar datas inicial/final sem assumir um calendário institucional.
- `OfertaDisciplina` liga disciplina, turma, período e curso responsável. A mesma oferta pode participar em outros cursos via `ParticipacaoCurso`.
- `AlocacaoProfessor` registra a CH atribuída a cada docente. `HorarioAula` registra cada encontro, turma e sala relacionadas.
- `AuditLog` registra operações de criação, edição e exclusão feitas pela API.

A migração para `Turma` e `Sala` preserva os textos antigos e cria os relacionamentos correspondentes; não remove ofertas nem horários.

## Regras de carga

- **CH prevista**: soma da carga no catálogo de disciplinas por oferta.
- **CH planejada**: carga informada na oferta, contada uma vez, ainda que compartilhada entre cursos.
- **CH docente atribuída**: soma explícita das alocações. A soma entre docentes não pode ultrapassar a carga da oferta nem a carga máxima configurada para cada professor no período.
- **CH apropriada por curso**: valor administrativo explícito em `ParticipacaoCurso`; a soma não pode ultrapassar a carga da oferta.
- O painel mostra saldos não atribuídos e conflitos. Não converte duração semanal em carga semestral, nem horas-relógio em horas-aula: frequência de encontros, calendário letivo, conversão institucional e regras de contabilização precisam ser definidas pela instituição.

O limite existente de `400 h` por período para professor é um padrão de cadastro legado, não uma regra institucional confirmada. Configure o valor de cada professor; a instituição deve confirmar se esse padrão é adequado.

## Validações e concorrência

A API e os modelos validam intervalos sobrepostos (incluindo sobreposição parcial), mesmo professor entre cursos, mesma turma e mesma sala, CH atribuída/apropriada e unicidade dos cadastros. Aulas consecutivas são permitidas. Edições de ofertas e encontros também são revalidadas. As escritas da API são transacionais e tentam bloquear período e professor para serializar alterações concorrentes.

O banco local padrão é SQLite, útil para desenvolvimento individual. `select_for_update` não oferece bloqueios de linha no SQLite; para uso concorrente em produção, configure PostgreSQL por `DATABASE_URL` e aplique as migrações. Mantenha `DEBUG=0`, `SECRET_KEY` e `ALLOWED_HOSTS` configurados no ambiente de produção.

## Endpoints principais

`/api/cursos/`, `/api/professores/`, `/api/disciplinas/`, `/api/periodos/`, `/api/turmas/`, `/api/salas/`, `/api/ofertas/`, `/api/participacoes/`, `/api/alocacoes/`, `/api/horarios/`, `/api/painel/` e `/api/auditoria/`.

Obtenha token via `POST /api/auth/token/` com `username` e `password`; envie `Authorization: Token <token>`. O painel aceita filtros `periodo`, `curso`, `professor`, `disciplina` e `unidade`.

## Dados existentes e importação

Os registros existentes no Supabase permanecem intactos. Não existe planilha ou mapeamento de importação no repositório, e a estrutura antiga não contém período letivo, oferta compartilhada, CH por docente ou apropriação por curso em formato compatível. Por segurança, eles não são copiados automaticamente nem exibidos como se estivessem na base Django. Antes de migrá-los, confirme a origem oficial, os campos de período e as regras de CH; então faça uma importação com prévia, relatório de duplicidades/conflitos e confirmação explícita.

## Testes

```powershell
python manage.py test planejamento
npm run build
npm run lint
```
