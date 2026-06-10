import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

/* ── Constantes ──────────────────────────────────────────────── */
const TIPOGRAFIAS = [
  { id: 'classica',  nome: 'Clássica',  desc: 'Cormorant + Inter — elegante e atemporal' },
  { id: 'modern',    nome: 'Modern',    desc: 'Manrope — geométrica e contemporânea' },
  { id: 'minimal',   nome: 'Minimal',   desc: 'Inter — limpa e funcional' },
  { id: 'romantica', nome: 'Romântica', desc: 'Playfair + Lato — feminina e suave' },
];

const NUTRI_DEFAULTS = {
  cor_fundo_nutri:  '',
  cor_sidebar:      '#a08456',
  cor_texto_sidebar:'',
  cor_card_nutri:   '',
  cor_primaria:     '#a08456',
  cor_abas:         '#a08456',
  cor_texto:        '#000000',
  cor_secundaria:   '#c9a96e',
  // granular sidebar / topbar
  cor_nav_item:     '',
  cor_nav_grupo:    '',
  cor_sidebar_nome: '',
  cor_topbar:       '',
  cor_topbar_texto: '',
  // abas e botões
  cor_aba:          '',
  cor_btn_sec:      '',
  cor_btn_txt:      '',
};

const PAC_DEFAULTS = {
  pac_bg:   '#f0ebe3',
  pac_card: '#ffffff',
  pac_btn:  '#1c1712',
  pac_text: '#000000',
};

const PALETAS_NUTRI = [
  { nome: 'Dourado Lapidare', cor_fundo_nutri: '',        cor_sidebar: '#a08456', cor_texto_sidebar: '', cor_card_nutri: '',        cor_primaria: '#c9a96e', cor_abas: '#a08456', cor_texto: '#000000' },
  { nome: 'Rose Gold',        cor_fundo_nutri: '#fff5f5', cor_sidebar: '#b76e79', cor_texto_sidebar: '', cor_card_nutri: '#fff8f8', cor_primaria: '#d4a5a5', cor_abas: '#b76e79', cor_texto: '#2a1a1f' },
  { nome: 'Verde Sálvia',     cor_fundo_nutri: '#f3f7f4', cor_sidebar: '#5e7a6b', cor_texto_sidebar: '', cor_card_nutri: '#f8fbf9', cor_primaria: '#9bb19f', cor_abas: '#5e7a6b', cor_texto: '#1a2e18' },
  { nome: 'Terracota',        cor_fundo_nutri: '#faf5f2', cor_sidebar: '#a0613f', cor_texto_sidebar: '', cor_card_nutri: '#fdf9f7', cor_primaria: '#d4926a', cor_abas: '#a0613f', cor_texto: '#2a1a0f' },
  { nome: 'Lavanda',          cor_fundo_nutri: '#f5f3fa', cor_sidebar: '#8e7aa3', cor_texto_sidebar: '', cor_card_nutri: '#faf8fd', cor_primaria: '#bca8c9', cor_abas: '#8e7aa3', cor_texto: '#1e1630' },
  { nome: 'Azul Sereno',      cor_fundo_nutri: '#f2f6fa', cor_sidebar: '#5a7a99', cor_texto_sidebar: '', cor_card_nutri: '#f8fbfd', cor_primaria: '#9fb5cc', cor_abas: '#5a7a99', cor_texto: '#0d2040' },
  { nome: 'Dark',             cor_fundo_nutri: '#1a1a1a', cor_sidebar: '#2a2a2a', cor_texto_sidebar: '#f0ebe3', cor_card_nutri: '#242424', cor_primaria: '#c9a96e', cor_abas: '#c9a96e', cor_texto: '#f0ebe3' },
];

const PAC_PRESETS = [
  { label: 'Lapidare',    pac_bg: '#f0ebe3', pac_card: '#ffffff', pac_btn: '#1c1712', pac_text: '#000000' },
  { label: 'Rosa nude',   pac_bg: '#f9f0ee', pac_card: '#ffffff', pac_btn: '#8b3a52', pac_text: '#2a1a1f' },
  { label: 'Verde sage',  pac_bg: '#eef2ec', pac_card: '#ffffff', pac_btn: '#2d5a27', pac_text: '#1a2e18' },
  { label: 'Lavanda',     pac_bg: '#f0edf8', pac_card: '#ffffff', pac_btn: '#5b3d9e', pac_text: '#1e1630' },
  { label: 'Dark mode',   pac_bg: '#1a1a1a', pac_card: '#2a2a2a', pac_btn: '#c9a96e', pac_text: '#f0ebe3' },
  { label: 'Azul polar',  pac_bg: '#eef4fb', pac_card: '#ffffff', pac_btn: '#1a4a80', pac_text: '#0d2040' },
];

/* ── Componente de linha de cor ──────────────────────────────── */
function ColorRow({ label, hint, value, onChange, defaultVal, allowEmpty }) {
  const pickerRef = useRef(null);
  const isEmpty = allowEmpty && !value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
      <div
        style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0, position: 'relative',
          border: '1.5px solid var(--border)', cursor: 'pointer', overflow: 'hidden',
          background: isEmpty
            ? 'repeating-linear-gradient(45deg,#ddd,#ddd 4px,#f5f5f5 4px,#f5f5f5 8px)'
            : (value || '#808080'),
        }}
        onClick={() => pickerRef.current?.click()}
      >
        <input
          ref={pickerRef}
          type="color"
          value={value || '#808080'}
          onChange={e => onChange(e.target.value)}
          style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', padding: 0, border: 'none' }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4, marginTop: 1 }}>{hint}</div>}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => {
          const v = e.target.value;
          if (allowEmpty && v === '') { onChange(''); return; }
          if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
        }}
        placeholder={allowEmpty ? 'automático' : defaultVal}
        style={{ width: 86, fontFamily: 'monospace', fontSize: 12, textAlign: 'center' }}
      />
      {value !== defaultVal && (
        <button
          onClick={() => onChange(defaultVal)}
          title="Restaurar padrão"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, padding: '0 2px', flexShrink: 0 }}
        >↻</button>
      )}
    </div>
  );
}

/* ── Componente principal ────────────────────────────────────── */
export default function Personalizacao() {
  const { user, profile, refreshProfile } = useSession();
  const [form, setForm] = useState({
    // Marca
    marca_nome: 'Lapidare',
    marca_subtitulo: '',
    logo_url: null,
    // Perfil da nutri
    nome: '',
    foto_url: null,
    // Tipografia
    tipografia: 'classica',
    // Cores da nutri (área da nutricionista)
    ...NUTRI_DEFAULTS,
    // Cores da paciente
    ...PAC_DEFAULTS,
  });
  const [busy, setBusy]           = useState(false);
  const [erro, setErro]           = useState(null);
  const [feedback, setFeedback]   = useState(null);
  const [uploading, setUploading] = useState(false);

  /* Carrega dados da nutri */
  useEffect(() => {
    if (!profile) return;
    setForm(f => ({
      ...f,
      marca_nome:        profile.marca_nome       ?? 'Lapidare',
      marca_subtitulo:   profile.marca_subtitulo  ?? '',
      logo_url:          profile.logo_url         ?? null,
      nome:              profile.nome             ?? '',
      foto_url:          profile.foto_url         ?? null,
      tipografia:        profile.tipografia       ?? 'classica',
      cor_fundo_nutri:   profile.cor_fundo_nutri   ?? '',
      cor_sidebar:       profile.cor_sidebar       ?? profile.cor_primaria ?? NUTRI_DEFAULTS.cor_sidebar,
      cor_texto_sidebar: profile.cor_texto_sidebar ?? '',
      cor_card_nutri:    profile.cor_card_nutri    ?? '',
      cor_primaria:      profile.cor_primaria      ?? NUTRI_DEFAULTS.cor_primaria,
      cor_abas:          profile.cor_abas          ?? profile.cor_primaria ?? NUTRI_DEFAULTS.cor_abas,
      cor_texto:         profile.cor_texto         ?? '#000000',
      cor_secundaria:    profile.cor_secundaria    ?? NUTRI_DEFAULTS.cor_secundaria,
      cor_nav_item:      profile.cor_nav_item      ?? '',
      cor_nav_grupo:     profile.cor_nav_grupo     ?? '',
      cor_sidebar_nome:  profile.cor_sidebar_nome  ?? '',
      cor_topbar:        profile.cor_topbar        ?? '',
      cor_topbar_texto:  profile.cor_topbar_texto  ?? '',
      cor_aba:           profile.cor_aba           ?? '',
      cor_btn_sec:       profile.cor_btn_sec       ?? '',
      cor_btn_txt:       profile.cor_btn_txt       ?? '',
    }));
  }, [profile]);

  /* Carrega cores da paciente */
  useEffect(() => {
    if (!user?.id) return;
    supabase.from('configuracoes').select('tema').eq('nutri_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.tema) {
          setForm(f => ({
            ...f,
            pac_bg:   data.tema.pac_bg   ?? PAC_DEFAULTS.pac_bg,
            pac_card: data.tema.pac_card ?? PAC_DEFAULTS.pac_card,
            pac_btn:  data.tema.pac_btn  ?? PAC_DEFAULTS.pac_btn,
            pac_text: data.tema.pac_text ?? PAC_DEFAULTS.pac_text,
          }));
        }
      });
  }, [user?.id]);

  /* Preview ao vivo */
  useEffect(() => {
    if (!profile) return;
    const r = document.documentElement;
    const sidebar = form.cor_sidebar || form.cor_primaria;
    r.style.setProperty('--dark',       sidebar);
    r.style.setProperty('--sidebar-bg', sidebar);
    const sidebarTxt = form.cor_texto_sidebar
      ? form.cor_texto_sidebar
      : (luminanciaSimples(sidebar) > 0.45 ? '#1a1612' : '#faf8f5');
    r.style.setProperty('--sidebar-text', sidebarTxt);
    r.style.setProperty('--gold-deep', form.cor_primaria);
    r.style.setProperty('--amber',     form.cor_secundaria);
    r.style.setProperty('--gold',      form.cor_secundaria);
    r.style.setProperty('--ink',       form.cor_texto || '#000000');
    // fundo nutri — sempre sólido (sem gradiente)
    r.style.setProperty('--fundo-nutri', form.cor_fundo_nutri || '#faf8f5');
    if (form.cor_texto_sidebar) r.style.setProperty('--dark-text', form.cor_texto_sidebar);
    else r.style.removeProperty('--dark-text');
    if (form.cor_card_nutri) r.style.setProperty('--nutri-card', form.cor_card_nutri);
    else r.style.removeProperty('--nutri-card');
    if (form.cor_nav_item) r.style.setProperty('--nav-item-text', form.cor_nav_item);
    else r.style.removeProperty('--nav-item-text');
    if (form.cor_nav_grupo) r.style.setProperty('--nav-grupo-text', form.cor_nav_grupo);
    else r.style.removeProperty('--nav-grupo-text');
    if (form.cor_sidebar_nome) r.style.setProperty('--sidebar-nome-text', form.cor_sidebar_nome);
    else r.style.removeProperty('--sidebar-nome-text');
    if (form.cor_topbar) r.style.setProperty('--topbar-bg', form.cor_topbar);
    else r.style.removeProperty('--topbar-bg');
    if (form.cor_topbar_texto) r.style.setProperty('--topbar-text', form.cor_topbar_texto);
    else r.style.removeProperty('--topbar-text');
    // abas
    if (form.cor_aba) {
      r.style.setProperty('--tab-bg', form.cor_aba);
      r.style.setProperty('--tab-txt', luminanciaSimples(form.cor_aba) > 0.45 ? '#3a3028' : '#faf8f5');
    } else {
      r.style.removeProperty('--tab-bg');
      r.style.removeProperty('--tab-txt');
    }
    if (form.cor_abas) {
      r.style.setProperty('--tab-ativa-bg', form.cor_abas);
      r.style.setProperty('--tab-ativa-txt', luminanciaSimples(form.cor_abas) > 0.45 ? '#1a1612' : '#ffffff');
    } else {
      r.style.removeProperty('--tab-ativa-bg');
      r.style.removeProperty('--tab-ativa-txt');
    }
    // botões secundários
    if (form.cor_btn_sec) r.style.setProperty('--btn-sec-bg', form.cor_btn_sec);
    else r.style.removeProperty('--btn-sec-bg');
    if (form.cor_btn_txt) r.style.setProperty('--btn-sec-txt', form.cor_btn_txt);
    else r.style.removeProperty('--btn-sec-txt');
    r.dataset.tipografia = form.tipografia;
  }, [profile, form.cor_sidebar, form.cor_primaria, form.cor_secundaria, form.cor_fundo_nutri, form.cor_card_nutri, form.cor_texto, form.cor_texto_sidebar, form.cor_abas, form.tipografia, form.cor_nav_item, form.cor_nav_grupo, form.cor_sidebar_nome, form.cor_topbar, form.cor_topbar_texto, form.cor_aba, form.cor_btn_sec, form.cor_btn_txt]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* Salva tudo */
  async function salvar() {
    setErro(null); setFeedback(null);
    if (!form.marca_nome.trim()) return setErro('Informe o nome da marca.');
    setBusy(true);
    const agora = new Date().toISOString();

    // Salva dados da nutri
    const { error: errNutri } = await supabase.from('nutris').update({
      marca_nome:        form.marca_nome.trim(),
      marca_subtitulo:   form.marca_subtitulo.trim() || null,
      logo_url:          form.logo_url,
      nome:              form.nome?.trim() || profile?.nome || 'Sua nutri',
      foto_url:          form.foto_url,
      tipografia:        form.tipografia,
      cor_primaria:      form.cor_primaria,
      cor_secundaria:    form.cor_secundaria,
      cor_sidebar:       form.cor_sidebar || null,
      cor_fundo_nutri:   form.cor_fundo_nutri || null,
      cor_abas:          form.cor_abas || null,
      cor_card_nutri:    form.cor_card_nutri    || null,
      cor_texto:         form.cor_texto         || '#000000',
      cor_texto_sidebar: form.cor_texto_sidebar?.trim() || null,
      cor_nav_item:      form.cor_nav_item      || null,
      cor_nav_grupo:     form.cor_nav_grupo     || null,
      cor_sidebar_nome:  form.cor_sidebar_nome  || null,
      cor_topbar:        form.cor_topbar        || null,
      cor_topbar_texto:  form.cor_topbar_texto  || null,
      cor_aba:           form.cor_aba           || null,
      cor_btn_sec:       form.cor_btn_sec       || null,
      cor_btn_txt:       form.cor_btn_txt       || null,
    }).eq('id', user.id);

    if (errNutri) { setBusy(false); return setErro('Erro: ' + errNutri.message); }

    // Salva cores da paciente — select-then-update-or-insert (sem depender de constraint UNIQUE)
    const temaPac = { pac_bg: form.pac_bg, pac_card: form.pac_card, pac_btn: form.pac_btn, pac_text: form.pac_text };
    const { data: cfgExistente } = await supabase
      .from('configuracoes').select('id').eq('nutri_id', user.id).maybeSingle();
    const { error: errPac } = cfgExistente
      ? await supabase.from('configuracoes').update({ tema: temaPac, updated_at: agora }).eq('nutri_id', user.id)
      : await supabase.from('configuracoes').insert({ nutri_id: user.id, tema: temaPac, updated_at: agora });

    setBusy(false);
    if (errPac && errPac.code !== '42P01') return setErro('Erro nas cores da paciente: ' + errPac.message);
    await refreshProfile();
    setFeedback(true);
  }

  /* Upload logo */
  async function uploadLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('Imagem muito grande (máx 2 MB).');
    setUploading(true);
    if (form.logo_url) {
      try {
        const u = new URL(form.logo_url);
        const old = u.pathname.split('/logos/')[1];
        if (old) await supabase.storage.from('logos').remove([old]);
      } catch {}
    }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { setUploading(false); return alert('Erro no upload: ' + error.message); }
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    set('logo_url', data.publicUrl);
    setUploading(false);
  }

  /* Upload foto */
  async function uploadFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('Imagem muito grande (máx 2 MB).');
    setUploading(true);
    if (form.foto_url) {
      try {
        const u = new URL(form.foto_url);
        const old = u.pathname.split('/logos/')[1];
        if (old) await supabase.storage.from('logos').remove([old]);
      } catch {}
    }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${user.id}/foto_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { setUploading(false); return alert('Erro no upload: ' + error.message); }
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    set('foto_url', data.publicUrl);
    setUploading(false);
  }

  /* JSX */
  return (
    <>
      <div className="page-title">Personalização</div>
      <div className="page-sub">Deixe o app com a cara da sua marca — sem mexer em código</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20 }}>
        <div>

          {/* ── Marca ── */}
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Marca</div>

            <label className="form-lbl">Nome da marca</label>
            <input value={form.marca_nome} onChange={e => set('marca_nome', e.target.value)} placeholder="Ex: Lapidare, Nutri Ana…" />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>Aparece no topo da sidebar e na tela de Login das pacientes.</div>

            <label className="form-lbl" style={{ marginTop: 14 }}>Subtítulo</label>
            <input value={form.marca_subtitulo} onChange={e => set('marca_subtitulo', e.target.value)} placeholder='Ex: "Nutrição estratégica", "by Sara Dias"' />

            <label className="form-lbl" style={{ marginTop: 14 }}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '0.5px dashed var(--border)', borderRadius: 10, background: 'var(--bg2)' }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" style={{ width: 56, height: 56, objectFit: 'contain', background: 'var(--white)', borderRadius: 8, padding: 4 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 11 }}>Sem logo</div>
              )}
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={uploadLogo} disabled={uploading} style={{ fontSize: 12 }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>PNG ou SVG · máx 2 MB · ideal 300×300px</div>
              </div>
              {form.logo_url && (
                <button onClick={() => { if (window.confirm('Remover logo?')) set('logo_url', null); }}
                  style={{ background: 'none', border: '0.5px solid var(--red)', borderRadius: 6, padding: '4px 8px', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>
                  <i className="ti ti-trash" aria-hidden="true"></i> Remover
                </button>
              )}
            </div>
          </div>

          {/* ── Perfil da nutri ── */}
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 4 }}>Meu perfil</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Como você aparece <strong>pras suas pacientes</strong> no chat e nos banners.</div>

            <label className="form-lbl">Seu nome</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder='Ex: "Dra. Kelly Oliveira", "Nutri Ana"' />

            <label className="form-lbl" style={{ marginTop: 14 }}>Foto de perfil</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '0.5px dashed var(--border)', borderRadius: 10, background: 'var(--bg2)' }}>
              {form.foto_url ? (
                <img src={form.foto_url} alt="Foto" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 11 }}>Sem foto</div>
              )}
              <div style={{ flex: 1 }}>
                <input type="file" accept="image/*" onChange={uploadFoto} disabled={uploading} style={{ fontSize: 12 }} />
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>JPG ou PNG · máx 2 MB · ideal quadrada</div>
              </div>
              {form.foto_url && (
                <button onClick={() => { if (window.confirm('Remover foto?')) set('foto_url', null); }}
                  style={{ background: 'none', border: '0.5px solid var(--red)', borderRadius: 6, padding: '4px 8px', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>
                  <i className="ti ti-trash" aria-hidden="true"></i> Remover
                </button>
              )}
            </div>
          </div>

          {/* ── Tipografia ── */}
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Tipografia</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {TIPOGRAFIAS.map(t => {
                const ativo = form.tipografia === t.id;
                return (
                  <button key={t.id} onClick={() => set('tipografia', t.id)}
                    style={{
                      background: ativo ? 'var(--amber-bg, var(--bg2))' : 'var(--white)',
                      border: `${ativo ? 2 : 1}px solid ${ativo ? 'var(--gold-deep)' : 'var(--border)'}`,
                      borderRadius: 10, padding: 14, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', textAlign: 'left',
                    }}>
                    <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4, fontFamily: previewFontPara(t.id) }}>{t.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Cores da nutricionista ── */}
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div className="card-title">Cores — painel da nutricionista</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Aparece somente no seu painel</div>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, ...NUTRI_DEFAULTS }))}
                style={{ background: 'none', border: '0.5px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}>
                ↻ Restaurar padrão
              </button>
            </div>

            {/* Paletas prontas */}
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 8 }}>Paletas prontas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
              {PALETAS_NUTRI.map(p => (
                <button key={p.nome} onClick={() => setForm(f => ({ ...f, ...p }))}
                  style={{ background: p.cor_fundo_nutri || 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8, padding: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: p.cor_sidebar, display: 'block', flexShrink: 0 }} />
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: p.cor_primaria, display: 'block', flexShrink: 0 }} />
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: p.cor_card_nutri || '#ffffff', border: '0.5px solid #ddd', display: 'block', flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: p.cor_texto || '#000' }}>{p.nome}</div>
                </button>
              ))}
            </div>

            {/* Linhas de cor — geral */}
            {[
              { key: 'cor_fundo_nutri',   label: 'Fundo do app',          hint: 'Cor sólida de fundo das telas e páginas internas',           defaultVal: '', allowEmpty: true },
              { key: 'cor_sidebar',       label: 'Fundo do menu lateral', hint: 'Cor de fundo do menu lateral e dos botões principais',       defaultVal: NUTRI_DEFAULTS.cor_sidebar },
              { key: 'cor_texto_sidebar', label: 'Texto do menu lateral', hint: 'Cor dos itens do menu lateral — vazio = contraste automático',  defaultVal: '', allowEmpty: true },
              { key: 'cor_card_nutri',    label: 'Cards e painéis',       hint: 'Cor de fundo dos cartões e seções internas',                 defaultVal: '', allowEmpty: true },
              { key: 'cor_primaria',      label: 'Botões principais',     hint: 'Cor dos botões de ação e elementos de destaque',             defaultVal: NUTRI_DEFAULTS.cor_primaria },
              { key: 'cor_texto',         label: 'Letras',                hint: 'Cor do texto principal em títulos, labels e parágrafos',     defaultVal: NUTRI_DEFAULTS.cor_texto },
            ].map(campo => (
              <ColorRow key={campo.key} {...campo} value={form[campo.key]} onChange={v => set(campo.key, v)} />
            ))}

            {/* Mini-separador abas e botões */}
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, padding: '14px 0 4px', borderTop: '0.5px solid var(--border)', marginTop: 6 }}>
              Abas e botões (vazio = automático)
            </div>
            {[
              { key: 'cor_aba',      label: 'Cor das abas',              hint: 'Fundo da barra de abas (Evolução, Plano, Exames…)',           defaultVal: '', allowEmpty: true },
              { key: 'cor_abas',     label: 'Aba ativa',                 hint: 'Cor da aba selecionada no momento',                          defaultVal: NUTRI_DEFAULTS.cor_abas },
              { key: 'cor_btn_sec',  label: 'Botões secundários',        hint: 'Fundo dos botões de ação secundária (ex: "Nova consulta")',   defaultVal: '', allowEmpty: true },
              { key: 'cor_btn_txt',  label: 'Texto dos botões',          hint: 'Cor do texto e borda nos botões secundários',                defaultVal: '', allowEmpty: true },
            ].map(campo => (
              <ColorRow key={campo.key} {...campo} value={form[campo.key]} onChange={v => set(campo.key, v)} />
            ))}

            {/* Mini-separador */}
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, padding: '14px 0 4px', borderTop: '0.5px solid var(--border)', marginTop: 6 }}>
              Sidebar — detalhes (vazio = automático)
            </div>
            {[
              { key: 'cor_nav_item',      label: 'Itens do menu',              hint: '"Visão geral", "Pacientes", "Agenda"… (estado inativo)',   defaultVal: '', allowEmpty: true },
              { key: 'cor_nav_grupo',     label: 'Categorias do menu',         hint: '"ATENDIMENTO", "GESTÃO DO CONSULTÓRIO", "SESSÃO"',         defaultVal: '', allowEmpty: true },
              { key: 'cor_sidebar_nome',  label: 'Nome da nutricionista',      hint: 'Texto com seu nome no rodapé da sidebar',                  defaultVal: '', allowEmpty: true },
            ].map(campo => (
              <ColorRow key={campo.key} {...campo} value={form[campo.key]} onChange={v => set(campo.key, v)} />
            ))}

            {/* Mini-separador topbar */}
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, padding: '14px 0 4px', borderTop: '0.5px solid var(--border)', marginTop: 6 }}>
              Barra superior (topbar) — vazio = usa cor da sidebar
            </div>
            {[
              { key: 'cor_topbar',        label: 'Fundo da barra superior',    hint: 'Cor de fundo da barra com o nome da página e mês',  defaultVal: '', allowEmpty: true },
              { key: 'cor_topbar_texto',  label: 'Texto da barra superior',    hint: 'Seção, nome da página ("Pacientes"), data e mês',    defaultVal: '', allowEmpty: true },
            ].map(campo => (
              <ColorRow key={campo.key} {...campo} value={form[campo.key]} onChange={v => set(campo.key, v)} />
            ))}
          </div>

          {/* ── Cores do app da paciente ── */}
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div className="card-title">Cores — app da paciente</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>O que suas pacientes veem ao abrir o app</div>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, ...PAC_DEFAULTS }))}
                style={{ background: 'none', border: '0.5px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text3)' }}>
                ↻ Restaurar padrão
              </button>
            </div>

            {/* Paletas paciente */}
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 8 }}>Paletas prontas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {PAC_PRESETS.map(p => (
                <button key={p.label} onClick={() => setForm(f => ({ ...f, ...p }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    border: '1.5px solid var(--border)',
                    background: p.pac_bg, fontSize: 12, color: p.pac_text, fontWeight: 500,
                  }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.pac_btn, flexShrink: 0 }} />
                  {p.label}
                </button>
              ))}
            </div>

            {[
              { key: 'pac_bg',   label: 'Fundo do app',        hint: 'Cor de fundo das telas da paciente',        defaultVal: PAC_DEFAULTS.pac_bg   },
              { key: 'pac_card', label: 'Cards e seções',       hint: 'Cor de fundo dos cartões e painéis',        defaultVal: PAC_DEFAULTS.pac_card },
              { key: 'pac_btn',  label: 'Destaque / botões',    hint: 'Cor dos botões principais e títulos',       defaultVal: PAC_DEFAULTS.pac_btn  },
              { key: 'pac_text', label: 'Texto principal',      hint: 'Cor do texto no app da paciente',           defaultVal: PAC_DEFAULTS.pac_text },
            ].map(campo => (
              <ColorRow key={campo.key} {...campo} value={form[campo.key]} onChange={v => set(campo.key, v)} />
            ))}
          </div>

        </div>

        {/* ── Preview lateral ── */}
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>Preview ao vivo</div>
          <div style={{ position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Preview nutri */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Painel da nutricionista</div>
              <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
                {/* Mini topbar */}
                <div style={{ height: 26, background: form.cor_topbar || form.cor_sidebar || form.cor_primaria, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 5, flexShrink: 0 }}>
                  <span style={{ fontSize: 7, letterSpacing: 1, textTransform: 'uppercase', color: form.cor_topbar_texto || (luminanciaSimples(form.cor_topbar || form.cor_sidebar || form.cor_primaria) > 0.45 ? '#1a1612' : '#faf8f5'), opacity: .7 }}>Pacientes</span>
                  <span style={{ fontSize: 8, color: form.cor_topbar_texto || (luminanciaSimples(form.cor_topbar || form.cor_sidebar || form.cor_primaria) > 0.45 ? '#1a1612' : '#faf8f5'), fontWeight: 600 }}>· Ana Silva</span>
                  <span style={{ marginLeft: 'auto', fontSize: 7, color: form.cor_topbar_texto || (luminanciaSimples(form.cor_topbar || form.cor_sidebar || form.cor_primaria) > 0.45 ? '#1a1612' : '#faf8f5'), opacity: .65 }}>Jun 2026</span>
                </div>
                {/* Corpo: sidebar + main */}
                <div style={{ display: 'flex' }}>
                  {/* Mini sidebar */}
                  <div style={{ width: 76, background: form.cor_sidebar || form.cor_primaria, padding: '8px 6px', flexShrink: 0 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 5, background: 'rgba(255,255,255,.15)', marginBottom: 8 }} />
                    <div style={{ fontSize: 7, color: form.cor_nav_grupo || form.cor_texto_sidebar || (luminanciaSimples(form.cor_sidebar || form.cor_primaria) > 0.45 ? '#1a1612' : '#faf8f5'), opacity: .55, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 4px', fontWeight: 600, marginBottom: 2 }}>Atendimento</div>
                    {['Visão geral', 'Pacientes', 'Agenda'].map((item, i) => (
                      <div key={item} style={{
                        fontSize: 8, padding: '4px 5px', borderRadius: 3, marginBottom: 2,
                        background: i === 0 ? 'rgba(0,0,0,.18)' : 'transparent',
                        color: form.cor_nav_item || form.cor_texto_sidebar || (luminanciaSimples(form.cor_sidebar || form.cor_primaria) > 0.45 ? '#1a1612' : '#faf8f5'),
                        fontWeight: i === 0 ? 600 : 400,
                      }}>{item}</div>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '0.5px solid rgba(255,255,255,.12)' }}>
                      <div style={{ fontSize: 7, color: form.cor_nav_grupo || form.cor_texto_sidebar || (luminanciaSimples(form.cor_sidebar || form.cor_primaria) > 0.45 ? '#1a1612' : '#faf8f5'), opacity: .55, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Sessão</div>
                      <div style={{ fontSize: 8, color: form.cor_sidebar_nome || form.cor_texto_sidebar || (luminanciaSimples(form.cor_sidebar || form.cor_primaria) > 0.45 ? '#1a1612' : '#faf8f5') }}>Nutri Júlia</div>
                    </div>
                  </div>
                  {/* Área principal */}
                  <div style={{ flex: 1, background: form.cor_fundo_nutri || '#f5f1eb', padding: 8 }}>
                    <div style={{ background: form.cor_card_nutri || '#fff', borderRadius: 5, padding: '6px 8px', marginBottom: 6, boxShadow: '0 1px 3px rgba(0,0,0,.06)', border: '0.5px solid rgba(0,0,0,.06)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: form.cor_texto || '#000', marginBottom: 3 }}>Ana Silva</div>
                      <div style={{ fontSize: 8, color: '#888' }}>Última consulta: 15/05</div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,.06)', borderRadius: 5, padding: 2, marginBottom: 6 }}>
                      {['Plano', 'Evolução', 'Exames'].map((tab, i) => (
                        <div key={tab} style={{
                          flex: 1, fontSize: 7, textAlign: 'center', padding: '3px 2px', borderRadius: 3,
                          background: i === 0 ? (form.cor_card_nutri || '#fff') : 'transparent',
                          color: i === 0 ? (form.cor_abas || form.cor_primaria) : '#aaa',
                          fontWeight: i === 0 ? 600 : 400,
                        }}>{tab}</div>
                      ))}
                    </div>
                    <button style={{ background: form.cor_primaria, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 8, width: '100%', cursor: 'default' }}>
                      Liberar para paciente
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview paciente */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>App da paciente</div>
              <div style={{ background: form.pac_bg, borderRadius: 14, padding: 14, boxShadow: '0 4px 16px rgba(0,0,0,.12)', border: '1px solid rgba(0,0,0,.06)' }}>
                <div style={{ background: form.pac_btn, borderRadius: 10, padding: '9px 12px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Meu Plano</div>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,.25)' }} />
                </div>
                <div style={{ background: form.pac_card, borderRadius: 9, padding: 10, marginBottom: 9, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
                  <div style={{ fontSize: 9, color: form.pac_text, opacity: .5, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Macros do dia</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {[['120g', 'Proteína'], ['150g', 'Carbo'], ['50g', 'Gordura']].map(([v, l]) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: form.pac_btn }}>{v}</div>
                        <div style={{ fontSize: 8, color: form.pac_text, opacity: .6 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: form.pac_card, borderRadius: 9, padding: 10, boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: form.pac_text, marginBottom: 6 }}>🌅 Café da manhã</div>
                  {['Pão integral — 2 fatias', 'Ovo mexido — 1½ un.', 'Mamão — 130g'].map((item, i) => (
                    <div key={i} style={{ fontSize: 10, color: form.pac_text, padding: '3px 0', borderBottom: i < 2 ? `0.5px solid ${form.pac_bg}` : 'none' }}>{item}</div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Banner de sucesso */}
      {feedback && (
        <div style={{
          marginTop: 18, padding: '20px 24px',
          background: 'linear-gradient(135deg, #fff3b8, #ffe88a)',
          border: '2px solid #c9a233', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 6px 20px rgba(201,162,51,.18)',
        }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#c9a233', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="ti ti-refresh" style={{ fontSize: 26 }} aria-hidden="true"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#5a4500', marginBottom: 4 }}>✅ Personalização salva!</div>
            <div style={{ fontSize: 14, color: '#5a4500', lineHeight: 1.5 }}>
              Cores aplicadas agora. As pacientes verão ao recarregar o app delas.
            </div>
          </div>
          <button onClick={() => window.location.reload()}
            style={{ background: '#5a4500', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-sans)' }}>
            <i className="ti ti-refresh" style={{ marginRight: 6 }} aria-hidden="true"></i> Recarregar agora
          </button>
        </div>
      )}

      {/* Barra de salvar */}
      <div style={{
        marginTop: 18, padding: 14, background: 'var(--white)', borderRadius: 12,
        border: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        position: 'sticky', bottom: 16,
      }}>
        <div style={{ flex: 1 }}>
          {erro && <div style={{ color: 'var(--red)', fontSize: 13 }}>{erro}</div>}
        </div>
        <button className="btn" onClick={salvar} disabled={busy}>
          <i className="ti ti-device-floppy" aria-hidden="true"></i> {busy ? 'Salvando…' : 'Salvar personalização'}
        </button>
      </div>
    </>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */
function previewFontPara(id) {
  switch (id) {
    case 'modern':    return '"Manrope", sans-serif';
    case 'minimal':   return '"Inter", sans-serif';
    case 'romantica': return '"Playfair Display", serif';
    default:          return '"Cormorant Garamond", serif';
  }
}

function luminanciaSimples(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  if (!m) return 0.5;
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
