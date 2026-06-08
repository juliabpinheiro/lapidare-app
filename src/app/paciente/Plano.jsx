import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';
import { gerarPlanoHtml } from '../../lib/gerarPlanoHtml.js';

export default function Plano() {
  const { user } = useSession();
  const [plano, setPlano] = useState(undefined); // undefined=loading, null=vazio
  const [validade, setValidade] = useState(null);
  const [openSubs, setOpenSubs] = useState({});
  const [planoVisual, setPlanoVisual] = useState(null); // PDF final liberado

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      const [planRes, visualRes] = await Promise.all([
        supabase.from('planos').select('dados, validade, publicado_em')
          .eq('paciente_id', user.id)
          .order('publicado_em', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('planos_visuais').select('dados')
          .eq('paciente_id', user.id).eq('publicado', true)
          .order('publicado_em', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!active) return;
      setPlano(planRes.data?.dados ?? null);
      setValidade(planRes.data?.validade ?? null);
      setPlanoVisual(visualRes.data?.dados ?? null);
    }
    load();
    return () => { active = false; };
  }, [user]);

  const toggleSubs = (key) => setOpenSubs(s => ({ ...s, [key]: !s[key] }));

  if (plano === undefined) {
    return <div className="empty-state"><div className="empty-sub">Carregando…</div></div>;
  }

  if (!plano) {
    return (
      <div className="empty-state">
        <i className="ti ti-salad empty-icon" aria-hidden="true"></i>
        <div className="empty-title">Plano não publicado ainda</div>
        <div className="empty-sub">
          Sua nutricionista está preparando seu plano personalizado. Você será notificada quando estiver pronto.
        </div>
      </div>
    );
  }

  const totalFeitos = plano.refeicoes?.filter(r => r.feita).length ?? 0;
  const total = plano.refeicoes?.length ?? 0;

  function abrirPlanoCompleto() {
    if (!planoVisual) return;
    const html = gerarPlanoHtml({
      pacienteNome: user?.user_metadata?.nome ?? user?.email ?? '',
      plano,
      extras: planoVisual,
      subsTexto: planoVisual.subs_texto ?? null,
      nutriNome: '',
      nutriCrn: '',
      nutriEmail: '',
    });
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para abrir o PDF.'); return; }
    win.document.write(html);
    win.document.close();
  }

  return (
    <>
      {/* Banner do plano completo */}
      {planoVisual && (
        <div style={{
          margin: '0 0 12px', background: 'linear-gradient(135deg, #173103 0%, #95380A 100%)',
          borderRadius: 12, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>
              Plano alimentar completo disponível
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
              Prioridades, metas, substituições e orientações personalizadas
            </div>
          </div>
          <button onClick={abrirPlanoCompleto} style={{
            background: '#fff', color: '#95380A', border: 'none', borderRadius: 8,
            padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true"></i>
            Baixar PDF
          </button>
        </div>
      )}

      {/* Macros */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>
            Macros do dia
          </span>
          <span className="pill ghost" style={{ fontSize: 10 }}>{plano.macros?.kcal} kcal</span>
        </div>
        {[
          { label: 'Proteína',    v: plano.macros?.prot_g, color: 'var(--red)' },
          { label: 'Carboidrato', v: plano.macros?.cho_g,  color: 'var(--gold)' },
          { label: 'Gordura',     v: plano.macros?.lip_g,  color: 'var(--green)' },
        ].map((m, i) => (
          <div key={i} className="macro-row">
            <div className="macro-label"><span>{m.label}</span><span>{m.v}g</span></div>
            <div className="bar"><i style={{ width: '70%', background: m.color }}></i></div>
          </div>
        ))}
        {(plano.macros?.agua_l || plano.macros?.fibras_g) && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
            💧 Meta: {plano.macros.agua_l}L · 🌾 Fibras: {plano.macros.fibras_g}g
          </div>
        )}
      </div>

      {/* Progresso */}
      {total > 0 && (
        <div style={{ margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="bar" style={{ flex: 1 }}>
            <i style={{ width: `${(totalFeitos / total) * 100}%`, background: 'var(--green)' }}></i>
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {totalFeitos}/{total} refeições
          </span>
        </div>
      )}

      {/* Refeições */}
      {plano.refeicoes?.map((ref, ri) => (
        <div key={ri} className="refeicao-card">
          <div className="refeicao-header">
            <div>
              <div className="refeicao-titulo">{ref.emoji} {ref.nome}</div>
              {ref.horario && <div className="refeicao-horario">{ref.horario}</div>}
            </div>
            {ref.kcal && <span className="refeicao-kcal">{ref.kcal} kcal</span>}
          </div>

          {ref.alimentos?.map((al, ai) => (
            <div key={ai}>
              <div className="alimento-row" style={{ background: ai % 2 === 0 ? 'var(--paper)' : 'var(--bg-soft)' }}>
                <div>
                  <div className="alimento-nome">{al.nome}</div>
                  {al.qty && <div className="alimento-qty">{al.qty}{al.prot_g ? ` · ${al.prot_g}g prot` : ''}</div>}
                </div>
                {al.kcal && <span className="alimento-kcal">{al.kcal} kcal</span>}
              </div>

              {al.subs?.length > 0 && (
                <>
                  <button className="subs-toggle" onClick={() => toggleSubs(`${ri}-${ai}`)}>
                    <i className={`ti ti-${openSubs[`${ri}-${ai}`] ? 'chevron-up' : 'chevron-down'}`} style={{ fontSize: 12 }} aria-hidden="true"></i>
                    {openSubs[`${ri}-${ai}`] ? 'Fechar substituições' : `Ver ${al.subs.length} substituições`}
                  </button>
                  {openSubs[`${ri}-${ai}`] && (
                    <div className="subs-list">
                      {al.subs.map((s, si) => <div key={si} className="sub-item">→ {s}</div>)}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {ref.obs && (
            <div className="refeicao-obs">
              <i className="ti ti-info-circle" style={{ fontSize: 12, marginRight: 5, color: 'var(--gold-deep)' }} aria-hidden="true"></i>
              {ref.obs}
            </div>
          )}
        </div>
      ))}

      {/* Orientações */}
      {(() => {
        const o = plano.orientacoes;
        if (!o) return null;
        const blocos = [
          { key: 'prioridades',   label: 'prioridades',   val: o.prioridades,   bg: '#eef4e6' },
          { key: 'metas',         label: 'metas',         val: o.metas,         bg: '#f5f0e8' },
          { key: 'suplementacao', label: 'suplementação', val: o.suplementacao, bg: '#e8eff5' },
        ].filter(b => b.val?.trim());
        if (!blocos.length) return null;
        return (
          <div className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, marginBottom: 14 }}>
              Orientações
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {blocos.map(b => (
                <div key={b.key} style={{ background: b.bg, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18, color: 'var(--green)', marginBottom: 10, lineHeight: 1 }}>
                    {b.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {b.val.split('\n').filter(l => l.trim()).map((linha, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, display: 'flex', gap: 7 }}>
                        <span style={{ color: 'var(--gold-deep)', flexShrink: 0, fontWeight: 600 }}>—</span>
                        <span>{linha.trim().replace(/^[-—]\s*/, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {validade && (
        <div style={{ padding: '8px 16px', fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
          Válido até {dataBR(validade)}
        </div>
      )}
    </>
  );
}
