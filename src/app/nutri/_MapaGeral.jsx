import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

function uid() { return Math.random().toString(36).slice(2, 9); }
function hoje() { return new Date().toISOString().slice(0, 10); }
function fmtData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function MapaGeral({ pacienteId, nutriId }) {
  const [obs, setObs]             = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoData, setNovoData]   = useState(hoje());
  const [novoTexto, setNovoTexto] = useState('');
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editData, setEditData]   = useState('');
  const [editTexto, setEditTexto] = useState('');
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [erro, setErro]           = useState(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('mapa_geral')
      .select('dados')
      .eq('paciente_id', pacienteId)
      .eq('nutri_id', nutriId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        // dados pode ser array (novo formato) ou objeto (formato antigo — ignorar)
        setObs(Array.isArray(data?.dados) ? data.dados : []);
        setCarregando(false);
      });
    return () => { active = false; };
  }, [pacienteId, nutriId]);

  async function persistir(novas) {
    const { error } = await supabase.from('mapa_geral').upsert(
      { paciente_id: pacienteId, nutri_id: nutriId, dados: novas, updated_at: new Date().toISOString() },
      { onConflict: 'paciente_id,nutri_id' }
    );
    if (error) throw error;
  }

  function abrirNovo() {
    setNovoAberto(true);
    setNovoData(hoje());
    setNovoTexto('');
    setErro(null);
  }

  async function salvarNovo() {
    if (!novoTexto.trim()) return;
    setSalvandoNovo(true);
    setErro(null);
    const nova = { id: uid(), data: novoData || hoje(), texto: novoTexto.trim() };
    const novas = [...obs, nova].sort((a, b) => b.data.localeCompare(a.data));
    try {
      await persistir(novas);
      setObs(novas);
      setNovoAberto(false);
      setNovoTexto('');
      setNovoData(hoje());
    } catch (e) { setErro(e.message); }
    finally { setSalvandoNovo(false); }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta observação? A ação não pode ser desfeita.')) return;
    setErro(null);
    const novas = obs.filter(o => o.id !== id);
    try {
      await persistir(novas);
      setObs(novas);
    } catch (e) { setErro(e.message); }
  }

  function iniciarEdicao(o) {
    setEditandoId(o.id);
    setEditData(o.data);
    setEditTexto(o.texto);
    setErro(null);
  }

  async function salvarEdicao() {
    if (!editTexto.trim()) return;
    setSalvandoEdit(true);
    setErro(null);
    const novas = obs
      .map(o => o.id === editandoId ? { ...o, data: editData, texto: editTexto.trim() } : o)
      .sort((a, b) => b.data.localeCompare(a.data));
    try {
      await persistir(novas);
      setObs(novas);
      setEditandoId(null);
    } catch (e) { setErro(e.message); }
    finally { setSalvandoEdit(false); }
  }

  if (carregando) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
        <div>
          <div className="section-title">Observações por consulta</div>
          <div className="card-sub" style={{ marginTop: 3 }}>
            Anotações clínicas por data — só você tem acesso
          </div>
        </div>
        {!novoAberto && (
          <button className="btn" style={{ flexShrink: 0 }} onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true" /> Nova observação
          </button>
        )}
      </div>

      {/* Bloco de nova observação */}
      {novoAberto && (
        <div className="card" style={{ padding: 20, marginBottom: 18, borderColor: 'var(--verde)', borderWidth: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <label className="field-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Data</label>
            <input
              type="date"
              value={novoData}
              onChange={e => setNovoData(e.target.value)}
              style={{ fontSize: 13, width: 160 }}
            />
          </div>
          <textarea
            value={novoTexto}
            onChange={e => setNovoTexto(e.target.value)}
            placeholder="Escreva suas observações sobre esta consulta…"
            rows={6}
            autoFocus
            style={{
              width: '100%', resize: 'vertical',
              fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.65,
              marginBottom: 14,
            }}
          />
          {erro && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{erro}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn"
              onClick={salvarNovo}
              disabled={salvandoNovo || !novoTexto.trim()}
            >
              {salvandoNovo ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              className="btn-outline"
              onClick={() => { setNovoAberto(false); setErro(null); }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {obs.length === 0 && !novoAberto && (
        <div className="card empty-card">
          <div className="empty-sub">
            Nenhuma observação registrada ainda.<br />
            Clique em "Nova observação" para começar.
          </div>
        </div>
      )}

      {/* Lista de observações */}
      {obs.map(o => (
        <div key={o.id} className="card" style={{ padding: 20, marginBottom: 12 }}>
          {editandoId === o.id ? (
            /* Modo edição */
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <label className="field-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Data</label>
                <input
                  type="date"
                  value={editData}
                  onChange={e => setEditData(e.target.value)}
                  style={{ fontSize: 13, width: 160 }}
                />
              </div>
              <textarea
                value={editTexto}
                onChange={e => setEditTexto(e.target.value)}
                rows={6}
                autoFocus
                style={{
                  width: '100%', resize: 'vertical',
                  fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.65,
                  marginBottom: 14,
                }}
              />
              {erro && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>{erro}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  onClick={salvarEdicao}
                  disabled={salvandoEdit || !editTexto.trim()}
                >
                  {salvandoEdit ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  className="btn-outline"
                  onClick={() => { setEditandoId(null); setErro(null); }}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            /* Modo visualização */
            <>
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'var(--verde)',
                marginBottom: 10, letterSpacing: '.02em',
              }}>
                {fmtData(o.data)}
              </div>
              <div style={{
                fontSize: 13, color: 'var(--dark)', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', marginBottom: 16,
              }}>
                {o.texto}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-outline"
                  style={{ fontSize: 12 }}
                  onClick={() => iniciarEdicao(o)}
                >
                  <i className="ti ti-pencil" aria-hidden="true" /> Editar
                </button>
                <button
                  className="btn-outline"
                  style={{ fontSize: 12, color: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={() => excluir(o.id)}
                >
                  <i className="ti ti-trash" aria-hidden="true" /> Excluir
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
