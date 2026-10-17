from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum


class TimeStamped(models.Model):
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Curso(TimeStamped):
    codigo = models.CharField(max_length=20, unique=True)
    nome = models.CharField(max_length=150)
    coordenador = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="cursos_coordenados")

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return f"{self.codigo} - {self.nome}"


class Professor(TimeStamped):
    nome = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="professor")
    ch_maxima_periodo = models.PositiveIntegerField(
        default=400, help_text="Carga horária máxima no período letivo (horas).")

    class Meta:
        ordering = ["nome"]
        verbose_name_plural = "professores"

    def __str__(self):
        return self.nome


class Disciplina(TimeStamped):
    codigo = models.CharField(max_length=20, unique=True)
    nome = models.CharField(max_length=150)
    carga_horaria = models.PositiveIntegerField(help_text="Horas")

    class Meta:
        ordering = ["nome"]

    def __str__(self):
        return f"{self.codigo} - {self.nome}"


class PeriodoLetivo(TimeStamped):
    ano = models.PositiveSmallIntegerField()
    semestre = models.PositiveSmallIntegerField(choices=[(1, "1º"), (2, "2º")])
    ativo = models.BooleanField(default=True)

    class Meta:
        unique_together = [("ano", "semestre")]
        ordering = ["-ano", "-semestre"]

    def __str__(self):
        return f"{self.ano}/{self.semestre}"


class OfertaDisciplina(TimeStamped):
    """Unidade central do modelo: Oferta de Disciplina/Atividade."""
    TIPOS = [("DISCIPLINA", "Disciplina"), ("ATIVIDADE", "Atividade")]

    disciplina = models.ForeignKey(Disciplina, on_delete=models.PROTECT, related_name="ofertas")
    periodo = models.ForeignKey(PeriodoLetivo, on_delete=models.PROTECT, related_name="ofertas")
    turma = models.CharField(max_length=20, default="A")
    tipo = models.CharField(max_length=10, choices=TIPOS, default="DISCIPLINA")
    carga_horaria = models.PositiveIntegerField(help_text="CH total da oferta (contada uma única vez).")
    curso_responsavel = models.ForeignKey(Curso, on_delete=models.PROTECT,
                                          related_name="ofertas_responsavel")
    cursos = models.ManyToManyField(Curso, through="ParticipacaoCurso", related_name="ofertas")

    class Meta:
        unique_together = [("disciplina", "periodo", "turma")]
        ordering = ["periodo", "disciplina"]

    def __str__(self):
        return f"{self.disciplina.codigo} turma {self.turma} ({self.periodo})"


class ParticipacaoCurso(TimeStamped):
    """Participação de um curso na oferta + apropriação administrativa da CH (separada da alocação)."""
    oferta = models.ForeignKey(OfertaDisciplina, on_delete=models.CASCADE, related_name="participacoes")
    curso = models.ForeignKey(Curso, on_delete=models.PROTECT, related_name="participacoes")
    ch_apropriada = models.PositiveIntegerField(
        default=0, help_text="CH apropriada administrativamente por este curso.")

    class Meta:
        unique_together = [("oferta", "curso")]

    def __str__(self):
        return f"{self.curso.codigo} em {self.oferta}"

    def clean(self):
        if not self.oferta_id or not self.curso_id:
            return
        outras = self.oferta.participacoes.exclude(pk=self.pk).aggregate(t=Sum("ch_apropriada"))["t"] or 0
        if outras + self.ch_apropriada > self.oferta.carga_horaria:
            raise ValidationError(
                f"A soma das CH apropriadas ({outras + self.ch_apropriada}h) excede a CH da oferta "
                f"({self.oferta.carga_horaria}h).")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class AlocacaoProfessor(TimeStamped):
    """Professor alocado à oferta uma única vez; a CH é contada uma só vez na carga global."""
    oferta = models.ForeignKey(OfertaDisciplina, on_delete=models.CASCADE, related_name="alocacoes")
    professor = models.ForeignKey(Professor, on_delete=models.PROTECT, related_name="alocacoes")
    ch_alocada = models.PositiveIntegerField()

    class Meta:
        unique_together = [("oferta", "professor")]
        verbose_name_plural = "alocações"

    def __str__(self):
        return f"{self.professor} -> {self.oferta}"

    def clean(self):
        if not self.oferta_id or not self.professor_id:
            return
        from .services import conflitos_horarios_alocacao, carga_global_professor
        if self.ch_alocada > self.oferta.carga_horaria:
            raise ValidationError("CH alocada maior que a CH da oferta.")
        total = carga_global_professor(self.professor, self.oferta.periodo, excluir_alocacao=self.pk)
        if total + self.ch_alocada > self.professor.ch_maxima_periodo:
            raise ValidationError(
                f"Carga global excedida: {total + self.ch_alocada}h > "
                f"{self.professor.ch_maxima_periodo}h para {self.professor}.")
        conflitos = conflitos_horarios_alocacao(self)
        if conflitos:
            raise ValidationError("Sobreposição de horários: " + "; ".join(conflitos))

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class HorarioAula(TimeStamped):
    DIAS = [(0, "Segunda"), (1, "Terça"), (2, "Quarta"), (3, "Quinta"), (4, "Sexta"), (5, "Sábado"), (6, "Domingo")]

    oferta = models.ForeignKey(OfertaDisciplina, on_delete=models.CASCADE, related_name="horarios")
    dia_semana = models.PositiveSmallIntegerField(choices=DIAS)
    hora_inicio = models.TimeField()
    hora_fim = models.TimeField()
    sala = models.CharField(max_length=30, blank=True)

    class Meta:
        ordering = ["dia_semana", "hora_inicio"]

    def __str__(self):
        return f"{self.oferta} {self.get_dia_semana_display()} {self.hora_inicio:%H:%M}-{self.hora_fim:%H:%M}"

    def clean(self):
        if not self.oferta_id or not self.hora_inicio or not self.hora_fim:
            return
        if self.hora_inicio >= self.hora_fim:
            raise ValidationError("hora_inicio deve ser anterior a hora_fim.")
        from .services import conflitos_horario
        conflitos = conflitos_horario(self)
        if conflitos:
            raise ValidationError("Sobreposição de horários: " + "; ".join(conflitos))

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class AuditLog(models.Model):
    """Trilha de auditoria: quem fez o quê, quando, com estado antes/depois."""
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    acao = models.CharField(max_length=10)
    modelo = models.CharField(max_length=60)
    objeto_id = models.CharField(max_length=40)
    objeto_repr = models.CharField(max_length=200)
    dados = models.JSONField(default=dict)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.criado_em:%d/%m/%Y %H:%M} {self.usuario} {self.acao} {self.modelo}#{self.objeto_id}"
