import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';
import { gerarPlanoHtml } from '../../lib/gerarPlanoHtml.js';
import HidratacaoCard from '../../components/HidratacaoCard.jsx';

const PERGUNTA_SEMANAL = 'Me conta como foi sua alimentação e treino essa semana. Está conseguindo ver evolução no espelho e nas roupas? Me conte como está se sentindo.';

const CAT_LABELS = { carbo: 'Carboidrato', prot: 'Proteína', gordura: 'Gordura', leg: 'Leguminosa', fruta: 'Fruta', bebida: 'Bebida' };

function normMealKey(nome) {
  const n = (nome ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
  if (n.includes('ceia')) return 'ceia';
  if (n.includes('jantar')) return 'jantar';
  if (n.includes('lanche') && (n.includes('tarde') || n.includes('16') || n.includes('15'))) return 'lanche_tarde';
  if (n.includes('almoco')) return 'almoco';
  if (n.includes('lanche')) return 'lanche_manha';
  return 'cafe_manha';
}

function getMondayISO() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const seg = new Date(d); seg.setDate(d.getDate() + diff);
  return seg.toISOString().slice(0, 10);
}

export default function Plano() {
  const { user, profile } = useSession();
  const [plano, setPlano] = useState(undefined); // undefined=loading, null=vazio
  const [validade, setValidade] = useState(null);
  const [planoVisual, setPlanoVisual] = useState(null);
  const [relatorio, setRelatorio] = useState(undefined); // undefined=loading, null=sem resp
  const [respostaRelatorio, setRespostaRelatorio] = useState('');
  const [enviandoRelatorio, setEnviandoRelatorio] = useState(false);
  const [recibos, setRecibos] = useState([]);

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

  useEffect(() => {
    if (!user) return;
    supabase.from('relatorio_semanal')
      .select('id, resposta, respondido_em')
      .eq('paciente_id', user.id).eq('semana_inicio', getMondayISO())
      .maybeSingle()
      .then(({ data }) => setRelatorio(data ?? null));

    supabase.from('recibos_paciente')
      .select('id, nome, arquivo_url, created_at')
      .eq('paciente_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRecibos(data ?? []));
  }, [user]);

  async function submitRelatorio() {
    if (!respostaRelatorio.trim() || enviandoRelatorio) return;
    setEnviandoRelatorio(true);
    const { data } = await supabase.from('relatorio_semanal').insert({
      paciente_id: user.id,
      nutri_id: profile?.nutri_id ?? null,
      semana_inicio: getMondayISO(),
      pergunta: PERGUNTA_SEMANAL,
      resposta: respostaRelatorio.trim(),
      respondido_em: new Date().toISOString(),
    }).select().maybeSingle();
    setEnviandoRelatorio(false);
    if (data) { setRelatorio(data); setRespostaRelatorio(''); }
  }

  if (plano === undefined) {
    return <div className="empty-state"><div className="empty-sub">Carregando…</div></div>;
  }

  if (!plano) {
    return (
      <>
        <HidratacaoCard />
        <div className="empty-state">
          <i className="ti ti-salad empty-icon" aria-hidden="true"></i>
          <div className="empty-title">Plano não publicado ainda</div>
          <div className="empty-sub">
            Sua nutricionista está preparando seu plano personalizado. Você será notificada quando estiver pronto.
          </div>
        </div>
      </>
    );
  }

  const totalFeitos = plano.refeicoes?.filter(r => r.feita).length ?? 0;
  const total = plano.refeicoes?.length ?? 0;

  function abrirPlanoCompleto() {
    if (!planoVisual) return;
    const html = gerarPlanoHtml({
      pacienteNome: planoVisual.paciente_dados?.nome ?? user?.user_metadata?.nome ?? user?.email ?? '',
      plano,
      extras: planoVisual,
      subsTexto: planoVisual.subs_texto ?? null,
      nutriNome:  planoVisual.nutri_nome  ?? '',
      nutriCrn:   planoVisual.nutri_crn   ?? '',
      nutriEmail: planoVisual.nutri_email ?? '',
      pacienteDados: planoVisual.paciente_dados ?? null,
    });
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para abrir o PDF.'); return; }
    win.document.write(html);
    win.document.close();
  }

  return (
    <>
      {/* Card de hidratação */}
      <HidratacaoCard />

      {/* Relatório semanal */}
      {relatorio === null && (
        <div className="card" style={{ padding: '16px 16px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <i className="ti ti-message-heart" style={{ fontSize: 18, color: 'var(--gold-deep)' }} aria-hidden="true"></i>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Relatório da semana</div>
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: '#555555', marginBottom: 12 }}>
            {PERGUNTA_SEMANAL}
          </p>
          <textarea
            value={respostaRelatorio}
            onChange={e => setRespostaRelatorio(e.target.value)}
            placeholder="Escreva aqui sua resposta…"
            rows={4}
            style={{
              width: '100%', padding: '10px 12px', fontSize: 13,
              border: '0.5px solid var(--border)', borderRadius: 8,
              fontFamily: 'var(--font-sans)', resize: 'vertical',
              outline: 'none', marginBottom: 10, boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={submitRelatorio}
              disabled={enviandoRelatorio || !respostaRelatorio.trim()}
              style={{
                background: 'var(--dark)', color: '#fff', border: 'none',
                borderRadius: 8, padding: '8px 18px', fontSize: 13,
                fontWeight: 600, cursor: 'pointer', opacity: respostaRelatorio.trim() ? 1 : 0.5,
                fontFamily: 'var(--font-sans)',
              }}>
              {enviandoRelatorio ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
      {relatorio?.respondido_em && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#f0fdf4', border: '0.5px solid #bbf7d0',
          borderRadius: 10, padding: '10px 14px', marginBottom: 10,
          fontSize: 13, color: '#16a34a',
        }}>
          <i className="ti ti-check" style={{ fontSize: 16 }} aria-hidden="true"></i>
          Relatório da semana enviado — obrigada!
        </div>
      )}

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
            Meta: {plano.macros.agua_l}L agua · {plano.macros.fibras_g}g fibras
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
            <div key={ai} className="alimento-row" style={{ background: ai % 2 === 0 ? 'var(--paper)' : 'var(--bg-soft)' }}>
              <div>
                <div className="alimento-nome">
                  {al.catKey && CAT_LABELS[al.catKey] && (
                    <span className="alimento-cat">{CAT_LABELS[al.catKey]} – </span>
                  )}
                  {al.nome}
                </div>
                {al.qty && <div className="alimento-qty">{al.qty}{al.prot_g ? ` · ${al.prot_g}g prot` : ''}</div>}
              </div>
              {al.kcal && <span className="alimento-kcal">{al.kcal} kcal</span>}
            </div>
          ))}

          {/* Substituições por refeição (agrupadas por categoria, vindas de planoVisual) */}
          {(() => {
            const mealSubs = planoVisual?.subs_texto?.[normMealKey(ref.nome)];
            if (!mealSubs) return null;
            const entries = Object.entries(mealSubs).filter(([, t]) => t?.trim());
            if (!entries.length) return null;
            return (
              <div className="meal-subs-section">
                <div className="meal-subs-titulo">Escolha 1 opção para substituir:</div>
                {entries.map(([catKey, texto]) => (
                  <div key={catKey} className="meal-subs-grupo">
                    <div className="meal-subs-cat">{CAT_LABELS[catKey] ?? catKey}</div>
                    {texto.split(' · ').map((item, i) => (
                      <div key={i} className="meal-subs-item">• {item}</div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}

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

      {/* Recibos */}
      {recibos.length > 0 && (
        <div className="card" style={{ padding: '16px 20px', marginTop: 4 }}>
          <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, marginBottom: 12 }}>
            Meus recibos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recibos.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <i className="ti ti-file-type-pdf" style={{ color: 'var(--red)', fontSize: 20, flexShrink: 0 }} aria-hidden="true"></i>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{dataBR(r.created_at)}</div>
                </div>
                <a href={r.arquivo_url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, padding: '5px 12px', borderRadius: 8,
                  background: 'var(--dark)', color: '#fff', textDecoration: 'none',
                  fontWeight: 600, flexShrink: 0,
                }}>
                  <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true"></i>
                  Baixar PDF
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {validade && (
        <div style={{ padding: '8px 16px', fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>
          Válido até {dataBR(validade)}
        </div>
      )}
    </>
  );
}
