import { useCallback, useEffect, useState } from 'react'
import { allPages, api } from './api'
import './App.css'

const VIEWS = [
  ['painel', 'Visão geral'], ['cursos', 'Cursos'], ['professores', 'Professores'],
  ['disciplinas', 'Disciplinas'], ['salas', 'Salas e laboratórios'], ['grade', 'Grade horária'],
]
const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
const emptyData = { cursos: [], professores: [], disciplinas: [], periodos: [], ofertas: [], salas: [], coordenadores: [], indicadores: {} }

function Brand() {
  return <a className="brand" href="#inicio">
    <svg className="brand-mark" viewBox="0 0 56 44" aria-hidden="true" focusable="false">
      <path d="M3 39 23 14l8 25H3Z" fill="currentColor" />
      <path d="m18 39 17-31 9 31H18Z" fill="currentColor" opacity=".78" />
      <path d="m31 39 12-22 10 22H31Z" fill="currentColor" opacity=".58" />
    </svg><span>Portal do Professor</span>
  </a>
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
  const [activeView, setActiveView] = useState('painel')
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
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

  const offers = filteredOffers()
  const indicators = data.indicadores || {}
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

  return <div className="app-shell">
    <header className="topbar"><Brand /><nav className="topbar-nav" aria-label="Navegação principal">{VIEWS.map(([id, title]) => <button key={id} onClick={() => setActiveView(id)} className="nav-item" aria-current={activeView === id ? 'page' : undefined}>{title}</button>)}</nav><div className="topbar-status">Acesso público</div></header>
    <main className="page-content">
      {error && <div className="notice error" role="alert">{error}<button className="notice-close" onClick={() => setError('')} aria-label="Fechar aviso">×</button></div>}
      {notice && <div className="notice success" role="status">{notice}<button className="notice-close" onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></div>}
      {loading && <div className="loading-line" role="status">Atualizando dados da base central…</div>}

      {activeView === 'painel' && <>
        {header('Planejamento docente', 'Visão integrada de cursos, docentes, ofertas e horários usando os mesmos registros centrais.', 'Painel acadêmico')}
        <div className="stats-grid">
          <Stat label="Professores alocados" value={indicators.professores_alocados} detail="Docentes distintos" onClick={() => setActiveView('professores')} />
          <Stat label="Cursos planejados" value={indicators.cursos_planejados} detail={`${indicators.ofertas_planejadas ?? 0} ofertas`} onClick={() => setActiveView('cursos')} />
          <Stat label="CH prevista" value={`${indicators.carga_prevista_disciplinas_h ?? 0} h`} detail="Catálogo das disciplinas" onClick={() => setActiveView('disciplinas')} />
          <Stat label="Conflitos" value={indicators.conflitos ?? 0} detail="Docente, turma ou sala" onClick={() => setActiveView('grade')} />
        </div>
        {section('Relatório integrado', 'Exporta as ofertas, as apropriações por curso, as alocações docentes e os encontros.', <button className="button-primary" onClick={exportReport}>Baixar CSV</button>)}
        {section('Conflitos detectados', 'Sobreposições nos dados atuais, agrupadas pelo par de registros em conflito.', table(['Tipo', 'Dia', 'Horário A', 'Registro A', 'Horário B', 'Registro B'], conflictRows, 'Nenhum conflito detectado'))}
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
      <footer className="page-footer"><span>Portal do Professor · Dados da API central do planejamento</span><span>Alterações registradas em auditoria</span></footer>
    </main>
  </div>
}

export default App
