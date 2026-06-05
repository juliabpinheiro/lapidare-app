import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const CAMPOS = [
  {
    key: 'objetivo_principal',
    label: 'Objetivo principal',
    rows: 3,
    placeholder: 'Ex: Emagrecimento com preservação de massa muscular, melhora dos triglicerídeos…',
  },
  {
    key: 'historico_relevante',
    label: 'Histórico relevante',
    rows: 4,
    placeholder: 'Doenças diagnosticadas, cirurgias, histórico familiar, queixas principais, contexto de vida…',
  },
  {
    key: 'restricoes',
    label: 'Restrições alimentares',
    rows: 3,
    placeholder: 'Alergias, intolerâncias, aversões, preferências e restrições culturais ou religiosas…',
  },
  {
    key: 'medicamentos',
    label: 'Medicamentos em uso',
    rows: 3,
    placeholder: 'Nome, dose e frequência de cada medicamento ou suplemento de uso contínuo…',
  },
  {
    key: 'outras_obs',
    label: 'Outras observações',
    rows: 3,
    placeholder: 'Rotina, sono, nível de estresse, prática de atividade física, contexto emocional…',
  },
];

export default function MapaGeral({ pacienteId, nutriId }) {
  const [dados, setDados] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState(null);

  async function carregar() {
    const { data } = await supabase
      .from('mapa_geral')
      .select('dados')
      .eq('paciente_id', pacienteId)
      .eq('nutri_id', nutriId)
      .maybeSingle();
    setDados(data?.dados ?? {});
    setCarregando(false);
  }

  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const { error } = await supabase.from('mapa_geral').upsert(
      {
        paciente_id: pacienteId,
        nutri_id: nutriId,
        dados,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'paciente_id,nutri_id' }
    );
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  if (carregando) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="card" style={{ padding: 22 }}>
        <div style={{ marginBottom: 20 }}>
          <div className="section-title">Mapa geral da paciente</div>
          <div className="card-sub" style={{ marginTop: 2 }}>
            Contexto clínico centralizado — só você tem acesso a estas informações
          </div>
        </div>

        {CAMPOS.map(c => (
          <div key={c.key} style={{ marginBottom: 16 }}>
            <label className="form-lbl">{c.label}</label>
            <textarea
              value={dados[c.key] ?? ''}
              onChange={e => setDados(d => ({ ...d, [c.key]: e.target.value }))}
              placeholder={c.placeholder}
              rows={c.rows}
              style={{
                width: '100%', resize: 'vertical',
                fontFamily: 'var(--font-sans)', fontSize: 13,
                lineHeight: 1.5,
              }}
            />
          </div>
        ))}

        {erro && (
          <div style={{
            background: 'var(--red-bg, #fff0f0)', color: 'var(--red, #c0392b)',
            padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12,
          }}>{erro}</div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn" onClick={salvar} disabled={salvando}>
            <i className="ti ti-device-floppy" aria-hidden="true"></i>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {salvo && (
            <span style={{ fontSize: 12, color: 'var(--green, #27ae60)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-check" aria-hidden="true"></i> Salvo com sucesso
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
