import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';

const BUCKET = 'documentos-nutri';
const ACCEPT  = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv';

function fmtTamanho(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function icone(mime) {
  if (!mime) return 'ti-file';
  if (mime.includes('pdf'))   return 'ti-file-type-pdf';
  if (mime.includes('image')) return 'ti-photo';
  if (mime.includes('word') || mime.includes('document')) return 'ti-file-type-doc';
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return 'ti-file-type-xls';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'ti-file-type-ppt';
  return 'ti-file';
}

/* ── Componente principal ─────────────────────────────────────────────── */
export default function Documentos() {
  const { user } = useSession();
  const [docs,      setDocs]      = useState(null);
  const [uploading, setUploading] = useState(false);
  const [erroUp,    setErroUp]    = useState(null);
  const [renomeando, setRenomeando] = useState(null); // { id, nome }
  const [deletando,  setDeletando]  = useState(null); // doc obj
  const inputRef = useRef(null);

  async function carregar() {
    if (!user) return;
    const { data } = await supabase
      .from('documentos_nutri')
      .select('*')
      .eq('nutri_id', user.id)
      .order('created_at', { ascending: false });
    setDocs(data ?? []);
  }

  useEffect(() => { carregar(); }, [user]);

  /* ── Upload ── */
  async function handleUpload(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !user) return;
    setUploading(true); setErroUp(null);

    for (const file of files) {
      const ext   = file.name.split('.').pop();
      const uuid  = crypto.randomUUID();
      const path  = `${user.id}/${uuid}.${ext}`;

      const { error: storErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type });

      if (storErr) {
        setErroUp('Erro ao enviar "' + file.name + '": ' + storErr.message);
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }

      await supabase.from('documentos_nutri').insert({
        nutri_id:  user.id,
        nome:      file.name.replace(/\.[^.]+$/, ''),
        arquivo:   file.name,
        path,
        mime_type: file.type || null,
        tamanho:   file.size || null,
      });
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    carregar();
  }

  /* ── Download (URL assinada de 60s) ── */
  async function baixar(doc) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.path, 60);
    if (error || !data?.signedUrl) {
      alert('Não foi possível gerar o link: ' + (error?.message ?? 'erro desconhecido'));
      return;
    }
    window.open(data.signedUrl, '_blank');
  }

  /* ── Renomear ── */
  async function salvarNome() {
    if (!renomeando) return;
    const nome = renomeando.nome.trim();
    if (!nome) return;
    await supabase.from('documentos_nutri').update({ nome }).eq('id', renomeando.id);
    setRenomeando(null);
    carregar();
  }

  /* ── Excluir ── */
  async function confirmarExcluir() {
    if (!deletando) return;
    await supabase.storage.from(BUCKET).remove([deletando.path]);
    await supabase.from('documentos_nutri').delete().eq('id', deletando.id);
    setDeletando(null);
    carregar();
  }

  return (
    <>
      <style>{`@keyframes spin-doc{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div className="page-title">Documentos</div>
      <div className="page-sub">Armazene e acesse arquivos importantes do consultório</div>

      {/* ── Área de upload ── */}
      <div className="card" style={{ padding: 18, marginBottom: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
        <button
          className="btn"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          style={{ gap: 8 }}
        >
          <i
            className={`ti ti-${uploading ? 'loader-2' : 'upload'}`}
            style={{ animation: uploading ? 'spin-doc .9s linear infinite' : 'none' }}
            aria-hidden="true"
          ></i>
          {uploading ? 'Enviando...' : 'Enviar documento'}
        </button>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          PDF, Word, Excel, PowerPoint, imagens — máx. 50 MB por arquivo
        </span>
        {erroUp && (
          <div style={{
            width: '100%', fontSize: 12, color: 'var(--red)',
            background: 'var(--red-bg)', padding: '7px 10px', borderRadius: 6,
          }}>
            {erroUp}
          </div>
        )}
      </div>

      {/* ── Lista ── */}
      {docs === null ? (
        <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>
      ) : docs.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-folder-open" style={{ fontSize: 36, color: 'var(--border)', display: 'block', marginBottom: 10 }} aria-hidden="true"></i>
          <div className="empty-title">Nenhum documento ainda</div>
          <div className="empty-sub">Clique em "Enviar documento" para começar.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {docs.map((doc, i) => (
            <div
              key={doc.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                borderBottom: i < docs.length - 1 ? '0.5px solid var(--border)' : 'none',
              }}
            >
              {/* Ícone */}
              <i
                className={`ti ${icone(doc.mime_type)}`}
                style={{ fontSize: 22, color: 'var(--amber)', flexShrink: 0 }}
                aria-hidden="true"
              ></i>

              {/* Info / input de renomear */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {renomeando?.id === doc.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      autoFocus
                      value={renomeando.nome}
                      onChange={e => setRenomeando(r => ({ ...r, nome: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  salvarNome();
                        if (e.key === 'Escape') setRenomeando(null);
                      }}
                      style={{
                        flex: 1, minWidth: 120,
                        padding: '5px 9px', fontSize: 13,
                        border: '1px solid var(--amber)', borderRadius: 6,
                        background: '#fff', fontFamily: 'var(--font-sans)', outline: 'none',
                      }}
                    />
                    <button className="btn" style={{ padding: '5px 12px', fontSize: 12 }} onClick={salvarNome}>
                      Salvar
                    </button>
                    <button className="btn-outline" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setRenomeando(null)}>
                      <i className="ti ti-x" aria-hidden="true"></i>
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: 'var(--dark)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {doc.nome || doc.arquivo}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                      {doc.arquivo}
                      {' · '}
                      {dataBR(doc.created_at)}
                      {doc.tamanho ? ' · ' + fmtTamanho(doc.tamanho) : ''}
                    </div>
                  </>
                )}
              </div>

              {/* Botões de ação */}
              {renomeando?.id !== doc.id && (
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  <AcaoBtn title="Baixar" icon="download" onClick={() => baixar(doc)} />
                  <AcaoBtn
                    title="Renomear"
                    icon="pencil"
                    onClick={() => setRenomeando({ id: doc.id, nome: doc.nome || doc.arquivo.replace(/\.[^.]+$/, '') })}
                  />
                  <AcaoBtn title="Excluir" icon="trash" danger onClick={() => setDeletando(doc)} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal confirmar exclusão ── */}
      {deletando && (
        <div
          onClick={() => setDeletando(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.42)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, padding: 16, fontFamily: 'var(--font-sans)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 14,
              maxWidth: 380, width: '100%',
              padding: '24px 24px 20px',
              boxShadow: '0 12px 40px rgba(0,0,0,.2)',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8, color: 'var(--dark)' }}>
              Excluir documento?
            </div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 22, lineHeight: 1.55 }}>
              <strong style={{ color: 'var(--dark)' }}>
                {deletando.nome || deletando.arquivo}
              </strong>{' '}
              será removido permanentemente e não poderá ser recuperado.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-outline"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setDeletando(null)}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExcluir}
                style={{
                  flex: 1, padding: '8px 16px',
                  background: 'var(--red)', color: '#fff',
                  border: 'none', borderRadius: 6,
                  fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Botão de ação inline ── */
function AcaoBtn({ icon, title, onClick, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '6px 7px', borderRadius: 5, fontSize: 16,
        color: hover ? (danger ? 'var(--red)' : 'var(--dark)') : 'var(--text3)',
        transition: 'color .15s',
      }}
    >
      <i className={`ti ti-${icon}`} aria-hidden="true"></i>
    </button>
  );
}
