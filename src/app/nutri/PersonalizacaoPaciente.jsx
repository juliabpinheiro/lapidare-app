import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

const DEFAULTS = {
  pac_bg:   '#f0ebe3',
  pac_card: '#ffffff',
  pac_btn:  '#1c1712',
  pac_text: '#000000',
};

const PRESETS = [
  { label: 'Lapidare',    pac_bg: '#f0ebe3', pac_card: '#ffffff', pac_btn: '#1c1712', pac_text: '#000000' },
  { label: 'Rosa nude',   pac_bg: '#f9f0ee', pac_card: '#ffffff', pac_btn: '#8b3a52', pac_text: '#2a1a1f' },
  { label: 'Verde sage',  pac_bg: '#eef2ec', pac_card: '#ffffff', pac_btn: '#2d5a27', pac_text: '#1a2e18' },
  { label: 'Lavanda',     pac_bg: '#f0edf8', pac_card: '#ffffff', pac_btn: '#5b3d9e', pac_text: '#1e1630' },
  { label: 'Dark mode',   pac_bg: '#1a1a1a', pac_card: '#2a2a2a', pac_btn: '#c9a96e', pac_text: '#f0ebe3' },
  { label: 'Azul polar',  pac_bg: '#eef4fb', pac_card: '#ffffff', pac_btn: '#1a4a80', pac_text: '#0d2040' },
];

export default function PersonalizacaoPaciente() {
  const { user } = useSession();
  const [tema, setTema] = useState({ ...DEFAULTS });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('configuracoes').select('tema').eq('nutri_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.tema) setTema(prev => ({ ...prev, ...data.tema }));
      });
  }, [user?.id]);

  const set = (k, v) => { setTema(prev => ({ ...prev, [k]: v })); setFeedback(null); };

  async function salvar() {
    setBusy(true);
    setFeedback(null);
    const { error } = await supabase.from('configuracoes').upsert(
      { nutri_id: user.id, tema, updated_at: new Date().toISOString() },
      { onConflict: 'nutri_id' }
    );
    setBusy(false);
    if (error) {
      if (error.code === '42P01') {
        return setFeedback({ tipo: 'erro', msg: 'Tabela configuracoes não existe — rode o SQL de migração no Supabase.' });
      }
      return setFeedback({ tipo: 'erro', msg: error.message });
    }
    setFeedback({ tipo: 'ok', msg: 'Cores salvas! As pacientes verão ao recarregar o app.' });
  }

  async function resetar() {
    setTema({ ...DEFAULTS });
    setFeedback(null);
  }

  const campos = [
    { key: 'pac_bg',   label: 'Fundo do app',     hint: 'Cor de fundo das telas' },
    { key: 'pac_card', label: 'Cards e painéis',   hint: 'Cor de fundo dos cartões' },
    { key: 'pac_btn',  label: 'Botões principais', hint: 'Cor dos botões e destaques' },
    { key: 'pac_text', label: 'Letras',            hint: 'Cor do texto principal' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-title">Personalização do App da Paciente</div>
        <div className="page-sub">
          Escolha as cores que suas pacientes vão ver. Afeta fundo, cards, botões e texto.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Presets */}
          <div className="card">
            <div className="card-header"><div className="card-title">Paletas prontas</div></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => { setTema({ ...tema, ...p }); setFeedback(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                      border: '1.5px solid var(--border)',
                      background: p.pac_bg, fontSize: 12,
                      color: p.pac_text, fontWeight: 500,
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.pac_btn, flexShrink: 0 }} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Seletores de cor */}
          <div className="card">
            <div className="card-header"><div className="card-title">Cores personalizadas</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {campos.map(({ key, label, hint }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: tema[key],
                      border: '2px solid var(--border)',
                      boxShadow: '0 1px 4px rgba(0,0,0,.12)',
                      cursor: 'pointer',
                    }} onClick={() => document.getElementById(`picker-${key}`).click()} />
                    <input
                      id={`picker-${key}`}
                      type="color"
                      value={tema[key]}
                      onChange={e => set(key, e.target.value)}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{hint}</div>
                  </div>
                  <input
                    type="text"
                    value={tema[key]}
                    onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) set(key, e.target.value); }}
                    style={{ width: 90, fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn" onClick={salvar} disabled={busy}>
              <i className="ti ti-device-floppy" aria-hidden="true"></i>
              {busy ? 'Salvando…' : 'Salvar cores'}
            </button>
            <button className="btn-outline" onClick={resetar}>
              <i className="ti ti-refresh" aria-hidden="true"></i> Resetar padrão
            </button>
          </div>

          {feedback && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: feedback.tipo === 'ok' ? 'var(--green-bg, #e6f0d4)' : 'var(--red-bg, #fbeaf0)',
              color: feedback.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
            }}>
              <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`} style={{ marginRight: 6 }} />
              {feedback.msg}
            </div>
          )}
        </div>

        {/* Preview */}
        <div style={{ position: 'sticky', top: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Preview — como a paciente vai ver
          </div>
          <div style={{
            background: tema.pac_bg, borderRadius: 16,
            padding: 16, boxShadow: '0 4px 20px rgba(0,0,0,.15)',
            border: '1px solid rgba(0,0,0,.06)',
            fontFamily: 'var(--font-sans)',
          }}>
            {/* Fake top bar */}
            <div style={{
              background: tema.pac_btn, borderRadius: 10, padding: '10px 14px',
              marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>Meu Plano</div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.25)' }} />
            </div>

            {/* Fake card macros */}
            <div style={{
              background: tema.pac_card, borderRadius: 10, padding: 12,
              marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            }}>
              <div style={{ fontSize: 10, color: tema.pac_text, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Macros do dia</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {['Proteína\n120g', 'Carbo\n150g', 'Gordura\n50g'].map((m, i) => (
                  <div key={i} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: tema.pac_btn }}>{m.split('\n')[1]}</div>
                    <div style={{ fontSize: 9, color: tema.pac_text, opacity: 0.6 }}>{m.split('\n')[0]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fake refeição card */}
            <div style={{
              background: tema.pac_card, borderRadius: 10, padding: 12,
              marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: tema.pac_text, marginBottom: 4 }}>🌅 Café da manhã</div>
              <div style={{ fontSize: 11, color: tema.pac_text, opacity: 0.6, marginBottom: 8 }}>08:00 · 384 kcal</div>
              {['Pão integral — 2 fatias', 'Ovo mexido — 1½ unidade', 'Mamão papaia — 130g'].map((item, i) => (
                <div key={i} style={{
                  fontSize: 11, color: tema.pac_text, padding: '4px 0',
                  borderBottom: i < 2 ? `1px solid ${tema.pac_bg}` : 'none',
                }}>{item}</div>
              ))}
            </div>

            {/* Fake button */}
            <button style={{
              width: '100%', background: tema.pac_btn, color: '#fff',
              border: 'none', borderRadius: 10, padding: '10px 0',
              fontSize: 12, fontWeight: 600, cursor: 'default',
            }}>
              Baixar Plano em PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
