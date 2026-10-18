import { useCallback, useEffect, useState } from 'react'
import { allPages, api } from './api'
import './App.css'

const VIEWS = [
  ['painel', 'Visão geral'], ['cursos', 'Cursos'], ['professores', 'Professores'],
  ['disciplinas', 'Disciplinas'], ['salas', 'Salas e laboratórios'], ['grade', 'Grade horária'],
]
const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const emptyData = { cursos: [], professores: [], disciplinas: [], periodos: [], ofertas: [], salas: [], coordenadores: [], sessao: { is_staff: true }, indicadores: {} }

function Brand() {
  return <a className="brand" href="#inicio">
    <svg className="brand-mark" viewBox="0 0 56 44" aria-hidden="true" focusable="false">
      <circle cx="27" cy="22" r="16" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M27 12v11l8 5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg><span>CronosAI</span>
  </a>
}

function Reveal({ children, className = '' }) {
  useEffect(() => {
    const elements = document.querySelectorAll('.reveal:not(.is-visible)')
    if (!('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.16 })
    elements.forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [])
  return <div className={`reveal ${className}`}>{children}</div>
}

function LandingPage({ onOpenApp }) {
  const [expandedAi, setExpandedAi] = useState(-1)
  const [aiPreview, setAiPreview] = useState('review')
  const aiFeatures = [
    ['Assistência à construção do planejamento', 'A partir de objetivos, conteúdos e orientações fornecidos pelo educador, a IA pode ajudar a estruturar uma primeira versão do planejamento, que será revisada e aprovada pelo professor.', 'Organize objetivos, conteúdos e atividades em uma estrutura inicial para revisão.'],
    ['Identificação de possíveis inconsistências', 'Analise informações disponíveis para sinalizar campos ausentes, divergências ou pontos que mereçam revisão.', 'Receba alertas sobre informações que parecem incompletas ou divergentes.'],
    ['Revisão e aprimoramento de textos', 'Torne objetivos, descrições de atividades e estratégias pedagógicas mais claros e coerentes com as orientações fornecidas.', 'Refine a clareza do texto preservando a intenção pedagógica de quem escreveu.'],
    ['Síntese inteligente para a coordenação', 'Resuma planejamentos com destaque para pendências e pontos que merecem acompanhamento, respeitando o escopo dos dados disponíveis.', 'Visualize um resumo para apoiar o acompanhamento da equipe.'],
  ]
  return <main className="landing-page" id="inicio">
    <nav className="landing-nav" aria-label="Navegação principal">
      <a className="landing-brand" href="#inicio"><span className="landing-brand-mark">C</span> CronosAI</a>
      <div className="landing-nav-links"><a href="#solucao">A solução</a><a href="#inteligencia">IA assistiva</a><a href="#recursos">Recursos</a><button className="landing-nav-cta" onClick={onOpenApp}>Acessar plataforma</button></div>
    </nav>

    <section className="landing-hero">
      <Reveal className="landing-hero-copy">
        <h1 className="landing-hero-manifesto">Menos planilhas.<br />Menos conflitos.<br /><span>Mais controle.</span></h1>
        <h2 className="landing-hero-subtitle">A gestão docente que sua instituição precisa.</h2>
        <p className="landing-lead">Abandone a complexidade das planilhas Excel. Organize grades horárias, distribua cargas docentes e identifique inconsistências em um único lugar — com mais agilidade, clareza e segurança.</p>
        <div className="landing-actions"><button className="landing-primary" onClick={onOpenApp}>Conheça a plataforma <span aria-hidden="true">↗</span></button><a className="landing-text-link" href="#solucao">Veja como funciona <span aria-hidden="true">↓</span></a></div>
      </Reveal>
      <Reveal className="landing-product-visual">
        <div className="mock-window">
          <div className="mock-topbar"><div className="mock-dots"><i/><i/><i/></div><span>Planejamento acadêmico</span><span className="mock-user">Coordenação</span></div>
          <div className="mock-content"><aside className="mock-sidebar"><b>◈　Portal</b><span className="selected">▦　Visão geral</span><span>⌂　Cursos</span><span>◎　Professores</span><span>▤　Grade horária</span></aside><div className="mock-dashboard"><p className="mock-caption">SEGUNDO SEMESTRE · 2026</p><h2>Seu planejamento, em perspectiva.</h2><div className="mock-stats"><div><small>Cursos ativos</small><strong>08</strong><em>no período</em></div><div><small>Docentes</small><strong>42</strong><em>na equipe</em></div><div><small>Conflitos</small><strong className="mock-alert">02</strong><em>precisam de atenção</em></div></div><div className="mock-schedule"><div className="mock-schedule-head"><b>Visão da semana</b><span>Segunda — Sexta</span></div><div className="mock-grid"><span>08:00</span><i/><i className="mock-blue"/><i/><span>10:00</span><i className="mock-lilac"/><i/><i className="mock-blue short"/><span>14:00</span><i/><i className="mock-lilac short"/><i/></div></div></div></div>
        </div>
      </Reveal>
      <a className="landing-scroll" href="#solucao"><span/>Role para descobrir</a>
    </section>

    <section className="landing-section landing-light" id="solucao"><Reveal className="landing-section-copy"><p className="landing-eyebrow">Uma rotina mais organizada</p><h2>Menos planilhas desconectadas. <span>Mais visão do todo.</span></h2><p>A rotina acadêmica reúne muitas peças: pessoas, cursos, disciplinas, salas e horários. O Portal conecta essas informações para que a coordenação enxergue o planejamento com mais segurança.</p></Reveal><Reveal className="landing-feature-row"><article><span className="feature-number">01</span><h3>Centralize</h3><p>Cadastros e informações acadêmicas reunidos em uma base compartilhada.</p></article><article><span className="feature-number">02</span><h3>Visualize</h3><p>Acompanhe cargas, alocações e horários com filtros que ajudam a encontrar o que precisa.</p></article><article><span className="feature-number">03</span><h3>Antecipe</h3><p>Identifique conflitos de agenda antes que eles virem retrabalho no dia a dia.</p></article></Reveal></section>

    <section className="landing-ai" id="inteligencia"><div className="landing-ai-top"><Reveal className="landing-ai-copy"><p className="landing-ai-eyebrow">Inteligência artificial</p><h2>Use a IA para torná-lo mais inteligente.</h2><p>A inteligência artificial pode ajudar sua equipe a revisar informações, estruturar ideias e identificar pontos que merecem atenção, sem substituir o julgamento pedagógico do professor.</p></Reveal><Reveal className="ai-assistant"><div className="ai-assistant-head"><span className="ai-sparkle">✧</span><strong>Assistente Pedagógico Inteligente</strong><span className="ai-context">Plano · Ciências 7º C</span></div><div className="ai-prompt">Revise este planejamento e identifique informações que precisam de maior detalhamento.</div>{aiPreview === 'ignored' ? <div className="ai-response"><p>Revisão ignorada. Você pode explorar outra possibilidade abaixo.</p><button onClick={() => setAiPreview('review')}>Ver análise novamente</button></div> : <div className="ai-response"><p>{aiPreview === 'suggestions' ? 'Sugestões para aprimorar este planejamento:' : 'Encontrei três pontos que podem ser revisados:'}</p>{aiPreview === 'suggestions' ? <ul><li>Defina um objetivo de aprendizagem mais específico.</li><li>Indique como será acompanhada a atividade.</li><li>Relacione o critério de avaliação ao objetivo.</li></ul> : <ul><li>O objetivo de aprendizagem está descrito de forma ampla;</li><li>A atividade proposta não explicita como será acompanhada;</li><li>O critério de avaliação pode ser detalhado.</li></ul>}<p>Deseja sugestões de melhoria?</p><div className="ai-actions"><button className="ai-action-primary" onClick={() => setAiPreview('suggestions')}>Ver sugestões</button><button className="ai-action-secondary" onClick={() => setAiPreview('ignored')}>Ignorar</button></div></div>}<p className="ai-disclaimer">◉ Demonstração ilustrativa. A decisão final é sempre do professor.</p></Reveal></div><Reveal className="ai-feature-grid">{aiFeatures.map(([title,description,detail],index)=><button type="button" className={`ai-feature${expandedAi === index ? ' is-expanded' : ''}`} key={title} aria-expanded={expandedAi === index} onClick={() => setExpandedAi(expandedAi === index ? -1 : index)}><span className="ai-feature-meta"><span className="ai-feature-icon">{['↗','△','▤','✧'][index]}</span><span>0{index + 1}</span></span><strong>{title}</strong><span className="ai-feature-description">{description}</span>{expandedAi === index && <span className="ai-feature-detail">{detail}</span>}</button>)}</Reveal></section>

    <section className="landing-section landing-dark" id="recursos"><Reveal className="landing-dark-copy"><p className="landing-eyebrow">Uma jornada conectada</p><h2>Do planejamento à sala de aula, <span>cada detalhe encontra seu lugar.</span></h2><p>Relacione professores, disciplinas, turmas e salas em uma grade feita para dar contexto ao trabalho de quem coordena e de quem ensina.</p></Reveal><Reveal className="landing-dark-visual"><div className="dark-visual-heading"><span>GRADE DA SEMANA</span><span>2º semestre · 2026</span></div><div className="dark-timetable"><div className="dark-day-labels"><span>HORÁRIO</span><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span></div>{[['08:00','Didática','—','Avaliação','—','Projeto'],['10:00','—','Leitura','—','Pesquisa','—'],['14:00','Currículo','Estágio','—','Didática','Extensão']].map(row=><div className="dark-time-row" key={row[0]}>{row.map((cell,i)=><span key={i} className={i > 0 && cell !== '—' ? `dark-class class-${(i + row[0].charCodeAt(1)) % 3}` : ''}>{cell}</span>)}</div>)}</div></Reveal></section>

    <section className="landing-final"><Reveal><p className="landing-eyebrow">Um planejamento que faz sentido</p><h2>Seu tempo merece uma jornada mais leve.</h2><p>Comece com uma visão mais clara do trabalho docente.</p><button className="landing-primary" onClick={onOpenApp}>Acessar CronosAI <span aria-hidden="true">↗</span></button></Reveal></section>
    <footer className="landing-footer"><span>© 2026 CronosAI</span><span>Planejamento acadêmico com mais clareza.</span></footer>
  </main>
}

function Select({ value, onChange, children, ...props }) {
  return <select className="field-control" value={value} onChange={onChange} {...props}>{children}</select>
}

function Stat({ label, value, detail, onClick }) {
  return <button type="button" className={`stat-card${onClick ? ' stat-action' : ''}`} onClick={onClick}>
    <span>{label}</span><strong>{value ?? '—'}</strong>{detail && <small>{detail}</small>}
  </button>
}

function App() {
  const [showLanding, setShowLanding] = useState(true)
  const [activeView, setActiveView] = useState('painel')
  const [data, setData] = useState(emptyData)
  const [filters, setFilters] = useState({ periodo: '', curso: '', professor: '', disciplina: '', unidade: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [editingMeeting, setEditingMeeting] = useState(null)
  const [editingAllocation, setEditingAllocation] = useState(null)
  const [forms, setForms] = useState({ courseName: '', courseCode: '', unit: '', modality: '', coordinatorId: '', teacherLink: '', teacherLimit: '', professorName: '', professorEmail: '', teacherId: '', subjectId: '', subjectCode: '', subjectName: '', subjectHours: '', periodId: '', periodYear: '', periodSemester: '1', periodStart: '', periodEnd: '', className: 'A', classPeriod: '', offerHours: '', responsibleCourse: '', participationCourse: '', appropriationHours: '', roomName: '', roomCapacity: '', room: '', weekday: '0', start: '', end: '', allocatedHours: '', meetingClass: '', offerId: '', offerSubject: '' })
  const set = (name, value) => setForms(current => ({ ...current, [name]: value }))

  const loadData = useCallback(async (currentFilters = filters) => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams(Object.entries(currentFilters).filter(([, value]) => value))
    try {
      const [dashboard, rooms, coordinators] = await Promise.all([
        api(`/painel/${query.size ? `?${query}` : ''}`),
        allPages('/salas/'),
        allPages('/coordenadores/'),
      ])
      setData({ ...dashboard, salas: rooms, coordenadores, sessao: { is_staff: true } })
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [filters])

  useEffect(() => {
    if (!showLanding) loadData()
  }, [showLanding, loadData])

  async function mutate(path, body, success, method = 'POST') {
    setBusy(true); setNotice(''); setError('')
    try {
      await api(path, { method, body })
      setNotice(success)
      await loadData()
      return true
    } catch (e) { setError(e.message); return false }
    finally { setBusy(false) }
  }

  async function submit(event, path, body, success, reset = []) {
    event.preventDefault()
    const ok = await mutate(path, body, success)
    if (ok) reset.forEach(name => set(name, ''))
  }

  function filteredOffers() { return data.ofertas || [] }
  function selectedOffer() { return filteredOffers().find(o => String(o.id) === String(forms.offerId)) }
  function exportReport() {
    const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [['Período', 'Curso responsável', 'Cursos participantes', 'Código da disciplina', 'Disciplina', 'Turma', 'CH prevista', 'CH da oferta', 'CH apropriada por curso', 'Docentes e CH', 'Dia', 'Início', 'Fim', 'Sala']]
    for (const offer of filteredOffers()) {
      const meetings = offer.horarios.length ? offer.horarios : [null]
      for (const meeting of meetings) rows.push([
        offer.periodo, offer.curso, offer.cursos.map(c => c.codigo).join(', '), offer.codigo_disciplina,
        offer.disciplina, offer.turma, offer.carga_prevista, offer.carga_oferta,
        offer.participacoes.map(p => `${p.curso__codigo}: ${p.ch_apropriada} h`).join('; '),
        offer.alocacoes.map(a => `${a.professor__nome}: ${a.ch_alocada} h`).join('; '),
        meeting ? meeting.dia : '', meeting?.inicio || '', meeting?.fim || '', meeting?.sala || '',
      ])
    }
    const csv = `\uFEFF${rows.map(row => row.map(escape).join(';')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'relatorio-planejamento-docente.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  function header(title, description, eyebrow, count) {
    return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{count !== undefined && <div className="count-pill">Registros <strong>{count}</strong></div>}</header>
  }
  function section(title, description, children, extraClass = '') {
    return <section className={`section-card ${extraClass}`}><div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{children}</section>
  }
  function table(headers, rows, empty, key = 'id') {
    if (!rows?.length) return <div className="empty-state"><strong>{empty}</strong>Quando houver registros na base central, eles aparecerão aqui.</div>
    return <div className="table-wrap"><table className="data-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row[key] ?? i}>{row.cells.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
  }

  if (showLanding) return <LandingPage onOpenApp={() => setShowLanding(false)} />

  const offers = filteredOffers()
  const indicators = data.indicadores || {}
  const conflictRows = (data.conflitos_detectados || []).map((c, i) => ({ id: i, cells: [c.motivos.join(', '), c.dia, c.horario_a, c.oferta_a, c.horario_b, c.oferta_b] }))
  const courseRows = (data.cursos || []).filter(c => (!filters.curso || String(c.id) === filters.curso) && (!filters.unidade || c.unidade === filters.unidade)).map(c => ({ id: c.id, cells: [<span className="code-label">{c.codigo}</span>, <span className="table-primary">{c.nome}</span>, c.unidade || '—', c.modalidade || '—', c.coordenador__username || '—', data.sessao?.is_staff ? <button className="button-quiet" onClick={() => { setEditingCourse(c); set('courseCode', c.codigo); set('courseName', c.nome); set('unit', c.unidade || ''); set('modality', c.modalidade || ''); set('coordinatorId', String(c.coordenador_id || '')) }}>Editar</button> : '—'] }))
  const professorRows = (data.professores || []).filter(p => !filters.professor || String(p.id) === filters.professor).map(p => {
    const allocations = offers.flatMap(o => o.alocacoes.filter(a => a.professor_id === p.id).map(a => ({ o, a })))
    const total = allocations.reduce((sum, entry) => sum + entry.a.ch_alocada, 0)
    return { id: p.id, cells: [<span className="table-primary">{p.nome}</span>, p.identificacao || '—', p.vinculo || '—', p.email, `${total} h / ${p.ch_maxima_periodo} h`, allocations.length ? <div className="tag-list">{allocations.map(({ o, a }) => <button key={a.id} className="person-chip chip-action" onClick={() => { setActiveView('grade'); setEditingAllocation(a); set('offerId', String(o.id)); set('teacherId', String(p.id)); set('allocatedHours', String(a.ch_alocada)) }}>{o.disciplina} · {a.ch_alocada} h · editar</button>)}</div> : 'Sem alocações'] }
  })
  const subjectRows = (data.disciplinas || []).filter(d => !filters.disciplina || String(d.id) === filters.disciplina).map(d => {
    const list = offers.filter(o => o.disciplina_id === d.id)
    return { id: d.id, cells: [<span className="code-label">{d.codigo}</span>, <span className="table-primary">{d.nome}</span>, `${d.carga_horaria} h`, list.map(o => `${o.curso} · turma ${o.turma} · ${o.periodo}`).join('; ') || 'Sem ofertas'] }
  })
  const courseOfferRows = offers.map(o => ({ id: o.id, cells: [<span className="code-label">{o.codigo_disciplina}</span>, <span className="table-primary">{o.disciplina}</span>, `${o.curso} · turma ${o.turma}`, o.periodo, `${o.carga_prevista} h`, `${o.carga_oferta} h`, o.alocacoes.map(a => `${a.professor__nome}: ${a.ch_alocada} h`).join(', ') || 'Pendente', o.horarios.map(h => `${h.dia} ${h.inicio}–${h.fim} · ${h.sala || 'sem sala'}`).join('; ') || 'Pendente'] }))
  const roomRows = (data.salas || []).map(room => ({ id: room.id, cells: [<span className="table-primary">{room.nome}</span>, room.capacidade ?? 'Não informada'] }))
  const scheduleRows = offers.flatMap(o => o.horarios.map(h => ({ id: h.id, cells: [WEEKDAYS[h.dia_semana] || h.dia, `${h.inicio}–${h.fim}`, <><span className="table-primary">{o.disciplina}</span><span className="table-secondary">{o.codigo_disciplina} · {o.carga_oferta} h na oferta</span></>, `${o.curso} · turma ${h.turma || o.turma} · ${o.periodo}`, o.alocacoes.map(a => `${a.professor__nome} (${a.ch_alocada} h)`).join(', ') || 'Sem docente', h.sala || '—', <div className="row-actions"><button className="button-quiet" onClick={() => { setEditingMeeting(h); set('offerId', String(o.id)); set('weekday', String(h.dia_semana)); set('start', h.inicio); set('end', h.fim); set('room', String(h.sala_registro_id || '')); set('meetingClass', h.turma || o.turma) }}>Editar</button><button className="button-danger" onClick={() => window.confirm('Excluir este horário?') && mutate(`/horarios/${h.id}/`, undefined, 'Horário excluído.', 'DELETE')}>Excluir</button></div>] })))

  return <div className="app-shell">
    <header className="topbar"><Brand /><nav className="topbar-nav" aria-label="Navegação principal">{VIEWS.map(([id, title]) => <button key={id} onClick={() => setActiveView(id)} className="nav-item" aria-current={activeView === id ? 'page' : undefined}>{title}</button>)}</nav><div className="topbar-status">Acesso aberto</div></header>
    <main className="page-content">
      {error && <div className="notice error" role="alert">{error}<button className="notice-close" onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}
      {notice && <div className="notice success" role="status">{notice}<button className="notice-close" onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
      <div className="filter-bar"><label>Período letivo<Select value={filters.periodo} onChange={e => setFilters(f => ({ ...f, periodo: e.target.value }))}><option value="">Todos</option>{(data.periodos || []).map(p => <option key={p.id} value={p.id}>{p.ano}/{p.semestre}</option>)}</Select></label><label>Curso<Select value={filters.curso} onChange={e => setFilters(f => ({ ...f, curso: e.target.value }))}><option value="">Todos</option>{(data.cursos || []).map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</Select></label><label>Professor<Select value={filters.professor} onChange={e => setFilters(f => ({ ...f, professor: e.target.value }))}><option value="">Todos</option>{(data.professores || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select></label><label>Disciplina<Select value={filters.disciplina} onChange={e => setFilters(f => ({ ...f, disciplina: e.target.value }))}><option value="">Todas</option>{(data.disciplinas || []).map(d => <option key={d.id} value={d.id}>{d.codigo} · {d.nome}</option>)}</Select></label><label>Unidade<Select value={filters.unidade} onChange={e => setFilters(f => ({ ...f, unidade: e.target.value }))}><option value="">Todas</option>{[...new Set((data.cursos || []).map(c => c.unidade).filter(Boolean))].map(u => <option key={u} value={u}>{u}</option>)}</Select></label><button className="button-secondary filter-submit" onClick={() => loadData(filters)}>Aplicar filtros</button></div>
      {loading && <div className="loading-line" role="status">Atualizando dados da base central…</div>}

      {activeView === 'painel' && <>
        {header('Planejamento docente', 'Visão integrada de cursos, docentes, ofertas e horários usando os mesmos registros centrais.', 'Painel acadêmico')}
        <div className="stats-grid">
          <Stat label="Professores alocados" value={indicators.professores_alocados} detail="Docentes distintos" onClick={() => setActiveView('professores')} />
          <Stat label="Cursos planejados" value={indicators.cursos_planejados} detail={`${indicators.ofertas_planejadas ?? 0} ofertas`} onClick={() => setActiveView('cursos')} />
          <Stat label="CH prevista" value={`${indicators.carga_prevista_disciplinas_h ?? 0} h`} detail="Catálogo das disciplinas" onClick={() => setActiveView('disciplinas')} />
          <Stat label="CH da oferta" value={`${indicators.carga_planejada_ofertas_h ?? 0} h`} detail="Cada oferta contabilizada uma vez" />
          <Stat label="CH atribuída" value={`${indicators.carga_docente_atribuida_h ?? 0} h`} detail="Soma das participações docentes" onClick={() => setActiveView('professores')} />
          <Stat label="CH docente por atribuir" value={`${indicators.carga_docente_pendente_h ?? 0} h`} detail="Saldo entre oferta e alocações" onClick={() => setActiveView('grade')} />
          <Stat label="Inconsistências de carga" value={indicators.inconsistencias_carga ?? 0} detail="Registros acima da CH da oferta" onClick={() => setActiveView('disciplinas')} />
          <Stat label="Conflitos" value={indicators.conflitos ?? 0} detail="Docente, turma ou sala" onClick={() => setActiveView('grade')} />
          <Stat label="Ofertas sem docente" value={indicators.ofertas_sem_docente ?? 0} detail="Pendentes de alocação" onClick={() => setActiveView('grade')} />
          <Stat label="Ofertas sem horário" value={indicators.ofertas_sem_horario ?? 0} detail="Pendentes de planejamento" onClick={() => setActiveView('grade')} />
        </div>
        {section('Distribuição por curso', 'Apropriação administrativa da CH, separada da alocação de docentes.', table(['Curso', 'CH apropriada'], (data.cursos || []).map(c => ({ id: c.id, cells: [<span className="table-primary">{c.codigo} · {c.nome}</span>, `${offers.flatMap(o => o.participacoes.filter(p => p.curso_id === c.id).map(p => p.ch_apropriada)).reduce((a, b) => a + b, 0)} h`] })), 'Nenhum curso planejado'))}
        {section('Relatório integrado', 'Exporta as ofertas, as apropriações por curso, as alocações docentes e os encontros com os filtros aplicados.', <button className="button-primary" onClick={exportReport}>Baixar CSV</button>)}
        {section('Conflitos detectados', 'Sobreposições nos dados atuais, agrupadas pelo par de registros em conflito.', table(['Tipo', 'Dia', 'Horário A', 'Registro A', 'Horário B', 'Registro B'], conflictRows, 'Nenhum conflito detectado'))}
        {data.sessao?.is_staff && section('Períodos letivos', 'Períodos centralizados para as ofertas de todos os cursos.', <><form className="form-grid three" onSubmit={e => submit(e, '/periodos/', { ano: Number(forms.periodYear), semestre: Number(forms.periodSemester), data_inicio: forms.periodStart || null, data_fim: forms.periodEnd || null, ativo: true }, 'Período letivo adicionado.', ['periodYear', 'periodStart', 'periodEnd'])}>
          <input className="field-control" type="number" min="2000" max="2200" placeholder="Ano" value={forms.periodYear} onChange={e => set('periodYear', e.target.value)} required />
          <Select value={forms.periodSemester} onChange={e => set('periodSemester', e.target.value)}><option value="1">1º semestre</option><option value="2">2º semestre</option></Select>
          <input className="field-control" type="date" aria-label="Data inicial (opcional)" value={forms.periodStart} onChange={e => set('periodStart', e.target.value)} />
          <input className="field-control" type="date" aria-label="Data final (opcional)" value={forms.periodEnd} onChange={e => set('periodEnd', e.target.value)} />
          <button className="button-primary" disabled={busy}>Adicionar período</button>
        </form><div className="tag-list">{data.periodos.map(p => <span key={p.id} className="person-chip">{p.ano}/{p.semestre}{p.ativo ? ' · ativo' : ''}{p.data_inicio && p.data_fim ? ` · ${p.data_inicio}–${p.data_fim}` : ''}</span>)}</div></>)}
      </>}

      {activeView === 'cursos' && <>
        {header('Cursos', 'Gerencie o catálogo compartilhado e acompanhe as ofertas de cada curso.', 'Estrutura acadêmica', data.cursos.length)}
        {data.sessao?.is_staff && section(editingCourse ? 'Editar curso' : 'Adicionar curso', 'Código identifica cada curso de forma única.', <form className="form-grid" onSubmit={e => submit(e, editingCourse ? `/cursos/${editingCourse.id}/` : '/cursos/', { codigo: forms.courseCode, nome: forms.courseName, unidade: forms.unit, modalidade: forms.modality, coordenador: forms.coordinatorId || null }, editingCourse ? 'Curso atualizado.' : 'Curso adicionado.', ['courseCode', 'courseName', 'unit', 'modality', 'coordinatorId']).then(ok => ok && setEditingCourse(null))}>
          <input className="field-control" placeholder="Código" value={forms.courseCode} onChange={e => set('courseCode', e.target.value)} required />
          <input className="field-control" placeholder="Nome do curso" value={forms.courseName} onChange={e => set('courseName', e.target.value)} required />
          <input className="field-control" placeholder="Unidade (opcional)" value={forms.unit} onChange={e => set('unit', e.target.value)} />
          <input className="field-control" placeholder="Modalidade (opcional)" value={forms.modality} onChange={e => set('modality', e.target.value)} />
          <Select value={forms.coordinatorId} onChange={e => set('coordinatorId', e.target.value)}><option value="">Sem coordenador</option>{data.coordenadores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select>
          <div className="form-actions"><button className="button-primary" disabled={busy}>{editingCourse ? 'Salvar alterações' : 'Adicionar curso'}</button>{editingCourse && <button type="button" className="button-secondary" onClick={() => setEditingCourse(null)}>Cancelar</button>}</div>
        </form>)}
        {section('Catálogo de cursos', 'Código único, unidade, modalidade e responsável.', table(['Código', 'Curso', 'Unidade', 'Modalidade', 'Coordenação', 'Ações'], courseRows, 'Nenhum curso cadastrado'))}
        {section('Ofertas e planejamento', 'As disciplinas, docentes e encontros vêm das ofertas compartilhadas.', table(['Código', 'Disciplina', 'Curso / turma', 'Período', 'CH prevista', 'CH oferta', 'Docentes', 'Encontros'], courseOfferRows, 'Nenhuma oferta encontrada para os filtros'))}
      </>}

      {activeView === 'professores' && <>
        {header('Professores', 'Visão global das alocações e carga atribuída no período filtrado.', 'Equipe acadêmica', data.professores.length)}
        {data.sessao?.is_staff && section('Adicionar professor', 'O nome é obrigatório; e-mail e identificação são opcionais.', <form className="form-grid three" onSubmit={e => submit(e, '/professores/', { nome: forms.professorName, email: forms.professorEmail || null, identificacao: forms.teacherId || null, vinculo: forms.teacherLink || '', ch_maxima_periodo: Number(forms.teacherLimit || 400) }, 'Professor adicionado.', ['professorName', 'professorEmail', 'teacherId', 'teacherLink'])}>
          <input className="field-control" placeholder="Nome completo" value={forms.professorName} onChange={e => set('professorName', e.target.value)} required />
          <input className="field-control" type="email" placeholder="E-mail institucional (opcional)" value={forms.professorEmail} onChange={e => set('professorEmail', e.target.value)} />
          <input className="field-control" placeholder="Identificação única (opcional)" value={forms.teacherId} onChange={e => set('teacherId', e.target.value)} />
          <input className="field-control" placeholder="Vínculo (opcional)" value={forms.teacherLink || ''} onChange={e => set('teacherLink', e.target.value)} />
          <input className="field-control" type="number" min="0" placeholder="CH máxima no período (padrão 400 h)" value={forms.teacherLimit || ''} onChange={e => set('teacherLimit', e.target.value)} />
          <button className="button-primary" disabled={busy}>Adicionar professor</button>
        </form>)}
        {section('Docentes e alocações', 'Carga atribuída soma alocações docentes distintas; não representa horas efetivamente ministradas.', table(['Professor', 'Identificação', 'Vínculo', 'E-mail', 'CH atribuída / limite', 'Disciplinas no filtro'], professorRows, 'Nenhum professor cadastrado'))}
      </>}

      {activeView === 'disciplinas' && <>
        {header('Disciplinas', 'Catálogo único reutilizado pelas ofertas de diferentes cursos.', 'Catálogo acadêmico', data.disciplinas.length)}
        {data.sessao?.is_staff && section('Adicionar disciplina', 'A carga prevista pertence ao catálogo; a carga planejada fica na oferta.', <form className="form-grid" onSubmit={e => submit(e, '/disciplinas/', { codigo: forms.subjectCode, nome: forms.subjectName, carga_horaria: Number(forms.subjectHours) }, 'Disciplina adicionada.', ['subjectCode', 'subjectName', 'subjectHours'])}>
          <input className="field-control" placeholder="Código único" value={forms.subjectCode} onChange={e => set('subjectCode', e.target.value)} required />
          <input className="field-control" placeholder="Nome da disciplina" value={forms.subjectName} onChange={e => set('subjectName', e.target.value)} required />
          <input className="field-control" type="number" min="1" placeholder="CH prevista (h)" value={forms.subjectHours} onChange={e => set('subjectHours', e.target.value)} required />
          <button className="button-primary" disabled={busy}>Adicionar disciplina</button>
        </form>)}
        {section('Catálogo de disciplinas', 'As ofertas vinculam cada disciplina ao curso, turma e período letivo.', table(['Código', 'Disciplina', 'CH prevista', 'Ofertas vinculadas'], subjectRows, 'Nenhuma disciplina cadastrada'))}
        {section('Criar oferta', 'Disciplina, período letivo, turma e curso responsável formam a chave da oferta. Para uma oferta compartilhada, registre os demais cursos abaixo.', <form className="form-grid three" onSubmit={e => submit(e, '/ofertas/', { disciplina: Number(forms.offerSubject), periodo: Number(forms.periodId), turma: forms.className, periodo_turma: forms.classPeriod, tipo: 'DISCIPLINA', carga_horaria: Number(forms.offerHours), curso_responsavel: Number(forms.responsibleCourse) }, 'Oferta criada.', ['offerSubject', 'periodId', 'classPeriod', 'offerHours'])}>
          <Select value={forms.offerSubject || ''} onChange={e => set('offerSubject', e.target.value)} required><option value="">Disciplina</option>{data.disciplinas.map(d => <option key={d.id} value={d.id}>{d.codigo} · {d.nome}</option>)}</Select>
          <Select value={forms.periodId} onChange={e => set('periodId', e.target.value)} required><option value="">Período letivo</option>{data.periodos.map(p => <option key={p.id} value={p.id}>{p.ano}/{p.semestre}</option>)}</Select>
          <Select value={forms.responsibleCourse} onChange={e => set('responsibleCourse', e.target.value)} required><option value="">Curso responsável</option>{data.cursos.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</Select>
          <input className="field-control" placeholder="Identificação da turma" value={forms.className} onChange={e => set('className', e.target.value)} required />
          <input className="field-control" placeholder="Período da turma (opcional)" value={forms.classPeriod} onChange={e => set('classPeriod', e.target.value)} />
          <input className="field-control" type="number" min="1" placeholder="CH total planejada na oferta" value={forms.offerHours} onChange={e => set('offerHours', e.target.value)} required />
          <button className="button-primary" disabled={busy}>Criar oferta</button>
        </form>)}
        {section('Compartilhar oferta com outro curso', 'A CH apropriada por curso é independente da CH docente e não pode exceder a CH da oferta.', <form className="form-grid three" onSubmit={e => submit(e, '/participacoes/', { oferta: Number(forms.offerId), curso: Number(forms.participationCourse), ch_apropriada: Number(forms.appropriationHours) }, 'Participação de curso registrada.', ['appropriationHours'])}>
          <Select value={forms.offerId} onChange={e => set('offerId', e.target.value)} required><option value="">Oferta central</option>{offers.map(o => <option key={o.id} value={o.id}>{o.codigo_disciplina} · {o.disciplina} · turma {o.turma}</option>)}</Select>
          <Select value={forms.participationCourse} onChange={e => set('participationCourse', e.target.value)} required><option value="">Curso participante</option>{data.cursos.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</Select>
          <input className="field-control" type="number" min="0" placeholder="CH apropriada ao curso (h)" value={forms.appropriationHours} onChange={e => set('appropriationHours', e.target.value)} required />
          <button className="button-primary" disabled={busy}>Registrar participação</button>
        </form>)}
      </>}

      {activeView === 'salas' && <>
        {header('Salas e laboratórios', 'Cadastro central de salas com validação de ocupação nos horários.', 'Infraestrutura', data.salas.length)}
        {data.sessao?.is_staff && section('Adicionar sala', 'O mesmo identificador de sala é usado por todos os cursos.', <form className="form-grid three" onSubmit={e => submit(e, '/salas/', { nome: forms.roomName, capacidade: forms.roomCapacity ? Number(forms.roomCapacity) : null }, 'Sala adicionada.', ['roomName', 'roomCapacity'])}>
          <input className="field-control" placeholder="Identificação da sala" value={forms.roomName} onChange={e => set('roomName', e.target.value)} required />
          <input className="field-control" type="number" min="1" placeholder="Capacidade (opcional)" value={forms.roomCapacity} onChange={e => set('roomCapacity', e.target.value)} />
          <button className="button-primary" disabled={busy}>Adicionar sala</button>
        </form>)}
        {section('Salas cadastradas', '', table(['Sala', 'Capacidade'], roomRows, 'Nenhuma sala cadastrada'))}
      </>}

      {activeView === 'grade' && <>
        {header('Grade horária', 'Encontros recorrentes no período letivo, com conflitos validados na API.', 'Planejamento integrado', scheduleRows.length)}
        {section(editingMeeting ? 'Editar horário' : 'Criar horário', 'Conflitos são validados na camada de serviço antes de salvar.', <form className="form-grid three" onSubmit={e => {
          const offer = selectedOffer()
          e.preventDefault()
          if (!offer) { setError('Selecione uma oferta.'); return }
          submit(e, editingMeeting ? `/horarios/${editingMeeting.id}/` : '/horarios/', { oferta: offer.id, dia_semana: Number(forms.weekday), hora_inicio: forms.start, hora_fim: forms.end, sala_registro: forms.room ? Number(forms.room) : null, sala: '', turma: forms.meetingClass || offer.turma }, editingMeeting ? 'Horário atualizado.' : 'Horário criado.', ['start', 'end']).then(ok => ok && setEditingMeeting(null))
        }}>
          <Select value={forms.offerId || ''} onChange={e => set('offerId', e.target.value)} required><option value="">Oferta · disciplina · turma · curso</option>{offers.map(o => <option key={o.id} value={o.id}>{o.codigo_disciplina} · {o.disciplina} · {o.turma} · {o.curso} · {o.periodo}</option>)}</Select>
          <Select value={forms.weekday} onChange={e => set('weekday', e.target.value)}>{WEEKDAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</Select>
          <input className="field-control" type="time" value={forms.start} onChange={e => set('start', e.target.value)} required />
          <input className="field-control" type="time" value={forms.end} onChange={e => set('end', e.target.value)} required />
          <Select value={forms.room} onChange={e => set('room', e.target.value)}><option value="">Sem sala</option>{data.salas.map(room => <option key={room.id} value={room.id}>{room.nome}</option>)}</Select>
          <input className="field-control" placeholder="Turma (usa turma da oferta por padrão)" value={forms.meetingClass} onChange={e => set('meetingClass', e.target.value)} />
          <div className="form-actions"><button className="button-primary" disabled={busy}>{editingMeeting ? 'Salvar horário' : 'Adicionar horário'}</button>{editingMeeting && <button type="button" className="button-secondary" onClick={() => setEditingMeeting(null)}>Cancelar</button>}</div>
        </form>)}
        {section(editingAllocation ? 'Editar alocação docente' : 'Alocar docente', 'A CH atribuída é limitada pela CH total restante da oferta e pela disponibilidade do professor.', <form className="form-grid three" onSubmit={e => {
          e.preventDefault()
          const offer = selectedOffer()
          if (!offer) { setError('Selecione uma oferta.'); return }
          submit(e, editingAllocation ? `/alocacoes/${editingAllocation.id}/` : '/alocacoes/', { oferta: offer.id, professor: Number(forms.teacherId), ch_alocada: Number(forms.allocatedHours) }, editingAllocation ? 'Alocação atualizada.' : 'Docente alocado.', ['allocatedHours']).then(ok => ok && setEditingAllocation(null))
        }}>
          <Select value={forms.offerId || ''} onChange={e => set('offerId', e.target.value)} required><option value="">Oferta</option>{offers.map(o => <option key={o.id} value={o.id}>{o.codigo_disciplina} · {o.disciplina} · turma {o.turma}</option>)}</Select>
          <Select value={forms.teacherId} onChange={e => set('teacherId', e.target.value)} required><option value="">Professor</option>{data.professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</Select>
          <input className="field-control" type="number" min="1" placeholder="CH atribuída (h)" value={forms.allocatedHours} onChange={e => set('allocatedHours', e.target.value)} required />
          <div className="form-actions"><button className="button-primary" disabled={busy}>{editingAllocation ? 'Salvar alocação' : 'Salvar alocação'}</button>{editingAllocation && <button type="button" className="button-secondary" onClick={() => setEditingAllocation(null)}>Cancelar</button>}</div>
        </form>)}
        {section('Aulas programadas', 'Professor, turma e sala são checados em intervalos sobrepostos.', table(['Dia', 'Horário', 'Disciplina', 'Curso / turma / período', 'Docentes e CH', 'Sala', 'Ações'], scheduleRows, 'Nenhuma aula programada'))}
      </>}
      <footer className="page-footer"><span>CronosAI · Dados da API central do planejamento</span><span>Alterações registradas em auditoria</span></footer>
    </main>
  </div>
}

export default App
