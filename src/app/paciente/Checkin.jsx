import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { PERGUNTAS_SEMANAL, segundaFeiraDaSemana } from '../../lib/checkinDefault.js';

const SEMANA = segundaFeiraDaSemana();
const SEMANA_BR = new Date(SEMANA + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function Checkin() {
  const { user } = useSession();
  const [checkin, setCheckin] = useState(undefined); // undefined=carregando
  const [respostas, setRespostas] = useState({});
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      const { data, error } = await supabase
        .from('checkins')
        .select('*')
        .eq('paciente_id', user.id)
        .eq('semana', SEMANA)
        .maybeSingle();
      if (error) console.error('[checkin] fetch error:', JSON.stringify(error));
      if (!active) return;
      setCheckin(data ?? null);
      if (data) setRespostas(data.respostas ?? {});
    }
    load();
    return () => { active = false; };
  }, [user]);

  async function enviar() {
    setErro(null);
    const semResposta = PERGUNTAS_SEMANAL.filter(q => {
      if (q.tipo !== 'texto') return respostas[q.id] == null;
      if (q.obrigatoria) return !respostas[q.id]?.trim();
      return false;
    });
    if (semResposta.length > 0) {
      return setErro('Responda todas as perguntas antes de enviar.');
    }
    setBusy(true);

    const { data: pacData } = await supabase
      .from('pacientes')
      .select('nutri_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!pacData?.nutri_id) {
      setBusy(false);
      return setErro('Erro ao identificar sua nutricionista.');
    }

    const { error } = await supabase.from('checkins').insert({
      paciente_id: user.id,
      nutricionista_id: pacData.nutri_id,
      semana: SEMANA,
      respostas,
    });

    setBusy(false);
    if (error) {
      console.error('[checkin] insert error:', JSON.stringify(error));
      return setErro(error.message);
    }
    setSucesso(true);
  }

  if (sucesso) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
        minHeight: 'calc(100svh - 220px)',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--green-soft, #ecfdf5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, marginBottom: 24,
          animation: 'view-in .4s cubic-bezier(.175,.885,.32,1.275)',
        }}>✨</div>
        <div className="serif" style={{ fontSize: 28, marginBottom: 8, color: 'var(--green, #10b981)' }}>
          Enviado!
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 260 }}>
          Sua nutri vai adorar saber como você está se sentindo!
        </div>
      </div>
    );
  }

  if (checkin === undefined) return null;

  const jaRespondido = !!checkin;

  return (
    <div style={{ padding: '0 16px 48px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
          Semana de {SEMANA_BR}
        </div>
        {jaRespondido && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--green, #10b981)',
            background: 'var(--green-soft, #ecfdf5)',
            padding: '5px 12px', borderRadius: 999,
          }}>
            <i className="ti ti-check" aria-hidden="true"></i>
            Check-in desta semana enviado!
          </div>
        )}
      </div>

      {PERGUNTAS_SEMANAL.map(q => {
        const valor = respostas[q.id];
        const obs = respostas[`${q.id}_obs`];

        if (q.tipo === 'texto') {
          return (
            <div key={q.id} style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5, fontWeight: 500 }}>
                {q.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 10 }}>{q.pergunta}</div>
              <textarea
                disabled={jaRespondido}
                value={valor ?? ''}
                onChange={e => setRespostas(r => ({ ...r, [q.id]: e.target.value }))}
                rows={3}
                placeholder={q.placeholder}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13,
                  border: '0.5px solid var(--border, #e2e0da)', borderRadius: 10,
                  outline: 'none', fontFamily: 'var(--font-sans)',
                  resize: 'vertical', boxSizing: 'border-box',
                  background: jaRespondido ? 'var(--bg-soft)' : 'var(--white)',
                  color: 'var(--ink)',
                }}
              />
            </div>
          );
        }

        return (
          <div key={q.id} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5, fontWeight: 500 }}>
              {q.label}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{q.pergunta}</div>

            <div style={{ display: 'flex', gap: 6 }}>
              {q.opcoes.map(o => (
                <button
                  key={o.valor}
                  disabled={jaRespondido}
                  onClick={() => setRespostas(r => ({ ...r, [q.id]: o.valor }))}
                  style={{
                    flex: 1, minWidth: 0, padding: '10px 4px',
                    borderRadius: 12,
                    border: valor === o.valor
                      ? '2px solid var(--gold-deep)'
                      : '1.5px solid var(--hair, #e2e0da)',
                    background: valor === o.valor ? 'var(--gold-soft)' : 'var(--white)',
                    cursor: jaRespondido ? 'default' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'border-color .15s, background .15s',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{o.emoji}</span>
                  <span style={{
                    fontSize: 9, lineHeight: 1.2, textAlign: 'center',
                    color: valor === o.valor ? 'var(--gold-deep)' : 'var(--muted)',
                    fontWeight: valor === o.valor ? 600 : 400,
                  }}>{o.label}</span>
                </button>
              ))}
            </div>

            {!jaRespondido && valor != null && (
              <textarea
                value={obs ?? ''}
                onChange={e => setRespostas(r => ({ ...r, [`${q.id}_obs`]: e.target.value }))}
                rows={2}
                placeholder="Comentário opcional..."
                style={{
                  marginTop: 8, width: '100%', padding: '8px 10px', fontSize: 12,
                  border: '0.5px solid var(--border, #e2e0da)', borderRadius: 8,
                  outline: 'none', fontFamily: 'var(--font-sans)',
                  resize: 'none', boxSizing: 'border-box', color: 'var(--ink)',
                  background: 'var(--bg-soft)',
                }}
              />
            )}

            {jaRespondido && obs && (
              <div style={{
                marginTop: 8, fontSize: 12, color: 'var(--ink-soft)',
                fontStyle: 'italic', padding: '6px 10px',
                background: 'var(--bg-soft)', borderRadius: 8,
              }}>
                "{obs}"
              </div>
            )}
          </div>
        );
      })}

      {!jaRespondido && (
        <div style={{ marginTop: 4 }}>
          {erro && (
            <div style={{
              background: 'var(--red-soft)', color: 'var(--red)',
              padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
            }}>{erro}</div>
          )}
          <button
            onClick={enviar}
            disabled={busy}
            style={{
              width: '100%', padding: '16px',
              background: 'var(--ink)', color: 'var(--bg-soft)',
              border: 'none', borderRadius: 14,
              fontSize: 15, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
              opacity: busy ? .6 : 1,
            }}
          >
            {busy ? 'Enviando...' : 'Enviar check-in ✨'}
          </button>
        </div>
      )}
    </div>
  );
}
