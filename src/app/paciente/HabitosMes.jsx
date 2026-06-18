import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

export const HABITOS_PADRAO = [
  'Foco 100% no plano',
  'Ingeri frutas e verduras',
  'Fiz atividade física',
  'Intestino funcionou bem',
  'Dormi bem (7-8 horas noite)',
  'Meta de hidratação batida',
  'Ingeri álcool',
  'Suplementação',
  'Comi besteira',
  'Me senti disposta',
  'Fiquei saciada',
  'Senti fome (barriga roncando)',
  'Senti vontade de comer',
];

export const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const navBtnStyle = {
  background: 'var(--bg-soft)', border: '0.5px solid var(--hair)', borderRadius: 8,
  padding: '6px 10px', cursor: 'pointer', color: 'var(--dark)', display: 'flex', alignItems: 'center',
};

const thStyle = { fontSize: 10, padding: '0 2px 8px', textAlign: 'center', minWidth: 24 };
const tdLabelStyle = { fontSize: 12, color: 'var(--ink)', padding: '6px 10px 6px 0', whiteSpace: 'nowrap' };

export default function HabitosMes() {
  const { user } = useSession();
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [habitos, setHabitos] = useState(HABITOS_PADRAO);
  const [checks, setChecks] = useState({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { carregar(); }, [user, ano, mes]);

  async function carregar() {
    if (!user) return;
    setCarregando(true);
    const { data } = await supabase
      .from('habitos_mes')
      .select('*')
      .eq('paciente_id', user.id)
      .eq('ano', ano)
      .eq('mes', mes)
      .maybeSingle();
    setHabitos(data?.habitos?.length ? data.habitos : HABITOS_PADRAO);
    setChecks(data?.checks ?? {});
    setCarregando(false);
  }

  async function salvar(partial) {
    await supabase.from('habitos_mes').upsert({
      paciente_id: user.id,
      ano, mes,
      habitos: partial.habitos ?? habitos,
      checks: partial.checks ?? checks,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'paciente_id,ano,mes' });
  }

  function toggleCheck(habitoIdx, dia) {
    const key = String(habitoIdx);
    const diaKey = String(dia);
    const novo = {
      ...checks,
      [key]: { ...checks[key], [diaKey]: !checks[key]?.[diaKey] },
    };
    setChecks(novo);
    salvar({ checks: novo });
  }

  function navMes(delta) {
    let m = mes + delta, a = ano;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAno(a);
  }

  const diasNoMes = new Date(ano, mes, 0).getDate();
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const hojeISO = agora.toISOString().slice(0, 10);
  const isMesAtual = ano === agora.getFullYear() && mes === agora.getMonth() + 1;

  if (carregando) {
    return <div className="empty-state"><div className="empty-sub">Carregando…</div></div>;
  }

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');`}</style>
      <div style={{ fontFamily: "'Poppins', var(--font-sans)" }}>
        <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={() => navMes(-1)} aria-label="Mês anterior" style={navBtnStyle}>
            <i className="ti ti-chevron-left" aria-hidden="true"></i>
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            {MESES[mes - 1]} {ano}
          </div>
          <button onClick={() => navMes(1)} aria-label="Próximo mês" style={navBtnStyle}>
            <i className="ti ti-chevron-right" aria-hidden="true"></i>
          </button>
        </div>

        <div className="card" style={{ padding: '14px 16px 16px', marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>
              Check diário
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: dias.length * 28 + 160 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, position: 'sticky', left: 0, background: 'var(--paper)', textAlign: 'left', minWidth: 150, zIndex: 1 }}></th>
                {dias.map(d => {
                  const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const isHoje = isMesAtual && iso === hojeISO;
                  return (
                    <th key={d} style={{ ...thStyle, color: isHoje ? 'var(--dark)' : 'var(--muted)', fontWeight: isHoje ? 700 : 500 }}>
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {habitos.map((h, hi) => (
                <tr key={hi}>
                  <td style={{ ...tdLabelStyle, position: 'sticky', left: 0, background: 'var(--paper)', zIndex: 1 }}>
                    {h}
                  </td>
                  {dias.map(d => {
                    const marcado = !!checks[String(hi)]?.[String(d)];
                    return (
                      <td key={d} style={{ padding: 2, textAlign: 'center' }}>
                        <button
                          onClick={() => toggleCheck(hi, d)}
                          aria-label={`${h} — dia ${d}`}
                          style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: marcado ? 'var(--dark)' : 'transparent',
                            border: marcado ? 'none' : '0.5px solid var(--hair)',
                            cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                          {marcado && <i className="ti ti-check" style={{ fontSize: 12, color: 'var(--white)' }} aria-hidden="true"></i>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}
