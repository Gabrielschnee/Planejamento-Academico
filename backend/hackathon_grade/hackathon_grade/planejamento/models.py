from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import Sum
from django.db.models.functions import Lower


class TimeStamped(models.Model):
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Curso(TimeStamped):
    codigo = models.CharField(max_length=20, unique=True)
    nome = models.CharField(max_length=150)
    unidade = models.CharField(max_length=120, blank=True)
    modalidade = models.CharField(max_length=80, blank=True)
    coordenador = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="cursos_coordenados")

    class Meta:
        ordering = ["nome"]
        constraints = [models.UniqueConstraint(Lower("codigo"), name="curso_codigo_case_insensitive_uniq")]

    def __str__(self):
        return f"{self.codigo} - {self.nome}"


class Professor(TimeStamped):
    identificacao = models.CharField(max_length=40, unique=True, null=True, blank=True)
    nome = models.CharField(max_length=150)
    email = models.EmailField(unique=True, blank=True, null=True)
    vinculo = models.CharField(max_length=100, blank=True)
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name="professor")
    ch_maxima_periodo = models.PositiveIntegerField(
        default=400, help_text="Carga horária máxima no período letivo (horas).")

    class Meta:
        ordering = ["nome"]
        verbose_name_plural = "professores"
        constraints = [models.UniqueConstraint(Lower("email"), condition=models.Q(email__isnull=False) & ~models.Q(email=""), name="professor_email_case_insensitive_uniq")]

    def __str__(self):
        return self.nome

    def clean(self):
        if not self.pk:
            return
        total_por_periodo = self.alocacoes.values("oferta__periodo_id").annotate(total=Sum("ch_alocada"))
        excedidos = [f"{row['total']}h no período {row['oferta__periodo_id']}"
                     for row in total_por_periodo if row["total"] > self.ch_maxima_periodo]
        if excedidos:
            raise ValidationError("A nova carga máxima é menor que alocações existentes: " + ", ".join(excedidos))

    @transaction.atomic
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Disciplina(TimeStamped):
    codigo = models.CharField(max_length=20, unique=True)
    nome = models.CharField(max_length=150)
    carga_horaria = models.PositiveIntegerField(help_text="Horas")

    class Meta:
        ordering = ["nome"]
        constraints = [models.UniqueConstraint(Lower("codigo"), name="disciplina_codigo_case_insensitive_uniq")]

    def __str__(self):
        return f"{self.codigo} - {self.nome}"


class PeriodoLetivo(TimeStamped):
    ano = models.PositiveSmallIntegerField()
    semestre = models.PositiveSmallIntegerField(choices=[(1, "1º"), (2, "2º")])
    data_inicio = models.DateField(null=True, blank=True)
    data_fim = models.DateField(null=True, blank=True)
    ativo = models.BooleanField(default=True)

    class Meta:
        unique_together = [("ano", "semestre")]
        ordering = ["-ano", "-semestre"]

    def __str__(self):
        return f"{self.ano}/{self.semestre}"

    def clean(self):
        if self.data_inicio and self.data_fim and self.data_inicio >= self.data_fim:
            raise ValidationError("A data inicial do período letivo deve ser anterior à data final.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class Turma(TimeStamped):
    codigo = models.CharField(max_length=40)
    curso = models.ForeignKey(Curso, on_delete=models.PROTECT, related_name="turmas")
    periodo = models.ForeignKey(PeriodoLetivo, on_delete=models.PROTECT, related_name="turmas")

    class Meta:
        ordering = ["periodo", "curso", "codigo"]
        constraints = [models.UniqueConstraint(fields=["codigo", "curso", "periodo"],
                                                name="turma_codigo_curso_periodo_uniq")]

    def __str__(self):
        return f"{self.curso.codigo} · turma {self.codigo} ({self.periodo})"


class OfertaDisciplina(TimeStamped):
    """Unidade central do modelo: Oferta de Disciplina/Atividade."""
    TIPOS = [("DISCIPLINA", "Disciplina"), ("ATIVIDADE", "Atividade")]

    disciplina = models.ForeignKey(Disciplina, on_delete=models.PROTECT, related_name="ofertas")
    periodo = models.ForeignKey(PeriodoLetivo, on_delete=models.PROTECT, related_name="ofertas")
    turma = models.CharField(max_length=20, default="A")
    turma_ref = models.ForeignKey(Turma, null=True, blank=True, on_delete=models.PROTECT,
                                  related_name="ofertas")
    periodo_turma = models.CharField(max_length=40, blank=True)
    tipo = models.CharField(max_length=10, choices=TIPOS, default="DISCIPLINA")
    carga_horaria = models.PositiveIntegerField(help_text="CH total da oferta (contada uma única vez).")
    curso_responsavel = models.ForeignKey(Curso, on_delete=models.PROTECT,
                                          related_name="ofertas_responsavel")
    cursos = models.ManyToManyField(Curso, through="ParticipacaoCurso", related_name="ofertas")

    class Meta:
        unique_together = [("disciplina", "periodo", "turma", "curso_responsavel")]
        ordering = ["periodo", "disciplina"]

    def __str__(self):
        return f"{self.disciplina.codigo} turma {self.turma} ({self.periodo})"

    def clean(self):
        if self.turma_ref_id:
            if self.curso_responsavel_id and self.turma_ref.curso_id != self.curso_responsavel_id:
                raise ValidationError("A turma deve pertencer ao curso responsável pela oferta.")
            if self.periodo_id and self.turma_ref.periodo_id != self.periodo_id:
                raise ValidationError("A turma deve pertencer ao mesmo período letivo da oferta.")
            self.turma = self.turma_ref.codigo
        if not self.pk:
            return
        soma_docente = self.alocacoes.exclude(pk=None).aggregate(total=Sum("ch_alocada"))["total"] or 0
        if soma_docente > self.carga_horaria:
            raise ValidationError("A nova CH da oferta é menor que a carga já atribuída aos docentes.")
        soma_curso = self.participacoes.exclude(pk=None).aggregate(total=Sum("ch_apropriada"))["total"] or 0
        if soma_curso > self.carga_horaria:
            raise ValidationError("A nova CH da oferta é menor que a carga apropriada pelos cursos.")
        from .services import validar_alteracao_horario
        encontros = list(self.horarios.all())
        for i, horario in enumerate(encontros):
            for outro in encontros[i + 1:]:
                if horario.dia_semana == outro.dia_semana and \
                        horario.hora_inicio < outro.hora_fim and outro.hora_inicio < horario.hora_fim:
                    raise ValidationError("A alteração da oferta cria sobreposição entre encontros da mesma turma.")
            horario.oferta = self
            validar_alteracao_horario(horario)

    @transaction.atomic
    def save(self, *args, **kwargs):
        if self.curso_responsavel_id and self.periodo_id and (
                not self.turma_ref_id or self.turma_ref.codigo != self.turma or
                self.turma_ref.curso_id != self.curso_responsavel_id or
                self.turma_ref.periodo_id != self.periodo_id):
            self.turma_ref, _ = Turma.objects.get_or_create(
                codigo=self.turma, curso_id=self.curso_responsavel_id, periodo_id=self.periodo_id)
        self.full_clean()
        super().save(*args, **kwargs)


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

    @transaction.atomic
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
        if self.pk:
            from .services import validar_alteracao_alocacao
            validar_alteracao_alocacao(self)
        outras_alocacoes = self.oferta.alocacoes.exclude(pk=self.pk).aggregate(t=Sum("ch_alocada"))["t"] or 0
        if outras_alocacoes + self.ch_alocada > self.oferta.carga_horaria:
            raise ValidationError(
                f"A soma da carga horaria atribuida ({outras_alocacoes + self.ch_alocada}h) excede "
                f"a CH da oferta ({self.oferta.carga_horaria}h). Ajuste a distribuicao entre docentes.")
        total = carga_global_professor(self.professor, self.oferta.periodo, excluir_alocacao=self.pk)
        if total + self.ch_alocada > self.professor.ch_maxima_periodo:
            raise ValidationError(
                f"Carga global excedida: {total + self.ch_alocada}h > "
                f"{self.professor.ch_maxima_periodo}h para {self.professor}.")
        conflitos = conflitos_horarios_alocacao(self)
        if conflitos:
            raise ValidationError("Sobreposição de horários: " + "; ".join(conflitos))

    @transaction.atomic
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
    sala_registro = models.ForeignKey("Sala", null=True, blank=True, on_delete=models.PROTECT,
                                      related_name="horarios")
    turma = models.CharField(max_length=40, blank=True, help_text="Identificação opcional da turma neste encontro.")
    turma_ref = models.ForeignKey(Turma, null=True, blank=True, on_delete=models.PROTECT,
                                  related_name="encontros")

    class Meta:
        ordering = ["dia_semana", "hora_inicio"]

    def __str__(self):
        return f"{self.oferta} {self.get_dia_semana_display()} {self.hora_inicio:%H:%M}-{self.hora_fim:%H:%M}"

    def clean(self):
        if not self.oferta_id or not self.hora_inicio or not self.hora_fim:
            return
        if self.turma_ref_id:
            if self.turma_ref.curso_id != self.oferta.curso_responsavel_id or \
                    self.turma_ref.periodo_id != self.oferta.periodo_id:
                raise ValidationError("A turma do encontro deve pertencer ao curso e período da oferta.")
            self.turma = self.turma_ref.codigo
        elif not self.turma.strip():
            self.turma_ref = self.oferta.turma_ref
            self.turma = self.oferta.turma
        else:
            self.turma_ref = Turma.objects.filter(curso_id=self.oferta.curso_responsavel_id,
                periodo_id=self.oferta.periodo_id, codigo=self.turma).first()
        if self.sala_registro_id:
            self.sala = self.sala_registro.nome
        elif self.sala.strip():
            self.sala_registro = Sala.objects.filter(nome__iexact=self.sala.strip()).first()
        if self.hora_inicio >= self.hora_fim:
            raise ValidationError("hora_inicio deve ser anterior a hora_fim.")
        if self.pk:
            from .services import validar_alteracao_horario
            validar_alteracao_horario(self)
        from .services import conflitos_horario
        conflitos = conflitos_horario(self)
        if conflitos:
            raise ValidationError("Sobreposição de horários: " + "; ".join(conflitos))

    @transaction.atomic
    def save(self, *args, **kwargs):
        if self.oferta_id:
            codigo = self.turma.strip() or self.oferta.turma
            if (not self.turma_ref_id or self.turma_ref.codigo != codigo or
                    self.turma_ref.curso_id != self.oferta.curso_responsavel_id or
                    self.turma_ref.periodo_id != self.oferta.periodo_id):
                self.turma_ref, _ = Turma.objects.get_or_create(
                    codigo=codigo, curso_id=self.oferta.curso_responsavel_id,
                    periodo_id=self.oferta.periodo_id)
            self.turma = codigo
        self.full_clean()
        super().save(*args, **kwargs)


class Sala(TimeStamped):
    nome = models.CharField(max_length=80, unique=True)
    capacidade = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["nome"]
        constraints = [models.UniqueConstraint(Lower("nome"), name="sala_nome_case_insensitive_uniq")]

    def __str__(self):
        return self.nome

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
