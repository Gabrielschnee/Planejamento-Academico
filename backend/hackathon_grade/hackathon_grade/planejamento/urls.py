from rest_framework.routers import DefaultRouter
from django.urls import path

from . import views as v

router = DefaultRouter()
router.register("cursos", v.CursoViewSet)
router.register("professores", v.ProfessorViewSet)
router.register("salas", v.SalaViewSet)
router.register("turmas", v.TurmaViewSet)
router.register("painel", v.PainelViewSet, basename="painel")
router.register("coordenadores", v.CoordenadorViewSet, basename="coordenadores")
router.register("disciplinas", v.DisciplinaViewSet)
router.register("periodos", v.PeriodoLetivoViewSet)
router.register("ofertas", v.OfertaViewSet)
router.register("participacoes", v.ParticipacaoViewSet)
router.register("alocacoes", v.AlocacaoViewSet)
router.register("horarios", v.HorarioViewSet)
router.register("auditoria", v.AuditLogViewSet)

urlpatterns = router.urls + [
    path("assistente-grade/", v.assistente_grade, name="assistente-grade"),
]
