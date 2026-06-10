import { useState, useEffect } from 'react';

const COPOS = [
  { id: 0, horario: '08:00', ml: 500 },
  { id: 1, horario: '10:00', ml: 400 },
  { id: 2, horario: '12:00', ml: 400 },
  { id: 3, horario: '14:00', ml: 400 },
  { id: 4, horario: '16:00', ml: 400 },
  { id: 5, horario: '17:30', ml: 400 },
];
const TOTAL_ML = 2500;

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function HidratacaoCard() {
  const [marcados, setMarcados] = useState(() => {
    try {
      const key = `lapidare_hidratacao_${hojeISO()}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(`lapidare_hidratacao_${hojeISO()}`, JSON.stringify(marcados));
  }, [marcados]);

  const totalMl = marcados.reduce((acc, id) => {
    const c = COPOS.find(c => c.id === id);
    return acc + (c?.ml ?? 0);
  }, 0);
  const pct = Math.min(100, Math.round((totalMl / TOTAL_ML) * 100));

  const agora = new Date();
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  function minHorario(h) { const [hr, m] = h.split(':').map(Number); return hr * 60 + m; }

  function toggle(id) {
    setMarcados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 14 }}>
          <i className="ti ti-droplet-filled" style={{ color: '#3b82f6', fontSize: 16 }} aria-hidden="true"></i>
          Hidratação de hoje
        </div>
        <button
          onClick={() => setMarcados([])}
          style={{ fontSize: 11, color: '#888888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Resetar
        </button>
      </div>

      {/* Barra de progresso */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666666', marginBottom: 4 }}>
          <span>{totalMl}ml de {TOTAL_ML}ml</span>
          <span style={{ color: pct === 100 ? '#16a34a' : '#3b82f6', fontWeight: 600 }}>{pct}%</span>
        </div>
        <div style={{ height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, transition: 'width .3s',
            background: pct === 100 ? '#16a34a' : '#3b82f6',
            width: `${pct}%`,
          }} />
        </div>
      </div>

      {/* Lista de copos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {COPOS.map(c => {
          const checked = marcados.includes(c.id);
          const passado = minHorario(c.horario) <= minAgora;
          return (
            <label key={c.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              padding: '5px 8px', borderRadius: 6, transition: 'all .15s',
              background: checked ? 'rgba(59,130,246,.07)' : passado && !checked ? 'rgba(239,68,68,.04)' : 'transparent',
              border: `0.5px solid ${checked ? 'rgba(59,130,246,.25)' : 'transparent'}`,
            }}>
              <input
                type="checkbox" checked={checked} onChange={() => toggle(c.id)}
                style={{ width: 15, height: 15, accentColor: '#3b82f6', cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: checked ? '#1d4ed8' : '#444444', fontWeight: checked ? 500 : 400, flex: 1 }}>
                {c.horario}
              </span>
              <span style={{ fontSize: 11, color: '#888888' }}>{c.ml}ml</span>
              {checked && <i className="ti ti-droplet-filled" style={{ fontSize: 12, color: '#3b82f6' }} aria-hidden="true"></i>}
              {!checked && passado && <i className="ti ti-alert-circle" style={{ fontSize: 12, color: '#f97316', opacity: .5 }} aria-hidden="true"></i>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
