import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from . import serializers as s
from .models import (AlocacaoProfessor, AuditLog, Curso, Disciplina, HorarioAula, OfertaDisciplina,
                     ParticipacaoCurso, PeriodoLetivo, Professor, Sala, Turma)
from .services import resumo_carga, resumo_planejamento


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
