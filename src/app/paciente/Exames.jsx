import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { useTheme } from '../../lib/theme.jsx';

function fmtData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ExamesPaciente() {
  const { user, profile } = useSession();
  const tema = useTheme();
  const cor = tema.cor_primaria || '#c8a96e';

  const [lista, setLista] = useState(undefined);
  const [urls, setUrls] = useState({});
  const [nome, setNome] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(false);
  const fileRef = useRef(null);

  async function carregar() {
    const { data } = await supabase
      .from('resultados_exames')
      .select('*')
      .eq('paciente_id', user.id)
      .order('created_at', { ascending: false });
    setLista(data ?? []);

    // Pré-fetch signed URLs — window.open deve ser síncrono no iOS
    const novasUrls = {};
    for (const r of data ?? []) {
      if (r.arquivo_path) {
        const { data: d } = await supabase.storage
          .from('exames')
          .createSignedUrl(r.arquivo_path, 3600);
        if (d?.signedUrl) novasUrls[r.id] = d.signedUrl;
      }
    }
    setUrls(novasUrls);
  }

  useEffect(() => {
    if (!user || !profile?.nutri_id) return;
    let active = true;
    carregar().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [user, profile?.nutri_id]);

  async function enviar() {
    setErro(null);
    setSucesso(false);
    if (!arquivo) return setErro('Selecione um arquivo.');
    if (!nome.trim()) return setErro('Informe o nome do exame.');
    if (!profile?.nutri_id) return setErro('Nutricionista não encontrada.');
    setBusy(true);

    const ext = arquivo.name.split('.').pop() || 'pdf';
    const path = `${profile.nutri_id}/${user.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('exames')
      .upload(path, arquivo, { contentType: arquivo.type });
    if (upErr) {
      setBusy(false);
      return setErro('Upload falhou: ' + upErr.message);
    }

    const { data: urlData } = supabase.storage.from('exames').getPublicUrl(path);

    const { error: insErr } = await supabase.from('resultados_exames').insert({
      paciente_id: user.id,
      nutri_id: profile.nutri_id,
      nome: nome.trim(),
      arquivo_url: urlData?.publicUrl ?? null,
      arquivo_path: path,
    });
    setBusy(false);
    if (insErr) {
      await supabase.storage.from('exames').remove([path]);
      return setErro('Erro ao salvar: ' + insErr.message);
    }
    setNome('');
    setArquivo(null);
    if (fileRef.current) fileRef.current.value = '';
    setSucesso(true);
    carregar();
  }

  function abrir(id) {
    const url = urls[id];
    if (url) window.open(url, '_blank');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>

      {/* Formulário de upload */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title" style={{ marginBottom: 4 }}>Enviar resultado de exame</div>
        <div className="card-sub" style={{ marginBottom: 16 }}>PDF ou imagem do resultado</div>

        <div style={{ marginBottom: 12 }}>
          <label className="field-label">Nome do exame *</label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: Hemograma junho 2026, TSH, Vitamina D…"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Arquivo</label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            style={{ display: 'none' }}
            onChange={e => { setArquivo(e.target.files[0] ?? null); setSucesso(false); setErro(null); }}
          />
          <button
            className="btn-outline"
            style={{ width: '100%', justifyContent: 'center', gap: 8 }}
            onClick={() => fileRef.current?.click()}
          >
            <i className="ti ti-upload" aria-hidden="true" />
            {arquivo ? arquivo.name : 'Selecionar arquivo (PDF ou imagem)'}
          </button>
        </div>

        {erro && (
          <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>{erro}</div>
        )}
        {sucesso && (
          <div style={{ fontSize: 13, color: 'var(--green, #10b981)', marginBottom: 10 }}>
            Exame enviado com sucesso!
          </div>
        )}

        <button
          className="btn"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={enviar}
          disabled={busy}
        >
          {busy ? 'Enviando…' : 'Enviar exame'}
        </button>
      </div>

      {/* Lista */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
          Exames enviados
        </div>

        {lista === undefined ? (
          <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>
        ) : lista.length === 0 ? (
          <div className="card empty-card">
            <i className="ti ti-test-pipe empty-icon" aria-hidden="true" />
            <div className="empty-title">Nenhum exame enviado</div>
            <div className="empty-sub">Seus resultados aparecerão aqui após o envio.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map(r => (
              <div key={r.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'var(--bg2, #f5f1eb)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <i className="ti ti-file-description" style={{ fontSize: 18, color: cor }} aria-hidden="true" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>
                      {r.nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtData(r.created_at)}</div>
                  </div>
                  {urls[r.id] && (
                    <button
                      onClick={() => abrir(r.id)}
                      style={{
                        padding: '7px 14px', borderRadius: 8,
                        background: cor, color: '#fff',
                        border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                      }}
                    >
                      <i className="ti ti-download" aria-hidden="true" />
                      Abrir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
