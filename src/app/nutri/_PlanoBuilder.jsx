import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase.js';
import { gerarPlanoHtml } from '../../lib/gerarPlanoHtml.js';

/* ── Constantes ─────────────────────────────────────────────── */
const CATS = [
  { key: 'carbo',  label: 'Carboidrato' },
  { key: 'prot',   label: 'Proteína' },
  { key: 'fruta',  label: 'Fruta' },
  { key: 'leg',    label: 'Leguminosa' },
  { key: 'bebida', label: 'Bebida' },
];

const SUGESTOES = [
  { nome: 'Café da Manhã',   horario: '08:00' },
  { nome: 'Lanche da Manhã', horario: '10:30' },
  { nome: 'Almoço',          horario: '12:30' },
  { nome: 'Lanche da Tarde', horario: '15:30' },
  { nome: 'Jantar',          horario: '19:00' },
  { nome: 'Ceia',            horario: '21:00' },
];

/* ── Utilitários ────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 9); }
function rd(v, d = 1) { if (v == null) return null; const m = 10 ** d; return Math.round(v * m) / m; }
function fmt(v, d = 1) { if (v == null || isNaN(v)) return '—'; return Number(v).toFixed(d); }

function servingG(food) {
  if (food?.serving_g > 0) return food.serving_g;
  const s = food?.serving ?? '';
  const m = s.match(/\((\d+(?:\.\d+)?)\s*g\)/i) || s.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  return m ? parseFloat(m[1]) : 100;
}

function calcMacros(food, gramas) {
  const f = gramas / servingG(food);
  return {
    nome:   food.name,
    qty:    `${gramas}g`,
    kcal:   rd((food.kcal   ?? 0) * f, 0),
    prot_g: rd((food.prot_g ?? 0) * f, 1),
    cho_g:  rd((food.carb_g ?? 0) * f, 1),
    lip_g:  rd((food.fat_g  ?? 0) * f, 1),
  };
}

function somaAlimentos(alimentos) {
  return alimentos.reduce((a, al) => ({
    kcal:   a.kcal   + (al.kcal   ?? 0),
    prot_g: a.prot_g + (al.prot_g ?? 0),
    cho_g:  a.cho_g  + (al.cho_g  ?? 0),
    lip_g:  a.lip_g  + (al.lip_g  ?? 0),
  }), { kcal: 0, prot_g: 0, cho_g: 0, lip_g: 0 });
}

function normMealKey(nome) {
  const n = (nome ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
  if (n.includes('ceia'))   return 'ceia';
  if (n.includes('jantar')) return 'jantar';
  if (n.includes('lanche') && (n.includes('tarde') || n.includes('15') || n.includes('16'))) return 'lanche_tarde';
  if (n.includes('almoco')) return 'almoco';
  if (n.includes('lanche')) return 'lanche_manha';
  return 'cafe_manha';
}

function guessCatKey(al) {
  const p = al.prot_g ?? 0, c = al.cho_g ?? 0;
  return p > 5 && p >= c ? 'prot' : 'carbo';
}

function buildSubsTexto(refeicoes) {
  const result = {};
  for (const ref of refeicoes) {
    const mk = normMealKey(ref.nome);
    for (const al of ref.alimentos) {
      if (!al.subs?.length) continue;
      const ck = al.catKey || guessCatKey(al);
      if (!result[mk]) result[mk] = {};
      const partes = [`${al.nome} ${al.qty}`, ...al.subs.map(s => `${s.nome} ${s.qty || ''}`.trim())];
      result[mk][ck] = result[mk][ck] ? `${result[mk][ck]} · ${partes.join(' · ')}` : partes.join(' · ');
    }
  }
  return Object.keys(result).length ? result : null;
}

/* ── Modal: adicionar alimento ou substituto ────────────────── */
function ModalAlimento({ isSub, onConfirm, onFechar }) {
  const [tab, setTab]             = useState('fatsecret');
  const [busca, setBusca]         = useState('');
  const [resultados, setRes]      = useState([]);
  const [loading, setLoading]     = useState(false);
  const [erro, setErro]           = useState(null);
  const [sel, setSel]             = useState(null);
  const [detalhe, setDetalhe]     = useState(null);
  const [loadDet, setLoadDet]     = useState(false);
  const [qtd, setQtd]             = useState('100');
  const [manual, setManual]       = useState({ nome: '', qty: '', kcal: '', prot_g: '', cho_g: '', lip_g: '' });

  useEffect(() => {
    if (!sel) { setDetalhe(null); return; }
    setLoadDet(true);
    fetch(`/.netlify/functions/fatsecret?food_id=${sel.food_id}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setDetalhe(d); })
      .catch(() => {})
      .finally(() => setLoadDet(false));
  }, [sel?.food_id]);

  async function buscar() {
    if (!busca.trim()) return;
    setLoading(true); setErro(null); setRes([]); setSel(null);
    try {
      const res = await fetch(`/.netlify/functions/fatsecret?q=${encodeURIComponent(busca)}`);
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Erro na busca');
      setRes(d.foods ?? []);
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  }

  function confirmarFS() {
    const g = parseFloat(qtd);
    if (!g || !sel) return;
    onConfirm({ id: uid(), ...calcMacros(detalhe ?? sel, g), subs: [], catKey: '' });
  }

  function confirmarManual() {
    if (!manual.nome.trim()) return;
    const n = v => parseFloat(v) || null;
    onConfirm({ id: uid(), nome: manual.nome.trim(), qty: manual.qty || '—', kcal: n(manual.kcal), prot_g: n(manual.prot_g), cho_g: n(manual.cho_g), lip_g: n(manual.lip_g), subs: [], catKey: '' });
  }

  const src     = detalhe ?? sel;
  const g       = parseFloat(qtd);
  const preview = src && g > 0 ? calcMacros(src, g) : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onFechar()}
    >
      <div style={{ background: 'var(--white)', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,.25)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--dark)' }}>
            {isSub ? 'Adicionar substituto' : 'Adicionar alimento'}
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '10px 20px 0', borderBottom: '1px solid var(--border)', marginTop: 6 }}>
          {[['fatsecret', 'Buscar no FatSecret'], ['manual', 'Digitar manualmente']].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'none', color: tab === id ? 'var(--dark)' : 'var(--text3)',
              borderBottom: tab === id ? '2px solid var(--green)' : '2px solid transparent',
              marginBottom: -1,
            }}>{lbl}</button>
          ))}
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── FatSecret ── */}
          {tab === 'fatsecret' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={busca} onChange={e => setBusca(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscar()}
                  placeholder="Ex: banana, frango, aveia, greek yogurt…"
                  style={{ flex: 1, fontSize: 14 }}
                  autoFocus
                />
                <button className="btn" style={{ fontSize: 13 }} onClick={buscar} disabled={loading || !busca.trim()}>
                  {loading ? '…' : 'Buscar'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                💡 Tente em inglês para mais resultados: chicken, oat, sweet potato…
              </div>

              {erro && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{erro}</div>}

              {resultados.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                  {resultados.slice(0, 10).map((food, i) => {
                    const ativo = sel?.food_id === food.food_id;
                    return (
                      <div key={food.food_id}>
                        <button
                          onClick={() => { setSel(ativo ? null : food); setQtd('100'); }}
                          style={{
                            width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                            borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
                            padding: '9px 12px', background: ativo ? '#fffbf5' : 'transparent',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: ativo ? 600 : 400, color: 'var(--dark)' }}>{food.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {food.serving && `${food.serving} · `}
                            {food.kcal != null && `${Math.round(food.kcal)} kcal`}
                          </div>
                        </button>

                        {ativo && (
                          <div style={{ padding: '10px 12px 14px', background: '#fffbf5', borderTop: '1px solid var(--border)' }}>
                            {preview && (
                              <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                                {[
                                  { l: 'kcal', v: preview.kcal },
                                  { l: 'prot', v: `${preview.prot_g}g` },
                                  { l: 'carb', v: `${preview.cho_g}g` },
                                  { l: 'gord', v: `${preview.lip_g}g` },
                                ].map(m => (
                                  <div key={m.l} style={{ textAlign: 'center', minWidth: 44 }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1, color: 'var(--dark)' }}>{m.v}</div>
                                    <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 2 }}>{m.l}</div>
                                  </div>
                                ))}
                                {loadDet && <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', fontStyle: 'italic' }}>refinando…</span>}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="number" min="1" max="5000" value={qtd}
                                onChange={e => setQtd(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmarFS()}
                                style={{ width: 80, fontSize: 14, textAlign: 'center' }}
                                autoFocus
                              />
                              <span style={{ fontSize: 13, color: 'var(--text3)' }}>g</span>
                              <button className="btn" style={{ fontSize: 13 }} onClick={confirmarFS} disabled={!qtd || parseFloat(qtd) <= 0}>
                                Confirmar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!loading && resultados.length === 0 && busca && !erro && (
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
                  Sem resultados. Tente em inglês ou use "Digitar manualmente".
                </div>
              )}
            </>
          )}

          {/* ── Manual ── */}
          {tab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Nome *</label>
                  <input value={manual.nome} onChange={e => setManual(p => ({ ...p, nome: e.target.value }))} placeholder="ex: Banana prata" autoFocus />
                </div>
                <div>
                  <label className="field-label">Quantidade</label>
                  <input value={manual.qty} onChange={e => setManual(p => ({ ...p, qty: e.target.value }))} placeholder="ex: 1 unidade / 70g" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[['kcal','Kcal'],['prot_g','Prot (g)'],['cho_g','Carb (g)'],['lip_g','Gord (g)']].map(([k, lbl]) => (
                  <div key={k}>
                    <label className="field-label">{lbl}</label>
                    <input inputMode="decimal" value={manual[k]} onChange={e => setManual(p => ({ ...p, [k]: e.target.value }))} placeholder="0" />
                  </div>
                ))}
              </div>
              <button className="btn" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={confirmarManual} disabled={!manual.nome.trim()}>
                Confirmar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Cabeçalho de coluna da tabela ──────────────────────────── */
const TH = ({ children }) => (
  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
    {children}
  </th>
);

/* ── Componente principal ───────────────────────────────────── */
export default function PlanoBuilder({ pacienteId, nutriId, pacienteNome }) {
  const DRAFT_KEY = `plano_rascunho_${pacienteId}`;

  const [refeicoes, setRefeicoes] = useState(() => {
    try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [modal, setModal]         = useState(null); // { refId, alimentoId: string|null }
  const [publicando, setPublicando] = useState(false);
  const [feedback, setFeedback]   = useState(null);
  const [nutriInfo, setNutriInfo] = useState({ nome: '', crn: '', email: '' });
  const [draft, setDraft]         = useState('salvo'); // 'salvo' | 'salvando'
  const draftTimer                = useRef(null);

  /* Carrega info da nutri para o PDF */
  useEffect(() => {
    supabase.from('nutris').select('nome, crn, email').eq('id', nutriId).maybeSingle()
      .then(({ data }) => { if (data) setNutriInfo(data); });
  }, [nutriId]);

  /* Auto-save rascunho (debounce 2s) */
  useEffect(() => {
    setDraft('salvando');
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(refeicoes)); } catch {}
      setDraft('salvo');
    }, 2000);
    return () => clearTimeout(draftTimer.current);
  }, [refeicoes, DRAFT_KEY]);

  /* ── Handlers de refeição ─────────────────────────────────── */
  function adicionarRefeicao() {
    const sug = SUGESTOES[refeicoes.length] ?? { nome: '', horario: '' };
    setRefeicoes(prev => [...prev, { id: uid(), nome: sug.nome, horario: sug.horario, alimentos: [] }]);
  }

  function removerRefeicao(refId) {
    if (!window.confirm('Remover esta refeição?')) return;
    setRefeicoes(prev => prev.filter(r => r.id !== refId));
  }

  function setRefField(refId, field, val) {
    setRefeicoes(prev => prev.map(r => r.id === refId ? { ...r, [field]: val } : r));
  }

  /* ── Handlers de alimento ────────────────────────────────── */
  function adicionarAlimento(refId, alimento) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId ? { ...r, alimentos: [...r.alimentos, alimento] } : r
    ));
  }

  function removerAlimento(refId, alId) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId ? { ...r, alimentos: r.alimentos.filter(a => a.id !== alId) } : r
    ));
  }

  function setCatKey(refId, alId, catKey) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId
        ? { ...r, alimentos: r.alimentos.map(a => a.id === alId ? { ...a, catKey } : a) }
        : r
    ));
  }

  /* ── Handlers de substituto ──────────────────────────────── */
  function adicionarSub(refId, alId, sub) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId
        ? { ...r, alimentos: r.alimentos.map(a =>
            a.id === alId ? { ...a, subs: [...(a.subs ?? []), { ...sub, id: uid() }] } : a
          )}
        : r
    ));
  }

  function removerSub(refId, alId, subId) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId
        ? { ...r, alimentos: r.alimentos.map(a =>
            a.id === alId ? { ...a, subs: a.subs.filter(s => s.id !== subId) } : a
          )}
        : r
    ));
  }

  /* ── Modal confirm ───────────────────────────────────────── */
  function handleConfirm(alimento) {
    if (!modal) return;
    if (modal.alimentoId) adicionarSub(modal.refId, modal.alimentoId, alimento);
    else adicionarAlimento(modal.refId, alimento);
    setModal(null);
  }

  /* ── Totais ──────────────────────────────────────────────── */
  const totDia = refeicoes.reduce((acc, ref) => {
    const t = somaAlimentos(ref.alimentos);
    return { kcal: acc.kcal + t.kcal, prot_g: acc.prot_g + t.prot_g, cho_g: acc.cho_g + t.cho_g, lip_g: acc.lip_g + t.lip_g };
  }, { kcal: 0, prot_g: 0, cho_g: 0, lip_g: 0 });

  const temAlimentos = refeicoes.some(r => r.alimentos.length > 0);

  /* ── Constrói objeto plano para salvar/PDF ───────────────── */
  function buildPlano() {
    const refs = refeicoes
      .filter(r => r.alimentos.length > 0)
      .map(r => {
        const tot = somaAlimentos(r.alimentos);
        return {
          nome:      r.nome,
          horario:   r.horario,
          kcal:      rd(tot.kcal, 0),
          prot_g:    rd(tot.prot_g, 1),
          cho_g:     rd(tot.cho_g, 1),
          lip_g:     rd(tot.lip_g, 1),
          alimentos: r.alimentos.map(a => ({ nome: a.nome, qty: a.qty, kcal: a.kcal, prot_g: a.prot_g, cho_g: a.cho_g, lip_g: a.lip_g })),
        };
      });
    return {
      macros: { kcal: rd(totDia.kcal, 0), prot_g: rd(totDia.prot_g, 1), cho_g: rd(totDia.cho_g, 1), lip_g: rd(totDia.lip_g, 1) },
      refeicoes: refs,
    };
  }

  /* ── Gerar PDF ───────────────────────────────────────────── */
  function gerarPdf() {
    if (!temAlimentos) return;
    const html = gerarPlanoHtml({
      pacienteNome,
      plano:      buildPlano(),
      extras:     {},
      subsTexto:  buildSubsTexto(refeicoes),
      nutriNome:  nutriInfo.nome,
      nutriCrn:   nutriInfo.crn,
      nutriEmail: nutriInfo.email,
    });
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para abrir o PDF.'); return; }
    win.document.write(html);
    win.document.close();
  }

  /* ── Liberar para paciente ───────────────────────────────── */
  async function liberarParaPaciente() {
    if (!temAlimentos) return;
    const plano = buildPlano();
    const subsTexto = buildSubsTexto(refeicoes);
    const dados = { ...plano, ...(subsTexto ? { subs_texto: subsTexto } : {}) };

    setPublicando(true);
    setFeedback(null);
    const { error } = await supabase.from('planos').insert({ paciente_id: pacienteId, nutri_id: nutriId, dados });
    setPublicando(false);

    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: 'Plano liberado! A paciente já pode visualizar e baixar.' });
  }

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Barra de ações ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn-outline" onClick={adicionarRefeicao}>
          <i className="ti ti-plus" aria-hidden="true" /> Adicionar refeição
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
          {draft === 'salvando' ? 'Salvando rascunho…' : 'Rascunho salvo'}
        </span>
        <button className="btn-outline" onClick={gerarPdf} disabled={!temAlimentos}>
          <i className="ti ti-printer" aria-hidden="true" /> Gerar PDF
        </button>
        <button className="btn" onClick={liberarParaPaciente} disabled={publicando || !temAlimentos}>
          <i className="ti ti-send" aria-hidden="true" />
          {publicando ? 'Liberando…' : 'Liberar para paciente'}
        </button>
      </div>

      {feedback && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: feedback.tipo === 'ok' ? '#e6f0d4' : '#fbeaf0', color: feedback.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>
          <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`} style={{ marginRight: 6 }} />
          {feedback.msg}
        </div>
      )}

      {/* ── Estado vazio ── */}
      {refeicoes.length === 0 && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text3)' }}>
          <i className="ti ti-salad" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: .25 }} aria-hidden="true" />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhuma refeição ainda</div>
          <div style={{ fontSize: 13, opacity: .7, marginBottom: 20 }}>Clique em "+ Adicionar refeição" para começar</div>
          <button className="btn" onClick={adicionarRefeicao}>
            <i className="ti ti-plus" aria-hidden="true" /> Adicionar primeira refeição
          </button>
        </div>
      )}

      {/* ── Cards de refeição ── */}
      {refeicoes.map(ref => {
        const totRef = somaAlimentos(ref.alimentos);
        return (
          <div key={ref.id} className="card" style={{ overflow: 'hidden', padding: 0 }}>

            {/* Header */}
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: '#f5f1eb', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={ref.nome}
                onChange={e => setRefField(ref.id, 'nome', e.target.value)}
                placeholder="Nome da refeição"
                style={{ flex: '1 1 160px', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px' }}
              />
              <input
                type="time"
                value={ref.horario}
                onChange={e => setRefField(ref.id, 'horario', e.target.value)}
                style={{ width: 100, fontSize: 13 }}
              />
              {ref.alimentos.length > 0 && (
                <span style={{ fontSize: 11, color: '#95380A', fontWeight: 600 }}>
                  {fmt(totRef.kcal, 0)} kcal · P:{fmt(totRef.prot_g)}g · C:{fmt(totRef.cho_g)}g · G:{fmt(totRef.lip_g)}g
                </span>
              )}
              <button onClick={() => removerRefeicao(ref.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, marginLeft: 'auto' }}>
                <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" />
              </button>
            </div>

            {/* Tabela de alimentos */}
            {ref.alimentos.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#faf7f2' }}>
                      <TH>Alimento</TH>
                      <TH>Quantidade</TH>
                      <TH>Kcal</TH>
                      <TH>Prot</TH>
                      <TH>Carb</TH>
                      <TH>Gord</TH>
                      <TH>Cat.</TH>
                      <TH></TH>
                    </tr>
                  </thead>
                  <tbody>
                    {ref.alimentos.flatMap(al => [
                      /* ── Alimento principal ── */
                      <tr key={al.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--dark)', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{al.nome}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text3)' }}>{al.qty}</td>
                        <td style={{ padding: '7px 10px' }}>{al.kcal ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{al.prot_g != null ? `${al.prot_g}g` : '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{al.cho_g  != null ? `${al.cho_g}g`  : '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{al.lip_g  != null ? `${al.lip_g}g`  : '—'}</td>
                        <td style={{ padding: '7px 6px' }}>
                          <select
                            value={al.catKey || ''}
                            onChange={e => setCatKey(ref.id, al.id, e.target.value)}
                            style={{ fontSize: 10, padding: '2px 4px', maxWidth: 90 }}
                            title="Categoria para PDF"
                          >
                            <option value="">cat…</option>
                            {CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => setModal({ refId: ref.id, alimentoId: al.id })}
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: 'var(--text3)', padding: '2px 7px', marginRight: 4 }}
                            title="Adicionar substituto"
                          >
                            + sub
                          </button>
                          <button onClick={() => removerAlimento(ref.id, al.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                            <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>,

                      /* ── Substitutos do alimento ── */
                      ...(al.subs ?? []).map(sub => (
                        <tr key={sub.id} style={{ background: '#fdf9f4', borderBottom: '0.5px solid var(--border)' }}>
                          <td style={{ padding: '5px 10px 5px 22px', color: 'var(--text3)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: 'var(--terra)', marginRight: 5, fontSize: 10 }}>↳</span>
                            {sub.nome}
                          </td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.qty}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.kcal ?? '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.prot_g != null ? `${sub.prot_g}g` : '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.cho_g  != null ? `${sub.cho_g}g`  : '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.lip_g  != null ? `${sub.lip_g}g`  : '—'}</td>
                          <td />
                          <td style={{ padding: '5px 10px' }}>
                            <button onClick={() => removerSub(ref.id, al.id, sub.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                              <i className="ti ti-x" style={{ fontSize: 11 }} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      )),
                    ])}

                    {/* Subtotal */}
                    <tr style={{ background: '#eee8de' }}>
                      <td colSpan={2} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--verde)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Subtotal</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--verde)' }}>{fmt(totRef.kcal, 0)}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--verde)' }}>{fmt(totRef.prot_g)}g</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--verde)' }}>{fmt(totRef.cho_g)}g</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--verde)' }}>{fmt(totRef.lip_g)}g</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer: adicionar alimento */}
            <div style={{ padding: '10px 16px', borderTop: ref.alimentos.length > 0 ? '1px solid var(--border)' : 'none' }}>
              <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => setModal({ refId: ref.id, alimentoId: null })}>
                <i className="ti ti-plus" aria-hidden="true" /> Adicionar alimento
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Total do dia ── */}
      {temAlimentos && (
        <div style={{ background: '#173103', borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 10 }}>
            Total do dia
          </div>
          <div style={{ display: 'flex' }}>
            {[
              { label: 'kcal',        v: fmt(totDia.kcal, 0),       cor: '#fff' },
              { label: 'proteína',    v: `${fmt(totDia.prot_g)}g`,  cor: '#a5c8ff' },
              { label: 'carboidrato', v: `${fmt(totDia.cho_g)}g`,   cor: '#ffd98a' },
              { label: 'gordura',     v: `${fmt(totDia.lip_g)}g`,   cor: '#a8e6a3' },
            ].map((m, i) => (
              <div key={m.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,.15)' : 'none', padding: '0 8px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.cor, lineHeight: 1 }}>{m.v}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <ModalAlimento
          isSub={!!modal.alimentoId}
          onConfirm={handleConfirm}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
