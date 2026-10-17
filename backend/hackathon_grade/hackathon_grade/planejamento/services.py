"""Regras de negócio globais: visão única do professor entre todos os cursos."""
from django.db.models import Sum

from .models import AlocacaoProfessor, HorarioAula


def _sobrepostos(periodo_id, dia, ini, fim):
    return HorarioAula.objects.filter(
        oferta__periodo_id=periodo_id, dia_semana=dia,
        hora_inicio__lt=fim, hora_fim__gt=ini,
    ).select_related("oferta__disciplina")


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
        for o in base.filter(sala=h.sala).exclude(oferta=h.oferta):
            msgs.append(f"sala {h.sala} ocupada por {o.oferta}")
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
