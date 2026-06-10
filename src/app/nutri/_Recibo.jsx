import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';

export default function Recibo({ pacienteId, nutriId }) {
  const [recibos, setRecibos] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);

  async function carregar() {
    const { data } = await supabase
      .from('recibos_paciente').select('*')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });
    setRecibos(data ?? []);
  }
  useEffect(() => { carregar(); }, [pacienteId]);

  async function enviarRecibo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setErro('Selecione um arquivo PDF.'); return;
    }
    setUploading(true); setErro(null);
    const ext = 'pdf';
    const path = `recibos/${pacienteId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('recibos').upload(path, file, { upsert: false });
    if (upErr) { setUploading(false); setErro('Erro no upload: ' + upErr.message); return; }
    const { data: urlData } = supabase.storage.from('recibos').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('recibos_paciente').insert({
      paciente_id: pacienteId, nutri_id: nutriId,
      nome: file.name, arquivo_url: urlData.publicUrl,
    });
    setUploading(false);
    if (dbErr) { setErro('Erro ao salvar: ' + dbErr.message); return; }
    if (inputRef.current) inputRef.current.value = '';
    carregar();
  }

  async function excluir(r) {
    if (!window.confirm(`Excluir recibo "${r.nome}"?`)) return;
    await supabase.from('recibos_paciente').delete().eq('id', r.id);
    carregar();
  }

  return (
    <div>
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Enviar recibo</div>
        {erro && <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{erro}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf"
            onChange={enviarRecibo} disabled={uploading} style={{ display: 'none' }} />
          <button className="btn" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <i className="ti ti-upload" aria-hidden="true"></i>
            {uploading ? 'Enviando…' : 'Selecionar PDF'}
          </button>
          <span style={{ fontSize: 12, color: '#888888' }}>Somente arquivos .pdf</span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {recibos === null ? (
          <div className="empty-card"><div className="empty-sub">Carregando…</div></div>
        ) : recibos.length === 0 ? (
          <div className="empty-card" style={{ padding: 32 }}>
            <i className="ti ti-receipt empty-icon" aria-hidden="true"></i>
            <div className="empty-title">Nenhum recibo enviado</div>
            <div className="empty-sub">Use o botão acima para enviar um recibo em PDF.</div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Arquivo</th><th>Data</th><th></th></tr>
            </thead>
            <tbody>
              {recibos.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className="ti ti-file-type-pdf" style={{ color: 'var(--red)', fontSize: 18 }} aria-hidden="true"></i>
                      <span style={{ fontSize: 13 }}>{r.nome}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: '#666666' }}>{dataBR(r.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <a href={r.arquivo_url} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, padding: '4px 10px',
                          border: '0.5px solid var(--border)', borderRadius: 6,
                          color: '#555555', textDecoration: 'none',
                        }}>
                        <i className="ti ti-download" aria-hidden="true"></i> Abrir
                      </a>
                      <button onClick={() => excluir(r)} style={{
                        display: 'inline-flex', alignItems: 'center', padding: '4px 8px',
                        borderRadius: 6, background: 'none', border: '0.5px solid var(--red)',
                        color: 'var(--red)', cursor: 'pointer', fontSize: 12,
                      }}>
                        <i className="ti ti-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
