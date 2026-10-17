# Hackathon 2026 – Desafio 08: Grade Horária e Planejamento Docente (backend)

Django + DRF. Base única, auditável e multiusuário.

## Rodar
    pip install -r requirements.txt
    python manage.py migrate
    python manage.py createsuperuser
    python manage.py runserver
    python manage.py test

Token: `POST /api/auth/token/` {username, password} → header `Authorization: Token <token>`.

## Modelo
- **OfertaDisciplina**: unidade central (curso responsável + vários cursos participantes).
- **AlocacaoProfessor**: professor alocado à oferta *uma única vez* (CH contada uma vez).
- **ParticipacaoCurso**: participação/apropriação administrativa da CH por curso (separada da alocação).
- **HorarioAula**: horários da oferta. **AuditLog**: trilha de todas as escritas.

## Regras
- Conflito de horário do professor é checado globalmente (todos os cursos).
- Conflito de sala e sobreposição dentro da mesma oferta.
- CH global do professor ≤ `ch_maxima_periodo`; CH apropriada ≤ CH da oferta.
- Só o coordenador do curso responsável (ou staff) altera a oferta e seus filhos; todos autenticados leem.

## Endpoints (/api/)
cursos, professores, disciplinas, periodos, ofertas, participacoes, alocacoes, horarios, auditoria (admin)
- `GET /professores/{id}/carga/?periodo=` – CH global + apropriação por curso
- `GET /professores/{id}/grade/?periodo=` – grade consolidada
