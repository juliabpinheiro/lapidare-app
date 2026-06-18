import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';

function fmtTamanho(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReceitasNutri() {
  const { user } = useSession();
  const [receitas, setReceitas] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const [nome, setNome] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const fileInputRef = useRef(null);

  async function carregar() {
    if (!user) return;
    const { data } = await supabase
      .from('receitas')
      .select('*')
      .eq('nutri_id', user.id)
      .order('created_at', { ascending: false });
    setReceitas(data ?? []);
  }

  useEffect(() => { carregar(); }, [user]);

  async function enviar() {
    setErro(null);
    if (!arquivo) return setErro('Selecione um arquivo.');
    if (!nome.trim()) return setErro('Informe um nome para a receita.');
    setBusy(true);

    const ext = arquivo.name.split('.').pop() || 'pdf';
    const path = `${user.id}/${Date.now()}-${nome.trim().replace(/[^a-z0-9]/gi, '_')}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('receitas')
      .upload(path, arquivo, { contentType: arquivo.type });
    if (upErr) {
      setBusy(false);
      return setErro('Upload falhou: ' + upErr.message);
    }

    const { data: urlData } = supabase.storage.from('receitas').getPublicUrl(path);

    const { error: insErr } = await supabase.from('receitas').insert({
      nutri_id: user.id,
      nome: nome.trim(),
      storage_path: path,
      arquivo_url: urlData.publicUrl,
      tamanho_bytes: arquivo.size,
    });
    setBusy(false);
    if (insErr) {
      await supabase.storage.from('receitas').remove([path]);
      return setErro('Erro ao salvar: ' + insErr.message);
    }
    setNome('');
    setArquivo(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    carregar();
  }

  async function remover(r) {
    if (!window.confirm(`Remover "${r.nome}"? As pacientes não verão mais este arquivo.`)) return;
    await supabase.storage.from('receitas').remove([r.storage_path]);
    await supabase.from('receitas').delete().eq('id', r.id);
    carregar();
  }

  async function abrirArquivo(r) {
    const { data, error } = await supabase.storage
      .from('receitas').createSignedUrl(r.storage_path, 120);
    if (error) return alert('Não foi possível abrir: ' + error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <>
      <div className="page-title">Receitas</div>
      <div className="page-sub">Arquivos disponíveis para todas as pacientes ativas</div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="field-label">Nome da receita</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Smoothie proteico, Pão low carb…"
            />
          </div>
          <div>
            <label className="field-label">Arquivo (PDF ou imagem)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => setArquivo(e.target.files?.[0] ?? null)}
              style={{ padding: 6 }}
            />
          </div>
        </div>

        {erro && (
          <div style={{
            fontSize: 12, color: 'var(--red)', background: 'var(--red-soft)',
            padding: '8px 12px', borderRadius: 8, marginBottom: 10,
          }}>{erro}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={enviar} disabled={busy || !arquivo || !nome.trim()}>
            <i className="ti ti-upload" aria-hidden="true"></i>
            {busy ? 'Enviando…' : 'Adicionar receita'}
          </button>
        </div>
      </div>

      {receitas === undefined ? (
        <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>
      ) : receitas.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-chef-hat empty-icon" aria-hidden="true"></i>
          <div className="empty-title">Nenhuma receita ainda</div>
          <div className="empty-sub">
            Faça upload de PDFs ou imagens — ficam visíveis para todas as pacientes ativas.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {receitas.map((r, i) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderBottom: i < receitas.length - 1 ? '0.5px solid var(--border)' : 'none',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: 'var(--gold-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <i className="ti ti-file-text" style={{ fontSize: 18, color: 'var(--gold-deep)' }} aria-hidden="true"></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {r.nome}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  {dataBR(r.created_at)}{r.tamanho_bytes ? ` · ${fmtTamanho(r.tamanho_bytes)}` : ''}
                </div>
              </div>
              <button
                className="btn-outline"
                style={{ fontSize: 12, padding: '4px 10px', flexShrink: 0 }}
                onClick={() => abrirArquivo(r)}
              >
                <i className="ti ti-eye" aria-hidden="true"></i> Ver
              </button>
              <button
                onClick={() => remover(r)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 4, flexShrink: 0 }}
                title="Remover"
              >
                <i className="ti ti-trash" style={{ fontSize: 16 }} aria-hidden="true"></i>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
