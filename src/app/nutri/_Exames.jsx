import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const hoje = () => new Date().toISOString().slice(0, 10);

function DataBox({ iso }) {
  const d = new Date(iso + 'T12:00:00');
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
  const ano = d.getFullYear();
  return (
    <div style={{
      background: 'var(--bg2, #f5f1eb)', borderRadius: 8,
      padding: '8px 12px', textAlign: 'center', flexShrink: 0, minWidth: 54,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--dark)', lineHeight: 1 }}>{dia}</div>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginTop: 2 }}>{mes}</div>
      <div style={{ fontSize: 9, color: 'var(--text3)' }}>{ano}</div>
    </div>
  );
}

export default function Exames({ pacienteId, nutriId }) {
  const [exames, setExames]     = useState(null);
  const [form, setForm]         = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [fbk, setFbk]           = useState(null);
  const fileRef                 = useRef(null);

  // Resultados enviados pela paciente
  const [resultados, setResultados] = useState(null);
  const unreadCount = (resultados ?? []).filter(r => !r.lido_nutri).length;

  async function carregar() {
    const { data } = await supabase
      .from('exames_paciente')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false });
    setExames(data ?? []);
  }

  async function carregarResultados() {
    const { data } = await supabase
      .from('resultados_exames')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('nutri_id', nutriId)
      .order('created_at', { ascending: false });
    setResultados(data ?? []);
  }

  async function abrirResultado(r) {
    if (!r.lido_nutri) {
      await supabase.from('resultados_exames')
        .update({ lido_nutri: true })
        .eq('id', r.id);
      setResultados(curr => curr.map(x => x.id === r.id ? { ...x, lido_nutri: true } : x));
    }
    const { data: d } = await supabase.storage
      .from('exames').createSignedUrl(r.arquivo_path, 3600);
    const url = d?.signedUrl ?? r.arquivo_url;
    if (url) window.open(url, '_blank');
  }

  useEffect(() => { carregar(); }, [pacienteId]);
  useEffect(() => { carregarResultados(); }, [pacienteId, nutriId]);

  function abrirNovo() {
    setForm({ data: hoje(), nome: '', texto: '', arquivo_url: null, _arquivo: null });
    setFbk(null);
  }

  function abrirEditar(ex) {
    setForm({ ...ex, _arquivo: null });
    setFbk(null);
  }

  function fechar() { setForm(null); setFbk(null); }

  async function salvar() {
    if (!form.nome.trim()) return setFbk({ tipo: 'erro', msg: 'Preencha o nome/tipo do exame.' });
    setSalvando(true);
    setFbk(null);

    let arquivo_url = form.arquivo_url ?? null;

    if (form._arquivo) {
      const ext = form._arquivo.name.split('.').pop();
      const path = `exames/${pacienteId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('exames')
        .upload(path, form._arquivo, { upsert: true });
      if (upErr) {
        setSalvando(false);
        return setFbk({ tipo: 'erro', msg: 'Erro no upload: ' + upErr.message });
      }
      const { data: urlData } = supabase.storage.from('exames').getPublicUrl(path);
      arquivo_url = urlData.publicUrl;
    }

    const payload = {
      paciente_id: pacienteId,
      data: form.data,
      nome: form.nome.trim(),
      texto: form.texto?.trim() || null,
      arquivo_url,
    };

    let error;
    if (form.id) {
      ({ error } = await supabase.from('exames_paciente').update(payload).eq('id', form.id));
    } else {
      ({ error } = await supabase.from('exames_paciente').insert(payload));
    }

    setSalvando(false);
    if (error) return setFbk({ tipo: 'erro', msg: error.message });
    fechar();
    carregar();
  }

  async function excluir(ex) {
    if (!window.confirm(`Excluir exame "${ex.nome}"?`)) return;
    await supabase.from('exames_paciente').delete().eq('id', ex.id);
    carregar();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="card-title">Exames</div>
          <div className="card-sub">Resultados e arquivos de exames laboratoriais</div>
        </div>
        {!form && (
          <button className="btn" onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true" /> Novo exame
          </button>
        )}
      </div>

      {/* Formulário */}
      {form && (
        <div className="card" style={{ padding: 20 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            {form.id ? 'Editar exame' : 'Novo exame'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label className="field-label">Data</label>
              <input
                type="date"
                value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Nome / Tipo do exame *</label>
              <input
                value={form.nome}
                autoFocus
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Hemograma completo, Perfil lipídico, TSH…"
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="field-label">Resultados</label>
            <textarea
              value={form.texto}
              onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
              rows={6}
              placeholder="Cole ou digite os resultados aqui…"
              style={{
                width: '100%', resize: 'vertical', fontSize: 13,
                lineHeight: 1.65, padding: '8px 10px',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Arquivo (PDF ou imagem)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,image/*"
                style={{ display: 'none' }}
                onChange={e => setForm(f => ({ ...f, _arquivo: e.target.files[0] ?? null }))}
              />
              <button
                className="btn-outline"
                style={{ fontSize: 12 }}
                onClick={() => fileRef.current?.click()}
              >
                <i className="ti ti-upload" aria-hidden="true" />
                {form._arquivo ? form._arquivo.name : 'Selecionar arquivo'}
              </button>
              {form.arquivo_url && !form._arquivo && (
                <a
                  href={form.arquivo_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: 'var(--gold-deep)', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <i className="ti ti-file" aria-hidden="true" /> Arquivo atual
                </a>
              )}
            </div>
          </div>

          {fbk && (
            <div style={{
              marginBottom: 12, fontSize: 13, padding: '8px 12px', borderRadius: 8,
              color: fbk.tipo === 'erro' ? 'var(--red)' : 'var(--green)',
              background: fbk.tipo === 'erro' ? '#fbeaf0' : '#e6f0d4',
            }}>
              {fbk.msg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            <button className="btn-outline" onClick={fechar}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Resultados enviados pela paciente */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div>
            <div className="card-title">Resultados enviados pela paciente</div>
            <div className="card-sub">Arquivos de exames enviados diretamente pela paciente</div>
          </div>
          {unreadCount > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              background: '#fde8e8', color: '#e05555', letterSpacing: '.3px',
            }}>
              {unreadCount} novo{unreadCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {resultados === null ? (
          <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>
        ) : resultados.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>
            Nenhum resultado enviado pela paciente ainda.
          </div>
        ) : (
          resultados.map(r => (
            <div key={r.id} className="card" style={{ padding: '14px 18px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {!r.lido_nutri && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e05555', flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)' }}>{r.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span>{new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {!r.lido_nutri && <span style={{ color: '#e05555', fontWeight: 600 }}>Novo</span>}
                  </div>
                </div>
                <button
                  onClick={() => abrirResultado(r)}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'var(--gold-deep, #b8860b)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  }}
                >
                  <i className="ti ti-external-link" aria-hidden="true" />
                  Abrir
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Exames registrados pela nutricionista */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        <div style={{ marginBottom: 14 }}>
          <div className="card-title">Registros da nutricionista</div>
          <div className="card-sub">Resultados e notas adicionados por você</div>
        </div>

      {/* Lista */}
      {exames === null ? (
        <div className="card empty-card">
          <div className="empty-sub">Carregando…</div>
        </div>
      ) : exames.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-test-pipe empty-icon" aria-hidden="true" />
          <div className="empty-title">Nenhum exame registrado</div>
          <div className="empty-sub">Clique em "+ Novo exame" para adicionar o primeiro.</div>
        </div>
      ) : (
        exames.map(ex => (
          <div key={ex.id} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <DataBox iso={ex.data} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)', marginBottom: ex.texto ? 6 : 0 }}>
                  {ex.nome}
                </div>
                {ex.texto && (
                  <div style={{
                    fontSize: 12, color: 'var(--text3)', lineHeight: 1.6,
                    display: '-webkit-box', WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    whiteSpace: 'pre-line',
                  }}>
                    {ex.texto}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexShrink: 0, gap: 6, alignItems: 'center' }}>
                {ex.arquivo_url && (
                  <a
                    href={ex.arquivo_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir arquivo"
                    style={{
                      padding: '5px 8px', borderRadius: 6, fontSize: 14,
                      border: '1px solid var(--border)', color: 'var(--gold-deep)',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <i className="ti ti-file-download" aria-hidden="true" />
                  </a>
                )}
                <button
                  onClick={() => abrirEditar(ex)}
                  title="Editar"
                  style={{
                    padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <i className="ti ti-edit" aria-hidden="true" />
                </button>
                <button
                  onClick={() => excluir(ex)}
                  title="Excluir"
                  style={{
                    padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 14,
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
      </div>{/* fim seção registros nutri */}
    </div>
  );
}
