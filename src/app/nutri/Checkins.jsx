import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { PERGUNTAS_SEMANAL } from '../../lib/checkinDefault.js';

function semanaLabel(semana) {
  if (!semana) return '';
  const d = new Date(semana + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Checkins() {
  const { user } = useSession();
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('checkins')
      .select('*, pacientes(nome)')
      .eq('nutricionista_id', user.id)
      .order('created_at', { ascending: false });
    setCheckins(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`checkins-nutri-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'checkins',
        filter: `nutricionista_id=eq.${user.id}`,
      }, carregar)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user, carregar]);

  async function abrirCheckin(ck) {
    setSel(ck);
    if (!ck.lido) {
      await supabase.from('checkins').update({ lido: true }).eq('id', ck.id);
      setCheckins(prev => prev.map(c => c.id === ck.id ? { ...c, lido: true } : c));
    }
  }

  const naoLidos = checkins.filter(c => !c.lido).length;

  return (
    <>
      <div className="page-title">Check-ins</div>
      <div className="page-sub">
        {naoLidos > 0
          ? `${naoLidos} não lido${naoLidos > 1 ? 's' : ''}`
          : 'Respostas semanais das suas pacientes'}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: '32px 0', textAlign: 'center' }}>
          Carregando…
        </div>
      ) : checkins.length === 0 ? (
        <div className="empty-state">
          <i className="ti ti-clipboard-text empty-icon" aria-hidden="true"></i>
          <div className="empty-title">Nenhum check-in ainda</div>
          <div className="empty-sub">
            Quando suas pacientes enviarem o check-in semanal, as respostas aparecerão aqui.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {checkins.map(ck => {
            const nome = ck.pacientes?.nome ?? 'Paciente';
            const r = ck.respostas ?? {};
            const beOpt = PERGUNTAS_SEMANAL.find(p => p.id === 'bem_estar')
              ?.opcoes?.find(o => o.valor === r.bem_estar);
            const alOpt = PERGUNTAS_SEMANAL.find(p => p.id === 'alimentacao')
              ?.opcoes?.find(o => o.valor === r.alimentacao);
            return (
              <div
                key={ck.id}
                onClick={() => abrirCheckin(ck)}
                style={{
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--white)',
                  border: ck.lido
                    ? '0.5px solid var(--border, #e2e0da)'
                    : '1.5px solid var(--gold)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: ck.lido ? 'var(--bg-soft)' : 'var(--gold-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>
                  {beOpt?.emoji ?? '📋'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {nome.split(' ')[0]}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 999,
                      background: ck.lido ? '#10b981' : '#e05555',
                      color: '#fff',
                    }}>
                      {ck.lido ? 'Lido' : 'Não lido'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Semana de {semanaLabel(ck.semana)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 3 }}>
                    {[beOpt?.emoji, alOpt?.emoji].filter(Boolean).join('  ')}
                    {r.livre && (
                      <span style={{ fontStyle: 'italic', marginLeft: beOpt ? 6 : 0 }}>
                        "{String(r.livre).slice(0, 50)}{r.livre.length > 50 ? '…' : ''}"
                      </span>
                    )}
                  </div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true"></i>
              </div>
            );
          })}
        </div>
      )}

      {sel && <ModalResposta ck={sel} onClose={() => setSel(null)} />}
    </>
  );
}

function ModalResposta({ ck, onClose }) {
  const nome = ck.pacientes?.nome ?? 'Paciente';
  const r = ck.respostas ?? {};

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(28,23,18,.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto',
        padding: 'max(24px, calc(env(safe-area-inset-top, 0px) + 24px)) 16px 32px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--white)', borderRadius: 20,
          width: '100%', maxWidth: 540,
          padding: '24px 20px', flexShrink: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{
              fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase',
              color: 'var(--muted)', marginBottom: 4,
            }}>Check-in semanal</div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.1 }}>{nome}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              Semana de {semanaLabel(ck.semana)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--muted)', padding: 4,
            }}
          >
            <i className="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {PERGUNTAS_SEMANAL.map(q => {
            const valor = r[q.id];
            const obs = r[`${q.id}_obs`];

            if (q.tipo === 'texto') {
              return (
                <div key={q.id}>
                  <div style={{
                    fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                    color: 'var(--muted)', marginBottom: 4, fontWeight: 500,
                  }}>{q.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 6 }}>{q.pergunta}</div>
                  <div style={{
                    fontSize: 13, lineHeight: 1.55,
                    padding: '10px 12px', background: 'var(--bg-soft)', borderRadius: 8,
                    color: valor ? 'var(--ink)' : 'var(--muted)',
                    fontStyle: valor ? 'normal' : 'italic',
                  }}>
                    {valor || 'Sem resposta'}
                  </div>
                </div>
              );
            }

            const opt = q.opcoes?.find(o => o.valor === valor);
            return (
              <div key={q.id}>
                <div style={{
                  fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                  color: 'var(--muted)', marginBottom: 4, fontWeight: 500,
                }}>{q.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 10 }}>{q.pergunta}</div>
                <div style={{ display: 'flex', gap: 5 }}>
                  {q.opcoes?.map(o => (
                    <div key={o.valor} style={{
                      flex: 1, padding: '8px 4px', borderRadius: 10, textAlign: 'center',
                      background: valor === o.valor ? 'var(--gold-soft)' : 'var(--bg-soft)',
                      border: valor === o.valor
                        ? '1.5px solid var(--gold-deep)'
                        : '1px solid transparent',
                    }}>
                      <div style={{ fontSize: 20 }}>{o.emoji}</div>
                      <div style={{
                        fontSize: 9, marginTop: 2,
                        color: valor === o.valor ? 'var(--gold-deep)' : 'var(--muted)',
                        fontWeight: valor === o.valor ? 600 : 400,
                      }}>{o.label}</div>
                    </div>
                  ))}
                </div>
                {opt && (
                  <div style={{
                    marginTop: 6, fontSize: 12, fontWeight: 500,
                    color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>{opt.emoji}</span> {opt.label}
                  </div>
                )}
                {obs && (
                  <div style={{
                    marginTop: 6, fontSize: 12, fontStyle: 'italic',
                    color: 'var(--ink-soft)', padding: '6px 10px',
                    background: 'var(--bg-soft)', borderRadius: 8,
                  }}>
                    "{obs}"
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 24, width: '100%', padding: '12px',
            background: 'var(--ink)', color: 'var(--bg-soft)',
            border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
