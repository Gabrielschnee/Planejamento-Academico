from rest_framework import serializers

from .models import (AlocacaoProfessor, AuditLog, Curso, Disciplina, HorarioAula, OfertaDisciplina,
                     ParticipacaoCurso, PeriodoLetivo, Professor)


def _ser(model):
    meta = type("Meta", (), {"model": model, "fields": "__all__"})
    return type(f"{model.__name__}Serializer", (serializers.ModelSerializer,), {"Meta": meta})


CursoSerializer = _ser(Curso)
ProfessorSerializer = _ser(Professor)
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
        fields = ["id", "disciplina", "periodo", "turma", "tipo", "carga_horaria", "curso_responsavel",
                  "participacoes", "alocacoes", "horarios", "criado_em", "atualizado_em"]


class AuditLogSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()

    class Meta:
        model = AuditLog
        fields = "__all__"
