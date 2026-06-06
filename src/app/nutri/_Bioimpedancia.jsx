import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';

function num(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function fmt(v, dec = 1) {
  if (v == null) return '—';
  return Number(v).toFixed(dec);
}

function dataBR(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function Bioimpedancia({ pacienteId, nutriId }) {
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [uploadando, setUploadando] = useState(false);

  const campoVazio = {
    data: new Date().toISOString().slice(0, 10),
    kg: '', pgc: '', mm_kg: '', massa_gorda: '',
    agua_corporal: '', idade_metabolica: '',
    obs: '', laudo_url: '',
  };
  const [form, setForm] = useState(campoVazio);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase
      .from('peso_registros')
      .select('id, data, kg, pgc, mm_kg, agua_corporal, idade_metabolica, obs, laudo_url')
      .eq('paciente_id', pacienteId)
      .not('pgc', 'is', null)
      .order('data', { ascending: false })
      .limit(20);
    setRegistros(data ?? []);
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  const set = key => e => {
    setForm(prev => ({ ...prev, [key]: e.target.value }));
    setFeedback(null);
  };

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      return setFeedback({ tipo: 'erro', msg: 'Arquivo muito grande. Máximo: 10 MB.' });
    }
    setUploadando(true);
    setFeedback(null);
    const ext = file.name.split('.').pop();
    const path = `${nutriId}/${pacienteId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('laudos').upload(path, file);
    if (error) {
      setUploadando(false);
      return setFeedback({ tipo: 'erro', msg: `Erro no upload: ${error.message}` });
    }
    const { data: { publicUrl } } = supabase.storage.from('laudos').getPublicUrl(path);
    setForm(prev => ({ ...prev, laudo_url: publicUrl }));
    setUploadando(false);
    setFeedback({ tipo: 'ok', msg: 'Laudo enviado.' });
  }

  async function salvar() {
    const pesoN = num(form.kg);
    const pgcN  = num(form.pgc);
    if (!pesoN || !pgcN) {
      return setFeedback({ tipo: 'erro', msg: 'Peso e % gordura são obrigatórios.' });
    }

    // massa magra calculada se não informada
    const mmKg = num(form.mm_kg) ?? (pesoN - pesoN * pgcN / 100);

    const payload = {
      paciente_id:      pacienteId,
      nutri_id:         nutriId,
      data:             form.data,
      kg:               pesoN,
      pgc:              pgcN,
      mm_kg:            Math.round(mmKg * 10) / 10,
      agua_corporal:    num(form.agua_corporal),
      idade_metabolica: num(form.idade_metabolica) ? parseInt(form.idade_metabolica) : null,
      obs:              form.obs || null,
      laudo_url:        form.laudo_url || null,
    };

    setSalvando(true);
    setFeedback(null);
    const { error } = await supabase.from('peso_registros').insert(payload);
    setSalvando(false);

    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setForm(campoVazio);
    setFeedback({ tipo: 'ok', msg: 'Bioimpedância registrada!' });
    carregar();
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este registro?')) return;
    await supabase.from('peso_registros').delete().eq('id', id);
    carregar();
  }

  const pesoN  = num(form.kg);
  const pgcN   = num(form.pgc);
  const mmCalc = (pesoN && pgcN) ? Math.round((pesoN - pesoN * pgcN / 100) * 10) / 10 : null;
  const mgCalc = (pesoN && pgcN) ? Math.round(pesoN * pgcN / 100 * 10) / 10 : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Formulário */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="card-title">Registrar Bioimpedância</div>
            <div className="card-sub">Dados do laudo da balança de bioimpedância ou InBody.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          <div>
            <label className="field-label">Data</label>
            <input type="date" value={form.data} onChange={set('data')} />
          </div>
          <div>
            <label className="field-label">Peso (kg) *</label>
            <input inputMode="decimal" placeholder="ex: 68,5" value={form.kg} onChange={set('kg')} />
          </div>
          <div>
            <label className="field-label">% Gordura *</label>
            <input inputMode="decimal" placeholder="ex: 32,1" value={form.pgc} onChange={set('pgc')} />
          </div>
          <div>
            <label className="field-label">
              Massa Magra (kg)
              {mmCalc != null && (
                <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 4 }}>
                  calc: {mmCalc}kg
                </span>
              )}
            </label>
            <input inputMode="decimal" placeholder={mmCalc ? String(mmCalc) : 'ex: 46,2'} value={form.mm_kg} onChange={set('mm_kg')} />
          </div>
          <div>
            <label className="field-label">
              Massa Gorda (kg)
              {mgCalc != null && (
                <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 4 }}>
                  calc: {mgCalc}kg
                </span>
              )}
            </label>
            <input inputMode="decimal" placeholder={mgCalc ? String(mgCalc) : 'ex: 22,3'} value={form.massa_gorda} onChange={set('massa_gorda')} readOnly style={{ background: '#faf7f2' }} />
          </div>
          <div>
            <label className="field-label">% Água Corporal</label>
            <input inputMode="decimal" placeholder="ex: 55,4" value={form.agua_corporal} onChange={set('agua_corporal')} />
          </div>
          <div>
            <label className="field-label">Idade Metabólica</label>
            <input inputMode="numeric" placeholder="ex: 34" value={form.idade_metabolica} onChange={set('idade_metabolica')} />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label className="field-label">Observações</label>
          <input placeholder="ex: InBody 270 · consulta 1" value={form.obs} onChange={set('obs')} />
        </div>

        {/* Upload do laudo */}
        <div style={{ marginTop: 10 }}>
          <label className="field-label">Laudo (foto ou PDF, máx. 10 MB)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleUpload}
              disabled={uploadando}
              style={{ fontSize: 13 }}
            />
            {uploadando && <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Enviando…</span>}
            {form.laudo_url && (
              <a href={form.laudo_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--green)', textDecoration: 'underline' }}>
                <i className="ti ti-file-check" style={{ marginRight: 3 }} />
                Laudo enviado — visualizar
              </a>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn" onClick={salvar} disabled={salvando || uploadando}>
            <i className="ti ti-device-floppy" aria-hidden="true" />
            {salvando ? 'Salvando…' : 'Salvar Bioimpedância'}
          </button>

          {feedback && (
            <div style={{
              fontSize: 13, padding: '6px 12px', borderRadius: 6,
              background: feedback.tipo === 'ok' ? '#e6f0d4' : '#fbeaf0',
              color:      feedback.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
            }}>
              <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`} style={{ marginRight: 5 }} />
              {feedback.msg}
            </div>
          )}
        </div>
      </div>

      {/* Histórico */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 10 }}>Histórico de Bioimpedância</div>
        {carregando ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Carregando…</div>
        ) : registros.length === 0 ? (
          <div className="empty-card">
            <div className="empty-sub">Nenhum registro de bioimpedância ainda.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Peso</th>
                  <th>% Gord.</th>
                  <th>M. Magra</th>
                  <th>M. Gorda</th>
                  <th>% Água</th>
                  <th>Id. Met.</th>
                  <th>Laudo</th>
                  <th>Obs.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {registros.map(r => {
                  const mg = (r.kg && r.pgc) ? Math.round(r.kg * r.pgc / 100 * 10) / 10 : null;
                  return (
                    <tr key={r.id}>
                      <td>{dataBR(r.data)}</td>
                      <td>{fmt(r.kg)} kg</td>
                      <td>{fmt(r.pgc)}%</td>
                      <td>{r.mm_kg ? `${fmt(r.mm_kg)} kg` : '—'}</td>
                      <td>{mg ? `${mg} kg` : '—'}</td>
                      <td>{r.agua_corporal ? `${fmt(r.agua_corporal)}%` : '—'}</td>
                      <td>{r.idade_metabolica ?? '—'}</td>
                      <td>
                        {r.laudo_url
                          ? <a href={r.laudo_url} target="_blank" rel="noreferrer" style={{ color: 'var(--green)', fontSize: 12 }}>
                              <i className="ti ti-file" /> ver
                            </a>
                          : '—'}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.obs ?? '—'}
                      </td>
                      <td>
                        <button onClick={() => excluir(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                          <i className="ti ti-trash" style={{ fontSize: 13 }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
