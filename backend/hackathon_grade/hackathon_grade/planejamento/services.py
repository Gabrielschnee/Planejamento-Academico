"""Regras de negócio globais: visão única do professor entre todos os cursos."""
from django.core.exceptions import ValidationError
from django.db.models import Q, Sum

from .models import AlocacaoProfessor, HorarioAula


def _sobrepostos(periodo_id, dia, ini, fim):
    return HorarioAula.objects.filter(
        oferta__periodo_id=periodo_id, dia_semana=dia,
        hora_inicio__lt=fim, hora_fim__gt=ini,
    ).select_related("oferta__disciplina")


def _conflitos_de_turma(h, base):
    turma = h.turma or h.oferta.turma
    candidatos = base.exclude(oferta=h.oferta).select_related("oferta__curso_responsavel").prefetch_related(
        "oferta__cursos")
    mensagens = []
    for outro in candidatos:
        if h.turma_ref_id and outro.turma_ref_id:
            mesma_turma = h.turma_ref_id == outro.turma_ref_id
        else:
            cursos_h = {h.oferta.curso_responsavel_id, *h.oferta.cursos.values_list("id", flat=True)}
            cursos_outro = {outro.oferta.curso_responsavel_id,
                            *outro.oferta.cursos.values_list("id", flat=True)}
            turma_outro = outro.turma or outro.oferta.turma
            mesma_turma = turma == turma_outro and bool(cursos_h & cursos_outro)
        if mesma_turma:
            mensagens.append(f"Turma {turma} em conflito com {outro.oferta}: "
                             f"{outro.get_dia_semana_display()} "
                             f"{outro.hora_inicio:%H:%M}-{outro.hora_fim:%H:%M}")
    return mensagens


def conflitos_horario(h):
    """Conflitos de um horário: mesmo professor (em qualquer curso), mesma sala, ou da própria oferta."""
    msgs = []
    base = _sobrepostos(h.oferta.periodo_id, h.dia_semana, h.hora_inicio, h.hora_fim).exclude(pk=h.pk)
    for o in base.filter(oferta=h.oferta):
        msgs.append(f"horário já existente na própria oferta ({o.hora_inicio:%H:%M}-{o.hora_fim:%H:%M})")
    for aloc in h.oferta.alocacoes.select_related("professor"):
        for o in base.filter(oferta__alocacoes__professor=aloc.professor).exclude(oferta=h.oferta):
            msgs.append(f"{aloc.professor} já leciona {o.oferta} nesse horário")
    if h.sala:
        for o in base.filter(sala__iexact=h.sala.strip()).exclude(oferta=h.oferta):
            msgs.append(f"Sala {h.sala} ocupada por {o.oferta} {o.get_dia_semana_display()} "
                        f"{o.hora_inicio:%H:%M}-{o.hora_fim:%H:%M}")
    msgs.extend(_conflitos_de_turma(h, base))
    return msgs


def conflitos_horarios_alocacao(aloc):
    """Ao alocar um professor, verifica os horários da oferta contra suas outras ofertas."""
    msgs = []
    for h in aloc.oferta.horarios.all():
        outros = _sobrepostos(aloc.oferta.periodo_id, h.dia_semana, h.hora_inicio, h.hora_fim) \
            .filter(oferta__alocacoes__professor=aloc.professor).exclude(oferta=aloc.oferta)
        for o in outros:
            msgs.append(f"{aloc.professor} já leciona {o.oferta} em {h.get_dia_semana_display()} "
                        f"{h.hora_inicio:%H:%M}-{h.hora_fim:%H:%M}")
    return msgs


def carga_global_professor(professor, periodo, excluir_alocacao=None):
    """CH total do professor no período, somando todas as ofertas (cada oferta contada uma vez)."""
    qs = AlocacaoProfessor.objects.filter(professor=professor, oferta__periodo=periodo)
    if excluir_alocacao:
        qs = qs.exclude(pk=excluir_alocacao)
    return qs.aggregate(t=Sum("ch_alocada"))["t"] or 0


def resumo_carga(professor, periodo):
    alocs = list(AlocacaoProfessor.objects.filter(professor=professor, oferta__periodo=periodo)
                 .select_related("oferta__disciplina", "oferta__curso_responsavel")
                 .prefetch_related("oferta__participacoes__curso"))
    apropriacao = {}
    ofertas = []
    for a in alocs:
        parts = [{"curso": p.curso.codigo, "ch_apropriada": p.ch_apropriada} for p in a.oferta.participacoes.all()]
        for p in parts:
            apropriacao[p["curso"]] = apropriacao.get(p["curso"], 0) + p["ch_apropriada"]
        ofertas.append({"oferta_id": a.oferta_id, "oferta": str(a.oferta), "ch_alocada": a.ch_alocada,
                        "curso_responsavel": a.oferta.curso_responsavel.codigo, "participacoes": parts})
    total = sum(a.ch_alocada for a in alocs)
    return {"professor": professor.nome, "periodo": str(periodo), "ch_total_alocada": total,
            "ch_maxima": professor.ch_maxima_periodo, "saldo": professor.ch_maxima_periodo - total,
            "apropriacao_por_curso": apropriacao, "ofertas": ofertas}


def validar_alteracao_horario(h):
    """Impede editar uma ocorrencia e deixar professor ou turma em conflito."""
    msgs = []
    for aloc in h.oferta.alocacoes.select_related("professor"):
        qs = _sobrepostos(h.oferta.periodo_id, h.dia_semana, h.hora_inicio, h.hora_fim) \
            .filter(oferta__alocacoes__professor=aloc.professor).exclude(pk=h.pk)
        for outro in qs:
            msgs.append(f"Professor {aloc.professor}: {outro.oferta}, {outro.get_dia_semana_display()} "
                        f"{outro.hora_inicio:%H:%M}-{outro.hora_fim:%H:%M}")
    qs_turma = _sobrepostos(h.oferta.periodo_id, h.dia_semana, h.hora_inicio, h.hora_fim).exclude(pk=h.pk)
    msgs.extend(_conflitos_de_turma(h, qs_turma))
    sala = h.sala.strip().casefold()
    if sala:
        for outro in _sobrepostos(h.oferta.periodo_id, h.dia_semana, h.hora_inicio, h.hora_fim).filter(
                sala__iexact=h.sala.strip()).exclude(pk=h.pk):
            msgs.append(f"Sala {h.sala}: {outro.oferta}, {outro.get_dia_semana_display()} "
                        f"{outro.hora_inicio:%H:%M}-{outro.hora_fim:%H:%M}")
    if msgs:
        raise ValidationError("Conflitos ao alterar horario: " + "; ".join(msgs))


def validar_alteracao_alocacao(aloc):
    """Valida a reatribuicao de docente nos encontros atuais da oferta."""
    msgs = conflitos_horarios_alocacao(aloc)
    if msgs:
        raise ValidationError("Conflitos ao alterar alocacao: " + "; ".join(msgs))


def resumo_planejamento(periodo_id=None, curso_id=None, professor_id=None, disciplina_id=None, unidade=None):
    """Indicadores e visoes filtraveis derivados exclusivamente das entidades centrais."""
    from .models import Curso, Disciplina, HorarioAula, OfertaDisciplina, ParticipacaoCurso, Professor, PeriodoLetivo

    ofertas = OfertaDisciplina.objects.select_related("disciplina", "periodo", "curso_responsavel")
    if periodo_id:
        ofertas = ofertas.filter(periodo_id=periodo_id)
    if curso_id:
        ofertas = ofertas.filter(Q(cursos__id=curso_id) | Q(curso_responsavel_id=curso_id)).distinct()
    if unidade:
        ofertas = ofertas.filter(Q(cursos__unidade=unidade) | Q(curso_responsavel__unidade=unidade)).distinct()
    if professor_id:
        ofertas = ofertas.filter(alocacoes__professor_id=professor_id).distinct()
    if disciplina_id:
        ofertas = ofertas.filter(disciplina_id=disciplina_id)
    oferta_rows = list(ofertas)
    oferta_ids = [o.id for o in oferta_rows]
    horarios_qs = HorarioAula.objects.filter(oferta_id__in=oferta_ids).select_related(
        "oferta__disciplina", "oferta__periodo", "oferta__curso_responsavel").prefetch_related(
        "oferta__alocacoes__professor", "oferta__cursos")
    horario_rows = list(horarios_qs)
    ch_atribuida_qs = AlocacaoProfessor.objects.filter(oferta_id__in=oferta_ids)
    if professor_id:
        ch_atribuida_qs = ch_atribuida_qs.filter(professor_id=professor_id)
    ch_atribuida = ch_atribuida_qs.aggregate(total=Sum("ch_alocada"))["total"] or 0
    apropriacoes = ParticipacaoCurso.objects.filter(oferta_id__in=oferta_ids)
    if curso_id:
        apropriacoes = apropriacoes.filter(curso_id=curso_id)
    ch_apropriada = apropriacoes.aggregate(total=Sum("ch_apropriada"))["total"] or 0

    conflitos = []
    membros_curso = {}
    for oferta in oferta_rows:
        membros_curso[oferta.id] = {oferta.curso_responsavel_id, *oferta.cursos.values_list("id", flat=True)}
    for i, a in enumerate(horario_rows):
        docentes_a = {al.professor_id for al in a.oferta.alocacoes.all()}
        for b in horario_rows[i + 1:]:
            if a.oferta.periodo_id != b.oferta.periodo_id or a.dia_semana != b.dia_semana:
                continue
            if a.hora_inicio >= b.hora_fim or b.hora_inicio >= a.hora_fim:
                continue
            docentes_b = {al.professor_id for al in b.oferta.alocacoes.all()}
            same_room = bool(a.sala and b.sala and a.sala.casefold() == b.sala.casefold())
            if a.turma_ref_id and b.turma_ref_id:
                same_class = a.turma_ref_id == b.turma_ref_id
            else:
                same_class = (bool(membros_curso[a.oferta_id] & membros_curso[b.oferta_id]) and
                              (a.turma or a.oferta.turma) == (b.turma or b.oferta.turma))
            motivos = []
            if docentes_a & docentes_b:
                motivos.append("docente")
            if same_class:
                motivos.append("turma")
            if same_room:
                motivos.append("sala")
            if motivos:
                conflitos.append({"registros": [a.pk, b.pk], "motivos": motivos,
                    "dia": a.get_dia_semana_display(),
                    "horario_a": f"{a.hora_inicio:%H:%M}-{a.hora_fim:%H:%M}",
                    "horario_b": f"{b.hora_inicio:%H:%M}-{b.hora_fim:%H:%M}",
                    "oferta_a": str(a.oferta), "oferta_b": str(b.oferta)})
    professores = Professor.objects.filter(alocacoes__oferta_id__in=oferta_ids).distinct()
    ch_docente_pendente = 0
    ch_curso_pendente = 0
    inconsistencias_carga = 0
    for oferta in oferta_rows:
        atribuida = oferta.alocacoes.aggregate(total=Sum("ch_alocada"))["total"] or 0
        apropriada = oferta.participacoes.aggregate(total=Sum("ch_apropriada"))["total"] or 0
        ch_docente_pendente += max(oferta.carga_horaria - atribuida, 0)
        ch_curso_pendente += max(oferta.carga_horaria - apropriada, 0)
        inconsistencias_carga += int(atribuida > oferta.carga_horaria or apropriada > oferta.carga_horaria)
    cursos = Curso.objects.filter(Q(ofertas__in=oferta_rows) | Q(ofertas_responsavel__in=oferta_rows)).distinct()
    return {
        "filtros": {"periodo": periodo_id, "curso": curso_id, "professor": professor_id,
                    "disciplina": disciplina_id, "unidade": unidade},
        "definicoes_carga": {"prevista": "Soma da CH prevista no catalogo por oferta, cada oferta uma vez.",
            "planejada": "CH informada na oferta, cada oferta uma vez.",
            "atribuida": "Soma da CH explicitamente atribuida aos docentes.",
            "apropriada": "Soma da apropriacao cadastrada por curso; nao repete CH da oferta."},
        "indicadores": {
            "professores_alocados": professores.count(), "cursos_planejados": cursos.count(),
            "ofertas_planejadas": len(oferta_rows),
            "carga_prevista_disciplinas_h": sum(o.disciplina.carga_horaria for o in oferta_rows),
            "carga_planejada_ofertas_h": sum(o.carga_horaria for o in oferta_rows),
            "carga_docente_atribuida_h": ch_atribuida, "carga_apropriada_cursos_h": ch_apropriada,
            "carga_docente_pendente_h": ch_docente_pendente, "carga_cursos_pendente_h": ch_curso_pendente,
            "inconsistencias_carga": inconsistencias_carga, "conflitos": len(conflitos),
            "ofertas_sem_docente": sum(not o.alocacoes.exists() for o in oferta_rows),
            "ofertas_sem_horario": sum(not o.horarios.exists() for o in oferta_rows),
        },
        "periodos": list(PeriodoLetivo.objects.values("id", "ano", "semestre", "data_inicio", "data_fim", "ativo")),
        "cursos": list(Curso.objects.values("id", "codigo", "nome", "unidade", "modalidade",
                                               "coordenador_id", "coordenador__username")),
        "professores": list(Professor.objects.values("id", "nome", "email", "identificacao", "vinculo", "ch_maxima_periodo")),
        "disciplinas": list(Disciplina.objects.values("id", "codigo", "nome", "carga_horaria")),
        "ofertas": [{
            "id": o.id, "disciplina_id": o.disciplina_id, "disciplina": o.disciplina.nome,
            "codigo_disciplina": o.disciplina.codigo, "carga_prevista": o.disciplina.carga_horaria,
            "carga_oferta": o.carga_horaria, "turma": o.turma, "turma_id": o.turma_ref_id, "periodo_turma": o.periodo_turma,
            "periodo_id": o.periodo_id, "periodo": str(o.periodo), "curso_id": o.curso_responsavel_id,
            "curso": o.curso_responsavel.nome, "cursos": list(o.cursos.values("id", "codigo", "nome")),
            "participacoes": list(o.participacoes.values("curso_id", "curso__codigo", "ch_apropriada")),
            "alocacoes": list(o.alocacoes.values("id", "professor_id", "professor__nome", "ch_alocada")),
            "horarios": [{"id": h.id, "dia": h.get_dia_semana_display(), "dia_semana": h.dia_semana,
                "inicio": h.hora_inicio.strftime("%H:%M"), "fim": h.hora_fim.strftime("%H:%M"),
                "sala": h.sala, "sala_registro_id": h.sala_registro_id, "turma": h.turma or o.turma,
                "turma_id": h.turma_ref_id or o.turma_ref_id} for h in o.horarios.all()]
        } for o in oferta_rows],
        "conflitos_detectados": conflitos,
    }
