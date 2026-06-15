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

async function baixarFoto(url, nomeArq) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeArq;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

export default function FotosEvolucao({ pacienteId, pacienteNome }) {
  const [fotos, setFotos] = useState(undefined);
  const [urls, setUrls] = useState({});
  const [ampliada, setAmpliada] = useState(null); // { url, label }
  const [baixando, setBaixando] = useState(null); // mes em download

  useEffect(() => {
    if (!pacienteId) return;
    let active = true;

    async function carregar() {
      // Busca apenas fotos enviadas pela paciente (frente/lado/costas)
      const { data } = await supabase
        .from('fotos_evolucao')
        .select('id, tipo, data_foto, storage_path, created_at')
        .eq('paciente_id', pacienteId)
        .in('tipo', ['frente', 'lado', 'costas'])
        .order('data_foto', { ascending: false });

      if (!active) return;
      const lista = data ?? [];
      setFotos(lista);

      const novasUrls = {};
      for (const f of lista) {
        const u = await getSignedUrl(f.storage_path);
        if (u && active) novasUrls[f.id] = u;
      }
      if (active) setUrls(novasUrls);
    }

    carregar();
    return () => { active = false; };
  }, [pacienteId]);

  if (fotos === undefined) {
    return (
      <div className="card empty-card">
        <div className="empty-sub">Carregando fotos…</div>
      </div>
    );
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

  async function baixarMes(mes) {
    setBaixando(mes);
    const fotosMes = byMes[mes];
    const nomePac = (pacienteNome ?? 'paciente').split(' ')[0].toLowerCase();
    for (const pos of POSICOES) {
      const f = fotosMes[pos.id];
      if (!f) continue;
      const url = urls[f.id] ?? await getSignedUrl(f.storage_path);
      if (!url) continue;
      await baixarFoto(url, `${nomePac}_${mes}_${pos.id}.jpg`);
      await new Promise(r => setTimeout(r, 300)); // pequeno delay entre downloads
    }
    setBaixando(null);
  }

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <div className="page-sub">
            {fotos.length} foto{fotos.length !== 1 ? 's' : ''} · {meses.length} mês/meses
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {meses.map(mes => {
          const fotosMes = byMes[mes];
          const totalMes = POSICOES.filter(p => fotosMes[p.id] && urls[fotosMes[p.id]?.id]).length;

          return (
            <div key={mes} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Header do mês */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: '0.5px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)' }}>
                    {mesLabel(mes)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                    {totalMes} de 3 foto{totalMes !== 1 ? 's' : ''} enviada{totalMes !== 1 ? 's' : ''}
                  </div>
                </div>
                <button
                  className="btn-outline"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  disabled={baixando === mes || totalMes === 0}
                  onClick={() => baixarMes(mes)}
                >
                  <i className="ti ti-download" style={{ fontSize: 13 }} aria-hidden="true" />
                  {baixando === mes ? 'Baixando…' : 'Baixar'}
                </button>
              </div>

              {/* Grade 3 colunas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
                {POSICOES.map((pos, idx) => {
                  const f = fotosMes[pos.id];
                  const fUrl = f ? urls[f.id] : null;

                  return (
                    <div
                      key={pos.id}
                      style={{
                        borderRight: idx < 2 ? '0.5px solid var(--border)' : 'none',
                      }}
                    >
                      {/* Foto ou placeholder */}
                      <div
                        onClick={() => fUrl && setAmpliada({ url: fUrl, label: `${pos.label} — ${mesLabel(mes)}` })}
                        style={{
                          aspectRatio: '3/4',
                          background: 'var(--bg2)',
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
                            {/* Overlay download individual */}
                            <div style={{
                              position: 'absolute', top: 6, right: 6,
                              display: 'flex', gap: 4,
                            }}>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  const nomePac = (pacienteNome ?? 'paciente').split(' ')[0].toLowerCase();
                                  baixarFoto(fUrl, `${nomePac}_${mes}_${pos.id}.jpg`);
                                }}
                                title={`Baixar ${pos.label}`}
                                style={{
                                  width: 28, height: 28,
                                  background: 'rgba(0,0,0,0.55)', color: '#fff',
                                  border: 'none', borderRadius: 6, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  backdropFilter: 'blur(4px)',
                                }}
                              >
                                <i className="ti ti-download" style={{ fontSize: 14 }} aria-hidden="true" />
                              </button>
                            </div>
                            {/* Lupa */}
                            <div style={{
                              position: 'absolute', bottom: 6, right: 6,
                            }}>
                              <div style={{
                                width: 24, height: 24,
                                background: 'rgba(0,0,0,0.45)', color: '#fff',
                                borderRadius: 5,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <i className="ti ti-zoom-in" style={{ fontSize: 13 }} aria-hidden="true" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: 'center' }}>
                            <i className="ti ti-camera" style={{ fontSize: 24, color: 'var(--border)', display: 'block', marginBottom: 4 }} aria-hidden="true" />
                            <div style={{ fontSize: 10, color: 'var(--text3)' }}>Não enviada</div>
                          </div>
                        )}
                      </div>

                      {/* Label da posição */}
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
          );
        })}
      </div>

      {/* Lightbox */}
      {ampliada && (
        <div
          onClick={() => setAmpliada(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
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
