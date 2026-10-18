import { useCallback, useEffect, useState } from 'react'
import { allPages, api } from './api'
import './App.css'

const VIEWS = [
  ['painel', 'Visão geral'], ['cursos', 'Cursos'], ['professores', 'Professores'],
  ['disciplinas', 'Disciplinas'], ['salas', 'Salas e laboratórios'], ['grade', 'Grade horária'],
]
const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const emptyData = { cursos: [], professores: [], disciplinas: [], periodos: [], ofertas: [], salas: [], coordenadores: [], indicadores: {} }
const demoIndicators = { professors: 3, courses: 5, predictedHours: 6, conflicts: 0 }

function Brand() {
  return <a className="brand" href="#inicio">
    <svg className="brand-mark" viewBox="0 0 56 44" aria-hidden="true" focusable="false">
      <path d="M3 39 23 14l8 25H3Z" fill="currentColor" />
      <path d="m18 39 17-31 9 31H18Z" fill="currentColor" opacity=".78" />
      <path d="m31 39 12-22 10 22H31Z" fill="currentColor" opacity=".58" />
    </svg><span>CareShield</span>
  </a>
}

function Select({ value, onChange, children, ...props }) {
  return <select className="field-control" value={value} onChange={onChange} {...props}>{children}</select>
}

function Stat({ label, value, detail }) {
  return <div className="stat-card">
    <span>{label}</span><strong>{value ?? '—'}</strong>{detail && <small>{detail}</small>}
  </div>
}

function App() {
  const [activeView, setActiveView] = useState('inicio')
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [assistantMessages, setAssistantMessages] = useState([
    { role: 'assistant', content: 'Olá! Posso analisar os horários cadastrados e sugerir maneiras de organizar sua grade. O que você gostaria de ajustar?' },
  ])
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantError, setAssistantError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [editingMeeting, setEditingMeeting] = useState(null)
  const [editingAllocation, setEditingAllocation] = useState(null)
  const [forms, setForms] = useState({ courseName: '', courseCode: '', unit: '', modality: '', coordinatorId: '', teacherLink: '', teacherLimit: '', professorName: '', professorEmail: '', teacherId: '', subjectId: '', subjectCode: '', subjectName: '', subjectHours: '', periodId: '', className: 'A', classPeriod: '', offerHours: '', responsibleCourse: '', participationCourse: '', appropriationHours: '', roomName: '', roomCapacity: '', room: '', weekday: '0', start: '', end: '', allocatedHours: '', meetingClass: '', offerId: '', offerSubject: '' })
  const set = (name, value) => setForms(current => ({ ...current, [name]: value }))

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dashboard, rooms, coordinators] = await Promise.all([
        api('/painel/'),
        allPages('/salas/'),
        allPages('/coordenadores/'),
      ])
      setData({ ...dashboard, salas: rooms, coordenadores: coordinators })
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const pageContent = document.querySelector('.page-content')
    if (!pageContent) return undefined

    const targets = '.page-header, .section-card, .stats-grid, .stat-card, .form-grid > *, .table-wrap, .home-hero, .home-preview-window, .home-preview-summary > div, .home-ai-section, .home-ai-preview, .home-feature-card, .home-step, .home-final-cta, .assistant-phone'
    if (!('IntersectionObserver' in window)) {
      pageContent.querySelectorAll(targets).forEach(element => element.classList.add('scroll-reveal-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.add('scroll-reveal-observed')
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-reveal-visible')
        } else {
          entry.target.classList.remove('scroll-reveal-visible')
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -32px 0px' })
    const observeTargets = () => {
      pageContent.querySelectorAll(`${targets}:not(.scroll-reveal-observed)`).forEach(element => {
        element.classList.add('scroll-reveal')
        observer.observe(element)
      })
    }
    const mutationObserver = new MutationObserver(records => {
      records.forEach(record => record.removedNodes.forEach(node => {
        if (node instanceof Element) {
          const removedTargets = []
          if (node.matches(targets)) removedTargets.push(node)
          removedTargets.push(...node.querySelectorAll(targets))
          removedTargets.forEach(element => {
            observer.unobserve(element)
            element.classList.remove('scroll-reveal', 'scroll-reveal-observed', 'scroll-reveal-visible')
          })
        }
      }))
      observeTargets()
    })

    observeTargets()
    mutationObserver.observe(pageContent, { childList: true, subtree: true })
    return () => {
      mutationObserver.disconnect()
      observer.disconnect()
    }
  }, [])

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

  async function sendAssistantMessage(event) {
    event.preventDefault()
    const message = assistantInput.trim()
    if (!message || assistantBusy) return

    const history = assistantMessages.slice(-8)
    setAssistantMessages(current => [...current, { role: 'user', content: message }])
    setAssistantInput('')
    setAssistantError('')
    setAssistantBusy(true)
    try {
      const response = await api('/assistente-grade/', { method: 'POST', body: { message, history } })
      if (!response?.reply) throw new Error('O serviço de IA retornou uma resposta vazia.')
      setAssistantMessages(current => [...current, { role: 'assistant', content: response.reply }])
    } catch (e) {
      setAssistantError(e.message)
    } finally {
      setAssistantBusy(false)
    }
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

  const offers = filteredOffers()
  const conflictRows = (data.conflitos_detectados || []).map((c, i) => ({ id: i, cells: [c.motivos.join(', '), c.dia, c.horario_a, c.oferta_a, c.horario_b, c.oferta_b] }))
  const courseRows = (data.cursos || []).map(c => ({ id: c.id, cells: [<span className="code-label">{c.codigo}</span>, <span className="table-primary">{c.nome}</span>, c.unidade || '—', c.modalidade || '—', c.coordenador__username || '—', <button className="button-quiet" onClick={() => { setEditingCourse(c); set('courseCode', c.codigo); set('courseName', c.nome); set('unit', c.unidade || ''); set('modality', c.modalidade || ''); set('coordinatorId', String(c.coordenador_id || '')) }}>Editar</button>] }))
  const professorRows = (data.professores || []).map(p => {
    const allocations = offers.flatMap(o => o.alocacoes.filter(a => a.professor_id === p.id).map(a => ({ o, a })))
    const total = allocations.reduce((sum, entry) => sum + entry.a.ch_alocada, 0)
    return { id: p.id, cells: [<span className="table-primary">{p.nome}</span>, p.identificacao || '—', p.vinculo || '—', p.email, `${total} h / ${p.ch_maxima_periodo} h`, allocations.length ? <div className="tag-list">{allocations.map(({ o, a }) => <button key={a.id} className="person-chip chip-action" onClick={() => { setActiveView('grade'); setEditingAllocation(a); set('offerId', String(o.id)); set('teacherId', String(p.id)); set('allocatedHours', String(a.ch_alocada)) }}>{o.disciplina} · {a.ch_alocada} h · editar</button>)}</div> : 'Sem alocações'] }
  })
  const subjectRows = (data.disciplinas || []).map(d => {
    const list = offers.filter(o => o.disciplina_id === d.id)
    return { id: d.id, cells: [<span className="code-label">{d.codigo}</span>, <span className="table-primary">{d.nome}</span>, `${d.carga_horaria} h`, list.map(o => `${o.curso} · turma ${o.turma} · ${o.periodo}`).join('; ') || 'Sem ofertas'] }
  })
  const courseOfferRows = offers.map(o => ({ id: o.id, cells: [<span className="code-label">{o.codigo_disciplina}</span>, <span className="table-primary">{o.disciplina}</span>, `${o.curso} · turma ${o.turma}`, o.periodo, `${o.carga_prevista} h`, `${o.carga_oferta} h`, o.alocacoes.map(a => `${a.professor__nome}: ${a.ch_alocada} h`).join(', ') || 'Pendente', o.horarios.map(h => `${h.dia} ${h.inicio}–${h.fim} · ${h.sala || 'sem sala'}`).join('; ') || 'Pendente'] }))
  const roomRows = (data.salas || []).map(room => ({ id: room.id, cells: [<span className="table-primary">{room.nome}</span>, room.capacidade ?? 'Não informada'] }))
  const scheduleRows = offers.flatMap(o => o.horarios.map(h => ({ id: h.id, cells: [WEEKDAYS[h.dia_semana] || h.dia, `${h.inicio}–${h.fim}`, <><span className="table-primary">{o.disciplina}</span><span className="table-secondary">{o.codigo_disciplina} · {o.carga_oferta} h na oferta</span></>, `${o.curso} · turma ${h.turma || o.turma} · ${o.periodo}`, o.alocacoes.map(a => `${a.professor__nome} (${a.ch_alocada} h)`).join(', ') || 'Sem docente', h.sala || '—', <div className="row-actions"><button className="button-quiet" onClick={() => { setEditingMeeting(h); set('offerId', String(o.id)); set('weekday', String(h.dia_semana)); set('start', h.inicio); set('end', h.fim); set('room', String(h.sala_registro_id || '')); set('meetingClass', h.turma || o.turma) }}>Editar</button><button className="button-danger" onClick={() => window.confirm('Excluir este horário?') && mutate(`/horarios/${h.id}/`, undefined, 'Horário excluído.', 'DELETE')}>Excluir</button></div>] })))

  return <div className="app-shell" id="inicio">
    <header className="topbar"><Brand /><nav className="topbar-nav" aria-label="Navegação principal"><button className="nav-item" onClick={() => setActiveView('inicio')} aria-current={activeView === 'inicio' ? 'page' : undefined}>Início</button>{VIEWS.map(([id, title]) => <button key={id} onClick={() => setActiveView(id)} className="nav-item" aria-current={activeView === id ? 'page' : undefined}>{title}</button>)}</nav><div className="topbar-status">Acesso público</div></header>
    <main className="page-content">
      {error && <div className="notice error" role="alert">{error}<button className="notice-close" onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}
      {notice && <div className="notice success" role="status">{notice}<button className="notice-close" onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
      {loading && <div className="loading-line" role="status">Atualizando dados da base central…</div>}

      {activeView === 'inicio' && <>
        <div className="home-page">
          <section className="home-hero">
            <div className="home-hero-copy">
              <p className="home-kicker">CARESHIELD</p>
              <h1>Sua grade horária<br /><span>resolvida em um bate-papo.</span></h1>
              <p className="home-hero-description">Cursos, professores, disciplinas e horários reunidos em um só lugar para facilitar a organização acadêmica da sua instituição.</p>
              <button className="button-primary home-hero-button" onClick={() => setActiveView('painel')}>Como funciona</button>
            </div>
            <div className="home-hero-visual" aria-label="Prévia ilustrativa do planejamento acadêmico">
              <div className="home-preview-window">
                <div className="home-preview-top"><span className="home-preview-brand"><span aria-hidden="true">◆</span> Planejamento acadêmico</span><span className="home-preview-status">VISÃO DA SEMANA</span></div>
                <div className="home-preview-summary">
                  <div><small>Cursos</small><strong>{String(demoIndicators.courses).padStart(2, '0')}</strong></div>
                  <div><small>Professores</small><strong>{String(demoIndicators.professors).padStart(2, '0')}</strong></div>
                  <div><small>CH prevista</small><strong>{demoIndicators.predictedHours} h</strong></div>
                  <div><small>Conflitos</small><strong>{demoIndicators.conflicts}</strong></div>
                </div>
                <div className="home-preview-schedule">
                  <div className="home-preview-day"><span>SEG</span><i /><i className="schedule-blue" /><i /><i className="schedule-lilac" /></div>
                  <div className="home-preview-day"><span>TER</span><i className="schedule-lilac" /><i /><i className="schedule-blue" /><i /></div>
                  <div className="home-preview-day"><span>QUA</span><i /><i className="schedule-blue" /><i className="schedule-lilac" /><i /></div>
                  <div className="home-preview-day"><span>QUI</span><i className="schedule-blue" /><i /><i /><i className="schedule-lilac" /></div>
                  <div className="home-preview-day"><span>SEX</span><i /><i className="schedule-lilac" /><i className="schedule-blue" /><i /></div>
                </div>
                <div className="home-preview-caption"><span className="preview-dot" /> Prévia demonstrativa · números fictícios</div>
              </div>
              <div className="home-assistant-note"><span className="assistant-spark" aria-hidden="true">✦</span><span><strong>Planejamento mais claro</strong><small>Informações organizadas em um só lugar</small></span></div>
            </div>
          </section>

          <section className="home-features" aria-labelledby="home-features-title">
            <div className="home-section-heading"><p className="home-kicker">RECURSOS</p><h2 id="home-features-title">Tudo conectado, de forma simples.</h2><p>Consulte os dados acadêmicos e acompanhe o planejamento com mais clareza.</p></div>
            <div className="home-feature-grid">
              <article className="home-feature-card"><span className="home-feature-icon" aria-hidden="true">▦</span><span className="home-feature-number">01</span><h3>Visão integrada</h3><p>Acompanhe cursos, professores, disciplinas e ofertas usando os mesmos registros centrais.</p></article>
              <article className="home-feature-card"><span className="home-feature-icon" aria-hidden="true">◷</span><span className="home-feature-number">02</span><h3>Grade horária</h3><p>Consulte horários, docentes e salas para entender como as aulas estão organizadas.</p></article>
              <article className="home-feature-card"><span className="home-feature-icon" aria-hidden="true">◇</span><span className="home-feature-number">03</span><h3>Conflitos em destaque</h3><p>Identifique possíveis sobreposições de docentes, turmas ou salas no planejamento.</p></article>
              <article className="home-feature-card"><span className="home-feature-icon" aria-hidden="true">✦</span><span className="home-feature-number">04</span><h3>Pronto para evoluir</h3><p>A estrutura centralizada abre espaço para aprimoramentos futuros, sempre com revisão da equipe.</p></article>
            </div>
            <p className="home-future-note">Peça sugestões para organizar a grade no assistente disponível na visão geral.</p>
          </section>

          <section className="home-ai-section" aria-labelledby="home-ai-title">
            <div className="home-ai-copy">
              <p className="home-kicker">INTELIGÊNCIA ARTIFICIAL</p>
              <h2 id="home-ai-title">Use IA para tornar seu planejamento mais inteligente.</h2>
              <p>Converse com o assistente para analisar a grade cadastrada, encontrar conflitos e receber sugestões práticas para organizar os horários.</p>
            </div>
            <div className="home-ai-preview" aria-label="Exemplo de conversa com o assistente acadêmico">
              <div className="home-ai-header">
                <span className="assistant-avatar" aria-hidden="true">✦</span>
                <span><strong>Assistente acadêmico</strong><small><i /> Recomendações locais</small></span>
                <span className="home-ai-label">EXEMPLO</span>
              </div>
              <div className="home-ai-messages">
                <div className="home-ai-bubble user"><span>Você</span><p>Como posso organizar melhor minha grade desta semana?</p></div>
                <div className="home-ai-bubble assistant"><span><span className="assistant-spark" aria-hidden="true">✦</span> Assistente</span><p>Posso ajudar! Vou considerar os horários cadastrados, identificar conflitos e sugerir uma distribuição mais equilibrada para sua semana.</p></div>
              </div>
              <p className="home-ai-disclaimer">Sugestões automáticas. Você decide o que aplicar.</p>
            </div>
          </section>

          <section className="home-how" aria-labelledby="home-how-title">
            <div className="home-section-heading"><p className="home-kicker">COMO FUNCIONA</p><h2 id="home-how-title">Do planejamento ao resultado.</h2><p>Encontre as informações e acompanhe o planejamento em poucos passos.</p></div>
            <div className="home-steps">
              <article className="home-step"><span>01</span><div><h3>Consulte a estrutura</h3><p>Veja cursos, professores, disciplinas e salas cadastrados.</p></div></article>
              <article className="home-step"><span>02</span><div><h3>Acompanhe os horários</h3><p>Explore a grade e confira como as ofertas estão distribuídas.</p></div></article>
              <article className="home-step"><span>03</span><div><h3>Veja o panorama</h3><p>Abra a visão geral para acompanhar indicadores e conflitos.</p></div></article>
            </div>
          </section>

          <section className="home-final-cta">
            <div><p className="home-kicker">PORTAL DO PROFESSOR</p><h2>Seu planejamento, em perspectiva.</h2><p>Acesse a visão geral dos dados acadêmicos da instituição.</p></div>
            <span className="button-primary contact-button" aria-label="Fale conosco">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.4-4.7A8.5 8.5 0 1 1 20.5 11.7Z" /><path d="M8.1 8.4c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.2-.2.3-.1.5.5.9 1.2 1.6 2.1 2.1.2.1.4 0 .5-.1l.7-.8c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5 0 .3-.2 1.1-.7 1.5-.5.5-1.2.7-1.9.6-.7-.1-1.6-.4-2.7-1.1-1.4-.9-2.4-2.1-2.8-2.8-.4-.7-.8-1.7-.8-2.4 0-.8.4-1.4.7-1.6Z" /></svg>
              Fale conosco
            </span>
          </section>
        </div>
      </>}

      {activeView === 'painel' && <>
        <div className="overview-page">
          {header('Painel Acadêmico', 'Demonstração com números fictícios, sem relação com os registros reais da base.', 'Visão geral')}
          <div className="stats-grid">
            <Stat label="Professores alocados" value={demoIndicators.professors} detail="Número fictício" />
            <Stat label="Cursos planejados" value={demoIndicators.courses} detail="Número fictício" />
            <Stat label="CH prevista" value={`${demoIndicators.predictedHours} h`} detail="Valor fictício" />
            <Stat label="Conflitos" value={demoIndicators.conflicts} detail="Exemplo sem conflitos" />
          </div>
          {section('Assistente de grade', 'Receba recomendações automáticas com base nos horários cadastrados.', <div className="assistant-chat">
            <div className="assistant-chat-info">
              <span className="assistant-avatar" aria-hidden="true">✦</span>
              <h3>Organize sua semana</h3>
              <p>Consulte conflitos, dias sem encontros e a distribuição semanal da grade.</p>
              <p className="assistant-privacy-note">Este assistente funciona sem API externa: suas mensagens e os dados da grade não saem do sistema. Ele não altera nem salva horários.</p>
            </div>
            <div className="assistant-phone">
              <div className="assistant-phone-header">
                <span className="assistant-avatar" aria-hidden="true">✦</span>
                <span><strong>Assistente acadêmico</strong><small><i /> Recomendações locais</small></span>
              </div>
              <div className="assistant-chat-history" aria-live="polite" aria-label="Conversa com o assistente">
                {assistantMessages.map((entry, index) => <div className={`assistant-message ${entry.role}`} key={`${index}-${entry.role}`}><span>{entry.role === 'assistant' ? 'Assistente' : 'Você'}</span><p>{entry.content}</p></div>)}
                {assistantBusy && <div className="assistant-message assistant"><span>Assistente</span><p>Preparando uma sugestão…</p></div>}
              </div>
              {assistantError && <p className="assistant-error" role="alert">{assistantError}</p>}
              <form className="assistant-chat-form" onSubmit={sendAssistantMessage}>
                <textarea className="field-control" rows="2" maxLength="1000" placeholder="Escreva sua mensagem..." value={assistantInput} onChange={event => setAssistantInput(event.target.value)} aria-label="Mensagem para o assistente" />
                <button className="button-primary" disabled={assistantBusy || !assistantInput.trim()} aria-label={assistantBusy ? 'Aguarde a resposta' : 'Enviar mensagem'}>{assistantBusy ? '…' : '↑'}</button>
              </form>
              <p className="assistant-phone-disclaimer">Sugestões automáticas. Confira antes de alterar.</p>
            </div>
          </div>, 'assistant-section')}
          {section('Relatório integrado', 'Exporta as ofertas, as apropriações por curso, as alocações docentes e os encontros.', <button className="button-primary" onClick={exportReport}>Baixar CSV</button>)}
          {section('Conflitos detectados', 'Sobreposições nos dados atuais, agrupadas pelo par de registros em conflito.', table(['Tipo', 'Dia', 'Horário A', 'Registro A', 'Horário B', 'Registro B'], conflictRows, 'Nenhum conflito detectado'))}
        </div>
      </>}

      {activeView === 'cursos' && <>
        {header('Cursos', 'Gerencie o catálogo compartilhado e acompanhe as ofertas de cada curso.', 'Estrutura acadêmica', data.cursos.length)}
        {section(editingCourse ? 'Editar curso' : 'Adicionar curso', 'Código identifica cada curso de forma única.', <form className="form-grid" onSubmit={e => submit(e, editingCourse ? `/cursos/${editingCourse.id}/` : '/cursos/', { codigo: forms.courseCode, nome: forms.courseName, unidade: forms.unit, modalidade: forms.modality, coordenador: forms.coordinatorId || null }, editingCourse ? 'Curso atualizado.' : 'Curso adicionado.', ['courseCode', 'courseName', 'unit', 'modality', 'coordinatorId']).then(ok => ok && setEditingCourse(null))}>
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
        {section('Adicionar professor', 'O nome é obrigatório; e-mail e identificação são opcionais.', <form className="form-grid three" onSubmit={e => submit(e, '/professores/', { nome: forms.professorName, email: forms.professorEmail || null, identificacao: forms.teacherId || null, vinculo: forms.teacherLink || '', ch_maxima_periodo: Number(forms.teacherLimit || 400) }, 'Professor adicionado.', ['professorName', 'professorEmail', 'teacherId', 'teacherLink'])}>
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
        {section('Adicionar disciplina', 'A carga prevista pertence ao catálogo; a carga planejada fica na oferta.', <form className="form-grid" onSubmit={e => submit(e, '/disciplinas/', { codigo: forms.subjectCode, nome: forms.subjectName, carga_horaria: Number(forms.subjectHours) }, 'Disciplina adicionada.', ['subjectCode', 'subjectName', 'subjectHours'])}>
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
        {section('Adicionar sala', 'O mesmo identificador de sala é usado por todos os cursos.', <form className="form-grid three" onSubmit={e => submit(e, '/salas/', { nome: forms.roomName, capacidade: forms.roomCapacity ? Number(forms.roomCapacity) : null }, 'Sala adicionada.', ['roomName', 'roomCapacity'])}>
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
      <footer className="page-footer"><span>CareShield · Dados da API central do planejamento</span><span>Alterações registradas em auditoria</span></footer>
    </main>
  </div>
}

export default App
