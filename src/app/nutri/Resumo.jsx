import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR, iniciais } from '../../lib/utils.js';
import { cutoffISO, resumoHabitos, ultimaMedida, evolucaoPeso } from '../../lib/resumoPaciente.js';

const DIAS_JANELA = 30;

export default function Resumo() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [linhas, setLinhas] = useState(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;

    async function carregar() {
      const cutoff = cutoffISO(DIAS_JANELA);
      const cutoffTs = new Date(Date.now() - DIAS_JANELA * 86_400_000).toISOString();

      const [pacRes, habRes, logRes, pesoRes, checkRes] = await Promise.all([
        supabase.from('pacientes').select('id, nome, ativo'),
        supabase.from('habitos').select('id, paciente_id, nome, emoji, tipo, meta, unidade, ativo')
          .eq('nutri_id', user.id),
        supabase.from('habitos_logs').select('habito_id, paciente_id, data, valor')
          .gte('data', cutoff),
        supabase.from('peso_registros').select('paciente_id, data, kg, cintura_cm, quadril_cm, pgc, mm_kg, agua_corporal')
          .eq('nutri_id', user.id).order('data', { ascending: false }),
        supabase.from('checkin_envios').select('paciente_id, respondido_em')
          .eq('nutri_id', user.id).not('respondido_em', 'is', null).gte('respondido_em', cutoffTs),
      ]);
      if (!active) return;

      const pacientes = pacRes.data ?? [];
      const habitos   = habRes.data ?? [];
      const logs      = logRes.data ?? [];
      const pesos     = pesoRes.data ?? [];
      const checkins  = checkRes.data ?? [];

      const linhas = pacientes.map(p => {
        const habitosP = habitos.filter(h => h.paciente_id === p.id);
        const logsP    = logs.filter(l => l.paciente_id === p.id);
        const pesosP   = pesos.filter(r => r.paciente_id === p.id);
        const checkinsP = checkins.filter(c => c.paciente_id === p.id).length;

        const { mediaAgua, mediaSono, porHabito } = resumoHabitos(habitosP, logsP, DIAS_JANELA);
        const adesaoMedia = porHabito.length
          ? Math.round(porHabito.reduce((s, h) => s + h.pct, 0) / porHabito.length)
          : null;

        return {
          paciente: p,
          mediaAgua, mediaSono, adesaoMedia,
          medida: ultimaMedida(pesosP),
          evolucao: evolucaoPeso(pesosP),
          checkinsRespondidos: checkinsP,
        };
      }).sort((a, b) => a.paciente.nome.localeCompare(b.paciente.nome));

      setLinhas(linhas);
    }

    carregar();
    return () => { active = false; };
  }, [user]);

  const filtradas = useMemo(() => {
    if (!linhas) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter(l => l.paciente.nome?.toLowerCase().includes(q));
  }, [linhas, busca]);

  return (
    <>
      <div className="page-title">Resumo</div>
      <div className="page-sub">Hábitos, medidas, check-ins e evolução de cada paciente nos últimos {DIAS_JANELA} dias</div>

      <div style={{ marginBottom: 14 }}>
        <input
          style={{ width: 240, margin: 0 }}
          className="input-field"
          placeholder="Buscar paciente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {linhas === null ? (
        <div className="card empty-card">
          <div className="empty-sub">Carregando…</div>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-report-analytics empty-icon" aria-hidden="true"></i>
          <div className="empty-title">Nenhuma paciente encontrada</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>💧 Água méd.</th>
                <th>😴 Sono méd.</th>
                <th>Adesão hábitos</th>
                <th>Último peso</th>
                <th>Evolução peso</th>
                <th>Check-ins (mês)</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(l => (
                <tr key={l.paciente.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/nutri/pacientes/${l.paciente.id}`)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'var(--bg2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 600, color: 'var(--dark)'
                      }}>{iniciais(l.paciente.nome)}</div>
                      <div style={{ fontWeight: 500 }}>{l.paciente.nome}</div>
                      {l.paciente.ativo === false && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: '#f3f4f6', color: '#6b7280',
                        }}>Inativa</span>
                      )}
                    </div>
                  </td>
                  <td>{l.mediaAgua != null ? `${l.mediaAgua.toFixed(1)} L` : '—'}</td>
                  <td>{l.mediaSono != null ? `${l.mediaSono.toFixed(1)} h` : '—'}</td>
                  <td>
                    {l.adesaoMedia == null ? '—' : (
                      <span style={{
                        fontWeight: 600,
                        color: l.adesaoMedia >= 70 ? 'var(--green, #10b981)' : l.adesaoMedia >= 40 ? 'var(--orange)' : 'var(--red)',
                      }}>{l.adesaoMedia}%</span>
                    )}
                  </td>
                  <td>
                    {l.medida ? (
                      <>{l.medida.kg != null ? `${l.medida.kg} kg` : '—'} <span style={{ fontSize: 11, color: 'var(--text3)' }}>· {dataBR(l.medida.data)}</span></>
                    ) : '—'}
                  </td>
                  <td>
                    {l.evolucao?.deltaKg != null ? (
                      <span style={{ color: l.evolucao.deltaKg < 0 ? 'var(--green, #10b981)' : l.evolucao.deltaKg > 0 ? 'var(--red)' : 'var(--text3)' }}>
                        {l.evolucao.deltaKg > 0 ? '+' : ''}{l.evolucao.deltaKg.toFixed(1)} kg
                      </span>
                    ) : '—'}
                  </td>
                  <td>{l.checkinsRespondidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
