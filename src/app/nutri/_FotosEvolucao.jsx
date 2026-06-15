import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const POSICOES = [
  { id: 'frente', label: 'Frente' },
  { id: 'lado',   label: 'Lado' },
  { id: 'costas', label: 'Costas' },
];

const urlCache = new Map();
async function getSignedUrl(path) {
  const cached = urlCache.get(path);
  if (cached && cached.exp > Date.now()) return cached.url;
  const { data } = await supabase.storage.from('fotos_evolucao').createSignedUrl(path, 300);
  if (!data) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 280_000 });
  return data.signedUrl;
}

function mesLabel(mes) {
  const [ano, m] = mes.split('-');
  const N = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${N[parseInt(m, 10) - 1] ?? m} ${ano}`;
}

async function baixarFoto(url, nome) {
  try {
    const blob = await fetch(url).then(r => r.blob());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

export default function FotosEvolucao({ pacienteId, pacienteNome }) {
  const [fotos,          setFotos]          = useState(undefined);
  const [urls,           setUrls]           = useState({});
  const [mesSelecionado, setMesSelecionado] = useState(null); // mes string ou null
  const [ampliada,       setAmpliada]       = useState(null); // { url, label }
  const [baixando,       setBaixando]       = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    let active = true;

    async function carregar() {
      const { data } = await supabase
        .from('fotos_evolucao')
        .select('id, tipo, data_foto, storage_path')
        .eq('paciente_id', pacienteId)
        .in('tipo', ['frente', 'lado', 'costas'])
        .order('data_foto', { ascending: false });

      if (!active) return;
      const lista = data ?? [];
      setFotos(lista);

      const novas = {};
      for (const f of lista) {
        const u = await getSignedUrl(f.storage_path);
        if (u && active) novas[f.id] = u;
      }
      if (active) setUrls(novas);
    }

    carregar();
    return () => { active = false; };
  }, [pacienteId]);

  if (fotos === undefined) {
    return <div className="card empty-card"><div className="empty-sub">Carregando fotos…</div></div>;
  }

  if (fotos.length === 0) {
    return (
      <div className="card empty-card">
        <i className="ti ti-camera" style={{ fontSize: 32, color: 'var(--text3)', display: 'block', marginBottom: 12 }} aria-hidden="true" />
        <div className="empty-sub">
          Nenhuma foto enviada ainda. As fotos aparecerão aqui quando a paciente enviar pelo app.
        </div>
      </div>
    );
  }

  // Agrupar por mês
  const byMes = {};
  for (const f of fotos) {
    const mes = (f.data_foto ?? '').slice(0, 7);
    if (!mes) continue;
    if (!byMes[mes]) byMes[mes] = {};
    byMes[mes][f.tipo] = f;
  }
  const meses = Object.keys(byMes).sort().reverse();

  const nomePac = (pacienteNome ?? 'paciente').split(' ')[0].toLowerCase();

  async function baixarMes(mes, e) {
    e?.stopPropagation();
    setBaixando(mes);
    for (const pos of POSICOES) {
      const f = byMes[mes]?.[pos.id];
      if (!f) continue;
      const url = urls[f.id] ?? await getSignedUrl(f.storage_path);
      if (!url) continue;
      await baixarFoto(url, `${nomePac}_${mes}_${pos.id}.jpg`);
      await new Promise(r => setTimeout(r, 300));
    }
    setBaixando(null);
  }

  // ── Vista de detalhe (modal) ────────────────────────────────
  const detalhe = mesSelecionado ? (
    <div
      onClick={() => setMesSelecionado(null)}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white, #fff)',
          borderRadius: 16,
          width: '100%', maxWidth: 720,
          maxHeight: '88vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header do modal */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)' }}>
              {mesLabel(mesSelecionado)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              {POSICOES.filter(p => byMes[mesSelecionado]?.[p.id] && urls[byMes[mesSelecionado]?.[p.id]?.id]).length} de 3 fotos enviadas
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn-outline"
              style={{ fontSize: 12, padding: '5px 12px' }}
              disabled={baixando === mesSelecionado}
              onClick={e => baixarMes(mesSelecionado, e)}
            >
              <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true" />
              {baixando === mesSelecionado ? 'Baixando…' : 'Baixar todas'}
            </button>
            <button
              onClick={() => setMesSelecionado(null)}
              style={{
                background: 'var(--bg2, #f5f5f5)', border: 'none',
                borderRadius: 8, padding: '6px 14px',
                fontSize: 13, cursor: 'pointer', color: 'var(--dark)',
                fontFamily: 'var(--font-sans)', fontWeight: 500,
              }}
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Grade das 3 fotos */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 0, overflowY: 'auto', flex: 1,
        }}>
          {POSICOES.map((pos, idx) => {
            const f    = byMes[mesSelecionado]?.[pos.id];
            const fUrl = f ? urls[f.id] : null;

            return (
              <div
                key={pos.id}
                style={{ borderRight: idx < 2 ? '0.5px solid var(--border)' : 'none' }}
              >
                {/* Foto ou placeholder */}
                <div
                  onClick={() => fUrl && setAmpliada({ url: fUrl, label: `${pos.label} — ${mesLabel(mesSelecionado)}` })}
                  style={{
                    aspectRatio: '3/4',
                    background: 'var(--bg2, #f5f5f5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: fUrl ? 'pointer' : 'default',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {fUrl ? (
                    <>
                      <img
                        src={fUrl}
                        alt={pos.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {/* Botão download individual */}
                      <button
                        onClick={e => { e.stopPropagation(); baixarFoto(fUrl, `${nomePac}_${mesSelecionado}_${pos.id}.jpg`); }}
                        title={`Baixar ${pos.label}`}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 30, height: 30,
                          background: 'rgba(0,0,0,0.55)', color: '#fff',
                          border: 'none', borderRadius: 7, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true" />
                      </button>
                      {/* Lupa */}
                      <div style={{
                        position: 'absolute', bottom: 8, right: 8,
                        width: 26, height: 26,
                        background: 'rgba(0,0,0,0.45)', color: '#fff',
                        borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none',
                      }}>
                        <i className="ti ti-zoom-in" style={{ fontSize: 13 }} aria-hidden="true" />
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <i className="ti ti-camera" style={{ fontSize: 26, color: 'var(--border)', display: 'block', marginBottom: 4 }} aria-hidden="true" />
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>Não enviada</div>
                    </div>
                  )}
                </div>

                {/* Label */}
                <div style={{
                  textAlign: 'center', padding: '8px 4px',
                  borderTop: '0.5px solid var(--border)',
                  fontSize: 11, fontWeight: 600, color: 'var(--text2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  {fUrl && <i className="ti ti-check" style={{ fontSize: 11, color: 'var(--green)' }} aria-hidden="true" />}
                  {pos.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  // ── Vista de lista ──────────────────────────────────────────
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <div className="page-sub">
          {fotos.length} foto{fotos.length !== 1 ? 's' : ''} · {meses.length} mês/meses
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {meses.map(mes => {
          const fotosMes  = byMes[mes];
          const total     = POSICOES.filter(p => fotosMes[p.id] && urls[fotosMes[p.id]?.id]).length;
          const primeiraF = POSICOES.map(p => fotosMes[p.id]).find(f => f && urls[f?.id]);
          const thumbUrl  = primeiraF ? urls[primeiraF.id] : null;

          return (
            <div
              key={mes}
              className="card"
              onClick={() => setMesSelecionado(mes)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 16px', cursor: 'pointer',
              }}
            >
              {/* Miniatura */}
              <div style={{
                width: 56, height: 56, borderRadius: 10, flexShrink: 0,
                overflow: 'hidden', background: 'var(--bg2, #f5f5f5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {thumbUrl
                  ? <img src={thumbUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <i className="ti ti-camera" style={{ fontSize: 20, color: 'var(--border)' }} aria-hidden="true" />
                }
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)' }}>
                  {mesLabel(mes)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {total === 3
                    ? '3 fotos enviadas'
                    : `${total} de 3 foto${total !== 1 ? 's' : ''} enviada${total !== 1 ? 's' : ''}`}
                </div>
              </div>

              {/* Indicador de completude + chevron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {total === 3 && (
                  <i className="ti ti-circle-check-filled" style={{ fontSize: 16, color: 'var(--green)' }} aria-hidden="true" />
                )}
                <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--text3)' }} aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de detalhe */}
      {detalhe}

      {/* Lightbox */}
      {ampliada && (
        <div
          onClick={() => setAmpliada(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 600,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 600, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{ampliada.label}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={e => { e.stopPropagation(); baixarFoto(ampliada.url, ampliada.label.replace(/[^a-zA-Z0-9 ]/g, '') + '.jpg'); }}
                style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '6px 12px',
                  fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true" /> Baixar
              </button>
              <button
                onClick={() => setAmpliada(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                  border: 'none', borderRadius: 8, padding: '6px 10px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >✕</button>
            </div>
          </div>
          <img
            src={ampliada.url}
            alt={ampliada.label}
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 10, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 14 }}>
            Clique fora para fechar
          </div>
        </div>
      )}
    </>
  );
}
