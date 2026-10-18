import json
import unicodedata

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action, api_view, throttle_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from . import serializers as s
from .models import (AlocacaoProfessor, AuditLog, Curso, Disciplina, HorarioAula, OfertaDisciplina,
                     ParticipacaoCurso, PeriodoLetivo, Professor, Sala, Turma)
from .services import resumo_carga, resumo_planejamento

class ScheduleAssistantThrottle(AnonRateThrottle):
    scope = "schedule_assistant"


def _local_schedule_suggestion(message):
    normalized = "".join(
        char for char in unicodedata.normalize("NFD", message.casefold())
        if unicodedata.category(char) != "Mn"
    )
    normalized = " ".join(normalized.split()).strip(" .,!?;:")
    words = set(normalized.split())
    if words & {"oi", "ola", "opa", "eai", "hey", "hello"} or normalized.startswith(
        ("bom dia", "boa tarde", "boa noite")
    ):
        return (
            "Olá! Posso ajudar a consultar a grade, identificar conflitos e avaliar a "
            "distribuição dos horários. O que você quer verificar?"
        )
    if any(term in normalized for term in ("obrigad", "valeu", "agradeco")):
        return "Por nada! Se quiser, posso conferir conflitos, dias sem encontros ou a distribuição da grade."
    if any(term in normalized for term in (
        "criar oferta", "crie oferta", "fazer oferta", "faca oferta",
        "faz uma oferta", "faca uma oferta", "cria uma oferta",
        "adicionar oferta", "montar oferta",
    )):
        return (
            "Não consigo criar ou salvar ofertas pelo chat. Para cadastrar uma, abra "
            "Disciplinas → Criar oferta e informe disciplina, período, curso responsável, "
            "turma e carga horária. Depois, você pode voltar aqui para consultar a grade."
        )

    asks_about_schedule = any(term in normalized for term in (
        "grade", "horario", "horarios", "aula", "aulas", "oferta", "ofertas",
        "conflito", "choque", "sobrepos", "colis", "livre", "vazio",
        "sem aula", "disponivel", "distribu", "equilibr", "organiza",
        "sobrecarg", "resumo",
    ))
    if not asks_about_schedule:
        return (
            "Posso ajudar com o planejamento de horários, mas não entendi essa pergunta. "
            "Tente perguntar, por exemplo, “há conflitos na grade?”, “quais dias não têm "
            "aulas?” ou “como estão distribuídos os encontros?”"
        )

    summary = resumo_planejamento()
    offers = summary["ofertas"]
    conflicts = summary["conflitos_detectados"]
    weekdays = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    day_counts = {day: 0 for day in weekdays}
    for offer in offers:
        for meeting in offer["horarios"]:
            if meeting["dia"] in day_counts:
                day_counts[meeting["dia"]] += 1

    if not offers:
        if any(word in normalized for word in ("conflito", "choque", "sobrepos", "colis")):
            return "Ainda não há ofertas cadastradas, então não existem horários para verificar conflitos."
        if any(word in normalized for word in ("livre", "vazio", "sem aula", "disponivel")):
            return "Ainda não há ofertas ou encontros cadastrados; por isso, não dá para identificar dias livres."
        return "Ainda não há ofertas cadastradas para analisar. Cadastre uma oferta e seus horários primeiro."

    if any(word in normalized for word in ("conflito", "choque", "sobrepos", "colis")):
        if not conflicts:
            return "Não encontrei sobreposições de docente, turma ou sala nos horários cadastrados."
        details = [
            f"{conflict['dia']}, {conflict['horario_a']} e {conflict['horario_b']} "
            f"({', '.join(conflict['motivos'])})"
            for conflict in conflicts[:5]
        ]
        remainder = len(conflicts) - len(details)
        suffix = f" Há mais {remainder} conflito(s) não listado(s)." if remainder else ""
        return f"Encontrei {len(conflicts)} conflito(s): {'; '.join(details)}.{suffix}"

    scheduled_days = [(day, count) for day, count in day_counts.items() if count]
    empty_days = [day for day, count in day_counts.items() if not count]
    if any(word in normalized for word in ("livre", "vazio", "sem aula", "disponivel")):
        if empty_days:
            return (
                f"Não há encontros cadastrados em {', '.join(empty_days)}. "
                "Isso indica apenas ausência de horários na base, não confirma disponibilidade institucional."
            )
        return (
            "Há encontros cadastrados em todos os dias da semana. Consulte a grade horária "
            "para identificar intervalos; a base não informa disponibilidade institucional."
        )

    if any(word in normalized for word in ("distribu", "equilibr", "organiza", "sobrecarg")):
        if not scheduled_days:
            return (
                "Há ofertas cadastradas, mas nenhuma tem encontro semanal registrado. "
                "Cadastre os horários para eu avaliar a distribuição."
            )
        busiest_day, busiest_count = max(scheduled_days, key=lambda entry: entry[1])
        lightest_day, lightest_count = min(scheduled_days, key=lambda entry: entry[1])
        if busiest_count - lightest_count <= 1:
            return (
                f"A distribuição parece equilibrada pelo número de encontros: "
                f"{busiest_day} tem {busiest_count} e {lightest_day} tem {lightest_count}. "
                "Confirme também a duração e as preferências antes de alterar horários."
            )
        return (
            f"{busiest_day} concentra mais encontros ({busiest_count}) e {lightest_day} "
            f"tem menos ({lightest_count}). Considere avaliar uma redistribuição para "
            f"{lightest_day}, verificando disponibilidade e conflitos antes de qualquer mudança."
        )

    count = sum(day_counts.values())
    overview = ", ".join(
        f"{day}: {amount}" for day, amount in scheduled_days
    ) or "nenhum encontro semanal"
    return (
        f"A grade tem {count} encontro(s) cadastrado(s) em {len(scheduled_days)} dia(s): "
        f"{overview}. Detectei {len(conflicts)} conflito(s). Você pode perguntar sobre "
        "conflitos, dias sem aula ou distribuição dos encontros."
    )


@api_view(["POST"])
@throttle_classes([ScheduleAssistantThrottle])
def assistente_grade(request):
    message = request.data.get("message")
    history = request.data.get("history", [])
    if not isinstance(message, str) or not message.strip() or len(message) > 1000:
        return Response({"detail": "A mensagem deve conter de 1 a 1000 caracteres."}, status=400)
    if not isinstance(history, list) or len(history) > 8:
        return Response({"detail": "O histórico deve conter no máximo 8 mensagens."}, status=400)
    for item in history:
        if (
            not isinstance(item, dict)
            or item.get("role") not in ("user", "assistant")
            or not isinstance(item.get("content"), str)
            or not item["content"].strip()
            or len(item["content"]) > 1000
        ):
            return Response({"detail": "O histórico da conversa é inválido."}, status=400)

    return Response({"reply": _local_schedule_suggestion(message.strip())})


class AuditedViewSet(viewsets.ModelViewSet):
    """Escritas públicas são auditadas (antes/depois) e transacionais."""

    def _snap(self, inst):
        return json.loads(json.dumps(self.get_serializer(inst).data, default=str))

    def _log(self, acao, inst, dados):
        user = self.request.user
        AuditLog.objects.create(usuario=user if user.is_authenticated else None, acao=acao, modelo=inst._meta.label,
                                objeto_id=str(inst.pk), objeto_repr=str(inst)[:200], dados=dados)

    def _bloquear_regras(self, obj):
        """Serializa escritas do mesmo período/docente em bancos com suporte a row locks."""
        from .models import PeriodoLetivo

        if isinstance(obj, dict):
            oferta = obj.get("oferta")
            periodo = obj.get("periodo") or (oferta.periodo if oferta else None)
            professor = obj.get("professor")
        else:
            oferta = getattr(obj, "oferta", None)
            periodo = getattr(obj, "periodo", None) or (oferta.periodo if oferta else None)
            professor = getattr(obj, "professor", None)
        if periodo:
            PeriodoLetivo.objects.select_for_update().get(pk=periodo.pk)
        if professor:
            Professor.objects.select_for_update().get(pk=professor.pk)

    @transaction.atomic
    def perform_create(self, serializer):
        validated = serializer.validated_data
        self._bloquear_regras(validated)
        inst = serializer.save()
        self._log("CRIAR", inst, {"depois": self._snap(inst)})

    @transaction.atomic
    def perform_update(self, serializer):
        self._bloquear_regras(serializer.instance)
        self._bloquear_regras(serializer.validated_data)
        antes = self._snap(serializer.instance)
        inst = serializer.save()
        self._log("EDITAR", inst, {"antes": antes, "depois": self._snap(inst)})

    @transaction.atomic
    def perform_destroy(self, instance):
        antes = self._snap(instance)
        self._log("EXCLUIR", instance, {"antes": antes})
        instance.delete()


class CursoViewSet(AuditedViewSet):
    queryset = Curso.objects.all()
    serializer_class = s.CursoSerializer
    search_fields = ["nome", "codigo"]


class ProfessorViewSet(AuditedViewSet):
    queryset = Professor.objects.all()
    serializer_class = s.ProfessorSerializer
    search_fields = ["nome", "email"]

    @action(detail=True, methods=["get"])
    def carga(self, request, pk=None):
        """Carga horária global do professor (todas as ofertas/cursos) no período: ?periodo=<id>."""
        prof = self.get_object()
        periodo = PeriodoLetivo.objects.filter(pk=request.query_params.get("periodo") or 0).first() \
            or PeriodoLetivo.objects.filter(ativo=True).first()
        if not periodo:
            return Response({"detail": "Informe ?periodo=<id>."}, status=400)
        return Response(resumo_carga(prof, periodo))

    @action(detail=True, methods=["get"])
    def grade(self, request, pk=None):
        """Grade horária semanal do professor, consolidada entre todos os cursos."""
        prof = self.get_object()
        qs = HorarioAula.objects.filter(oferta__alocacoes__professor=prof).select_related("oferta__disciplina")
        if request.query_params.get("periodo"):
            qs = qs.filter(oferta__periodo_id=request.query_params["periodo"])
        return Response([{"dia": h.get_dia_semana_display(), "inicio": h.hora_inicio, "fim": h.hora_fim,
                          "sala": h.sala, "oferta": str(h.oferta), "oferta_id": h.oferta_id} for h in qs])


class DisciplinaViewSet(AuditedViewSet):
    queryset = Disciplina.objects.all()
    serializer_class = s.DisciplinaSerializer
    search_fields = ["nome", "codigo"]


class PeriodoLetivoViewSet(AuditedViewSet):
    queryset = PeriodoLetivo.objects.all()
    serializer_class = s.PeriodoLetivoSerializer


class OfertaViewSet(AuditedViewSet):
    queryset = OfertaDisciplina.objects.select_related("disciplina", "periodo", "curso_responsavel") \
        .prefetch_related("participacoes", "alocacoes", "horarios")
    serializer_class = s.OfertaDisciplinaSerializer
    filterset_fields = ["periodo", "curso_responsavel", "cursos", "tipo", "disciplina", "alocacoes__professor"]
    search_fields = ["disciplina__nome", "disciplina__codigo", "turma"]

class ParticipacaoViewSet(AuditedViewSet):
    queryset = ParticipacaoCurso.objects.select_related("oferta__curso_responsavel", "curso")
    serializer_class = s.ParticipacaoCursoSerializer
    filterset_fields = ["oferta", "curso"]


class AlocacaoViewSet(AuditedViewSet):
    queryset = AlocacaoProfessor.objects.select_related("oferta__curso_responsavel", "professor")
    serializer_class = s.AlocacaoProfessorSerializer
    filterset_fields = ["oferta", "professor", "oferta__periodo"]


class HorarioViewSet(AuditedViewSet):
    queryset = HorarioAula.objects.select_related("oferta__curso_responsavel")
    serializer_class = s.HorarioAulaSerializer
    filterset_fields = ["oferta", "dia_semana", "sala", "oferta__periodo"]


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.select_related("usuario")
    serializer_class = s.AuditLogSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["usuario", "acao", "modelo", "objeto_id"]


class SalaViewSet(AuditedViewSet):
    queryset = Sala.objects.all()
    serializer_class = s.SalaSerializer
    search_fields = ["nome"]


class TurmaViewSet(AuditedViewSet):
    queryset = Turma.objects.select_related("curso", "periodo")
    serializer_class = s.TurmaSerializer
    filterset_fields = ["curso", "periodo"]
    search_fields = ["codigo", "curso__nome", "curso__codigo"]


class PainelViewSet(viewsets.ViewSet):
    """Visao integrada, com metricas calculadas no servico central."""
    def list(self, request):
        return Response(resumo_planejamento(
            periodo_id=request.query_params.get("periodo") or None,
            curso_id=request.query_params.get("curso") or None,
            professor_id=request.query_params.get("professor") or None,
            disciplina_id=request.query_params.get("disciplina") or None,
            unidade=request.query_params.get("unidade") or None,
        ))


class CoordenadorViewSet(viewsets.ViewSet):
    """Usuários administradores ou vinculados a um professor, sem expor outros usuários."""
    def list(self, request):
        User = get_user_model()
        users = User.objects.filter(Q(is_staff=True) | Q(professor__isnull=False) |
                                    Q(cursos_coordenados__isnull=False)).distinct()
        return Response([{"id": user.pk, "nome": user.get_full_name() or user.get_username(),
                          "username": user.get_username()} for user in users])
