import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';

export default function Recibos() {
  const { user } = useSession();
  const [recibos, setRecibos] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('recibos_paciente')
        .select('id, nome, arquivo_url, created_at')
        .eq('paciente_id', user.id)
        .order('created_at', { ascending: false });
      setRecibos(data ?? []);
    })();
  }, [user]);

  async function baixar(r) {
    const url = r.arquivo_url;
    if (!url) { alert('Arquivo não disponível.'); return; }
    const win = window.open('', '_blank');
    if (win) win.location.href = url;
  }

  return (
    <>
      {recibos === null ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          Carregando...
        </div>
      ) : recibos.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <i className="ti ti-receipt" style={{ fontSize: 40, color: 'var(--muted-2)' }} aria-hidden="true"></i>
          <div style={{ fontSize: 14, fontWeight: 500, margin: '8px 0 4px' }}>Nenhum recibo ainda</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            A Dra. ainda não compartilhou recibos com você.
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {recibos.map(r => (
            <button key={r.id} onClick={() => baixar(r)}
              style={{
                width: '100%', textAlign: 'left',
                background: 'var(--white)',
                border: '0.5px solid var(--hair)', borderRadius: 14,
                padding: 14, marginBottom: 10,
                display: 'flex', gap: 12, alignItems: 'center',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}>
              <div style={{
                width: 48, height: 48, borderRadius: 10,
                background: 'var(--bg-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <i className="ti ti-receipt" style={{ fontSize: 24, color: 'var(--gold-deep)' }} aria-hidden="true"></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
                  {r.nome ?? r.titulo ?? 'Recibo'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{dataBR(r.created_at)}</span>
                </div>
              </div>
              <i className="ti ti-download" style={{ fontSize: 18, color: 'var(--muted)' }} aria-hidden="true"></i>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
