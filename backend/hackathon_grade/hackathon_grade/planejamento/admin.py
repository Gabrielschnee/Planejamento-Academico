from django.contrib import admin
from . import models as m

for model in (m.Curso, m.Professor, m.Disciplina, m.PeriodoLetivo, m.Turma, m.OfertaDisciplina,
              m.ParticipacaoCurso, m.AlocacaoProfessor, m.HorarioAula, m.Sala):
    admin.site.register(model)


@admin.register(m.AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("criado_em", "usuario", "acao", "modelo", "objeto_repr")
    readonly_fields = [f.name for f in m.AuditLog._meta.fields]

    def has_add_permission(self, request): return False
    def has_change_permission(self, request, obj=None): return False
    def has_delete_permission(self, request, obj=None): return False
