import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

export default function App() {
  const [abaAtiva, setAbaAtiva] = useState('cursos') // 'cursos', 'professores', 'salas', 'grade'
  
  // Estados para Cursos
  const [cursos, setCursos] = useState([])
  const [novoCurso, setNovoCurso] = useState('')
  const [novoCodigo, setNovoCodigo] = useState('')
  const [coordenadorId, setCoordenadorId] = useState('')
  
  // Estado para Edição de Curso
  const [cursoEditandoId, setCursoEditandoId] = useState(null)
  const [coordenadorEditId, setCoordenadorEditId] = useState('')

  // Estados para Professores
  const [professores, setProfessores] = useState([])
  const [nomeProf, setNomeProf] = useState('')
  const [emailProf, setEmailProf] = useState('')

  // Estados para Salas
  const [salas, setSalas] = useState([])
  const [nomeSala, setNomeSala] = useState('')
  const [capacidadeSala, setCapacidadeSala] = useState('')

  // Estados para Grade Horária
  const [grade, setGrade] = useState([])
  const [cursoId, setCursoId] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [salaId, setSalaId] = useState('')
  const [periodo, setPeriodo] = useState('2º Período')
  const [disciplina, setDisciplina] = useState('')
  const [diaSemana, setDiaSemana] = useState('Segunda-feira')
  const [horarioInicio, setHorarioInicio] = useState('')
  const [horarioFim, setHorarioFim] = useState('')

  const [loading, setLoading] = useState(false)

  // --- BUSCAR DADOS ---
  async function fetchCursos() {
    const { data, error } = await supabase
      .from('cursos')
      .select(`
        *,
        professores:coordenador_id (id, nome)
      `)
    if (error) console.error('Erro ao buscar cursos:', error)
    else setCursos(data || [])
  }

  async function fetchProfessores() {
    const { data, error } = await supabase.from('professores').select('*')
    if (error) console.error('Erro ao buscar professores:', error)
    else setProfessores(data || [])
  }

  async function fetchSalas() {
    const { data, error } = await supabase.from('salas').select('*')
    if (error) console.error('Erro ao buscar salas:', error)
    else setSalas(data || [])
  }

  async function fetchGrade() {
    setLoading(true)
    const { data, error } = await supabase
      .from('grade_horaria')
      .select(`
        *,
        cursos (nome, codigo),
        professores (nome, email),
        salas (nome, capacidade)
      `)
      .order('dia_semana', { ascending: true })
    
    if (error) console.error('Erro ao buscar grade horária:', error)
    else setGrade(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchCursos()
    fetchProfessores()
    fetchSalas()
    fetchGrade()
  }, [])

  // --- HANDLERS DE ADIÇÃO E EDIÇÃO ---
  async function handleAddCurso(e) {
    e.preventDefault()
    if (!novoCurso || !novoCodigo) return
    
    const payload = {
      nome: novoCurso,
      codigo: novoCodigo,
      coordenador_id: coordenadorId || null
    }

    const { error } = await supabase.from('cursos').insert([payload])
    if (error) alert('Erro ao salvar curso: ' + error.message)
    else {
      setNovoCurso('')
      setNovoCodigo('')
      setCoordenadorId('')
      fetchCursos()
    }
  }

  async function handleUpdateCoordenador(cursoId) {
    const { error } = await supabase
      .from('cursos')
      .update({ coordenador_id: coordenadorEditId || null })
      .eq('id', cursoId)

    if (error) {
      alert('Erro ao atualizar coordenador: ' + error.message)
    } else {
      alert('✅ Coordenador atualizado com sucesso!')
      setCursoEditandoId(null)
      setCoordenadorEditId('')
      fetchCursos()
    }
  }

  async function handleAddProfessor(e) {
    e.preventDefault()
    if (!nomeProf || !emailProf) return
    const { error } = await supabase.from('professores').insert([{ nome: nomeProf, email: emailProf }])
    if (error) alert('Erro ao salvar professor: ' + error.message)
    else {
      setNomeProf('')
      setEmailProf('')
      fetchProfessores()
    }
  }

  async function handleAddSala(e) {
    e.preventDefault()
    if (!nomeSala || !capacidadeSala) return
    const { error } = await supabase.from('salas').insert([{ nome: nomeSala, capacidade: parseInt(capacidadeSala) }])
    if (error) alert('Erro ao salvar sala: ' + error.message)
    else {
      setNomeSala('')
      setCapacidadeSala('')
      fetchSalas()
    }
  }

  async function handleAddGrade(e) {
    e.preventDefault()
    if (!cursoId || !professorId || !salaId || !disciplina || !horarioInicio || !horarioFim) return

    const { error } = await supabase.from('grade_horaria').insert([{
      curso_id: cursoId,
      professor_id: professorId,
      sala_id: salaId,
      periodo,
      disciplina,
      dia_semana: diaSemana,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim
    }])

    if (error) {
      if (error.code === '23P01') {
        alert('❌ CONFLITO DETETADO: Este professor já possui uma aula alocada neste mesmo dia e intervalo de horário!')
      } else {
        alert('Erro ao alocar horário: ' + error.message)
      }
    } else {
      alert('✅ Aula alocada com sucesso e validada sem conflitos!')
      setDisciplina('')
      setHorarioInicio('')
      setHorarioFim('')
      fetchGrade()
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" onClick={() => setAbaAtiva('grade')}>
          <svg className="brand-mark" viewBox="0 0 56 44" aria-hidden="true" focusable="false">
            <path d="M3 39 23 14l8 25H3Z" fill="currentColor" />
            <path d="m18 39 17-31 9 31H18Z" fill="currentColor" opacity=".78" />
            <path d="m31 39 12-22 10 22H31Z" fill="currentColor" opacity=".58" />
          </svg>
          <span>Portal do Professor</span>
        </a>
        <nav className="topbar-nav" aria-label="Navegação principal">
          <button
            onClick={() => setAbaAtiva('cursos')}
            className="nav-item"
            aria-current={abaAtiva === 'cursos' ? 'page' : undefined}
          >
            Cursos
          </button>

          <button
            onClick={() => setAbaAtiva('professores')}
            className="nav-item"
            aria-current={abaAtiva === 'professores' ? 'page' : undefined}
          >
            Professores
          </button>

          <button
            onClick={() => setAbaAtiva('salas')}
            className="nav-item"
            aria-current={abaAtiva === 'salas' ? 'page' : undefined}
          >
            Salas e laboratórios
          </button>

          <button
            onClick={() => setAbaAtiva('grade')}
            className="nav-item"
            aria-current={abaAtiva === 'grade' ? 'page' : undefined}
          >
            Grade horária
          </button>
        </nav>
        <div className="topbar-status">Hackathon 2026 · <span>GIST ativo</span></div>
      </header>

      {/* Conteúdo Principal */}
      <main className="page-content">
        {/* ABA: CURSOS */}
        {abaAtiva === 'cursos' && (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">Planejamento acadêmico</p>
                <h1>Cursos e coordenadores</h1>
                <p className="page-description">Cadastre os cursos institucionais e atualize as pessoas responsáveis por cada formação.</p>
              </div>
              <div className="count-pill">
                Total <strong>{cursos.length}</strong>
              </div>
            </header>

            <section className="section-card">
              <div className="section-heading"><div><h2>Adicionar curso</h2><p>Inclua o curso e, se desejar, atribua um coordenador.</p></div></div>
              <form onSubmit={handleAddCurso} className="form-grid">
                <input
                  type="text"
                  placeholder="Nome do Curso (ex: Engenharia de Software)"
                  value={novoCurso}
                  onChange={(e) => setNovoCurso(e.target.value)}
                  className="field-control"
                  required
                />
                <input
                  type="text"
                  placeholder="Código (ex: ES01)"
                  value={novoCodigo}
                  onChange={(e) => setNovoCodigo(e.target.value)}
                  className="field-control"
                  required
                />
                <select
                  value={coordenadorId}
                  onChange={(e) => setCoordenadorId(e.target.value)}
                  className="field-control"
                >
                  <option value="">Selecione o Coordenador (Opcional)...</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <button type="submit" className="button-primary">
                  Adicionar curso
                </button>
              </form>
            </section>

            <section className="section-card table-card">
              <div className="section-heading"><div><h2>Cursos cadastrados</h2></div></div>
              {cursos.length === 0 ? (
                <div className="empty-state"><strong>Nenhum curso por aqui</strong>Adicione um curso para começar a organizar a grade.</div>
              ) : (
                <div className="table-wrap"><table className="data-table">
                  <thead>
                    <tr>
                      <th className="px-6 py-3">Código</th>
                      <th className="px-6 py-3">Nome do Curso</th>
                      <th className="px-6 py-3">Coordenador do Curso</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cursos.map((c) => (
                      <tr key={c.id}>
                        <td><span className="code-label">{c.codigo}</span></td>
                        <td><span className="table-primary">{c.nome}</span></td>
                        <td>
                          {cursoEditandoId === c.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={coordenadorEditId}
                                onChange={(e) => setCoordenadorEditId(e.target.value)}
                                className="field-control"
                              >
                                <option value="">Sem Coordenador</option>
                                {professores.map((p) => (
                                  <option key={p.id} value={p.id}>{p.nome}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleUpdateCoordenador(c.id)}
                                className="button-small"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setCursoEditandoId(null)}
                                className="button-small"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            c.professores?.nome ? (
                              <span className="person-chip">
                                {c.professores.nome}
                              </span>
                            ) : (
                              <span className="muted-text">Não atribuído</span>
                            )
                          )}
                        </td>
                        <td>
                          {cursoEditandoId !== c.id && (
                            <button
                              onClick={() => {
                                setCursoEditandoId(c.id)
                                setCoordenadorEditId(c.coordenador_id || '')
                              }}
                              className="button-quiet"
                            >
                              Alterar Coordenador
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </section>
          </>
        )}

        {/* ABA: PROFESSORES */}
        {abaAtiva === 'professores' && (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">Equipe acadêmica</p>
                <h1>Professores</h1>
                <p className="page-description">Cadastre o corpo docente para alocação de aulas ou coordenação dos cursos.</p>
              </div>
              <div className="count-pill">
                Total <strong>{professores.length}</strong>
              </div>
            </header>

            <section className="section-card">
              <div className="section-heading"><div><h2>Adicionar professor</h2><p>Os dados ficam disponíveis para cursos e alocações.</p></div></div>
              <form onSubmit={handleAddProfessor} className="form-grid three">
                <input
                  type="text"
                  placeholder="Nome do Professor"
                  value={nomeProf}
                  onChange={(e) => setNomeProf(e.target.value)}
                  className="field-control"
                  required
                />
                <input
                  type="email"
                  placeholder="E-mail Institucional"
                  value={emailProf}
                  onChange={(e) => setEmailProf(e.target.value)}
                  className="field-control"
                  required
                />
                <button type="submit" className="button-primary">
                  Adicionar professor
                </button>
              </form>
            </section>

            <section className="section-card table-card">
              <div className="section-heading"><div><h2>Corpo docente</h2></div></div>
              {professores.length === 0 ? (
                <div className="empty-state"><strong>Nenhum professor cadastrado</strong>Adicione professores para atribuí-los a cursos e aulas.</div>
              ) : (
                <div className="table-wrap"><table className="data-table">
                  <thead>
                    <tr>
                      <th className="px-6 py-3">Nome</th>
                      <th className="px-6 py-3">E-mail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {professores.map((p) => (
                      <tr key={p.id}>
                        <td><span className="table-primary">{p.nome}</span></td>
                        <td>{p.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </section>
          </>
        )}

        {/* ABA: SALAS */}
        {abaAtiva === 'salas' && (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">Infraestrutura</p>
                <h1>Salas e laboratórios</h1>
                <p className="page-description">Cadastre os espaços físicos disponíveis para as atividades acadêmicas.</p>
              </div>
              <div className="count-pill">
                Total <strong>{salas.length}</strong>
              </div>
            </header>

            <section className="section-card">
              <div className="section-heading"><div><h2>Adicionar sala</h2><p>Informe um nome e a capacidade do espaço.</p></div></div>
              <form onSubmit={handleAddSala} className="form-grid three">
                <input
                  type="text"
                  placeholder="Nome da Sala / Lab (ex: Lab 04)"
                  value={nomeSala}
                  onChange={(e) => setNomeSala(e.target.value)}
                  className="field-control"
                  required
                />
                <input
                  type="number"
                  placeholder="Capacidade"
                  value={capacidadeSala}
                  onChange={(e) => setCapacidadeSala(e.target.value)}
                  className="field-control"
                  required
                />
                <button type="submit" className="button-primary">
                  Adicionar sala
                </button>
              </form>
            </section>

            <section className="section-card table-card">
              <div className="section-heading"><div><h2>Espaços cadastrados</h2></div></div>
              {salas.length === 0 ? (
                <div className="empty-state"><strong>Nenhuma sala cadastrada</strong>Adicione os espaços disponíveis para organizar as aulas.</div>
              ) : (
                <div className="table-wrap"><table className="data-table">
                  <thead>
                    <tr>
                      <th className="px-6 py-3">Identificação</th>
                      <th className="px-6 py-3">Capacidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salas.map((s) => (
                      <tr key={s.id}>
                        <td><span className="table-primary">{s.nome}</span></td>
                        <td className="numeric">{s.capacidade} lugares</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </section>
          </>
        )}

        {/* ABA: GRADE HORÁRIA */}
        {abaAtiva === 'grade' && (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">Visão geral · Planejamento acadêmico</p>
                <h1>Grade horária</h1>
                <p className="page-description">Organize disciplinas e horários com validação automática de conflitos.</p>
              </div>
              <div className="count-pill">
                Aulas ativas <strong>{grade.length}</strong>
              </div>
            </header>

            <section className="section-card">
              <div className="section-heading"><div><h2>Adicionar aula</h2><p>Os conflitos de horário são verificados automaticamente.</p></div></div>
              <form onSubmit={handleAddGrade} className="form-grid three">
                <select
                  value={cursoId}
                  onChange={(e) => setCursoId(e.target.value)}
                  className="field-control"
                  required
                >
                  <option value="">Selecione o Curso...</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.codigo})</option>)}
                </select>

                <select
                  value={professorId}
                  onChange={(e) => setProfessorId(e.target.value)}
                  className="field-control"
                  required
                >
                  <option value="">Selecione o Professor...</option>
                  {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>

                <select
                  value={salaId}
                  onChange={(e) => setSalaId(e.target.value)}
                  className="field-control"
                  required
                >
                  <option value="">Selecione a Sala...</option>
                  {salas.map(s => <option key={s.id} value={s.id}>{s.nome} (Cap: {s.capacidade})</option>)}
                </select>

                <input
                  type="text"
                  placeholder="Nome da Disciplina (ex: Estrutura de Dados)"
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                  className="field-control"
                  required
                />

                <input
                  type="text"
                  placeholder="Período (ex: 2º Período)"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="field-control"
                  required
                />

                <select
                  value={diaSemana}
                  onChange={(e) => setDiaSemana(e.target.value)}
                  className="field-control"
                  required
                >
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                </select>

                <label className="time-field">
                  <span>Início</span>
                  <input
                    type="time"
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    className="field-control"
                    required
                  />
                </label>

                <label className="time-field">
                  <span>Fim</span>
                  <input
                    type="time"
                    value={horarioFim}
                    onChange={(e) => setHorarioFim(e.target.value)}
                    className="field-control"
                    required
                  />
                </label>

                <button type="submit" className="button-primary span-all">
                  Adicionar à grade
                </button>
              </form>
            </section>

            <section className="section-card table-card">
              <div className="section-heading"><div><h2>Aulas programadas</h2></div></div>
              {loading ? (
                <div className="empty-state">Carregando a grade…</div>
              ) : grade.length === 0 ? (
                <div className="empty-state"><strong>A grade ainda está vazia</strong>Cadastre uma aula acima para começar o planejamento.</div>
              ) : (
                <div className="table-wrap"><table className="data-table">
                  <thead>
                    <tr>
                      <th className="px-6 py-3">Dia / Horário</th>
                      <th className="px-6 py-3">Disciplina & Período</th>
                      <th className="px-6 py-3">Curso</th>
                      <th className="px-6 py-3">Professor</th>
                      <th className="px-6 py-3">Sala</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grade.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <span className="table-primary">{g.dia_semana}</span>
                          <span className="table-secondary numeric">{g.horario_inicio.slice(0,5)} – {g.horario_fim.slice(0,5)}</span>
                        </td>
                        <td>
                          <span className="table-primary">{g.disciplina}</span>
                          <span className="table-secondary">{g.periodo}</span>
                        </td>
                        <td>{g.cursos?.nome || '—'}</td>
                        <td><span className="table-primary">{g.professores?.nome || '—'}</span></td>
                        <td>{g.salas?.nome || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </section>
          </>
        )}
        <footer className="page-footer"><span>Portal do Professor · Planejamento acadêmico</span><span>Validação de conflitos ativa</span></footer>
      </main>
    </div>
  )
}
