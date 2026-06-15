import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

const POSICOES = [
  { id: 'frente', label: 'Frente', icon: 'man', desc: 'Palmas viradas para frente, braços levemente abertos' },
  { id: 'lado',   label: 'Lado',   icon: 'walk', desc: 'Pernas juntas, braços estendidos para frente' },
  { id: 'costas', label: 'Costas', icon: 'man', desc: 'Igual à frente. Cabelo comprido: jogue para a frente' },
];

const BTN_MENU = {
  background: 'none', border: 'none', color: '#fff',
  fontSize: 11, cursor: 'pointer', padding: '6px 10px',
  borderRadius: 6, textAlign: 'left', width: '100%',
  fontFamily: 'var(--font-sans)',
};

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
  const N = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${N[parseInt(m, 10) - 1] ?? m}/${ano}`;
}

export default function EvolucaoPaciente() {
  const { user, profile } = useSession();
  const [fotos, setFotos] = useState(undefined);
  const [urls, setUrls] = useState({});
  const [menuPos, setMenuPos] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [erro, setErro] = useState(null);
  const [ampliada, setAmpliada] = useState(null);
  const fileRef = useRef();
  const pendingPos = useRef(null);

  const mesAtual = new Date().toISOString().slice(0, 7);

  async function carregar() {
    if (!user) return;
    const { data } = await supabase
      .from('fotos_evolucao')
      .select('id, tipo, data_foto, storage_path, created_at')
      .eq('paciente_id', user.id)
      .order('data_foto', { ascending: false });

    const lista = data ?? [];
    setFotos(lista);

    const novasUrls = {};
    for (const f of lista) {
      const u = await getSignedUrl(f.storage_path);
      if (u) novasUrls[f.id] = u;
    }
    setUrls(novasUrls);
  }

  useEffect(() => { carregar(); }, [user]);

  useEffect(() => {
    if (!menuPos) return;
    function handle() { setMenuPos(null); }
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [menuPos]);

  function abrirMenu(e, posicao) {
    e.stopPropagation();
    setMenuPos(prev => (prev === posicao ? null : posicao));
    setErro(null);
  }

  function selecionarFonte(e, posicao, fonte) {
    e.stopPropagation();
    pendingPos.current = posicao;
    setMenuPos(null);
    fileRef.current.removeAttribute('capture');
    if (fonte === 'camera') fileRef.current.setAttribute('capture', 'environment');
    fileRef.current.value = '';
    fileRef.current.click();
  }

  async function handleFileChange(ev) {
    const file = ev.target.files?.[0];
    if (!file || !pendingPos.current) return;

    const posicao = pendingPos.current;
    pendingPos.current = null;
    setUploading(posicao);
    setErro(null);

    const mes = new Date().toISOString().slice(0, 7);
    const path = `${user.id}/${mes}-${posicao}.jpg`;
    const dataFoto = new Date().toISOString().slice(0, 10);

    const { error: upErr } = await supabase.storage
      .from('fotos_evolucao')
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true });

    if (upErr) {
      setUploading(null);
      setErro('Erro no upload: ' + upErr.message);
      return;
    }

    // Substitui registro existente do mesmo mês+posição
    await supabase.from('fotos_evolucao')
      .delete()
      .eq('paciente_id', user.id)
      .eq('tipo', posicao)
      .gte('data_foto', `${mes}-01`)
      .lte('data_foto', `${mes}-31`);

    const { error: insErr } = await supabase.from('fotos_evolucao').insert({
      paciente_id: user.id,
      nutri_id: profile?.nutri_id ?? null,
      storage_path: path,
      tipo: posicao,
      data_foto: dataFoto,
    });

    setUploading(null);
    if (insErr) { setErro('Erro ao salvar: ' + insErr.message); return; }
    carregar();
  }

  if (fotos === undefined) {
    return <div className="empty-state"><div className="empty-sub">Carregando…</div></div>;
  }

  // Agrupar por mês
  const byMes = {};
  for (const f of fotos) {
    const mes = (f.data_foto ?? '').slice(0, 7);
    if (!mes) continue;
    if (!byMes[mes]) byMes[mes] = {};
    byMes[mes][f.tipo] = f;
  }
  const fotosAtual = byMes[mesAtual] ?? {};
  const mesesPassados = Object.keys(byMes).filter(m => m !== mesAtual).sort().reverse();
  const todasEnviadas = POSICOES.every(p => fotosAtual[p.id] && urls[fotosAtual[p.id]?.id]);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Instruções */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--ink)' }}>
          Como tirar suas fotos
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 14 }}>
          Tire a cada 30 dias para acompanharmos sua evolução. Use biquíni, sunga ou roupa de academia. Fotos de corpo todo nas 3 posições:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {POSICOES.map(p => (
            <div key={p.id} style={{
              background: 'var(--bg-soft)', borderRadius: 10,
              padding: '10px 8px', textAlign: 'center',
            }}>
              <i className={`ti ti-${p.icon}`}
                style={{ fontSize: 22, color: 'var(--gold-deep)', marginBottom: 4, display: 'block' }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{p.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload do mês atual */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 10 }}>
        <div style={{
          fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
          color: 'var(--muted)', fontWeight: 600, marginBottom: 14,
        }}>
          {mesLabel(mesAtual)} — mês atual
        </div>

        {todasEnviadas ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#f0fdf4', border: '0.5px solid #bbf7d0',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <i className="ti ti-circle-check-filled" style={{ fontSize: 22, color: '#16a34a', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d', marginBottom: 2 }}>
                Fotos enviadas com sucesso!
              </div>
              <div style={{ fontSize: 11, color: '#16a34a' }}>
                Sua nutricionista vai ver em breve.
              </div>
            </div>
          </div>
        ) : (
          <>
            {erro && (
              <div style={{
                fontSize: 12, color: 'var(--red)', background: 'var(--red-soft)',
                padding: '8px 12px', borderRadius: 8, marginBottom: 12,
              }}>{erro}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {POSICOES.map(pos => {
            const existente = fotosAtual[pos.id];
            const emUpload = uploading === pos.id;
            const temFoto = !!existente && !!urls[existente?.id];
            const menuAberto = menuPos === pos.id;

            return (
              <div key={pos.id}>
                <div
                  onClick={e => !emUpload && abrirMenu(e, pos.id)}
                  style={{
                    aspectRatio: '3/4',
                    background: temFoto ? 'transparent' : 'var(--bg-soft)',
                    borderRadius: 10, overflow: 'hidden',
                    border: `1.5px ${temFoto ? 'solid var(--hair)' : 'dashed var(--hair)'}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: emUpload ? 'default' : 'pointer',
                    position: 'relative',
                  }}
                >
                  {emUpload ? (
                    <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: 8 }}>
                      Enviando…
                    </div>
                  ) : temFoto ? (
                    <>
                      <img
                        src={urls[existente.id]}
                        alt={pos.label}
                        onClick={e => { e.stopPropagation(); setAmpliada({ url: urls[existente.id], label: pos.label }); }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {menuAberto && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.84)', borderRadius: '0 0 8px 8px',
                            padding: '4px', display: 'flex', flexDirection: 'column', gap: 2, zIndex: 10,
                          }}
                        >
                          <button onClick={e => selecionarFonte(e, pos.id, 'camera')} style={BTN_MENU}>📷 Câmera</button>
                          <button onClick={e => selecionarFonte(e, pos.id, 'galeria')} style={BTN_MENU}>🖼️ Galeria</button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <i className="ti ti-camera-plus"
                        style={{ fontSize: 22, color: 'var(--gold-deep)', marginBottom: 4 }} />
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>Adicionar</span>
                      {menuAberto && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: 'rgba(0,0,0,0.84)', borderRadius: '0 0 8px 8px',
                            padding: '4px', display: 'flex', flexDirection: 'column', gap: 2, zIndex: 10,
                          }}
                        >
                          <button onClick={e => selecionarFonte(e, pos.id, 'camera')} style={BTN_MENU}>📷 Câmera</button>
                          <button onClick={e => selecionarFonte(e, pos.id, 'galeria')} style={BTN_MENU}>🖼️ Galeria</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div style={{
                  textAlign: 'center', fontSize: 11, fontWeight: 600,
                  color: 'var(--ink)', marginTop: 5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                }}>
                  {temFoto && <i className="ti ti-circle-check-filled" style={{ fontSize: 12, color: '#2d6a2d' }} />}
                  {pos.label}
                </div>
              </div>
            );
          })}
            </div>
          </>
        )}
      </div>

      {/* Histórico de meses anteriores */}
      {mesesPassados.length > 0 && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: 10 }}>
          <div style={{
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 600, marginBottom: 14,
          }}>
            Histórico
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {mesesPassados.map(mes => (
              <div key={mes}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 8 }}>
                  {mesLabel(mes)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {POSICOES.map(pos => {
                    const f = byMes[mes]?.[pos.id];
                    const fUrl = f ? urls[f.id] : null;
                    return (
                      <div key={pos.id}>
                        <div
                          onClick={() => fUrl && setAmpliada({ url: fUrl, label: `${pos.label} — ${mesLabel(mes)}` })}
                          style={{
                            aspectRatio: '3/4', borderRadius: 8, overflow: 'hidden',
                            background: 'var(--bg-soft)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: fUrl ? 'pointer' : 'default',
                          }}
                        >
                          {fUrl ? (
                            <img src={fUrl} alt={pos.label}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <i className="ti ti-photo" style={{ fontSize: 18, color: 'var(--hair)' }} />
                          )}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                          {pos.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {fotos.length === 0 && (
        <div className="empty-state">
          <i className="ti ti-camera empty-icon" aria-hidden="true" />
          <div className="empty-title">Nenhuma foto ainda</div>
          <div className="empty-sub">
            Adicione suas primeiras fotos acima. Elas ficam salvas com segurança — só você e sua nutricionista têm acesso.
          </div>
        </div>
      )}

      {/* Lightbox */}
      {ampliada && (
        <div
          onClick={() => setAmpliada(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
            {ampliada.label}
          </div>
          <img
            src={ampliada.url}
            alt={ampliada.label}
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 10, objectFit: 'contain' }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 14 }}>
            Toque para fechar
          </div>
        </div>
      )}
    </>
  );
}
