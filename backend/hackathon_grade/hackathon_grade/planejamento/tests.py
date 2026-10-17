from datetime import time

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from rest_framework.test import APITestCase

from .models import *
from .services import resumo_planejamento


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


class IntegridadeCentralTest(FluxoTest):
    def test_sobreposicao_parcial_e_rejeitada(self):
        o1, o2 = self.oferta(self.d1, self.c1), self.oferta(self.d2, self.c2)
        HorarioAula.objects.create(oferta=o1, dia_semana=0, hora_inicio=time(19), hora_fim=time(20, 40))
        self.client.force_authenticate(self.c2u)
        response = self.client.post("/api/horarios/", {
            "oferta": o2.pk, "dia_semana": 0, "hora_inicio": "20:00", "hora_fim": "21:00",
        })
        self.assertEqual(response.status_code, 201)
        AlocacaoProfessor.objects.create(oferta=o1, professor=self.prof, ch_alocada=30)
        response = self.client.post("/api/alocacoes/", {
            "oferta": o2.pk, "professor": self.prof.pk, "ch_alocada": 30,
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("20:00-21:00", str(response.data))

    def test_aulas_consecutivas_sao_permitidas(self):
        o1, o2 = self.oferta(self.d1, self.c1), self.oferta(self.d2, self.c2)
        HorarioAula.objects.create(oferta=o1, dia_semana=0, hora_inicio=time(19), hora_fim=time(20, 40))
        AlocacaoProfessor.objects.create(oferta=o1, professor=self.prof, ch_alocada=30)
        horario = HorarioAula.objects.create(oferta=o2, dia_semana=0,
                                             hora_inicio=time(20, 40), hora_fim=time(22))
        AlocacaoProfessor.objects.create(oferta=o2, professor=self.prof, ch_alocada=30)
        self.assertIsNotNone(horario.pk)

    def test_ch_atribuida_nao_pode_exceder_oferta_compartilhada(self):
        outro_prof = Professor.objects.create(nome="Bia", email="b@x.com")
        oferta = self.oferta(self.d1, self.c1)
        AlocacaoProfessor.objects.create(oferta=oferta, professor=self.prof, ch_alocada=40)
        with self.assertRaises(ValidationError):
            AlocacaoProfessor.objects.create(oferta=oferta, professor=outro_prof, ch_alocada=30)

    def test_edicao_de_horario_verifica_conflito_sem_bater_nele_proprio(self):
        oferta = self.oferta(self.d1, self.c1)
        horario = HorarioAula.objects.create(oferta=oferta, dia_semana=0,
                                             hora_inicio=time(8), hora_fim=time(10))
        horario.hora_inicio = time(9)
        horario.hora_fim = time(11)
        horario.save()
        self.assertEqual(HorarioAula.objects.filter(pk=horario.pk).count(), 1)

    def test_edicao_de_horario_rejeita_conflito_com_outro_registro(self):
        o1, o2 = self.oferta(self.d1, self.c1), self.oferta(self.d2, self.c2)
        h1 = HorarioAula.objects.create(oferta=o1, dia_semana=0, hora_inicio=time(8), hora_fim=time(10), sala="A1")
        HorarioAula.objects.create(oferta=o2, dia_semana=0, hora_inicio=time(12), hora_fim=time(14), sala="A1")
        h1.hora_inicio = time(13)
        h1.hora_fim = time(15)
        with self.assertRaises(ValidationError):
            h1.save()

    def test_ch_prevista_e_ch_oferta_sao_contadas_uma_vez(self):
        oferta = self.oferta(self.d1, self.c1)
        ParticipacaoCurso.objects.create(oferta=oferta, curso=self.c1, ch_apropriada=30)
        ParticipacaoCurso.objects.create(oferta=oferta, curso=self.c2, ch_apropriada=30)
        AlocacaoProfessor.objects.create(oferta=oferta, professor=self.prof, ch_alocada=30)
        snapshot = resumo_planejamento(periodo_id=self.per.pk)
        self.assertEqual(snapshot["indicadores"]["carga_prevista_disciplinas_h"], 60)
        self.assertEqual(snapshot["indicadores"]["carga_planejada_ofertas_h"], 60)
        self.assertEqual(snapshot["indicadores"]["carga_apropriada_cursos_h"], 60)
        self.assertEqual(snapshot["indicadores"]["carga_docente_atribuida_h"], 30)

    def test_resumo_respeita_filtro_de_curso_e_periodo(self):
        self.oferta(self.d1, self.c1)
        outro_periodo = PeriodoLetivo.objects.create(ano=2027, semestre=1)
        OfertaDisciplina.objects.create(disciplina=self.d2, periodo=outro_periodo, carga_horaria=60,
                                        curso_responsavel=self.c2)
        snapshot = resumo_planejamento(periodo_id=self.per.pk, curso_id=self.c1.pk)
        self.assertEqual(snapshot["indicadores"]["ofertas_planejadas"], 1)
        self.assertEqual(snapshot["indicadores"]["carga_planejada_ofertas_h"], 60)

    def test_painel_detecta_conflito_docente_e_sala(self):
        o1, o2 = self.oferta(self.d1, self.c1), self.oferta(self.d2, self.c2)
        h1 = HorarioAula(oferta=o1, dia_semana=0, hora_inicio=time(8), hora_fim=time(10), sala="A1")
        h2 = HorarioAula(oferta=o2, dia_semana=0, hora_inicio=time(9), hora_fim=time(11), sala="A1")
        HorarioAula.objects.bulk_create([h1, h2])
        AlocacaoProfessor.objects.bulk_create([
            AlocacaoProfessor(oferta=o1, professor=self.prof, ch_alocada=30),
            AlocacaoProfessor(oferta=o2, professor=self.prof, ch_alocada=30),
        ])
        snapshot = resumo_planejamento(periodo_id=self.per.pk)
        self.assertEqual(snapshot["indicadores"]["conflitos"], 1)
        self.assertEqual(snapshot["conflitos_detectados"][0]["registros"], [h1.pk, h2.pk])

    def test_dois_codigos_de_disciplina_repetidos_sao_bloqueados(self):
        with self.assertRaises(IntegrityError):
            Disciplina.objects.create(codigo=self.d1.codigo, nome="Cópia", carga_horaria=60)

    def test_turma_mesmo_curso_nao_pode_ter_aulas_simultaneas(self):
        d3 = Disciplina.objects.create(codigo="D3", nome="Redes", carga_horaria=60)
        o1, o2 = self.oferta(self.d1, self.c1), self.oferta(d3, self.c1)
        HorarioAula.objects.create(oferta=o1, dia_semana=0, hora_inicio=time(8), hora_fim=time(10))
        with self.assertRaises(ValidationError) as error:
            HorarioAula.objects.create(oferta=o2, dia_semana=0,
                                       hora_inicio=time(9), hora_fim=time(11))
        self.assertIn("Turma", str(error.exception))

    def test_sala_e_validada_sem_diferenciar_maiusculas(self):
        o1, o2 = self.oferta(self.d1, self.c1), self.oferta(self.d2, self.c2)
        HorarioAula.objects.create(oferta=o1, dia_semana=0, hora_inicio=time(8), hora_fim=time(10), sala="Lab 1")
        with self.assertRaises(ValidationError) as error:
            HorarioAula.objects.create(oferta=o2, dia_semana=0, hora_inicio=time(9),
                                       hora_fim=time(11), sala="lab 1")
        self.assertIn("Sala", str(error.exception))

    def test_painel_api_usa_os_registros_centrales_e_pode_filtrar(self):
        self.oferta(self.d1, self.c1)
        self.client.force_authenticate(self.c1u)
        response = self.client.get(f"/api/painel/?periodo={self.per.pk}&curso={self.c1.pk}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["indicadores"]["ofertas_planejadas"], 1)
        self.assertEqual(response.data["ofertas"][0]["turma_id"], OfertaDisciplina.objects.get().turma_ref_id)

    def test_turma_e_sala_relacionadas_sao_salvas_no_horario(self):
        oferta = self.oferta(self.d1, self.c1)
        sala = Sala.objects.create(nome="Sala 12", capacidade=30)
        horario = HorarioAula.objects.create(oferta=oferta, dia_semana=0, hora_inicio=time(8),
                                             hora_fim=time(10), sala_registro=sala)
        horario.refresh_from_db()
        self.assertEqual(horario.turma_ref_id, oferta.turma_ref_id)
        self.assertEqual(horario.sala, sala.nome)

    def test_editar_alocacao_reflete_em_todas_as_consultas_centrais(self):
        oferta = self.oferta(self.d1, self.c1)
        alocacao = AlocacaoProfessor.objects.create(oferta=oferta, professor=self.prof, ch_alocada=30)
        antes = resumo_planejamento(periodo_id=self.per.pk)
        alocacao.ch_alocada = 45
        alocacao.save()
        depois = resumo_planejamento(periodo_id=self.per.pk)
        self.assertEqual(antes["indicadores"]["carga_docente_atribuida_h"], 30)
        self.assertEqual(depois["indicadores"]["carga_docente_atribuida_h"], 45)
        self.assertEqual(depois["ofertas"][0]["alocacoes"][0]["ch_alocada"], 45)

    def test_coordenador_nao_pode_mover_horario_para_curso_de_outro(self):
        oferta_1, oferta_2 = self.oferta(self.d1, self.c1), self.oferta(self.d2, self.c2)
        horario = HorarioAula.objects.create(oferta=oferta_1, dia_semana=0,
                                             hora_inicio=time(8), hora_fim=time(10))
        self.client.force_authenticate(self.c1u)
        response = self.client.patch(f"/api/horarios/{horario.pk}/", {"oferta": oferta_2.pk})
        self.assertEqual(response.status_code, 403)
        horario.refresh_from_db()
        self.assertEqual(horario.oferta_id, oferta_1.pk)
