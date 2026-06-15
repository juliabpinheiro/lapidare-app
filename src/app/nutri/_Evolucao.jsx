import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';
import { formatarResposta } from '../../lib/checkinDefault.js';

const TIPOS_FOTO = [
  { id: 'frente',          label: 'Frente' },
  { id: 'lado',            label: 'Lado' },
  { id: 'perfil_direito',  label: 'Perfil direito' },
  { id: 'perfil_esquerdo', label: 'Perfil esquerdo' },
  { id: 'costas',          label: 'Costas' },
  { id: 'livre',           label: 'Livre' },
];

// Cache de signed URLs (5 min)
const urlCache = new Map();
async function signedUrl(path) {
  const cached = urlCache.get(path);
  if (cached && cached.exp > Date.now()) return cached.url;
  const { data } = await supabase.storage.from('fotos_evolucao').createSignedUrl(path, 300);
  if (!data) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 280_000 });
  return data.signedUrl;
}

// Gera HTML para impressão / salvar como PDF
function gerarResumoPDF(consulta, numero, pacienteNome, anamnese, plano, prescricoes) {
  const d = consulta.dados ?? {};
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const br = (s) => esc(s ?? '').replace(/\n/g, '<br>');
  const secao = (titulo, conteudo) =>
    conteudo
      ? `<h2 style="font-size:16px;font-weight:600;color:#1c1712;margin-top:26px;margin-bottom:6px;border-bottom:1px solid #e0d6c4;padding-bottom:4px">${esc(titulo)}</h2><div>${conteudo}</div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Consulta ${numero} — ${esc(pacienteNome)}</title>
<style>
  body{font-family:Georgia,serif;max-width:700px;margin:40px auto;color:#1c1712;line-height:1.6;font-size:14px}
  h1{font-size:28px;font-weight:600;margin-bottom:4px}
  .meta{color:#6b5b45;font-size:13px;margin-bottom:28px}
  p{margin:0}
  pre{font-size:13px;background:#f5f0e8;padding:12px;border-radius:6px;white-space:pre-wrap;font-family:monospace;margin:0}
  @media print{.btn-print{display:none}}
</style>
</head>
<body>
<button class="btn-print" onclick="window.print()" style="background:#1c1712;color:#fff;border:none;padding:10px 20px;font-size:14px;border-radius:8px;cursor:pointer;margin-bottom:32px;font-family:Georgia,serif">
  Imprimir / Salvar como PDF
</button>
<h1>Consulta ${numero}</h1>
<div class="meta">
  ${esc(pacienteNome)} &middot; ${dataBR(consulta.data_consulta)}${consulta.peso_kg ? ` &middot; ${Number(consulta.peso_kg).toFixed(1).replace('.', ',')} kg` : ''}
</div>
${secao('Objetivo', consulta.objetivo ? `<p>${br(consulta.objetivo)}</p>` : '')}
${secao('Observações', d.obs ? `<p>${br(d.obs)}</p>` : '')}
${secao('Cálculo energético', d.calculo ? `<pre>${br(d.calculo)}</pre>` : '')}
${secao('Suplementação', d.suplementos ? `<p>${br(d.suplementos)}</p>` : '')}
${anamnese ? secao('Anamnese', `<p>${esc(anamnese.titulo)} &middot; ${dataBR(anamnese.data)}</p>`) : ''}
${plano ? secao('Plano alimentar', `<p>${plano.dados?.macros?.kcal ?? '—'} kcal &middot; ${plano.dados?.refeicoes?.length ?? 0} refeições <span style="color:#6b5b45;font-size:12px">(publicado em ${dataBR(plano.publicado_em)})</span></p>`) : ''}
${prescricoes.length > 0 ? secao('Exames e documentos', prescricoes.map(p => `<div style="margin-bottom:4px">${esc(p.tipo)} &mdash; ${esc(p.titulo)} <span style="color:#6b5b45;font-size:12px">${dataBR(p.created_at)}</span></div>`).join('')) : ''}
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups para gerar o PDF.'); return; }
  w.document.write(html);
  w.document.close();
}

export default function Evolucao({ pacienteId, paciente, nutriId }) {
  const [carregando, setCarregando] = useState(true);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [urls, setUrls] = useState({});
  const [checkins, setCheckins] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [prescricoes, setPrescricoes] = useState([]);
  const [anamneses, setAnamneses] = useState([]);
  const [registroConsultas, setRegistroConsultas] = useState([]);
  const [apresentacao, setApresentacao] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [comparar, setComparar] = useState({ a: null, b: null });
  const [verCheckin, setVerCheckin] = useState(null);
  const [expandida, setExpandida] = useState(null);
  const [editarConsulta, setEditarConsulta] = useState(null);

  async function carregar() {
    const [avRes, ftRes, ckRes, plRes, prRes, anRes, rcRes] = await Promise.all([
      supabase.from('peso_registros').select('*').eq('paciente_id', pacienteId).order('data'),
      supabase.from('fotos_evolucao').select('*').eq('paciente_id', pacienteId).order('data_foto'),
      supabase.from('checkin_envios')
        .select('id, perguntas, respostas, respondido_em, enviado_em')
        .eq('paciente_id', pacienteId)
        .not('respondido_em', 'is', null)
        .order('respondido_em'),
      supabase.from('planos').select('id, dados, publicado_em').eq('paciente_id', pacienteId).order('publicado_em'),
      supabase.from('prescricoes').select('id, tipo, titulo, created_at').eq('paciente_id', pacienteId).order('created_at'),
      supabase.from('anamneses').select('id, titulo, data').eq('paciente_id', pacienteId).order('data', { ascending: false }),
      supabase.from('registro_consultas').select('*').eq('paciente_id', pacienteId).order('data_consulta'),
    ]);

    setAvaliacoes(avRes.data ?? []);
    setFotos(ftRes.data ?? []);
    setCheckins(ckRes.data ?? []);
    setPlanos(plRes.data ?? []);
    setPrescricoes(prRes.data ?? []);
    setAnamneses(anRes.data ?? []);
    setRegistroConsultas(rcRes.data ?? []);

    const novasUrls = {};
    for (const f of ftRes.data ?? []) {
      const u = await signedUrl(f.storage_path);
      if (u) novasUrls[f.id] = u;
    }
    setUrls(novasUrls);

    const frentes = (ftRes.data ?? []).filter(f => f.tipo === 'frente');
    const todas = ftRes.data ?? [];
    const ordem = frentes.length >= 2 ? frentes : todas;
    if (ordem.length >= 2) {
      setComparar({ a: ordem[0].id, b: ordem[ordem.length - 1].id });
    } else if (ordem.length === 1) {
      setComparar({ a: ordem[0].id, b: null });
    }

    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  useEffect(() => {
    if (!apresentacao) return;
    const onKey = (e) => { if (e.key === 'Escape') setApresentacao(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [apresentacao]);

  async function excluirFoto(foto) {
    if (!window.confirm(`Excluir foto de ${dataBR(foto.data_foto)}? Esta ação não pode ser desfeita.`)) return;
    await supabase.storage.from('fotos_evolucao').remove([foto.storage_path]);
    await supabase.from('fotos_evolucao').delete().eq('id', foto.id);
    setComparar(c => ({
      a: c.a === foto.id ? null : c.a,
      b: c.b === foto.id ? null : c.b,
    }));
    carregar();
  }

  const primeira = avaliacoes[0];
  const ultima   = avaliacoes[avaliacoes.length - 1];
  const totalDias = primeira && ultima
    ? Math.round((new Date(ultima.data) - new Date(primeira.data)) / 86_400_000)
    : 0;

  const delta = (campo) => {
    if (!primeira || !ultima || primeira.id === ultima.id) return null;
    const a = Number(primeira[campo] ?? 0);
    const b = Number(ultima[campo] ?? 0);
    if (!a || !b) return null;
    return { de: a, para: b, dif: b - a };
  };

  const deltaPeso    = delta('kg');
  const deltaCintura = delta('cintura_cm');
  const deltaPgc     = delta('pgc');

  function prescricoesParaConsulta(rc) {
    const date = new Date(rc.data_consulta + 'T12:00:00').getTime();
    return prescricoes.filter(p =>
      Math.abs(new Date(p.created_at).getTime() - date) < 7 * 86_400_000
    );
  }

  function HighlightCard({ titulo, atual, delta, unidade, melhorMenor = true }) {
    if (!atual) {
      return (
        <div className="stat-card" style={{ opacity: .5 }}>
          <div className="stat-label">{titulo}</div>
          <div className="stat-val">—</div>
          <div className="stat-sub">sem registro</div>
        </div>
      );
    }
    let corDelta = 'var(--text3)';
    let setaDelta = '';
    if (delta) {
      const desejado = melhorMenor ? delta.dif < 0 : delta.dif > 0;
      corDelta = desejado ? 'var(--green)' : (delta.dif === 0 ? 'var(--text3)' : 'var(--red)');
      setaDelta = delta.dif > 0 ? '↑' : delta.dif < 0 ? '↓' : '—';
    }
    return (
      <div className="stat-card">
        <div className="stat-label">{titulo}</div>
        <div className="stat-val">
          {Number(atual).toFixed(1).replace('.', ',')}
          {unidade && <span style={{ fontSize: 14, color: 'var(--text3)', marginLeft: 3 }}>{unidade}</span>}
        </div>
        <div className="stat-sub" style={{ color: corDelta, fontWeight: 500 }}>
          {delta
            ? <>{setaDelta} {Math.abs(delta.dif).toFixed(1).replace('.', ',')}{unidade} vs início</>
            : 'só uma avaliação'}
        </div>
      </div>
    );
  }

  if (carregando) {
    return <div className="card empty-card"><div className="empty-sub">Carregando evolução…</div></div>;
  }

  const fotoA = fotos.find(f => f.id === comparar.a);
  const fotoB = fotos.find(f => f.id === comparar.b);

  if (apresentacao) {
    return (
      <ModoApresentacao
        paciente={paciente}
        avaliacoes={avaliacoes}
        deltaPeso={deltaPeso}
        deltaCintura={deltaCintura}
        deltaPgc={deltaPgc}
        totalDias={totalDias}
        fotoA={fotoA} fotoB={fotoB}
        urls={urls}
        onClose={() => setApresentacao(false)}
      />
    );
  }

  return (
    <>
      {/* Barra de ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {totalDias > 0 && (
            <>Acompanhamento de <strong style={{ color: 'var(--dark)' }}>{totalDias} dia{totalDias === 1 ? '' : 's'}</strong> · </>
          )}
          {registroConsultas.length} consulta{registroConsultas.length === 1 ? '' : 's'} registrada{registroConsultas.length === 1 ? '' : 's'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={() => setUploadOpen(true)}>
            <i className="ti ti-camera-plus" aria-hidden="true"></i> Adicionar foto
          </button>
          <button className="btn" onClick={() => setApresentacao(true)}>
            <i className="ti ti-presentation" aria-hidden="true"></i> Modo apresentação
          </button>
        </div>
      </div>

      {/* Destaques */}
      <div className="stats-grid">
        <HighlightCard titulo="Peso atual"      atual={ultima?.kg}         delta={deltaPeso}    unidade=" kg" />
        <HighlightCard titulo="Cintura atual"   atual={ultima?.cintura_cm} delta={deltaCintura} unidade=" cm" />
        <HighlightCard titulo="% gordura atual" atual={ultima?.pgc}        delta={deltaPgc}     unidade="%" />
        <div className="stat-card">
          <div className="stat-label">Check-ins</div>
          <div className="stat-val">{checkins.length}</div>
          <div className="stat-sub">respondidos no total</div>
        </div>
      </div>

      {/* ── Histórico de consultas ── */}
      <div className="section-header" style={{ marginTop: 24 }}>
        <div className="section-title">Histórico de consultas</div>
        <button
          className="btn"
          style={{ fontSize: 12, padding: '6px 12px' }}
          onClick={() => setEditarConsulta({ _novo: true })}
        >
          <i className="ti ti-plus" aria-hidden="true"></i> Nova consulta
        </button>
      </div>

      {registroConsultas.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-stethoscope empty-icon" aria-hidden="true"></i>
          <div className="empty-title">Nenhuma consulta registrada</div>
          <div className="empty-sub">
            Registre cada sessão para acompanhar a evolução clínica ao longo do tempo.
          </div>
          <button className="btn" onClick={() => setEditarConsulta({ _novo: true })}>
            <i className="ti ti-plus" aria-hidden="true"></i> Registrar primeira consulta
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {registroConsultas.map((rc, i) => {
            const anamnese = anamneses.find(a => a.id === rc.anamnese_id) ?? null;
            const plano    = planos.find(p => p.id === rc.plano_id)       ?? null;
            const presc    = prescricoesParaConsulta(rc);
            return (
              <ConsultaCard
                key={rc.id}
                consulta={rc}
                numero={i + 1}
                expanded={expandida === rc.id}
                onToggle={() => setExpandida(expandida === rc.id ? null : rc.id)}
                anamnese={anamnese}
                plano={plano}
                prescricoes={presc}
                onEdit={() => setEditarConsulta(rc)}
                onDelete={async () => {
                  if (!window.confirm('Excluir esta consulta? Esta ação não pode ser desfeita.')) return;
                  await supabase.from('registro_consultas').delete().eq('id', rc.id);
                  carregar();
                }}
                onPDF={() => gerarResumoPDF(rc, i + 1, paciente?.nome ?? '', anamnese, plano, presc)}
              />
            );
          })}
        </div>
      )}

      {/* ── Comparativo de fotos ── */}
      <div className="section-header" style={{ marginTop: 24 }}>
        <div className="section-title">Comparativo · antes e depois</div>
        {fotos.length >= 2 && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Escolha quais comparar nos seletores</span>
        )}
      </div>

      {fotos.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-camera empty-icon" aria-hidden="true"></i>
          <div className="empty-title">Sem fotos ainda</div>
          <div className="empty-sub">Adicione a primeira foto para começar o histórico visual.</div>
          <button className="btn" onClick={() => setUploadOpen(true)}>
            <i className="ti ti-camera-plus" aria-hidden="true"></i> Adicionar foto
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'a', foto: fotoA, label: 'Antes' },
              { key: 'b', foto: fotoB, label: 'Depois' },
            ].map(({ key, foto, label }) => (
              <div key={key}>
                <div style={{
                  fontSize: 11, color: 'var(--text3)', marginBottom: 6,
                  fontWeight: 500, letterSpacing: '.5px', textTransform: 'uppercase',
                }}>
                  {label}
                </div>
                <select
                  value={comparar[key] ?? ''}
                  onChange={e => setComparar(c => ({ ...c, [key]: e.target.value || null }))}
                  style={{ marginBottom: 8 }}
                >
                  <option value="">— Selecionar —</option>
                  {fotos.map(f => (
                    <option key={f.id} value={f.id}>
                      {dataBR(f.data_foto)} · {TIPOS_FOTO.find(t => t.id === f.tipo)?.label ?? f.tipo}
                    </option>
                  ))}
                </select>
                <div style={{
                  background: 'var(--bg2)', borderRadius: 8,
                  aspectRatio: '3/4', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative',
                }}>
                  {foto && urls[foto.id] ? (
                    <img src={urls[foto.id]} alt={label}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <i className="ti ti-photo" style={{ fontSize: 36, color: 'var(--text3)' }} aria-hidden="true"></i>
                  )}
                  {foto && (
                    <button
                      onClick={() => excluirFoto(foto)}
                      title="Excluir foto"
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'rgba(0,0,0,.7)', color: 'white',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, padding: 0,
                      }}
                    >
                      <i className="ti ti-trash" aria-hidden="true"></i>
                    </button>
                  )}
                </div>
                {foto && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, textAlign: 'center' }}>
                    {dataBR(foto.data_foto)}
                    {foto.obs && <> · <em>"{foto.obs}"</em></>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mini galeria */}
          {fotos.length > 0 && (
            <>
              <div style={{
                fontSize: 10, letterSpacing: 1, color: 'var(--text3)',
                textTransform: 'uppercase', marginTop: 16, marginBottom: 8, fontWeight: 500,
              }}>
                Todas as fotos ({fotos.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
                {fotos.map(f => (
                  <div
                    key={f.id}
                    onClick={() => {
                      if (comparar.a === f.id || comparar.b === f.id) return;
                      setComparar(c => ({ ...c, b: f.id }));
                    }}
                    style={{
                      aspectRatio: '1', borderRadius: 6, overflow: 'hidden',
                      background: 'var(--bg2)', cursor: 'pointer', position: 'relative',
                      outline: (comparar.a === f.id || comparar.b === f.id)
                        ? '2px solid var(--amber)' : 'none',
                    }}
                  >
                    {urls[f.id] && (
                      <img src={urls[f.id]} alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); excluirFoto(f); }}
                      title="Excluir foto"
                      style={{
                        position: 'absolute', top: 3, right: 3,
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,.65)', color: 'white',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, padding: 0,
                      }}
                    >
                      <i className="ti ti-trash" aria-hidden="true"></i>
                    </button>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,.55)', color: 'white',
                      fontSize: 8, padding: '2px 4px', textAlign: 'center',
                    }}>
                      {dataBR(f.data_foto)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modais */}
      {editarConsulta && (
        <ModalConsulta
          consulta={editarConsulta._novo ? null : editarConsulta}
          pacienteId={pacienteId}
          nutriId={nutriId}
          anamneses={anamneses}
          planos={planos}
          onClose={() => setEditarConsulta(null)}
          onSaved={() => { setEditarConsulta(null); carregar(); }}
        />
      )}
      {uploadOpen && (
        <UploadFoto
          pacienteId={pacienteId}
          nutriId={nutriId}
          onClose={() => setUploadOpen(false)}
          onSaved={async () => { setUploadOpen(false); await carregar(); }}
        />
      )}
      {verCheckin && (
        <VerCheckinModal envio={verCheckin} onClose={() => setVerCheckin(null)} />
      )}
    </>
  );
}

/* ============================================================
   CARD DE CONSULTA
   ============================================================ */
function ConsultaCard({ consulta, numero, expanded, onToggle, anamnese, plano, prescricoes, onEdit, onDelete, onPDF }) {
  const d = consulta.dados ?? {};
  const temConteudo = consulta.objetivo || d.obs || d.calculo || d.suplementos
    || anamnese || plano || prescricoes.length > 0;

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      {/* Cabeçalho clicável */}
      <div
        onClick={onToggle}
        role="button"
        style={{
          padding: '14px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12,
          userSelect: 'none',
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--amber)', color: 'var(--dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>
          {numero}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--dark)' }}>
            Consulta {numero}
          </div>
          <div style={{
            fontSize: 12, color: 'var(--text3)', marginTop: 2,
            display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <i className="ti ti-calendar" aria-hidden="true" style={{ fontSize: 11 }}></i>
              {dataBR(consulta.data_consulta)}
            </span>
            {consulta.peso_kg && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <i className="ti ti-scale" aria-hidden="true" style={{ fontSize: 11 }}></i>
                {Number(consulta.peso_kg).toFixed(1).replace('.', ',')} kg
              </span>
            )}
            {consulta.objetivo && (
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', maxWidth: 240, color: 'var(--text2)',
              }}>
                {consulta.objetivo}
              </span>
            )}
          </div>
        </div>

        <i
          className={`ti ti-chevron-${expanded ? 'up' : 'down'}`}
          style={{ color: 'var(--text3)', fontSize: 16, flexShrink: 0 }}
          aria-hidden="true"
        ></i>
      </div>

      {/* Conteúdo expandido */}
      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '16px 16px 14px' }}>
          {!temConteudo && (
            <p style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', margin: '0 0 12px' }}>
              Nenhum conteúdo registrado nesta consulta.
            </p>
          )}

          {consulta.objetivo && (
            <ConsultaSecao titulo="Objetivo" icon="target">
              <p style={{ margin: 0, fontSize: 13 }}>{consulta.objetivo}</p>
            </ConsultaSecao>
          )}
          {d.obs && (
            <ConsultaSecao titulo="Observações" icon="notes">
              <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{d.obs}</p>
            </ConsultaSecao>
          )}
          {d.calculo && (
            <ConsultaSecao titulo="Cálculo energético" icon="calculator">
              <pre style={{
                margin: 0, fontSize: 12, fontFamily: 'var(--font-mono, monospace)',
                background: 'var(--bg2)', padding: '8px 10px', borderRadius: 6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>{d.calculo}</pre>
            </ConsultaSecao>
          )}
          {d.suplementos && (
            <ConsultaSecao titulo="Suplementação" icon="pill">
              <p style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{d.suplementos}</p>
            </ConsultaSecao>
          )}
          {anamnese && (
            <ConsultaSecao titulo="Anamnese" icon="clipboard-text">
              <p style={{ margin: 0, fontSize: 13 }}>
                <strong>{anamnese.titulo}</strong>
                <span style={{ color: 'var(--text3)', marginLeft: 8 }}>{dataBR(anamnese.data)}</span>
              </p>
            </ConsultaSecao>
          )}
          {plano && (
            <ConsultaSecao titulo="Plano alimentar" icon="salad">
              <p style={{ margin: 0, fontSize: 13 }}>
                <strong>{plano.dados?.macros?.kcal ?? '—'} kcal</strong>
                <span style={{ color: 'var(--text3)', marginLeft: 8 }}>
                  {plano.dados?.refeicoes?.length ?? 0} refeições · publicado em {dataBR(plano.publicado_em)}
                </span>
              </p>
            </ConsultaSecao>
          )}
          {prescricoes.length > 0 && (
            <ConsultaSecao titulo={`Exames e documentos (${prescricoes.length})`} icon="file-text">
              {prescricoes.map(p => (
                <div key={p.id} style={{ fontSize: 13, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 10, letterSpacing: .5, textTransform: 'uppercase',
                    color: 'var(--text3)', background: 'var(--bg2)',
                    padding: '1px 5px', borderRadius: 4, flexShrink: 0,
                  }}>{p.tipo}</span>
                  {p.titulo}
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{dataBR(p.created_at)}</span>
                </div>
              ))}
            </ConsultaSecao>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn" onClick={onPDF}
              style={{ fontSize: 12, padding: '6px 12px' }}>
              <i className="ti ti-file-download" aria-hidden="true"></i> Baixar resumo PDF
            </button>
            <button className="btn-outline" onClick={onEdit}
              style={{ fontSize: 12, padding: '6px 12px' }}>
              <i className="ti ti-edit" aria-hidden="true"></i> Editar
            </button>
            <button className="btn-outline" onClick={onDelete}
              style={{ fontSize: 12, padding: '6px 12px', color: 'var(--red, #c0392b)' }}>
              <i className="ti ti-trash" aria-hidden="true"></i> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConsultaSecao({ titulo, icon, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
        color: 'var(--text3)', fontWeight: 600, marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <i className={`ti ti-${icon}`} aria-hidden="true" style={{ fontSize: 12 }}></i>
        {titulo}
      </div>
      {children}
    </div>
  );
}

/* ============================================================
   MODAL · NOVA / EDITAR CONSULTA
   ============================================================ */
function ModalConsulta({ consulta, pacienteId, nutriId, anamneses, planos, onClose, onSaved }) {
  const isNova = !consulta;
  const [data,       setData]       = useState(consulta?.data_consulta ?? new Date().toISOString().slice(0, 10));
  const [pesoKg,     setPesoKg]     = useState(consulta?.peso_kg ?? '');
  const [objetivo,   setObjetivo]   = useState(consulta?.objetivo ?? '');
  const [obs,        setObs]        = useState(consulta?.dados?.obs ?? '');
  const [calculo,    setCalculo]    = useState(consulta?.dados?.calculo ?? '');
  const [suplementos, setSupl]      = useState(consulta?.dados?.suplementos ?? '');
  const [anamneseId, setAnamneseId] = useState(consulta?.anamnese_id ?? '');
  const [planoId,    setPlanoId]    = useState(consulta?.plano_id ?? '');
  const [busy,       setBusy]       = useState(false);
  const [erro,       setErro]       = useState(null);

  async function salvar() {
    setErro(null);
    if (!data) { setErro('Selecione a data da consulta.'); return; }
    setBusy(true);
    const payload = {
      paciente_id: pacienteId,
      nutri_id:    nutriId,
      data_consulta: data,
      peso_kg:     pesoKg !== '' ? Number(pesoKg) : null,
      objetivo:    objetivo.trim()    || null,
      anamnese_id: anamneseId         || null,
      plano_id:    planoId            || null,
      dados: {
        obs:        obs.trim()        || null,
        calculo:    calculo.trim()    || null,
        suplementos: suplementos.trim() || null,
      },
    };

    let error;
    if (isNova) {
      ({ error } = await supabase.from('registro_consultas').insert(payload));
    } else {
      ({ error } = await supabase.from('registro_consultas').update(payload).eq('id', consulta.id));
    }

    setBusy(false);
    if (error) { setErro(error.message); return; }
    onSaved();
  }

  return (
    <ModalShell
      title={isNova ? 'Nova consulta' : 'Editar consulta'}
      subtitle="Registre o conteúdo clínico da sessão"
      onClose={onClose}
      large
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="form-lbl">Data da consulta</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} />
        </div>
        <div>
          <label className="form-lbl">Peso (kg)</label>
          <input
            type="number" step="0.1" min="20" max="300"
            value={pesoKg} onChange={e => setPesoKg(e.target.value)}
            placeholder="Ex: 68,5"
          />
        </div>
      </div>

      <label className="form-lbl">Objetivo desta consulta</label>
      <input
        value={objetivo} onChange={e => setObjetivo(e.target.value)}
        placeholder="Meta ou foco da sessão…"
      />

      <label className="form-lbl">Observações gerais</label>
      <textarea
        value={obs} onChange={e => setObs(e.target.value)} rows={3}
        placeholder="Queixas da paciente, evolução relatada, orientações dadas…"
        style={{ width: '100%', resize: 'vertical' }}
      />

      <label className="form-lbl">Cálculo energético</label>
      <textarea
        value={calculo} onChange={e => setCalculo(e.target.value)} rows={3}
        placeholder={"TMB: 1400 kcal\nTDEE: 1750 kcal\nMeta: P 120g · C 180g · G 55g"}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
      />

      <label className="form-lbl">Suplementação prescrita</label>
      <textarea
        value={suplementos} onChange={e => setSupl(e.target.value)} rows={2}
        placeholder="Ex: Ômega 3 2g/dia · Vitamina D 4000 UI · Magnésio 300mg"
        style={{ width: '100%', resize: 'vertical' }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="form-lbl">Vincular anamnese</label>
          <select value={anamneseId} onChange={e => setAnamneseId(e.target.value)}>
            <option value="">— Nenhuma —</option>
            {anamneses.map(a => (
              <option key={a.id} value={a.id}>
                {a.titulo}{a.data ? ` · ${dataBR(a.data)}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-lbl">Vincular plano alimentar</label>
          <select value={planoId} onChange={e => setPlanoId(e.target.value)}>
            <option value="">— Nenhum —</option>
            {planos.map(p => (
              <option key={p.id} value={p.id}>
                {p.dados?.macros?.kcal ?? '?'} kcal · {dataBR(p.publicado_em)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {erro && (
        <div style={{
          background: 'var(--red-bg, #fff0f0)', color: 'var(--red, #c0392b)',
          padding: '6px 10px', borderRadius: 6, fontSize: 11, marginTop: 8,
        }}>{erro}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
          Cancelar
        </button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={salvar} disabled={busy}>
          <i className="ti ti-check" aria-hidden="true"></i>
          {busy ? 'Salvando…' : isNova ? 'Registrar consulta' : 'Salvar alterações'}
        </button>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   UPLOAD DE FOTO
   ============================================================ */
function UploadFoto({ pacienteId, nutriId, onClose, onSaved }) {
  const [tipo,    setTipo]    = useState('frente');
  const [data,    setData]    = useState(new Date().toISOString().slice(0, 10));
  const [obs,     setObs]     = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rot,     setRot]     = useState(0);
  const [flip,    setFlip]    = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [erro,    setErro]    = useState(null);

  function escolherArquivo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivo(f);
    setPreview(URL.createObjectURL(f));
    setRot(0);
    setFlip(false);
  }

  async function transformarArquivo() {
    if (rot === 0 && !flip) return arquivo;
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const swap = rot === 90 || rot === 270;
        const w = swap ? img.height : img.width;
        const h = swap ? img.width  : img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.translate(w / 2, h / 2);
        ctx.rotate((rot * Math.PI) / 180);
        if (flip) ctx.scale(-1, 1);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        canvas.toBlob(
          b => b ? resolve(b) : reject(new Error('Canvas falhou')),
          arquivo.type || 'image/jpeg', 0.92
        );
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = URL.createObjectURL(arquivo);
    });
  }

  async function enviar() {
    setErro(null);
    if (!arquivo) return setErro('Selecione uma foto.');
    setBusy(true);
    let blob;
    try { blob = await transformarArquivo(); }
    catch (e) { setBusy(false); return setErro('Erro ao processar: ' + e.message); }

    const ext  = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${pacienteId}/${Date.now()}-${tipo}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('fotos_evolucao').upload(path, blob, { contentType: arquivo.type });
    if (upErr) { setBusy(false); return setErro('Upload falhou: ' + upErr.message); }

    const { error: insErr } = await supabase.from('fotos_evolucao').insert({
      paciente_id: pacienteId, nutri_id: nutriId,
      storage_path: path, tipo, data_foto: data,
      obs: obs.trim() || null,
    });
    setBusy(false);
    if (insErr) {
      await supabase.storage.from('fotos_evolucao').remove([path]);
      return setErro('Erro: ' + insErr.message);
    }
    onSaved();
  }

  const swap      = rot === 90 || rot === 270;
  const transform = `${flip ? 'scaleX(-1) ' : ''}rotate(${rot}deg)`;

  return (
    <ModalShell title="Adicionar foto de evolução"
      subtitle="A foto fica privada — só você e a paciente veem"
      onClose={onClose}>
      <label className="form-lbl">Foto</label>
      <input type="file" accept="image/*" capture="environment" onChange={escolherArquivo}
        style={{ padding: 6 }} />
      {preview && (
        <>
          <div style={{
            marginTop: 8, borderRadius: 8, overflow: 'hidden',
            background: '#000', height: 320,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={preview} alt="prévia" style={{
              maxWidth: swap ? '320px' : '100%',
              maxHeight: swap ? '100%' : '320px',
              objectFit: 'contain', transform,
              transition: 'transform .18s ease',
            }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setRot(r => (r + 270) % 360)}>
              <i className="ti ti-rotate-2" aria-hidden="true"></i> Girar esquerda
            </button>
            <button type="button" className="btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setRot(r => (r + 90) % 360)}>
              <i className="ti ti-rotate-clockwise-2" aria-hidden="true"></i> Girar direita
            </button>
            <button type="button" className="btn-outline" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setFlip(f => !f)}>
              <i className="ti ti-flip-horizontal" aria-hidden="true"></i> Espelhar
            </button>
            {(rot !== 0 || flip) && (
              <button type="button" className="btn-outline"
                style={{ fontSize: 11, padding: '4px 10px', color: 'var(--text3)' }}
                onClick={() => { setRot(0); setFlip(false); }}>
                <i className="ti ti-refresh" aria-hidden="true"></i> Resetar
              </button>
            )}
          </div>
        </>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label className="form-lbl">Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS_FOTO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="form-lbl">Data da foto</label>
          <input type="date" value={data} onChange={e => setData(e.target.value)} />
        </div>
      </div>
      <label className="form-lbl">Observação (opcional)</label>
      <input value={obs} onChange={e => setObs(e.target.value)}
        placeholder="Ex: 30 dias de acompanhamento" />
      {erro && (
        <div style={{
          background: 'var(--red-bg)', color: 'var(--red)',
          padding: '6px 10px', borderRadius: 6, fontSize: 11, marginTop: 10,
        }}>{erro}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
          Cancelar
        </button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
          onClick={enviar} disabled={busy || !arquivo}>
          <i className="ti ti-check" aria-hidden="true"></i>
          {busy ? 'Enviando...' : 'Salvar foto'}
        </button>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   MODO APRESENTAÇÃO (fullscreen pra consulta)
   ============================================================ */
function ModoApresentacao({ paciente, avaliacoes, deltaPeso, deltaCintura, deltaPgc, totalDias, fotoA, fotoB, urls, onClose }) {
  const primeira = avaliacoes[0];
  const ultima   = avaliacoes[avaliacoes.length - 1];
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      zIndex: 200, overflow: 'auto',
      padding: '40px 32px',
    }}>
      <button onClick={onClose} style={{
        position: 'fixed', top: 20, right: 20,
        background: 'var(--dark)', color: 'var(--white)',
        border: 'none', borderRadius: 8, padding: '8px 14px',
        cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)',
        display: 'inline-flex', alignItems: 'center', gap: 6, zIndex: 201,
      }}>
        <i className="ti ti-x" aria-hidden="true"></i> Sair (ESC)
      </button>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          fontSize: 12, letterSpacing: '.22em', textTransform: 'uppercase',
          color: 'var(--gold-deep, #a08456)', marginBottom: 8,
        }}>
          Evolução
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 48, fontWeight: 500,
          color: 'var(--dark)', marginBottom: 4, lineHeight: 1.1,
        }}>
          {paciente?.nome}
        </h1>
        {totalDias > 0 && (
          <div style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 32 }}>
            {totalDias} dias de acompanhamento
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14, marginBottom: 36,
        }}>
          {[
            { label: 'Peso',      atual: ultima?.kg,         delta: deltaPeso,    un: 'kg', melhorMenor: true },
            { label: 'Cintura',   atual: ultima?.cintura_cm, delta: deltaCintura, un: 'cm', melhorMenor: true },
            { label: '% gordura', atual: ultima?.pgc,        delta: deltaPgc,     un: '%',  melhorMenor: true },
          ].map((s, i) => {
            if (!s.atual) return null;
            const corDelta = s.delta
              ? (s.melhorMenor ? s.delta.dif < 0 : s.delta.dif > 0) ? 'var(--green)' : 'var(--red)'
              : 'var(--text3)';
            return (
              <div key={i} style={{
                background: 'var(--white)', border: '0.5px solid var(--border)',
                borderRadius: 14, padding: '24px 28px',
              }}>
                <div style={{
                  fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
                  color: 'var(--text3)', marginBottom: 10, fontWeight: 500,
                }}>{s.label}</div>
                <div style={{
                  fontFamily: 'var(--font-serif)', fontSize: 56, fontWeight: 600,
                  color: 'var(--dark)', lineHeight: 1,
                }}>
                  {Number(s.atual).toFixed(1).replace('.', ',')}
                  <span style={{ fontSize: 22, color: 'var(--text3)', marginLeft: 6 }}>{s.un}</span>
                </div>
                {s.delta && (
                  <div style={{
                    fontSize: 18, fontWeight: 500, color: corDelta,
                    marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    {s.delta.dif > 0 ? '↑' : s.delta.dif < 0 ? '↓' : '—'}{' '}
                    {Math.abs(s.delta.dif).toFixed(1).replace('.', ',')}{s.un}
                    <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 6, fontWeight: 400 }}>
                      desde {dataBR(primeira?.data)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(fotoA || fotoB) && (
          <>
            <h2 style={{
              fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 500,
              color: 'var(--dark)', marginBottom: 18,
            }}>
              Antes e depois
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              {[{ foto: fotoA, label: 'Antes' }, { foto: fotoB, label: 'Depois' }].map((x, i) => (
                <div key={i}>
                  <div style={{
                    fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase',
                    color: 'var(--text3)', marginBottom: 10, fontWeight: 500,
                  }}>{x.label}</div>
                  <div style={{
                    background: 'var(--bg2)', borderRadius: 14,
                    aspectRatio: '3/4', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {x.foto && urls[x.foto.id] ? (
                      <img src={urls[x.foto.id]} alt={x.label}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: 'var(--text3)', fontSize: 14 }}>Sem foto</span>
                    )}
                  </div>
                  {x.foto && (
                    <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 10, textAlign: 'center' }}>
                      {dataBR(x.foto.data_foto)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {avaliacoes.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            Sem avaliações antropométricas registradas ainda.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   MODAL DE VER RESPOSTAS DO CHECK-IN
   ============================================================ */
function VerCheckinModal({ envio, onClose }) {
  const respostas = envio.respostas ?? {};
  return (
    <ModalShell title="Respostas do check-in"
      subtitle={`Respondido em ${dataBR(envio.respondido_em)}`}
      onClose={onClose} large>
      <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: 12 }}>
        {envio.perguntas?.map(p => (
          <div key={p.id} style={{ padding: '10px 0', borderBottom: '0.5px solid #e3dcce' }}>
            <div style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
              {p.secao}
            </div>
            <div style={{ fontSize: 13, color: 'var(--dark)', fontWeight: 500, marginBottom: 4 }}>
              {p.pergunta}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft, #4a3828)', background: 'var(--white)', padding: '8px 10px', borderRadius: 6 }}>
              {formatarResposta(p, respostas[p.id])}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn-outline" onClick={onClose}>Fechar</button>
      </div>
    </ModalShell>
  );
}

/* ============================================================
   SHELL DE MODAL (reutilizável)
   ============================================================ */
function ModalShell({ title, subtitle, children, onClose, large }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(28,23,18,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--white)', borderRadius: 12, padding: 22,
        width: large ? 600 : 460, maxWidth: '92vw',
        maxHeight: '92vh', overflowY: 'auto',
        border: '0.5px solid var(--border)',
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, marginBottom: 4 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}
