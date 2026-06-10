import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { iniciais } from '../../lib/utils.js';

const REACOES = [
  { id: 'coracao', icon: 'ti-heart',         iconAtivo: 'ti-heart-filled',        label: 'Aprovado', cor: '#e05555', bg: '#fdf0f0' },
  { id: 'atencao', icon: 'ti-alert-circle',  iconAtivo: 'ti-alert-circle-filled', label: 'Atenção',  cor: '#c97c2e', bg: '#fef5eb' },
];

const urlCache = new Map();

async function getSignedUrl(path) {
  const cached = urlCache.get(path);
  if (cached && cached.exp > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from('fotos_pratos').createSignedUrl(path, 3600);
  if (error) return null;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 3_500_000 });
  return data.signedUrl;
}

function dataHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function FeedNutri() {
  const { user } = useSession();
  const [posts, setPosts] = useState(undefined);
  const [urls, setUrls] = useState({});
  const [filtro, setFiltro] = useState('todos');
  const [reagindo, setReagindo] = useState({});
  const [comentEdit, setComentEdit] = useState({});
  const [salvando, setSalvando] = useState({});

  async function carregar() {
    if (!user) return;
    const { data } = await supabase
      .from('feed_pratos')
      .select('id, refeicao, legenda, storage_path, comentario_nutri, reacao_nutri, created_at, paciente:pacientes(id, nome, nutri_id)')
      .order('created_at', { ascending: false })
      .limit(150);
    const mine = (data ?? []).filter(p => p.paciente?.nutri_id === user.id);
    setPosts(mine);

    const entries = await Promise.all(
      mine.map(async p => [p.id, await getSignedUrl(p.storage_path)])
    );
    setUrls(Object.fromEntries(entries.filter(([, url]) => url)));
  }

  useEffect(() => { carregar(); }, [user]);

  const listagem = useMemo(() => {
    if (!posts) return [];
    const hoje = new Date().toISOString().slice(0, 10);
    if (filtro === 'sem_feedback') return posts.filter(p => !p.comentario_nutri && !p.reacao_nutri);
    if (filtro === 'hoje') return posts.filter(p => p.created_at?.slice(0, 10) === hoje);
    return posts;
  }, [posts, filtro]);

  async function reagir(post, reacaoId) {
    const nova = post.reacao_nutri === reacaoId ? null : reacaoId;
    setReagindo(r => ({ ...r, [post.id]: true }));
    await supabase.from('feed_pratos').update({ reacao_nutri: nova }).eq('id', post.id);
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, reacao_nutri: nova } : p));
    setReagindo(r => ({ ...r, [post.id]: false }));
  }

  async function salvar(post) {
    const texto = (comentEdit[post.id] ?? '').trim();
    setSalvando(s => ({ ...s, [post.id]: true }));
    await supabase.from('feed_pratos').update({ comentario_nutri: texto || null }).eq('id', post.id);
    setSalvando(s => ({ ...s, [post.id]: false }));
    setComentEdit(e => { const n = { ...e }; delete n[post.id]; return n; });
    setPosts(ps => ps.map(p => p.id === post.id ? { ...p, comentario_nutri: texto || null } : p));
  }

  const total = posts?.length ?? 0;
  const semFb = posts?.filter(p => !p.comentario_nutri && !p.reacao_nutri).length ?? 0;
  const hj = posts?.filter(p => p.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length ?? 0;

  return (
    <>
      <div className="page-title">Feed de pratos</div>
      <div className="page-sub">Fotos das pacientes — reaja e deixe seu feedback</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'todos',        label: `Todos (${total})` },
          { id: 'sem_feedback', label: `Sem feedback (${semFb})` },
          { id: 'hoje',         label: `Hoje (${hj})` },
        ].map(f => (
          <button key={f.id}
            className={filtro === f.id ? 'btn' : 'btn-outline'}
            onClick={() => setFiltro(f.id)}
            style={{ fontSize: 12, padding: '6px 14px' }}>
            {f.label}
          </button>
        ))}
      </div>

      {posts === undefined ? (
        <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>
      ) : listagem.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-camera empty-icon" aria-hidden="true"></i>
          <div className="empty-title">
            {filtro === 'sem_feedback' ? 'Todas com feedback'
              : filtro === 'hoje' ? 'Nenhum registro hoje'
              : 'Nenhuma foto ainda'}
          </div>
          <div className="empty-sub">As fotos de pratos das pacientes aparecerão aqui.</div>
        </div>
      ) : (
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {listagem.map(p => (
            <FeedCard
              key={p.id}
              post={p}
              url={urls[p.id]}
              reagindo={!!reagindo[p.id]}
              comentEdit={comentEdit[p.id]}
              salvando={!!salvando[p.id]}
              onReagir={id => reagir(p, id)}
              onEditarComent={txt => setComentEdit(e => ({ ...e, [p.id]: txt }))}
              onSalvar={() => salvar(p)}
              onCancelar={() => setComentEdit(e => { const n = { ...e }; delete n[p.id]; return n; })}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FeedCard({ post, url, reagindo, comentEdit, salvando, onReagir, onEditarComent, onSalvar, onCancelar }) {
  const emEdicao = comentEdit !== undefined;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'var(--bg2)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, color: 'var(--dark)',
        }}>{iniciais(post.paciente?.nome)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: 'var(--dark)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {post.paciente?.nome ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {post.refeicao ?? 'Refeição'} · {dataHora(post.created_at)}
          </div>
        </div>
        {!post.comentario_nutri && !post.reacao_nutri && (
          <span style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 20,
            background: '#fef5eb', color: '#c97c2e',
            fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', flexShrink: 0,
          }}>Sem feedback</span>
        )}
      </div>

      {/* Foto */}
      <div style={{ width: '100%', aspectRatio: '4 / 3', background: 'var(--bg2)', overflow: 'hidden' }}>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
            <img src={url} alt={post.refeicao ?? 'prato'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </a>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-photo" style={{ fontSize: 40, color: 'var(--border)' }} aria-hidden="true"></i>
          </div>
        )}
      </div>

      {/* Legenda */}
      {post.legenda && (
        <div style={{ padding: '10px 16px 0', fontSize: 13, color: 'var(--dark)', lineHeight: 1.55 }}>
          {post.legenda}
        </div>
      )}

      {/* Reações + Comentário */}
      <div style={{ padding: '12px 16px 16px' }}>

        {/* Botões de reação */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {REACOES.map(r => {
            const ativa = post.reacao_nutri === r.id;
            return (
              <button
                key={r.id}
                onClick={() => onReagir(r.id)}
                disabled={reagindo}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 8,
                  border: `0.5px solid ${ativa ? r.cor : 'var(--border)'}`,
                  background: ativa ? r.bg : 'transparent',
                  color: ativa ? r.cor : 'var(--text2)',
                  fontSize: 13, fontWeight: ativa ? 600 : 400,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  cursor: reagindo ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all .15s',
                }}>
                <i className={`ti ${ativa ? r.iconAtivo : r.icon}`} style={{ fontSize: 16 }} aria-hidden="true"></i>
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Área de comentário */}
        {!emEdicao ? (
          post.comentario_nutri ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{
                flex: 1,
                background: 'var(--bg)',
                borderLeft: '2px solid var(--amber)',
                borderRadius: '0 6px 6px 0',
                padding: '8px 10px',
                fontSize: 13, lineHeight: 1.5, color: 'var(--text2)',
              }}>
                <div style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 700, marginBottom: 3, letterSpacing: '.6px', textTransform: 'uppercase' }}>
                  Seu comentário
                </div>
                {post.comentario_nutri}
              </div>
              <button
                onClick={() => onEditarComent(post.comentario_nutri)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, padding: '6px 4px' }}
                title="Editar">
                <i className="ti ti-pencil" aria-hidden="true"></i>
              </button>
            </div>
          ) : (
            <button
              onClick={() => onEditarComent('')}
              className="btn-outline"
              style={{ width: '100%', justifyContent: 'center', fontSize: 13, padding: '8px 12px' }}>
              <i className="ti ti-message-circle" style={{ fontSize: 15 }} aria-hidden="true"></i>
              Adicionar comentário
            </button>
          )
        ) : (
          <>
            <textarea
              rows={3}
              autoFocus
              value={comentEdit ?? ''}
              onChange={e => onEditarComent(e.target.value)}
              placeholder="Ex: Boa escolha de proteína! Que tal adicionar um vegetal verde?"
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                border: '0.5px solid var(--border)', borderRadius: 6,
                outline: 'none', fontFamily: 'var(--font-sans)',
                resize: 'vertical', boxSizing: 'border-box',
                background: 'var(--white)', color: 'var(--dark)',
              }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn-outline" onClick={onCancelar}
                style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}>
                Cancelar
              </button>
              <button className="btn" onClick={onSalvar} disabled={salvando}
                style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}>
                <i className="ti ti-check" aria-hidden="true"></i>
                {salvando ? '…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
