import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { gerarPlanoHtml } from '../../lib/gerarPlanoHtml.js';

/* ── Refeições padrão ──────────────────────────────────────── */
const REFEICOES = [
  { nome: 'Café da Manhã',   horario: '08:00' },
  { nome: 'Lanche da Manhã', horario: '10:30' },
  { nome: 'Almoço',          horario: '12:30' },
  { nome: 'Lanche da Tarde', horario: '15:30' },
  { nome: 'Jantar',          horario: '19:00' },
  { nome: 'Ceia',            horario: '21:00' },
];

const CATEGORIAS = [
  { key: 'carbo', label: 'Carboidrato' },
  { key: 'prot',  label: 'Proteína' },
  { key: 'fruta', label: 'Fruta' },
  { key: 'leg',   label: 'Leguminosa' },
  { key: 'bebida',label: 'Bebida' },
  { key: 'outro', label: 'Outro' },
];

function normMealKey(nome) {
  const n = (nome ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,'').trim();
  if (n.includes('ceia')) return 'ceia';
  if (n.includes('jantar')) return 'jantar';
  if (n.includes('lanche') && (n.includes('tarde') || n.includes('16') || n.includes('15'))) return 'lanche_tarde';
  if (n.includes('almoco')) return 'almoco';
  if (n.includes('lanche')) return 'lanche_manha';
  return 'cafe_manha';
}

function planoVazio() {
  return Object.fromEntries(
    REFEICOES.map(r => [r.nome, { horario: r.horario, alimentos: [] }])
  );
}

function subsVazia() {
  // { [refNome]: { [catKey]: string } }
  return Object.fromEntries(REFEICOES.map(r => [r.nome, {}]));
}

/* ── Helpers numéricos ─────────────────────────────────────── */
function fmt(v, dec = 1) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toFixed(dec);
}

function rd(v, dec = 1) {
  if (v == null) return null;
  const m = Math.pow(10, dec);
  return Math.round(v * m) / m;
}

function servingG(food) {
  if (food?.serving_g > 0) return food.serving_g;
  const s = food?.serving ?? '';
  const m = s.match(/\((\d+(?:\.\d+)?)\s*g\)/i) || s.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  return m ? parseFloat(m[1]) : 100;
}

function calcMacros(food, gramas) {
  const factor = gramas / servingG(food);
  const al = {
    nome:   food.name,
    qty:    `${gramas}g`,
    kcal:   rd((food.kcal   ?? 0) * factor, 0),
    prot_g: rd((food.prot_g ?? 0) * factor, 1),
    cho_g:  rd((food.carb_g ?? 0) * factor, 1),
    lip_g:  rd((food.fat_g  ?? 0) * factor, 1),
  };
  const fibra = rd((food.fibra_g ?? 0) * factor, 1);
  if (fibra) al.fibra_g = fibra;
  return al;
}

function previewMacros(food, qtd) {
  const g = parseFloat(qtd);
  if (!food || !g || g <= 0) return null;
  const f = g / servingG(food);
  return {
    kcal:  fmt((food.kcal   ?? 0) * f, 0),
    prot:  fmt((food.prot_g ?? 0) * f) + 'g',
    carb:  fmt((food.carb_g ?? 0) * f) + 'g',
    gord:  fmt((food.fat_g  ?? 0) * f) + 'g',
  };
}

function somaRef(ref) {
  return ref.alimentos.reduce((a, al) => ({
    kcal:    a.kcal    + (al.kcal    ?? 0),
    prot_g:  a.prot_g  + (al.prot_g  ?? 0),
    cho_g:   a.cho_g   + (al.cho_g   ?? 0),
    lip_g:   a.lip_g   + (al.lip_g   ?? 0),
    fibra_g: a.fibra_g + (al.fibra_g ?? 0),
  }), { kcal: 0, prot_g: 0, cho_g: 0, lip_g: 0, fibra_g: 0 });
}

/* ── Sub-componente: busca FatSecret inline para substituições ── */
function BuscaSubsInline({ onSelecionar }) {
  const [busca, setBusca]       = useState('');
  const [resultados, setRes]    = useState([]);
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState(null);

  async function buscar() {
    const termo = busca.trim();
    if (!termo) return;
    setLoading(true); setErro(null); setRes([]);
    try {
      const res  = await fetch(`/.netlify/functions/fatsecret?q=${encodeURIComponent(termo)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
      setRes((data.foods ?? []).slice(0, 10));
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Buscar no FatSecret (ex: banana, rice…)"
          style={{ flex: 1, fontSize: 12 }}
        />
        <button className="btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} onClick={buscar} disabled={loading || !busca.trim()}>
          {loading ? '…' : 'Buscar'}
        </button>
      </div>
      {erro && <div style={{ fontSize: 11, color: 'var(--red)' }}>{erro}</div>}
      {resultados.map(f => (
        <button
          key={f.food_id}
          onClick={() => { onSelecionar(f); setBusca(''); setRes([]); }}
          style={{
            display: 'block', width: '100%', textAlign: 'left', background: 'none',
            border: '0.5px solid var(--border)', borderRadius: 5, padding: '5px 8px',
            cursor: 'pointer', marginBottom: 3, fontSize: 11, color: 'var(--dark)',
          }}
        >
          {f.name}
          {f.serving && <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({f.serving})</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Componente principal ──────────────────────────────────── */
export default function BuscarAlimentos() {
  const { user } = useSession();

  // Busca
  const [busca, setBusca]               = useState('');
  const [resultados, setResultados]     = useState([]);
  const [totalRes, setTotalRes]         = useState(null);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [erroBusca, setErroBusca]       = useState(null);

  // Seleção de alimento
  const [selecionado, setSelecionado]       = useState(null);
  const [detalhe, setDetalhe]               = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [qtdGramas, setQtdGramas]           = useState('100');

  // Montagem do plano
  const [pacientes, setPacientes]         = useState([]);
  const [pacienteId, setPacienteId]       = useState('');
  const [refAtiva, setRefAtiva]           = useState('Café da Manhã');
  const [plano, setPlano]                 = useState(planoVazio);
  const [salvando, setSalvando]           = useState(false);
  const [feedbackSalvar, setFeedbackSalvar] = useState(null);

  // Painel direito: "plano" ou "subs"
  const [painelDir, setPainelDir] = useState('plano');

  // Substituições: { [refNome]: { [catKey]: string } }
  const [subs, setSubs] = useState(subsVazia);
  // Qual alimento está com o painel de subs expandido: `${refNome}__${idx}`
  const [subsAberta, setSubsAberta] = useState(null);
  // Categoria selecionada por alimento: { [`${refNome}__${idx}`]: catKey }
  const [alimCat, setAlimCat] = useState({});

  const inputRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('pacientes').select('id, nome')
      .eq('nutri_id', user.id).order('nome')
      .then(({ data }) => { if (data) setPacientes(data); });
  }, [user?.id]);

  useEffect(() => {
    if (!selecionado) { setDetalhe(null); return; }
    setDetalhe(null);
    setLoadingDetalhe(true);
    fetch(`/.netlify/functions/fatsecret?food_id=${selecionado.food_id}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setDetalhe(d); })
      .catch(() => {})
      .finally(() => setLoadingDetalhe(false));
  }, [selecionado?.food_id]);

  /* ── Buscar ──────────────────────────────────────────────── */
  async function executarBusca() {
    const termo = busca.trim();
    if (!termo) return;
    setLoadingBusca(true);
    setErroBusca(null);
    setResultados([]);
    setSelecionado(null);
    setDetalhe(null);
    try {
      const res  = await fetch(`/.netlify/functions/fatsecret?q=${encodeURIComponent(termo)}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
      setResultados(data.foods ?? []);
      setTotalRes(data.total ?? null);
    } catch (e) {
      setErroBusca(e.message);
    } finally {
      setLoadingBusca(false);
    }
  }

  /* ── Adicionar alimento ao plano ─────────────────────────── */
  function adicionarAlimento() {
    const g = parseFloat(qtdGramas);
    if (!g || g <= 0 || !selecionado) return;
    const src = detalhe ?? selecionado;
    const al  = calcMacros(src, g);
    setPlano(prev => ({
      ...prev,
      [refAtiva]: {
        ...prev[refAtiva],
        alimentos: [...prev[refAtiva].alimentos, al],
      },
    }));
    setSelecionado(null);
    setDetalhe(null);
    setQtdGramas('100');
    setFeedbackSalvar(null);
  }

  function removerAlimento(refNome, idx) {
    setPlano(prev => ({
      ...prev,
      [refNome]: {
        ...prev[refNome],
        alimentos: prev[refNome].alimentos.filter((_, i) => i !== idx),
      },
    }));
    // limpa cat e subs expandidos para esse alimento
    const key = `${refNome}__${idx}`;
    setAlimCat(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (subsAberta === key) setSubsAberta(null);
  }

  function limparPlano() {
    if (!window.confirm('Limpar todo o plano em montagem?')) return;
    setPlano(planoVazio());
    setSubs(subsVazia());
    setAlimCat({});
    setSubsAberta(null);
    setFeedbackSalvar(null);
  }

  /* ── Adicionar alimento como substituição via FatSecret ──── */
  function adicionarSubFatSecret(refNome, catKey, food) {
    const porcao = food.serving ? `${food.name} ${food.serving}` : food.name;
    setSubs(prev => {
      const refSubs = prev[refNome] ?? {};
      const atual = refSubs[catKey] ?? '';
      const sep = atual.trim() ? ' · ' : '';
      return {
        ...prev,
        [refNome]: { ...refSubs, [catKey]: atual + sep + porcao },
      };
    });
  }

  function setSubsTexto(refNome, catKey, val) {
    setSubs(prev => ({
      ...prev,
      [refNome]: { ...(prev[refNome] ?? {}), [catKey]: val },
    }));
  }

  /* ── Converter subs para formato subsTexto (planos_visuais) ─ */
  function buildSubsTexto() {
    const result = {};
    for (const ref of REFEICOES) {
      const mealKey = normMealKey(ref.nome);
      const cats = subs[ref.nome] ?? {};
      const temConteudo = Object.values(cats).some(v => v?.trim());
      if (temConteudo) {
        result[mealKey] = {};
        for (const [catKey, texto] of Object.entries(cats)) {
          if (texto?.trim()) result[mealKey][catKey] = texto.trim();
        }
      }
    }
    return Object.keys(result).length ? result : null;
  }

  /* ── Salvar plano + substituições no Supabase ────────────── */
  async function salvarPlano() {
    if (!pacienteId) return setFeedbackSalvar({ tipo: 'erro', msg: 'Selecione uma paciente antes de salvar.' });
    const refsComAlimentos = REFEICOES.filter(r => plano[r.nome].alimentos.length > 0);
    if (!refsComAlimentos.length) return setFeedbackSalvar({ tipo: 'erro', msg: 'Adicione pelo menos um alimento.' });

    const totDia = REFEICOES.reduce((acc, r) => {
      const t = somaRef(plano[r.nome]);
      return { kcal: acc.kcal + t.kcal, prot_g: acc.prot_g + t.prot_g, cho_g: acc.cho_g + t.cho_g, lip_g: acc.lip_g + t.lip_g, fibra_g: acc.fibra_g + t.fibra_g };
    }, { kcal: 0, prot_g: 0, cho_g: 0, lip_g: 0, fibra_g: 0 });

    const subsTexto = buildSubsTexto();

    const dados = {
      macros: {
        kcal:    rd(totDia.kcal, 0),
        prot_g:  rd(totDia.prot_g, 1),
        cho_g:   rd(totDia.cho_g, 1),
        lip_g:   rd(totDia.lip_g, 1),
        ...(totDia.fibra_g > 0 ? { fibras_g: rd(totDia.fibra_g, 1) } : {}),
      },
      refeicoes: refsComAlimentos.map(r => {
        const tot = somaRef(plano[r.nome]);
        return {
          nome:      r.nome,
          horario:   plano[r.nome].horario,
          kcal:      rd(tot.kcal, 0),
          prot_g:    rd(tot.prot_g, 1),
          cho_g:     rd(tot.cho_g, 1),
          lip_g:     rd(tot.lip_g, 1),
          alimentos: plano[r.nome].alimentos,
        };
      }),
      ...(subsTexto ? { subs_texto: subsTexto } : {}),
    };

    setSalvando(true);
    setFeedbackSalvar(null);
    const { error } = await supabase.from('planos').insert({
      paciente_id: pacienteId,
      nutri_id:    user.id,
      dados,
    });
    setSalvando(false);

    if (error) return setFeedbackSalvar({ tipo: 'erro', msg: error.message });
    const pacNome = pacientes.find(p => p.id === pacienteId)?.nome ?? 'paciente';
    setFeedbackSalvar({ tipo: 'ok', msg: `Plano salvo para ${pacNome}! Substituições incluídas — abre na aba PDF Final.` });
  }

  /* ── PDF rascunho (uso interno da nutri) ────────────────── */
  function baixarPdfRascunho() {
    const refsComAlimentos = REFEICOES.filter(r => plano[r.nome].alimentos.length > 0);
    if (!refsComAlimentos.length) return;

    const totDiaLocal = REFEICOES.reduce((acc, r) => {
      const t = somaRef(plano[r.nome]);
      return { kcal: acc.kcal + t.kcal, prot_g: acc.prot_g + t.prot_g, cho_g: acc.cho_g + t.cho_g, lip_g: acc.lip_g + t.lip_g, fibra_g: acc.fibra_g + t.fibra_g };
    }, { kcal: 0, prot_g: 0, cho_g: 0, lip_g: 0, fibra_g: 0 });

    const planoParaPdf = {
      macros: {
        kcal:    rd(totDiaLocal.kcal, 0),
        prot_g:  rd(totDiaLocal.prot_g, 1),
        cho_g:   rd(totDiaLocal.cho_g, 1),
        lip_g:   rd(totDiaLocal.lip_g, 1),
        ...(totDiaLocal.fibra_g > 0 ? { fibras_g: rd(totDiaLocal.fibra_g, 1) } : {}),
      },
      refeicoes: refsComAlimentos.map(r => {
        const tot = somaRef(plano[r.nome]);
        return {
          nome:      r.nome,
          horario:   plano[r.nome].horario,
          kcal:      rd(tot.kcal, 0),
          prot_g:    rd(tot.prot_g, 1),
          cho_g:     rd(tot.cho_g, 1),
          lip_g:     rd(tot.lip_g, 1),
          alimentos: plano[r.nome].alimentos,
        };
      }),
    };

    const pacNome = pacientes.find(p => p.id === pacienteId)?.nome ?? 'Rascunho';
    const html = gerarPlanoHtml({
      pacienteNome: pacNome,
      plano:        planoParaPdf,
      extras:       {},
      subsTexto:    buildSubsTexto(),
      nutriNome:    '',
      nutriCrn:     '',
      nutriEmail:   '',
    });

    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para abrir o PDF.'); return; }
    win.document.write(html);
    win.document.close();
  }

  /* ── Derivados ───────────────────────────────────────────── */
  const srcAtivo       = detalhe ?? selecionado;
  const preview        = previewMacros(srcAtivo, qtdGramas);
  const totalAlimentos = REFEICOES.reduce((s, r) => s + plano[r.nome].alimentos.length, 0);
  const totDia         = REFEICOES.reduce((acc, r) => {
    const t = somaRef(plano[r.nome]);
    return { kcal: acc.kcal + t.kcal, prot_g: acc.prot_g + t.prot_g, cho_g: acc.cho_g + t.cho_g, lip_g: acc.lip_g + t.lip_g };
  }, { kcal: 0, prot_g: 0, cho_g: 0, lip_g: 0 });

  const refsComAlimentos = REFEICOES.filter(r => plano[r.nome].alimentos.length > 0);

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 1120, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-title">Buscar Alimentos</div>
        <div className="page-sub">Monte planos alimentares com a base FatSecret. Busque, ajuste a quantidade e defina substituições.</div>
      </div>

      {/* ── Seletores: paciente + refeição ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label className="field-label">Paciente</label>
              <select value={pacienteId} onChange={e => { setPacienteId(e.target.value); setFeedbackSalvar(null); }}>
                <option value="">Selecionar paciente…</option>
                {pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label className="field-label">Adicionar alimentos na refeição</label>
              <select value={refAtiva} onChange={e => setRefAtiva(e.target.value)}>
                {REFEICOES.map(r => <option key={r.nome} value={r.nome}>{r.nome}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', paddingBottom: 6 }}>
              Busque → clique → ajuste gramas → <strong>Adicionar</strong>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>

        {/* ── Coluna esquerda: busca + resultados ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div className="card">
            <div className="card-body">
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  ref={inputRef}
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && executarBusca()}
                  placeholder="Ex: chicken breast, banana, white rice, greek yogurt…"
                  style={{ flex: 1, fontSize: 14 }}
                  autoFocus
                />
                <button className="btn" onClick={executarBusca} disabled={loadingBusca || !busca.trim()}>
                  <i className="ti ti-search" aria-hidden="true"></i>
                  {loadingBusca ? 'Buscando…' : 'Buscar'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                💡 A base FatSecret é majoritariamente em inglês — busque em inglês para mais resultados.
              </div>
              {erroBusca && (
                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: '#fbeaf0', color: 'var(--red)', fontSize: 13 }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: 6 }} aria-hidden="true"></i>
                  {erroBusca}
                </div>
              )}
            </div>
          </div>

          {loadingBusca && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Buscando na base FatSecret…
            </div>
          )}

          {!loadingBusca && resultados.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '6px 14px', background: '#faf7f2', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text3)' }}>
                {totalRes ?? resultados.length} resultado{(totalRes ?? resultados.length) !== 1 ? 's' : ''} — mostrando 20
              </div>
              {resultados.map((food, i) => {
                const ativo = selecionado?.food_id === food.food_id;
                return (
                  <div key={food.food_id} style={{ borderBottom: i < resultados.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                    <button
                      onClick={() => {
                        if (ativo) { setSelecionado(null); setDetalhe(null); }
                        else { setSelecionado(food); setQtdGramas('100'); }
                      }}
                      style={{
                        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                        background: ativo ? '#fffbf5' : 'transparent',
                        padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: ativo ? 600 : 400, color: 'var(--dark)', marginBottom: 1 }}>
                          {food.name}
                          {food.brand && <span style={{ fontSize: 11, color: '#c9a96e', marginLeft: 6, fontWeight: 400 }}>{food.brand}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {food.serving && <span>por {food.serving}</span>}
                          {food.kcal    != null && <span>{fmt(food.kcal, 0)} kcal</span>}
                          {food.prot_g  != null && <span>{fmt(food.prot_g)}g prot</span>}
                          {food.carb_g  != null && <span>{fmt(food.carb_g)}g carb</span>}
                          {food.fat_g   != null && <span>{fmt(food.fat_g)}g gord</span>}
                        </div>
                      </div>
                      <i className={`ti ti-chevron-${ativo ? 'up' : 'down'}`} style={{ fontSize: 13, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true"></i>
                    </button>

                    {ativo && (
                      <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border)', background: '#fffbf5' }}>
                        {preview && (
                          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                            {[
                              { l: 'kcal', v: preview.kcal },
                              { l: 'prot', v: preview.prot },
                              { l: 'carb', v: preview.carb },
                              { l: 'gord', v: preview.gord },
                            ].map(m => (
                              <div key={m.l} style={{ textAlign: 'center', minWidth: 44 }}>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--dark)', lineHeight: 1 }}>{m.v}</div>
                                <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 2 }}>{m.l}</div>
                              </div>
                            ))}
                            {loadingDetalhe && (
                              <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', fontStyle: 'italic' }}>refinando…</span>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input
                              type="number" min="1" max="5000"
                              value={qtdGramas}
                              onChange={e => setQtdGramas(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && adicionarAlimento()}
                              style={{ width: 76, fontSize: 14, textAlign: 'center' }}
                              autoFocus
                            />
                            <span style={{ fontSize: 13, color: 'var(--text3)' }}>g</span>
                          </div>
                          <button
                            className="btn"
                            style={{ fontSize: 12, padding: '6px 16px' }}
                            onClick={adicionarAlimento}
                            disabled={!qtdGramas || parseFloat(qtdGramas) <= 0}
                          >
                            <i className="ti ti-plus" aria-hidden="true"></i>
                            Adicionar ao {refAtiva}
                          </button>
                          <button
                            onClick={() => { setSelecionado(null); setDetalhe(null); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', padding: '4px 0' }}
                          >
                            cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loadingBusca && resultados.length === 0 && busca && !erroBusca && (
            <div className="card empty-card">
              <div className="empty-sub">Nenhum resultado para "{busca}". Tente em inglês (ex: chicken breast, sweet potato).</div>
            </div>
          )}

          {!loadingBusca && resultados.length === 0 && !busca && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)' }}>
              <i className="ti ti-salad" style={{ fontSize: 40, display: 'block', marginBottom: 10, opacity: 0.35 }} aria-hidden="true"></i>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Busque um alimento para começar</div>
              <div style={{ fontSize: 12, marginTop: 5, opacity: 0.7 }}>chicken, banana, rice, greek yogurt, whey protein…</div>
            </div>
          )}
        </div>

        {/* ── Coluna direita: plano + substituições ── */}
        <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>

            {/* Tabs do painel direito */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#f5f1eb' }}>
              {[
                { id: 'plano', label: 'Plano Base' },
                { id: 'subs',  label: `Substituições${refsComAlimentos.length > 0 ? ` (${refsComAlimentos.length})` : ''}` },
              ].map(t => (
                <button key={t.id} onClick={() => setPainelDir(t.id)} style={{
                  flex: 1, padding: '9px 6px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: painelDir === t.id ? '#fff' : 'transparent',
                  color: painelDir === t.id ? 'var(--dark)' : 'var(--text3)',
                  borderBottom: painelDir === t.id ? '2px solid var(--green)' : '2px solid transparent',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─── Painel: Plano Base ─── */}
            {painelDir === 'plano' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)' }}>Plano em montagem</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {totalAlimentos === 0 ? 'Nenhum alimento ainda' : `${totalAlimentos} alimento${totalAlimentos !== 1 ? 's' : ''}`}
                    </div>
                  </div>
                  {totalAlimentos > 0 && (
                    <button onClick={limparPlano} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--red)', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <i className="ti ti-trash" style={{ fontSize: 12 }} aria-hidden="true"></i> limpar
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {REFEICOES.map(r => {
                    const ref = plano[r.nome];
                    if (!ref.alimentos.length) return null;
                    const tot = somaRef(ref);
                    return (
                      <div key={r.nome} style={{ borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', background: '#faf7f2' }}>
                          <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--dark)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {r.nome}
                          </span>
                          <span style={{ fontSize: 10, color: '#c9a96e', fontWeight: 600 }}>{fmt(tot.kcal, 0)} kcal</span>
                        </div>
                        {ref.alimentos.map((al, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '5px 14px', gap: 6, borderTop: '0.5px solid #f0ebe3' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{al.nome}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                                {al.qty} · {al.kcal}kcal · P:{al.prot_g}g C:{al.cho_g}g G:{al.lip_g}g
                              </div>
                            </div>
                            <button onClick={() => removerAlimento(r.nome, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '2px', flexShrink: 0 }}>
                              <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true"></i>
                            </button>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, padding: '5px 14px 8px', fontSize: 10, color: 'var(--text3)' }}>
                          <span>Sub: {fmt(tot.kcal, 0)} kcal</span>
                          <span>P:{fmt(tot.prot_g)}g</span>
                          <span>C:{fmt(tot.cho_g)}g</span>
                          <span>G:{fmt(tot.lip_g)}g</span>
                        </div>
                      </div>
                    );
                  })}

                  {totalAlimentos === 0 && (
                    <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                      Busque e adicione alimentos →
                    </div>
                  )}
                </div>

                {totalAlimentos > 0 && (
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: '#f5f1eb' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                      Total do dia
                    </div>
                    <div style={{ display: 'flex' }}>
                      {[
                        { label: 'kcal', v: fmt(totDia.kcal, 0), cor: 'var(--dark)' },
                        { label: 'prot', v: fmt(totDia.prot_g) + 'g', cor: '#185fa5' },
                        { label: 'carb', v: fmt(totDia.cho_g)  + 'g', cor: '#b97d00' },
                        { label: 'gord', v: fmt(totDia.lip_g)  + 'g', cor: '#3b6d11' },
                      ].map((m, i) => (
                        <div key={m.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border)' : 'none', padding: '0 4px' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: m.cor, lineHeight: 1 }}>{m.v}</div>
                          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ─── Painel: Substituições ─── */}
            {painelDir === 'subs' && (
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {refsComAlimentos.length === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
                    Monte o plano base primeiro →
                  </div>
                ) : (
                  refsComAlimentos.map(r => {
                    const ref = plano[r.nome];
                    const mealKey = normMealKey(r.nome);
                    return (
                      <div key={r.nome} style={{ borderBottom: '1px solid var(--border)' }}>
                        {/* Header da refeição */}
                        <div style={{ padding: '8px 14px', background: '#faf7f2' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--dark)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            {r.nome}
                          </div>
                          {/* Alimentos com tag de categoria */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {ref.alimentos.map((al, idx) => {
                              const alKey = `${r.nome}__${idx}`;
                              const catSel = alimCat[alKey];
                              const aberto = subsAberta === alKey;
                              return (
                                <div key={idx}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 11, color: 'var(--dark)', flex: '1 1 100px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {al.nome}
                                    </span>
                                    <select
                                      value={catSel ?? ''}
                                      onChange={e => {
                                        const v = e.target.value;
                                        setAlimCat(prev => ({ ...prev, [alKey]: v }));
                                      }}
                                      style={{ fontSize: 10, padding: '2px 4px', flex: '0 0 auto' }}
                                    >
                                      <option value="">categoria…</option>
                                      {CATEGORIAS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                    </select>
                                    {catSel && (
                                      <button
                                        onClick={() => setSubsAberta(aberto ? null : alKey)}
                                        style={{ fontSize: 10, background: aberto ? '#e6f0d4' : '#f5f1eb', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: 'var(--dark)', whiteSpace: 'nowrap' }}
                                      >
                                        {aberto ? 'Fechar' : '+ Subs'}
                                      </button>
                                    )}
                                  </div>

                                  {/* Painel de substituições para esse alimento */}
                                  {aberto && catSel && (
                                    <div style={{ marginTop: 6, padding: '8px 10px', background: '#fffbf5', border: '1px solid var(--border)', borderRadius: 6 }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--terra)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                                        {CATEGORIAS.find(c => c.key === catSel)?.label} — substituições para {al.nome}
                                      </div>
                                      <textarea
                                        value={subs[r.nome]?.[catSel] ?? ''}
                                        onChange={e => setSubsTexto(r.nome, catSel, e.target.value)}
                                        placeholder={`Ex: ${al.nome} ${al.qty} · Opção 2 · Opção 3…`}
                                        rows={2}
                                        style={{ width: '100%', fontSize: 11, resize: 'vertical', marginBottom: 4 }}
                                      />
                                      <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>
                                        Ou busque no FatSecret para adicionar automaticamente:
                                      </div>
                                      <BuscaSubsInline
                                        onSelecionar={food => adicionarSubFatSecret(r.nome, catSel, food)}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Resumo das subs já definidas para essa refeição */}
                        {Object.entries(subs[r.nome] ?? {}).some(([, v]) => v?.trim()) && (
                          <div style={{ padding: '6px 14px 10px' }}>
                            {Object.entries(subs[r.nome]).map(([catKey, texto]) => {
                              if (!texto?.trim()) return null;
                              const catLabel = CATEGORIAS.find(c => c.key === catKey)?.label ?? catKey;
                              return (
                                <div key={catKey} style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>
                                  <span style={{ fontWeight: 700, color: 'var(--terra)' }}>{catLabel}:</span>{' '}
                                  {texto.length > 60 ? texto.slice(0, 60) + '…' : texto}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Botões salvar + PDF */}
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                onClick={salvarPlano}
                disabled={salvando || totalAlimentos === 0 || !pacienteId}
              >
                <i className="ti ti-send" aria-hidden="true"></i>
                {salvando ? 'Salvando…' : 'Salvar plano + substituições'}
              </button>
              <button
                className="btn-outline"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                onClick={baixarPdfRascunho}
                disabled={totalAlimentos === 0}
              >
                <i className="ti ti-printer" aria-hidden="true"></i>
                Baixar PDF do plano
              </button>
              {!pacienteId && totalAlimentos > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
                  Selecione uma paciente para salvar
                </div>
              )}
            </div>
          </div>

          {feedbackSalvar && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: feedbackSalvar.tipo === 'ok' ? '#e6f0d4' : '#fbeaf0',
              color:      feedbackSalvar.tipo === 'ok' ? 'var(--green)'  : 'var(--red)',
            }}>
              <i className={`ti ti-${feedbackSalvar.tipo === 'ok' ? 'check' : 'alert-circle'}`} style={{ marginRight: 6 }} aria-hidden="true"></i>
              {feedbackSalvar.msg}
            </div>
          )}

          <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', opacity: 0.6 }}>
            Dados nutricionais: FatSecret Platform API
          </div>
        </div>
      </div>
    </div>
  );
}
