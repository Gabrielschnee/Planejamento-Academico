from datetime import time

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import *


class FluxoTest(APITestCase):
    def setUp(self):
        U = get_user_model()
        self.c1u, self.c2u = U.objects.create_user("c1", password="x"), U.objects.create_user("c2", password="x")
        self.c1 = Curso.objects.create(codigo="ADS", nome="ADS", coordenador=self.c1u)
        self.c2 = Curso.objects.create(codigo="SI", nome="SI", coordenador=self.c2u)
        self.per = PeriodoLetivo.objects.create(ano=2026, semestre=2)
        self.prof = Professor.objects.create(nome="Ana", email="a@x.com", ch_maxima_periodo=100)
        self.d1 = Disciplina.objects.create(codigo="D1", nome="BD", carga_horaria=60)
        self.d2 = Disciplina.objects.create(codigo="D2", nome="ES", carga_horaria=60)

    def oferta(self, d, curso):
        return OfertaDisciplina.objects.create(disciplina=d, periodo=self.per, carga_horaria=60, curso_responsavel=curso)

    def test_conflito_global_entre_cursos(self):
        o1, o2 = self.oferta(self.d1, self.c1), self.oferta(self.d2, self.c2)
        for o in (o1, o2):
            HorarioAula.objects.create(oferta=o, dia_semana=0, hora_inicio=time(8), hora_fim=time(10))
        AlocacaoProfessor.objects.create(oferta=o1, professor=self.prof, ch_alocada=40)
        self.client.force_authenticate(self.c2u)
        r = self.client.post("/api/alocacoes/", {"oferta": o2.pk, "professor": self.prof.pk, "ch_alocada": 40})
        self.assertEqual(r.status_code, 400)

    def test_ch_global_excedida(self):
        o1, o2 = self.oferta(self.d1, self.c1), self.oferta(self.d2, self.c2)
        AlocacaoProfessor.objects.create(oferta=o1, professor=self.prof, ch_alocada=60)
        self.client.force_authenticate(self.c2u)
        r = self.client.post("/api/alocacoes/", {"oferta": o2.pk, "professor": self.prof.pk, "ch_alocada": 60})
        self.assertEqual(r.status_code, 400)

    def test_permissao_e_auditoria(self):
        o1 = self.oferta(self.d1, self.c1)
        self.client.force_authenticate(self.c2u)
        r = self.client.post("/api/horarios/", {"oferta": o1.pk, "dia_semana": 1, "hora_inicio": "08:00", "hora_fim": "10:00"})
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.c1u)
        r = self.client.post("/api/horarios/", {"oferta": o1.pk, "dia_semana": 1, "hora_inicio": "08:00", "hora_fim": "10:00"})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(AuditLog.objects.filter(acao="CRIAR").count(), 1)

    def test_apropriacao_separada(self):
        o1 = self.oferta(self.d1, self.c1)
        ParticipacaoCurso.objects.create(oferta=o1, curso=self.c1, ch_apropriada=30)
        ParticipacaoCurso.objects.create(oferta=o1, curso=self.c2, ch_apropriada=30)
        AlocacaoProfessor.objects.create(oferta=o1, professor=self.prof, ch_alocada=60)
        self.client.force_authenticate(self.c1u)
        r = self.client.get(f"/api/professores/{self.prof.pk}/carga/?periodo={self.per.pk}")
        self.assertEqual(r.data["ch_total_alocada"], 60)
        self.assertEqual(r.data["apropriacao_por_curso"], {"ADS": 30, "SI": 30})
