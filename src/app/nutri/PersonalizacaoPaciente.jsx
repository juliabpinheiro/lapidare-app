import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

const DEFAULTS = {
  pac_bg:              '#f0ebe3',
  pac_card:            '#ffffff',
  pac_btn:             '#1c1712',
  pac_text:            '#000000',
  pac_tabbar:          '#ffffff',
  pac_tabbar_txt:      '#2c2420',
  pac_header_ref:      '#1c1712',
  pac_header_ref_txt:  '#f0ebe3',
  pac_macro:           '#a08456',
  pac_titulo:          '#8a7a6e',
  pac_hero:       '#1c1712',
  pac_btn_plano:       '#c9a96e',
  pac_avatar:          '#c9a96e',
};

const PRESETS = [
  { label: 'Lapidare',
    pac_bg: '#f0ebe3', pac_card: '#ffffff', pac_btn: '#1c1712', pac_text: '#000000',
    pac_tabbar: '#ffffff', pac_tabbar_txt: '#2c2420',
    pac_header_ref: '#1c1712', pac_header_ref_txt: '#f0ebe3',
    pac_macro: '#a08456', pac_titulo: '#8a7a6e',
    pac_hero: '#1c1712', pac_btn_plano: '#c9a96e', pac_avatar: '#c9a96e',
  },
  { label: 'Rosa nude',
    pac_bg: '#f9f0ee', pac_card: '#ffffff', pac_btn: '#8b3a52', pac_text: '#2a1a1f',
    pac_tabbar: '#ffffff', pac_tabbar_txt: '#8b3a52',
    pac_header_ref: '#8b3a52', pac_header_ref_txt: '#f9f0ee',
    pac_macro: '#8b3a52', pac_titulo: '#8b3a52',
    pac_hero: '#8b3a52', pac_btn_plano: '#8b3a52', pac_avatar: '#8b3a52',
  },
  { label: 'Verde sage',
    pac_bg: '#eef2ec', pac_card: '#ffffff', pac_btn: '#2d5a27', pac_text: '#1a2e18',
    pac_tabbar: '#eef2ec', pac_tabbar_txt: '#2d5a27',
    pac_header_ref: '#2d5a27', pac_header_ref_txt: '#eef2ec',
    pac_macro: '#2d5a27', pac_titulo: '#2d5a27',
    pac_hero: '#2d5a27', pac_btn_plano: '#2d5a27', pac_avatar: '#2d5a27',
  },
  { label: 'Lavanda',
    pac_bg: '#f0edf8', pac_card: '#ffffff', pac_btn: '#5b3d9e', pac_text: '#1e1630',
    pac_tabbar: '#f0edf8', pac_tabbar_txt: '#5b3d9e',
    pac_header_ref: '#5b3d9e', pac_header_ref_txt: '#f0edf8',
    pac_macro: '#5b3d9e', pac_titulo: '#5b3d9e',
    pac_hero: '#5b3d9e', pac_btn_plano: '#5b3d9e', pac_avatar: '#5b3d9e',
  },
  { label: 'Dark mode',
    pac_bg: '#1a1a1a', pac_card: '#2a2a2a', pac_btn: '#c9a96e', pac_text: '#f0ebe3',
    pac_tabbar: '#1a1a1a', pac_tabbar_txt: '#f0ebe3',
    pac_header_ref: '#2a2a2a', pac_header_ref_txt: '#f0ebe3',
    pac_macro: '#c9a96e', pac_titulo: '#c9a96e',
    pac_hero: '#2a2a2a', pac_btn_plano: '#c9a96e', pac_avatar: '#c9a96e',
  },
  { label: 'Azul polar',
    pac_bg: '#eef4fb', pac_card: '#ffffff', pac_btn: '#1a4a80', pac_text: '#0d2040',
    pac_tabbar: '#ffffff', pac_tabbar_txt: '#1a4a80',
    pac_header_ref: '#1a4a80', pac_header_ref_txt: '#eef4fb',
    pac_macro: '#1a4a80', pac_titulo: '#1a4a80',
    pac_hero: '#1a4a80', pac_btn_plano: '#1a4a80', pac_avatar: '#1a4a80',
  },
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
    const agora = new Date().toISOString();

    const { data: existente, error: selErr } = await supabase
      .from('configuracoes').select('id').eq('nutri_id', user.id).maybeSingle();
    if (selErr && selErr.code !== 'PGRST116') {
      setBusy(false);
      return setFeedback({ tipo: 'erro', msg: selErr.message });
    }

    const { error } = existente
      ? await supabase.from('configuracoes')
          .update({ tema, updated_at: agora })
          .eq('nutri_id', user.id)
      : await supabase.from('configuracoes')
          .insert({ nutri_id: user.id, tema, updated_at: agora });

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
    const padrao = {
      pac_bg:    '#F0EBE3',
      pac_card:  '#FFFFFF',
      pac_btn:   '#173103',
      pac_text:  '#000000',
      pac_hero:        '#173103',
      pac_card_dark:   '#173103',
      pac_btn_plano:   '#95380A',
      pac_avatar:      '#173103',
      pac_macro:       '#95380A',
      pac_titulo:      '#173103',
      pac_tabbar:      '#FFFFFF',
      pac_tabbar_txt:  '#173103',
      pac_header_ref:      '#173103',
      pac_header_ref_txt:  '#FFFFFF',
    };
    setTema(padrao);
    setFeedback(null);
    setBusy(true);
    const agora = new Date().toISOString();
    const { data: existente } = await supabase
      .from('configuracoes').select('id').eq('nutri_id', user.id).maybeSingle();
    const { error } = existente
      ? await supabase.from('configuracoes').update({ tema: padrao, updated_at: agora }).eq('nutri_id', user.id)
      : await supabase.from('configuracoes').insert({ nutri_id: user.id, tema: padrao, updated_at: agora });
    setBusy(false);
    if (!error) setFeedback({ tipo: 'ok', msg: 'Cores restauradas para o padrão!' });
  }

  const campos = [
    { key: 'pac_bg',             label: 'Fundo do app',            hint: 'Cor de fundo de todas as telas' },
    { key: 'pac_card',           label: 'Cards e seções',           hint: 'Cor de fundo dos cartões' },
    { key: 'pac_btn',            label: 'Destaque / botões',        hint: 'Botões, ícones e elementos de acento' },
    { key: 'pac_text',           label: 'Texto principal',          hint: 'Cor do texto nas telas' },
    { key: 'pac_tabbar',         label: 'Menu inferior (fundo)',    hint: 'Fundo da barra de abas inferior' },
    { key: 'pac_tabbar_txt',     label: 'Menu inferior (ícones)',   hint: 'Ícones e texto das abas' },
    { key: 'pac_header_ref',     label: 'Header de refeição',       hint: 'Fundo de "Café da manhã", "Almoço" etc.' },
    { key: 'pac_header_ref_txt', label: 'Texto do header',          hint: 'Cor do texto dentro do header de refeição' },
    { key: 'pac_macro',          label: 'Barras de macros',         hint: 'Cor das barras de proteína, carbo e gordura' },
    { key: 'pac_titulo',         label: 'Rótulos / categorias',     hint: 'Cor dos pequenos textos de categoria (eyebrow)' },
    { key: 'pac_hero',      label: 'Card Próxima Refeição',    hint: 'Fundo do card hero da tela inicial' },
    { key: 'pac_btn_plano',      label: 'Botão Ver plano completo', hint: 'Cor do botão na tela inicial' },
    { key: 'pac_avatar',         label: 'Avatar da paciente',       hint: 'Círculo com iniciais no canto superior direito' },
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
            boxShadow: '0 4px 20px rgba(0,0,0,.15)',
            border: '1px solid rgba(0,0,0,.06)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
          }}>
            {/* Fake page header */}
            <div style={{ padding: '12px 14px 10px', background: tema.pac_bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 8, letterSpacing: '.18em', textTransform: 'uppercase', color: tema.pac_titulo, marginBottom: 2 }}>Plano alimentar</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: tema.pac_text }}>Meu plano</div>
              </div>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: tema.pac_avatar,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 600, color: tema.pac_text,
              }}>JP</div>
            </div>

            <div style={{ padding: '0 12px 12px' }}>
              {/* Fake card macros */}
              <div style={{
                background: tema.pac_card, borderRadius: 10, padding: 10,
                marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,.07)',
              }}>
                <div style={{ fontSize: 8, color: tema.pac_titulo, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Macros do dia</div>
                {[['Proteína', '70%'], ['Carboidrato', '85%'], ['Gordura', '55%']].map(([label, w], i) => (
                  <div key={i} style={{ marginBottom: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: tema.pac_text, marginBottom: 2 }}>
                      <span>{label}</span><span style={{ opacity: .6 }}>120g</span>
                    </div>
                    <div style={{ background: tema.pac_bg, borderRadius: 3, height: 5, overflow: 'hidden' }}>
                      <div style={{ width: w, height: '100%', background: tema.pac_macro, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Fake card próxima refeição */}
              <div style={{
                background: tema.pac_hero, borderRadius: 10,
                marginBottom: 8, padding: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,.18)',
              }}>
                <div style={{ fontSize: 8, letterSpacing: '.14em', textTransform: 'uppercase', color: '#fff', opacity: .6, marginBottom: 4 }}>
                  Próxima refeição · 12:00
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Almoço</div>
                <div style={{
                  display: 'inline-block', background: tema.pac_btn_plano,
                  color: tema.pac_text, borderRadius: 6,
                  padding: '4px 10px', fontSize: 9, fontWeight: 600, cursor: 'default',
                }}>
                  Ver plano completo
                </div>
              </div>

              {/* Fake refeição card */}
              <div style={{
                background: tema.pac_card, borderRadius: 10,
                marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,.07)', overflow: 'hidden',
              }}>
                <div style={{
                  background: tema.pac_header_ref, padding: '7px 10px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: tema.pac_header_ref_txt }}>Café da manhã</div>
                  <div style={{ fontSize: 9, color: tema.pac_header_ref_txt, opacity: .75 }}>384 kcal</div>
                </div>
                <div style={{ padding: '8px 10px' }}>
                  {['Pão integral — 2 fatias', 'Ovo mexido — 1½ un.', 'Mamão — 130g'].map((item, i) => (
                    <div key={i} style={{ fontSize: 10, color: tema.pac_text, padding: '3px 0', opacity: i === 2 ? 0.85 : 1 }}>{item}</div>
                  ))}
                </div>
              </div>

              {/* Fake button */}
              <button style={{
                width: '100%', background: tema.pac_btn, color: '#fff',
                border: 'none', borderRadius: 8, padding: '8px 0',
                fontSize: 11, fontWeight: 600, cursor: 'default',
              }}>
                Baixar Plano em PDF
              </button>
            </div>

            {/* Fake tab bar */}
            <div style={{
              background: tema.pac_tabbar,
              borderTop: '0.5px solid rgba(0,0,0,.08)',
              display: 'flex', padding: '6px 4px 8px',
            }}>
              {[['home','Início'], ['salad','Plano'], ['camera','Pratos'], ['trending-up','Prog.'], ['menu-2','Mais']].map(([icon, label], i) => (
                <div key={i} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  opacity: i === 1 ? 1 : 0.4,
                }}>
                  <div style={{ fontSize: 14, color: tema.pac_tabbar_txt }}>
                    {icon === 'home' ? '⌂' : icon === 'salad' ? '🥗' : icon === 'camera' ? '📷' : icon === 'trending-up' ? '📈' : '☰'}
                  </div>
                  <div style={{ fontSize: 8, color: tema.pac_tabbar_txt, fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
