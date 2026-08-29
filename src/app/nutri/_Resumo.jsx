import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';
import { cutoffISO, resumoHabitos, ultimaMedida, evolucaoPeso } from '../../lib/resumoPaciente.js';

const DIAS_JANELA = 30;

export default function Resumo({ pacienteId }) {
  const [carregando, setCarregando] = useState(true);
  const [habitos, setHabitos] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pesos, setPesos] = useState([]);
  const [checkinsRespondidos, setCheckinsRespondidos] = useState(0);

  useEffect(() => {
    let active = true;
    async function carregar() {
      setCarregando(true);
      const cutoff = cutoffISO(DIAS_JANELA);
      const cutoffTs = new Date(Date.now() - DIAS_JANELA * 86_400_000).toISOString();
      const [hRes, lRes, pRes, cRes] = await Promise.all([
        supabase.from('habitos').select('id, nome, emoji, tipo, meta, unidade, ativo')
          .eq('paciente_id', pacienteId),
        supabase.from('habitos_logs').select('habito_id, data, valor')
          .eq('paciente_id', pacienteId).gte('data', cutoff),
        supabase.from('peso_registros').select('data, kg, cintura_cm, quadril_cm, pgc, mm_kg, agua_corporal')
          .eq('paciente_id', pacienteId).order('data', { ascending: false }),
        supabase.from('checkin_envios').select('id', { count: 'exact', head: true })
          .eq('paciente_id', pacienteId).not('respondido_em', 'is', null).gte('respondido_em', cutoffTs),
      ]);
      if (!active) return;
      setHabitos(hRes.data ?? []);
      setLogs(lRes.data ?? []);
      setPesos(pRes.data ?? []);
      setCheckinsRespondidos(cRes.count ?? 0);
      setCarregando(false);
    }
    carregar();
    return () => { active = false; };
  }, [pacienteId]);

  if (carregando) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  const { mediaAgua, mediaSono, porHabito } = resumoHabitos(habitos, logs, DIAS_JANELA);
  const medida = ultimaMedida(pesos);
  const evolucao = evolucaoPeso(pesos);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* 1. Hábitos */}
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Hábitos · últimos {DIAS_JANELA} dias</div>
        <div className="g3" style={{ marginBottom: 10 }}>
          <div className="stat">
            <div className="stat-lbl">💧 Água média/dia</div>
            <div className="stat-val" style={{ fontSize: 18 }}>{mediaAgua != null ? `${mediaAgua.toFixed(1)} L` : '—'}</div>
          </div>
          <div className="stat">
            <div className="stat-lbl">😴 Sono médio/noite</div>
            <div className="stat-val" style={{ fontSize: 18 }}>{mediaSono != null ? `${mediaSono.toFixed(1)} h` : '—'}</div>
          </div>
          <div className="stat">
            <div className="stat-lbl">Hábitos ativos</div>
            <div className="stat-val" style={{ fontSize: 18 }}>{porHabito.length}</div>
          </div>
        </div>

        {porHabito.length === 0 ? (
          <div className="card empty-card" style={{ padding: 16 }}>
            <div className="empty-sub">Nenhum hábito ativo cadastrado.</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Hábito</th>
                  <th>Meta</th>
                  <th style={{ textAlign: 'right' }}>Bateu a meta</th>
                </tr>
              </thead>
              <tbody>
                {porHabito.map(h => (
                  <tr key={h.id}>
                    <td>{h.emoji ? `${h.emoji} ` : ''}{h.nome}</td>
                    <td>{h.tipo === 'numero' && h.meta ? `${h.meta}${h.unidade ? ` ${h.unidade}` : ''}` : h.tipo === 'boolean' ? 'diário' : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: h.pct >= 70 ? 'var(--green, #10b981)' : h.pct >= 40 ? 'var(--orange)' : 'var(--red)' }}>
                      {h.pct}% dos dias
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2. Medidas */}
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Medidas · último registro</div>
        {!medida ? (
          <div className="card empty-card" style={{ padding: 16 }}>
            <div className="empty-sub">Nenhum registro de peso/medidas ainda.</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Registrado em {dataBR(medida.data)}</div>
            <div className="g3">
              <div className="stat"><div className="stat-lbl">Peso</div><div className="stat-val" style={{ fontSize: 18 }}>{medida.kg != null ? `${medida.kg} kg` : '—'}</div></div>
              <div className="stat"><div className="stat-lbl">Cintura</div><div className="stat-val" style={{ fontSize: 18 }}>{medida.cintura_cm != null ? `${medida.cintura_cm} cm` : '—'}</div></div>
              <div className="stat"><div className="stat-lbl">Quadril</div><div className="stat-val" style={{ fontSize: 18 }}>{medida.quadril_cm != null ? `${medida.quadril_cm} cm` : '—'}</div></div>
              <div className="stat"><div className="stat-lbl">% Gordura</div><div className="stat-val" style={{ fontSize: 18 }}>{medida.pgc != null ? `${medida.pgc}%` : '—'}</div></div>
              <div className="stat"><div className="stat-lbl">Massa magra</div><div className="stat-val" style={{ fontSize: 18 }}>{medida.mm_kg != null ? `${medida.mm_kg} kg` : '—'}</div></div>
              <div className="stat"><div className="stat-lbl">% Água corporal</div><div className="stat-val" style={{ fontSize: 18 }}>{medida.agua_corporal != null ? `${medida.agua_corporal}%` : '—'}</div></div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Check-ins */}
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Check-ins · último mês</div>
        <div className="stat" style={{ maxWidth: 220 }}>
          <div className="stat-lbl">Respondidos</div>
          <div className="stat-val" style={{ fontSize: 18 }}>{checkinsRespondidos}</div>
        </div>
      </div>

      {/* 4. Evolução */}
      <div>
        <div className="section-label" style={{ marginBottom: 8 }}>Evolução · primeiro vs. último registro</div>
        {!evolucao ? (
          <div className="card empty-card" style={{ padding: 16 }}>
            <div className="empty-sub">São necessários pelo menos 2 registros de peso/medidas pra calcular evolução.</div>
          </div>
        ) : (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              {dataBR(evolucao.primeiro.data)} → {dataBR(evolucao.ultimo.data)}
            </div>
            <div className="g3">
              <DeltaStat label="Peso" valor={evolucao.deltaKg} unidade="kg" />
              <DeltaStat label="Cintura" valor={evolucao.deltaCintura} unidade="cm" />
              <DeltaStat label="% Gordura" valor={evolucao.deltaPgc} unidade="%" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaStat({ label, valor, unidade }) {
  const cor = valor == null ? 'var(--text3)' : valor < 0 ? 'var(--green, #10b981)' : valor > 0 ? 'var(--red)' : 'var(--text3)';
  const texto = valor == null ? '—' : `${valor > 0 ? '+' : ''}${valor.toFixed(1)} ${unidade}`;
  return (
    <div className="stat">
      <div className="stat-lbl">{label}</div>
      <div className="stat-val" style={{ fontSize: 18, color: cor }}>{texto}</div>
    </div>
  );
}
