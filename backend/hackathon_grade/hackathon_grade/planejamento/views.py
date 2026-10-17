import json

from django.db import transaction
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from . import serializers as s
from .models import (AlocacaoProfessor, AuditLog, Curso, Disciplina, HorarioAula, OfertaDisciplina,
                     ParticipacaoCurso, PeriodoLetivo, Professor)
from .services import resumo_carga


def pode_editar(user, curso_responsavel):
    """Cada curso edita apenas as ofertas pelas quais é responsável (staff edita tudo)."""
    return user.is_staff or curso_responsavel.coordenador_id == user.id


class AuditedViewSet(viewsets.ModelViewSet):
    """Toda escrita é auditada (antes/depois), autorizada e transacional."""

    def curso_de(self, obj):
        """Curso responsável que controla a escrita. Cadastros básicos retornam None (só staff)."""
        return None

    def _snap(self, inst):
        return json.loads(json.dumps(self.get_serializer(inst).data, default=str))

    def _log(self, acao, inst, dados):
        AuditLog.objects.create(usuario=self.request.user, acao=acao, modelo=inst._meta.label,
                                objeto_id=str(inst.pk), objeto_repr=str(inst)[:200], dados=dados)

    def _autorizar(self, curso):
        user = self.request.user
        if curso is None:
            if not user.is_staff:
                raise PermissionDenied("Apenas administradores alteram este cadastro.")
        elif not pode_editar(user, curso):
            raise PermissionDenied("Apenas o coordenador do curso responsável pode alterar esta oferta.")

    @transaction.atomic
    def perform_create(self, serializer):
        self._autorizar(self.curso_de(serializer.validated_data))
        inst = serializer.save()
        self._log("CRIAR", inst, {"depois": self._snap(inst)})

    @transaction.atomic
    def perform_update(self, serializer):
        self._autorizar(self.curso_de(serializer.instance))
        antes = self._snap(serializer.instance)
        inst = serializer.save()
        self._log("EDITAR", inst, {"antes": antes, "depois": self._snap(inst)})

    @transaction.atomic
    def perform_destroy(self, instance):
        self._autorizar(self.curso_de(instance))
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

    def curso_de(self, obj):
        return obj["curso_responsavel"] if isinstance(obj, dict) else obj.curso_responsavel


class _FilhoOfertaViewSet(AuditedViewSet):
    def curso_de(self, obj):
        oferta = obj["oferta"] if isinstance(obj, dict) else obj.oferta
        return oferta.curso_responsavel


class ParticipacaoViewSet(_FilhoOfertaViewSet):
    queryset = ParticipacaoCurso.objects.select_related("oferta__curso_responsavel", "curso")
    serializer_class = s.ParticipacaoCursoSerializer
    filterset_fields = ["oferta", "curso"]


class AlocacaoViewSet(_FilhoOfertaViewSet):
    queryset = AlocacaoProfessor.objects.select_related("oferta__curso_responsavel", "professor")
    serializer_class = s.AlocacaoProfessorSerializer
    filterset_fields = ["oferta", "professor", "oferta__periodo"]


class HorarioViewSet(_FilhoOfertaViewSet):
    queryset = HorarioAula.objects.select_related("oferta__curso_responsavel")
    serializer_class = s.HorarioAulaSerializer
    filterset_fields = ["oferta", "dia_semana", "sala", "oferta__periodo"]


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = AuditLog.objects.select_related("usuario")
    serializer_class = s.AuditLogSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ["usuario", "acao", "modelo", "objeto_id"]
