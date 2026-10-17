from rest_framework import serializers

from .models import (AlocacaoProfessor, AuditLog, Curso, Disciplina, HorarioAula, OfertaDisciplina,
                     ParticipacaoCurso, PeriodoLetivo, Professor, Sala, Turma)


def _ser(model):
    meta = type("Meta", (), {"model": model, "fields": "__all__"})
    return type(f"{model.__name__}Serializer", (serializers.ModelSerializer,), {"Meta": meta})


CursoSerializer = _ser(Curso)
ProfessorSerializer = _ser(Professor)
SalaSerializer = _ser(Sala)
TurmaSerializer = _ser(Turma)
DisciplinaSerializer = _ser(Disciplina)
PeriodoLetivoSerializer = _ser(PeriodoLetivo)
ParticipacaoCursoSerializer = _ser(ParticipacaoCurso)
AlocacaoProfessorSerializer = _ser(AlocacaoProfessor)
HorarioAulaSerializer = _ser(HorarioAula)


class OfertaDisciplinaSerializer(serializers.ModelSerializer):
    participacoes = ParticipacaoCursoSerializer(many=True, read_only=True)
    alocacoes = AlocacaoProfessorSerializer(many=True, read_only=True)
    horarios = HorarioAulaSerializer(many=True, read_only=True)

    class Meta:
        model = OfertaDisciplina
        fields = ["id", "disciplina", "periodo", "turma", "turma_ref", "tipo", "carga_horaria", "curso_responsavel",
                  "periodo_turma", "participacoes", "alocacoes", "horarios", "criado_em", "atualizado_em"]


class AuditLogSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()

    class Meta:
        model = AuditLog
        fields = "__all__"
