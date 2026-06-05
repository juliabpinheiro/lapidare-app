import { useState, useRef } from 'react';

function fmt(v, dec = 1) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toFixed(dec);
}

function MacroBox({ label, valor, unit = 'g', cor }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: cor ?? 'var(--dark)', lineHeight: 1 }}>
        {valor}
        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  );
}

export default function BuscarAlimentos() {
  const [busca, setBusca]         = useState('');
  const [resultados, setResultados] = useState([]);
  const [total, setTotal]         = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [detalhe, setDetalhe]     = useState(null);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [erro, setErro]           = useState(null);
  const [copiado, setCopiado]     = useState(false);
  const inputRef = useRef(null);

  async function executarBusca() {
    const termo = busca.trim();
    if (!termo) return;
    setLoadingBusca(true);
    setErro(null);
    setResultados([]);
    setSelecionado(null);
    setDetalhe(null);

    try {
      const res  = await fetch(`/.netlify/functions/fatsecret?q=${encodeURIComponent(termo)}`);
      const data = await res.json();
      // Mostra erro real tanto de HTTP 4xx/5xx quanto do campo error no JSON
      if (!res.ok || data.error) throw new Error(data.error || `Erro HTTP ${res.status}`);
      setResultados(data.foods ?? []);
      setTotal(data.total ?? null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoadingBusca(false);
    }
  }

  async function selecionarAlimento(food) {
    setSelecionado(food);
    setDetalhe(null);
    setCopiado(false);
    setLoadingDetalhe(true);

    try {
      const res  = await fetch(`/.netlify/functions/fatsecret?food_id=${food.food_id}`);
      const data = await res.json();
      if (res.ok) setDetalhe(data);
    } catch (_) { /* mostra dados da busca mesmo sem detalhe */ }
    finally { setLoadingDetalhe(false); }
  }

  function copiarParaPlano() {
    const src = detalhe ?? selecionado;
    if (!src) return;

    const obj = {
      nome:   src.name,
      qty:    detalhe?.serving_desc ?? selecionado?.serving ?? '100g',
      kcal:   detalhe?.kcal   ?? selecionado?.kcal   ?? null,
      prot_g: detalhe?.prot_g ?? selecionado?.prot_g ?? null,
      cho_g:  detalhe?.carb_g ?? selecionado?.carb_g ?? null,
      lip_g:  detalhe?.fat_g  ?? selecionado?.fat_g  ?? null,
    };
    // Remove nulls
    Object.keys(obj).forEach(k => obj[k] == null && delete obj[k]);

    navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
      .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); })
      .catch(() => alert('Não foi possível copiar. Use Ctrl+C no texto abaixo.'));
  }

  const exibindo = detalhe ?? selecionado;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-title">Buscar Alimentos</div>
        <div className="page-sub">
          Pesquise na base FatSecret — calorias e macros por porção. Use para montar planos alimentares.
        </div>
      </div>

      {/* Barra de busca */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              ref={inputRef}
              value={busca}
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && executarBusca()}
              placeholder="Ex: frango peito grelhado, banana prata, arroz integral..."
              style={{ flex: 1, fontSize: 14 }}
              autoFocus
            />
            <button className="btn" onClick={executarBusca} disabled={loadingBusca || !busca.trim()}>
              <i className="ti ti-search" aria-hidden="true"></i>
              {loadingBusca ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
          {erro && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#fbeaf0', color: 'var(--red)', fontSize: 13 }}>
              <i className="ti ti-alert-circle" style={{ marginRight: 6 }} aria-hidden="true"></i>
              {erro}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selecionado ? '1fr 340px' : '1fr', gap: 16, alignItems: 'start' }}>

        {/* Lista de resultados */}
        <div>
          {loadingBusca && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
              <i className="ti ti-loader-2" style={{ fontSize: 20, display: 'block', marginBottom: 8 }} aria-hidden="true"></i>
              Buscando na base FatSecret…
            </div>
          )}

          {!loadingBusca && resultados.length === 0 && busca && !erro && (
            <div className="card empty-card">
              <div className="empty-sub">Nenhum resultado para "{busca}". Tente outro termo.</div>
            </div>
          )}

          {resultados.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.05em' }}>
                {total ? `${total} resultados encontrados` : `${resultados.length} resultados`} — mostrando 20
              </div>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {resultados.map((food, i) => {
                  const sel = selecionado?.food_id === food.food_id;
                  return (
                    <button
                      key={food.food_id}
                      onClick={() => selecionarAlimento(food)}
                      style={{
                        width: '100%', textAlign: 'left', background: sel ? '#fdf3ee' : 'transparent',
                        border: 'none', borderBottom: i < resultados.length - 1 ? '0.5px solid var(--border)' : 'none',
                        padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: sel ? 600 : 400, color: 'var(--dark)', marginBottom: 2 }}>
                          {food.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {food.brand && <span style={{ color: '#c9a96e' }}>{food.brand}</span>}
                          {food.serving && <span>{food.serving}</span>}
                          {food.kcal != null && <span>{fmt(food.kcal, 0)} kcal</span>}
                          {food.prot_g != null && <span>{fmt(food.prot_g)}g prot</span>}
                          {food.carb_g != null && <span>{fmt(food.carb_g)}g carb</span>}
                          {food.fat_g != null && <span>{fmt(food.fat_g)}g gord</span>}
                        </div>
                      </div>
                      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true"></i>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Estado vazio inicial */}
          {!loadingBusca && resultados.length === 0 && !busca && (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text3)' }}>
              <i className="ti ti-salad" style={{ fontSize: 36, display: 'block', marginBottom: 10, opacity: 0.4 }} aria-hidden="true"></i>
              <div style={{ fontSize: 14 }}>Digite um alimento e clique em <strong>Buscar</strong></div>
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>Ex: frango, batata doce, whey protein, queijo minas...</div>
            </div>
          )}
        </div>

        {/* Painel de detalhe */}
        {selecionado && (
          <div style={{ position: 'sticky', top: 16 }}>
            <div className="card" style={{ overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', background: '#f5f1eb' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', lineHeight: 1.3, marginBottom: 3 }}>
                  {exibindo?.name}
                </div>
                {exibindo?.brand && (
                  <div style={{ fontSize: 11, color: '#c9a96e', fontWeight: 500 }}>{exibindo.brand}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {loadingDetalhe
                    ? 'Carregando detalhes…'
                    : `Por ${detalhe?.serving_desc ?? selecionado?.serving ?? '100g'}`
                  }
                  {detalhe?.serving_g && detalhe.serving_g !== 100 && (
                    <span style={{ marginLeft: 6, color: '#c9a96e' }}>
                      ({detalhe.serving_g}{detalhe.serving_unit ?? 'g'})
                    </span>
                  )}
                </div>
              </div>

              {/* Macros */}
              <div style={{ padding: '16px 12px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
                <MacroBox label="Calorias" unit="kcal"
                  valor={fmt(detalhe?.kcal ?? selecionado?.kcal, 0)} cor="var(--dark)" />
                <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
                <MacroBox label="Proteína"     valor={fmt(detalhe?.prot_g ?? selecionado?.prot_g)} cor="#185fa5" />
                <MacroBox label="Carboidrato"  valor={fmt(detalhe?.carb_g ?? selecionado?.carb_g)} cor="#b97d00" />
                <MacroBox label="Gordura"      valor={fmt(detalhe?.fat_g  ?? selecionado?.fat_g)}  cor="#3b6d11" />
              </div>

              {/* Extras */}
              {(detalhe?.fibra_g || detalhe?.sodio_mg) && (
                <div style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 16, borderBottom: '1px solid var(--border)' }}>
                  {detalhe.fibra_g && <span>Fibras: <strong>{fmt(detalhe.fibra_g)}g</strong></span>}
                  {detalhe.sodio_mg && <span>Sódio: <strong>{fmt(detalhe.sodio_mg, 0)}mg</strong></span>}
                </div>
              )}

              {/* Copiar para plano */}
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn"
                  style={{ justifyContent: 'center', background: copiado ? '#3b6d11' : undefined }}
                  onClick={copiarParaPlano}
                  disabled={loadingDetalhe}
                >
                  <i className={`ti ti-${copiado ? 'check' : 'clipboard-copy'}`} aria-hidden="true"></i>
                  {copiado ? 'Copiado!' : 'Copiar para o plano'}
                </button>
                {copiado && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.4 }}>
                    Cole no array <code style={{ background: '#f5f1eb', padding: '1px 4px', borderRadius: 3 }}>alimentos</code> do JSON do plano
                  </div>
                )}
              </div>
            </div>

            {/* Nota de fonte */}
            <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 6, opacity: 0.7 }}>
              Dados: FatSecret Platform API
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
