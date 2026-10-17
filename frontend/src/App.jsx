import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

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
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800">
      {/* Sidebar Lateral */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col p-6 shadow-xl">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-wide text-indigo-400">
            Smart Schedule
          </h1>
          <p className="text-xs text-slate-400 mt-1">Hackathon 2026 - Gestão CLT & Overlap</p>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setAbaAtiva('cursos')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all cursor-pointer ${
              abaAtiva === 'cursos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            📚 Cursos & Coordenadores
          </button>

          <button
            onClick={() => setAbaAtiva('professores')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all cursor-pointer ${
              abaAtiva === 'professores' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            👨‍🏫 Professores
          </button>

          <button
            onClick={() => setAbaAtiva('salas')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all cursor-pointer ${
              abaAtiva === 'salas' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            🏛️ Salas & Lab
          </button>

          <button
            onClick={() => setAbaAtiva('grade')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all cursor-pointer ${
              abaAtiva === 'grade' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            🗓️ Grade Horária
          </button>
        </nav>

        <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
          Base de Dados: <span className="text-emerald-400 font-semibold">PostgreSQL (GIST Ativo)</span>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* ABA: CURSOS */}
        {abaAtiva === 'cursos' && (
          <>
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Gestão de Cursos & Coordenadores</h2>
                <p className="text-sm text-slate-500">Cadastre os cursos institucionais e altere os coordenadores quando necessário.</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                Total: <span className="text-indigo-600">{cursos.length}</span>
              </div>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Adicionar Novo Curso</h3>
              <form onSubmit={handleAddCurso} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Nome do Curso (ex: Engenharia de Software)"
                  value={novoCurso}
                  onChange={(e) => setNovoCurso(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:col-span-1"
                  required
                />
                <input
                  type="text"
                  placeholder="Código (ex: ES01)"
                  value={novoCodigo}
                  onChange={(e) => setNovoCodigo(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:col-span-1"
                  required
                />
                <select
                  value={coordenadorId}
                  onChange={(e) => setCoordenadorId(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm md:col-span-1"
                >
                  <option value="">Selecione o Coordenador (Opcional)...</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm text-sm cursor-pointer md:col-span-1">
                  Salvar Curso
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800">Cursos Registados</h3>
              </div>
              {cursos.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Nenhum curso cadastrado ainda.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-3">Código</th>
                      <th className="px-6 py-3">Nome do Curso</th>
                      <th className="px-6 py-3">Coordenador do Curso</th>
                      <th className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {cursos.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-indigo-600">{c.codigo}</td>
                        <td className="px-6 py-4 text-slate-800 font-medium">{c.nome}</td>
                        <td className="px-6 py-4 text-slate-600 font-medium">
                          {cursoEditandoId === c.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={coordenadorEditId}
                                onChange={(e) => setCoordenadorEditId(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                              >
                                <option value="">Sem Coordenador</option>
                                {professores.map((p) => (
                                  <option key={p.id} value={p.id}>{p.nome}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleUpdateCoordenador(c.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setCursoEditandoId(null)}
                                className="bg-slate-300 hover:bg-slate-400 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            c.professores?.nome ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                👨‍💼 {c.professores.nome}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-xs">Não atribuído</span>
                            )
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {cursoEditandoId !== c.id && (
                            <button
                              onClick={() => {
                                setCursoEditandoId(c.id)
                                setCoordenadorEditId(c.coordenador_id || '')
                              }}
                              className="text-indigo-600 hover:text-indigo-800 font-medium text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Alterar Coordenador
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ABA: PROFESSORES */}
        {abaAtiva === 'professores' && (
          <>
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Gestão de Professores</h2>
                <p className="text-sm text-slate-500">Cadastre o corpo docente para alocação de aulas ou coordenação.</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                Total: <span className="text-indigo-600">{professores.length}</span>
              </div>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Adicionar Novo Professor</h3>
              <form onSubmit={handleAddProfessor} className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Nome do Professor"
                  value={nomeProf}
                  onChange={(e) => setNomeProf(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
                <input
                  type="email"
                  placeholder="E-mail Institucional"
                  value={emailProf}
                  onChange={(e) => setEmailProf(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm text-sm cursor-pointer">
                  Salvar Professor
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800">Professores Registados</h3>
              </div>
              {professores.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Nenhum professor cadastrado ainda.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-3">Nome</th>
                      <th className="px-6 py-3">E-mail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {professores.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 text-slate-800 font-medium">{p.nome}</td>
                        <td className="px-6 py-4 text-slate-600">{p.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ABA: SALAS */}
        {abaAtiva === 'salas' && (
          <>
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Gestão de Salas e Laboratórios</h2>
                <p className="text-sm text-slate-500">Cadastre os espaços físicos disponíveis.</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                Total: <span className="text-indigo-600">{salas.length}</span>
              </div>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Adicionar Nova Sala</h3>
              <form onSubmit={handleAddSala} className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Nome da Sala / Lab (ex: Lab 04)"
                  value={nomeSala}
                  onChange={(e) => setNomeSala(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
                <input
                  type="number"
                  placeholder="Capacidade"
                  value={capacidadeSala}
                  onChange={(e) => setCapacidadeSala(e.target.value)}
                  className="w-full md:w-40 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm text-sm cursor-pointer">
                  Salvar Sala
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800">Salas Registadas</h3>
              </div>
              {salas.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Nenhuma sala cadastrada ainda.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-3">Identificação</th>
                      <th className="px-6 py-3">Capacidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {salas.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 text-slate-800 font-medium">{s.nome}</td>
                        <td className="px-6 py-4 text-slate-600 font-mono">{s.capacidade} alunos</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ABA: GRADE HORÁRIA */}
        {abaAtiva === 'grade' && (
          <>
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Grade Horária & Validação de Conflitos</h2>
                <p className="text-sm text-slate-500">Alocar disciplinas prevenindo sobreposição de professores em tempo real.</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-semibold text-slate-700">
                Alocações Ativas: <span className="text-indigo-600">{grade.length}</span>
              </div>
            </header>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Registar Nova Aula (Validação Automática GIST)</h3>
              <form onSubmit={handleAddGrade} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select
                  value={cursoId}
                  onChange={(e) => setCursoId(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                >
                  <option value="">Selecione o Curso...</option>
                  {cursos.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.codigo})</option>)}
                </select>

                <select
                  value={professorId}
                  onChange={(e) => setProfessorId(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                >
                  <option value="">Selecione o Professor...</option>
                  {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>

                <select
                  value={salaId}
                  onChange={(e) => setSalaId(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
                  className="px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />

                <input
                  type="text"
                  placeholder="Período (ex: 2º Período)"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />

                <select
                  value={diaSemana}
                  onChange={(e) => setDiaSemana(e.target.value)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                >
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                </select>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Início:</span>
                  <input
                    type="time"
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Fim:</span>
                  <input
                    type="time"
                    value={horarioFim}
                    onChange={(e) => setHorarioFim(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>

                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg shadow-sm text-sm cursor-pointer md:col-span-3">
                  Alocar Horário com Validação de Conflito
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800">Grade Alocada Atual</h3>
              </div>
              {loading ? (
                <div className="p-8 text-center text-slate-400">A carregar grade...</div>
              ) : grade.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Nenhuma aula alocada na grade ainda.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="px-6 py-3">Dia / Horário</th>
                      <th className="px-6 py-3">Disciplina & Período</th>
                      <th className="px-6 py-3">Curso</th>
                      <th className="px-6 py-3">Professor</th>
                      <th className="px-6 py-3">Sala</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {grade.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-800">{g.dia_semana}</span>
                          <div className="text-xs font-mono text-indigo-600">{g.horario_inicio.slice(0,5)} - {g.horario_fim.slice(0,5)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900">{g.disciplina}</span>
                          <div className="text-xs text-slate-500">{g.periodo}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{g.cursos?.nome || '—'}</td>
                        <td className="px-6 py-4 text-slate-700 font-medium">{g.professores?.nome || '—'}</td>
                        <td className="px-6 py-4 text-slate-600 font-mono">{g.salas?.nome || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}