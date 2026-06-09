import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import {
  gerarDiasCalendario, ehMesmoDia, mesAnoExtenso, DIAS_SEMANA_CURTOS,
} from '../../lib/utils.js';

const CORES = [
  { value: '#1a5a8c', label: 'Azul' },
  { value: '#3a6b1a', label: 'Verde' },
  { value: '#854f0b', label: 'Laranja' },
  { value: '#8c1a1a', label: 'Vermelho' },
  { value: '#6b1a7a', label: 'Roxo' },
  { value: '#1a7a6b', label: 'Teal' },
  { value: '#5a4a1a', label: 'Marrom' },
  { value: '#4a4a4a', label: 'Cinza' },
];

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatarDia(d) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

export default function Calendario() {
  const { user } = useSession();
  const [eventos, setEventos] = useState(undefined);
  const [mesVisivel, setMesVisivel] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [modalEvento, setModalEvento] = useState({ open: false, evento: null, data: null });

  async function carregar() {
    if (!user) return;
    const inicio = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth(), 1).toISOString().slice(0, 10);
    const fim = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('agenda_nutri')
      .select('*')
      .eq('nutri_id', user.id)
      .gte('data', inicio)
      .lte('data', fim)
      .order('data').order('horario', { ascending: true, nullsFirst: true });
    setEventos(data ?? []);
  }

  useEffect(() => { carregar(); }, [user, mesVisivel]);

  const hoje = useMemo(() => new Date(), []);

  const eventosPorDia = useMemo(() => {
    const m = new Map();
    for (const ev of (eventos ?? [])) {
      if (!m.has(ev.data)) m.set(ev.data, []);
      m.get(ev.data).push(ev);
    }
    return m;
  }, [eventos]);

  const eventosDoDia = useMemo(() => {
    if (!diaSelecionado) return [];
    return (eventosPorDia.get(toDateKey(diaSelecionado)) ?? [])
      .slice()
      .sort((a, b) => {
        if (!a.horario && !b.horario) return 0;
        if (!a.horario) return 1;
        if (!b.horario) return -1;
        return a.horario.localeCompare(b.horario);
      });
  }, [eventosPorDia, diaSelecionado]);

  function mudarMes(delta) {
    setMesVisivel(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  function selecionarDia(d) {
    setDiaSelecionado(prev => prev && ehMesmoDia(prev, d) ? null : d);
  }

  function abrirNovo(data) {
    setModalEvento({ open: true, evento: null, data });
  }

  function abrirEditar(evento) {
    setModalEvento({ open: true, evento, data: null });
  }

  function fecharModal() {
    setModalEvento({ open: false, evento: null, data: null });
  }

  const totalEventos = (eventos ?? []).length;

  return (
    <>
      <div className="page-title">Calendário</div>
      <div className="page-sub">
        {eventos === undefined
          ? 'Carregando…'
          : `${totalEventos} evento${totalEventos === 1 ? '' : 's'} em ${mesAnoExtenso(mesVisivel)}`}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Grade mensal */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <CalendarioGrade
            mesVisivel={mesVisivel}
            diaSelecionado={diaSelecionado}
            eventosPorDia={eventosPorDia}
            hoje={hoje}
            onMudarMes={mudarMes}
            onSelecionarDia={selecionarDia}
          />
        </div>

        {/* Painel lateral do dia */}
        {diaSelecionado && (
          <PainelDia
            dia={diaSelecionado}
            eventos={eventosDoDia}
            hoje={hoje}
            onNovoEvento={() => abrirNovo(toDateKey(diaSelecionado))}
            onEditarEvento={abrirEditar}
            onFechar={() => setDiaSelecionado(null)}
          />
        )}
      </div>

      {modalEvento.open && (
        <ModalEvento
          evento={modalEvento.evento}
          dataInicial={modalEvento.data}
          nutriId={user.id}
          onClose={fecharModal}
          onSaved={async () => { fecharModal(); await carregar(); }}
        />
      )}
    </>
  );
}

/* ============================================================
   GRADE MENSAL
   ============================================================ */
function CalendarioGrade({ mesVisivel, diaSelecionado, eventosPorDia, hoje, onMudarMes, onSelecionarDia }) {
  const dias = useMemo(() => gerarDiasCalendario(mesVisivel), [mesVisivel]);

  return (
    <div className="card" style={{ padding: '16px 14px 14px' }}>
      {/* Navegação de mês */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
      }}>
        <button
          onClick={() => onMudarMes(-1)}
          style={btnNavStyle}
          aria-label="Mês anterior"
        >
          <i className="ti ti-chevron-left" aria-hidden="true"></i>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'var(--dark)', letterSpacing: .3 }}>
            {mesAnoExtenso(mesVisivel)}
          </span>
          <button
            onClick={() => onMudarMes(
              (hoje.getFullYear() - mesVisivel.getFullYear()) * 12
              + (hoje.getMonth() - mesVisivel.getMonth())
            )}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gold-deep, #a08456)', fontWeight: 500, padding: '2px 6px' }}
          >
            Hoje
          </button>
        </div>

        <button
          onClick={() => onMudarMes(1)}
          style={btnNavStyle}
          aria-label="Próximo mês"
        >
          <i className="ti ti-chevron-right" aria-hidden="true"></i>
        </button>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 3 }}>
        {DIAS_SEMANA_CURTOS.map(d => (
          <div key={d} style={{
            fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
            color: 'var(--text3)', textAlign: 'center', padding: '5px 0', fontWeight: 600,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Células dos dias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {dias.map((d, i) => {
          const key = toDateKey(d.data);
          const evs = eventosPorDia.get(key) ?? [];
          const isToday = ehMesmoDia(d.data, hoje);
          const isSelected = diaSelecionado && ehMesmoDia(d.data, diaSelecionado);

          return (
            <CelulaCalendario
              key={i}
              d={d}
              evs={evs}
              isToday={isToday}
              isSelected={isSelected}
              onClick={() => onSelecionarDia(new Date(d.data))}
            />
          );
        })}
      </div>
    </div>
  );
}

function CelulaCalendario({ d, evs, isToday, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: isSelected ? 'var(--dark)' : 'var(--white)',
        border: '0.5px solid ' + (isSelected ? 'var(--dark)' : isToday ? 'var(--gold-deep, #a08456)' : 'var(--border)'),
        borderRadius: 7,
        padding: '6px 5px 5px',
        minHeight: 88,
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        opacity: d.foraDoMes ? .32 : 1,
        fontFamily: 'var(--font-sans)',
        transition: 'background .12s, border-color .12s',
        textAlign: 'left',
        verticalAlign: 'top',
      }}
    >
      {/* Número do dia */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 4 }}>
        <span style={{
          fontSize: 13,
          fontWeight: isToday ? 700 : 400,
          width: 24, height: 24,
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isToday && !isSelected ? 'var(--gold-deep, #a08456)' : 'transparent',
          color: isToday && !isSelected
            ? 'var(--white)'
            : isSelected
              ? 'var(--white)'
              : 'var(--dark)',
        }}>
          {d.data.getDate()}
        </span>
      </div>

      {/* Chips de eventos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {evs.slice(0, 3).map((ev, ci) => (
          <span key={ci} style={{
            fontSize: 10,
            lineHeight: 1.35,
            padding: '1px 5px',
            borderRadius: 4,
            background: isSelected ? ev.cor + '44' : ev.cor + '22',
            color: isSelected ? 'var(--white)' : ev.cor,
            border: '0.5px solid ' + (isSelected ? 'rgba(255,255,255,.25)' : ev.cor + '55'),
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: '100%',
            display: 'block',
          }}>
            {ev.horario ? ev.horario.slice(0, 5) + ' ' : ''}{ev.titulo}
          </span>
        ))}
        {evs.length > 3 && (
          <span style={{
            fontSize: 10, color: isSelected ? 'rgba(255,255,255,.7)' : 'var(--text3)',
            paddingLeft: 2,
          }}>
            +{evs.length - 3} mais
          </span>
        )}
      </div>
    </button>
  );
}

/* ============================================================
   PAINEL LATERAL DO DIA
   ============================================================ */
function PainelDia({ dia, eventos, hoje, onNovoEvento, onEditarEvento, onFechar }) {
  const isHoje = ehMesmoDia(dia, hoje);

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      background: 'var(--white)',
      border: '0.5px solid var(--border)',
      borderRadius: 10,
      overflow: 'hidden',
      alignSelf: 'flex-start',
      position: 'sticky',
      top: 16,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 10px',
        background: 'var(--bg)',
        borderBottom: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--dark)',
            textTransform: 'capitalize',
          }}>
            {formatarDia(dia)}
          </div>
          {isHoje && (
            <div style={{ fontSize: 11, color: 'var(--gold-deep, #a08456)', marginTop: 2, fontWeight: 600 }}>
              Hoje
            </div>
          )}
        </div>
        <button
          onClick={onFechar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, lineHeight: 1, padding: 2 }}
          aria-label="Fechar painel"
        >
          <i className="ti ti-x" aria-hidden="true"></i>
        </button>
      </div>

      {/* Lista de eventos */}
      <div style={{ padding: '10px 12px 12px' }}>
        {eventos.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '18px 0 10px' }}>
            Nenhum evento neste dia.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {eventos.map(ev => (
              <div
                key={ev.id}
                onClick={() => onEditarEvento(ev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '8px 10px', borderRadius: 7,
                  border: '0.5px solid ' + ev.cor + '44',
                  background: ev.cor + '0e',
                  cursor: 'pointer',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = ev.cor + '22'}
                onMouseLeave={e => e.currentTarget.style.background = ev.cor + '0e'}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: ev.cor, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ev.titulo}
                  </div>
                  {ev.horario && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                      {ev.horario.slice(0, 5)}
                    </div>
                  )}
                </div>
                <i className="ti ti-pencil" style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true"></i>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn"
          onClick={onNovoEvento}
          style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
        >
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true"></i>
          Novo evento
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL ADICIONAR / EDITAR EVENTO
   ============================================================ */
function ModalEvento({ evento, dataInicial, nutriId, onClose, onSaved }) {
  const isEdit = !!evento;

  const [data, setData] = useState(evento?.data ?? dataInicial ?? '');
  const [horario, setHorario] = useState(evento?.horario?.slice(0, 5) ?? '');
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [cor, setCor] = useState(evento?.cor ?? CORES[0].value);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);

  async function salvar() {
    setErro(null);
    if (!titulo.trim()) return setErro('Informe um título ou nome da paciente.');
    if (!data) return setErro('Selecione uma data.');
    setBusy(true);
    const payload = {
      nutri_id: nutriId,
      data,
      horario: horario || null,
      titulo: titulo.trim(),
      cor,
    };
    const { error } = isEdit
      ? await supabase.from('agenda_nutri').update(payload).eq('id', evento.id)
      : await supabase.from('agenda_nutri').insert(payload);
    setBusy(false);
    if (error) return setErro(error.message);
    onSaved();
  }

  async function excluir() {
    if (!window.confirm('Excluir este evento?')) return;
    setBusy(true);
    await supabase.from('agenda_nutri').delete().eq('id', evento.id);
    setBusy(false);
    onSaved();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(28,23,18,.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white)', borderRadius: 12, padding: 22,
          width: 380, maxWidth: '92vw',
          border: '0.5px solid var(--border)',
          boxShadow: '0 8px 32px rgba(28,23,18,.12)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, marginBottom: 4 }}>
          {isEdit ? 'Editar evento' : 'Novo evento'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
          {isEdit ? 'Altere os campos e salve.' : 'Adicione um compromisso ou lembrete ao calendário.'}
        </div>

        <label className="form-lbl">Título / nome da paciente</label>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Ex: Consulta com Maria, Revisão de plano..."
          autoFocus
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="form-lbl">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label className="form-lbl">Horário (opcional)</label>
            <input type="time" value={horario} onChange={e => setHorario(e.target.value)} />
          </div>
        </div>

        <label className="form-lbl">Cor</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, marginBottom: 14 }}>
          {CORES.map(c => (
            <button
              key={c.value}
              type="button"
              title={c.label}
              onClick={() => setCor(c.value)}
              style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: c.value,
                border: cor === c.value ? `3px solid var(--dark)` : '2px solid transparent',
                outline: cor === c.value ? `1.5px solid ${c.value}` : 'none',
                outlineOffset: 1,
                cursor: 'pointer',
                transition: 'transform .1s',
                transform: cor === c.value ? 'scale(1.15)' : 'scale(1)',
              }}
              aria-label={c.label}
            />
          ))}
        </div>

        {/* Preview do chip */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '4px 10px', borderRadius: 6,
          background: cor + '22', color: cor,
          border: '0.5px solid ' + cor + '55',
          fontSize: 13, marginBottom: 16,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
          {titulo || 'Prévia do evento'}
          {horario && <span style={{ opacity: .75 }}> · {horario}</span>}
        </div>

        {erro && (
          <div style={{
            background: 'var(--red-bg)', color: 'var(--red)',
            padding: '6px 10px', borderRadius: 6, fontSize: 13, marginBottom: 10,
          }}>{erro}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn"
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={salvar}
            disabled={busy}
          >
            <i className="ti ti-check" aria-hidden="true"></i>
            {busy ? '…' : isEdit ? 'Salvar' : 'Adicionar'}
          </button>
        </div>

        {isEdit && (
          <button
            onClick={excluir}
            disabled={busy}
            style={{
              marginTop: 12, width: '100%',
              background: 'transparent', color: 'var(--red)',
              border: '0.5px solid var(--red)', borderRadius: 6,
              padding: '9px 14px', fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <i className="ti ti-trash" aria-hidden="true"></i> Excluir evento
          </button>
        )}
      </div>
    </div>
  );
}

const btnNavStyle = {
  background: 'none',
  border: '0.5px solid var(--border)',
  borderRadius: 7,
  padding: '6px 11px',
  cursor: 'pointer',
  color: 'var(--text2)',
  fontSize: 14,
  display: 'flex', alignItems: 'center',
};
