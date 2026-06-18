import { useState, useMemo, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import BrandFooter from './BrandFooter.jsx';
import { useSession, signOut } from '../lib/session.jsx';
import { useTheme, mistura } from '../lib/theme.jsx';
import { supabase } from '../lib/supabase.js';
import { iniciais } from '../lib/utils.js';
import '../styles/paciente.css';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

const TABS = [
  { id: 'inicio',    path: '/paciente/inicio',    label: 'Início',    icon: 'home' },
  { id: 'plano',     path: '/paciente/plano',     label: 'Plano',     icon: 'salad' },
  { id: 'feed',      path: '/paciente/feed',      label: 'Pratos',    icon: 'camera' },
  { id: 'evolucao',  path: '/paciente/evolucao',  label: 'Evolução',  icon: 'camera-selfie' },
  { id: 'habitos-mes', path: '/paciente/habitos-mes', label: 'Hábitos', icon: 'calendar-stats' },
  { id: 'progresso', path: '/paciente/progresso', label: 'Progresso', icon: 'trending-up' },
  { id: 'mais',                                    label: 'Mais',      icon: 'menu-2' },
];

const MAIS_ITEMS = [
  { path: '/paciente/checkin',     icon: 'clipboard-text', label: 'Check-in semanal',    sub: 'Como foi sua semana?' },
  { path: '/paciente/compras',     icon: 'shopping-cart', label: 'Lista de compras',     sub: 'Lista da semana' },
  { path: '/paciente/suplementos', icon: 'pill',          label: 'Suplementos',          sub: 'Lista do dia' },
  { path: '/paciente/habitos',     icon: 'checklist',     label: 'Hábitos',              sub: 'Tracker diário' },
  { path: '/paciente/prescricoes', icon: 'file-text',     label: 'Prescrições',          sub: 'Documentos da Dra.' },
  { path: '/paciente/ebooks',      icon: 'book-2',        label: 'E-books',              sub: 'Materiais da Dra.' },
  { path: '/paciente/receitas',   icon: 'chef-hat',      label: 'Receitas',             sub: 'Arquivos da sua nutri' },
  { path: '/paciente/exames',    icon: 'test-pipe',     label: 'Exames',               sub: 'Envie seus resultados de exames' },
  { path: '/paciente/recibos',     icon: 'receipt',       label: 'Recibos',              sub: 'Comprovantes de pagamento' },
  { path: '/paciente/chat',        icon: 'message-circle', label: 'Chat com a Dra.',     sub: 'Conversa direta' },
];

const HEADERS = {
  '/paciente/inicio':       (nome) =>           ({ eyebrow: 'Meu plano',         title: `Bom dia, ${nome}` }),
  '/paciente/plano':        () =>                ({ eyebrow: 'Plano alimentar',  title: 'Meu plano',         subtitle: '' }),
  '/paciente/feed':         () =>                ({ eyebrow: 'Diário alimentar', title: 'Pratos',            subtitle: 'Registre o que você comeu' }),
  '/paciente/evolucao':     () =>                ({ eyebrow: 'Progresso visual', title: 'Evolução',   subtitle: 'Fotos de antes e depois' }),
  '/paciente/progresso':    () =>                ({ eyebrow: 'Minha evolução',   title: 'Progresso' }),
  '/paciente/compras':      () =>                ({ eyebrow: 'Lista',            title: 'Compras',           subtitle: 'Para a semana' }),
  '/paciente/prescricoes':  () =>                ({ eyebrow: 'Documentos',       title: 'Prescrições' }),
  '/paciente/ebooks':       () =>                ({ eyebrow: 'Materiais',        title: 'E-books',           subtitle: 'Compartilhados pela sua nutri' }),
  '/paciente/recibos':      () =>                ({ eyebrow: 'Pagamentos',       title: 'Recibos',           subtitle: 'Seus comprovantes' }),
  '/paciente/suplementos':  () =>                ({ eyebrow: 'Habit tracker',    title: 'Meus suplementos',  subtitle: 'Marque diariamente' }),
  '/paciente/habitos':      () =>                ({ eyebrow: 'Hábitos do dia',   title: 'Meus hábitos',      subtitle: 'Acompanhe sua rotina' }),
  '/paciente/habitos-mes':  () =>                ({ eyebrow: 'Hábitos do mês',   title: 'Hábitos do mês',    subtitle: 'Check diário mensal' }),
  '/paciente/chat':         (_nome, nutriNome) => ({ eyebrow: 'Conversa',         title: nutriNome || 'Sua nutri', subtitle: 'Online' }),
  '/paciente/checkin':      () =>                ({ eyebrow: 'Check-in semanal', title: 'Como estou',         subtitle: 'Compartilhe com a sua nutri' }),
  '/paciente/receitas':    () =>                ({ eyebrow: 'Conteúdo',         title: 'Receitas',            subtitle: 'Da sua nutricionista' }),
  '/paciente/exames':     () =>                ({ eyebrow: 'Meus exames',       title: 'Exames',              subtitle: 'Resultados enviados para a nutri' }),
};

export default function PacienteLayout() {
  const { profile, user } = useSession();
  const tema = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [evolucaoBadge, setEvolucaoBadge] = useState(false);
  const [alterarSenhaOpen, setAlterarSenhaOpen] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaErro, setSenhaErro] = useState(null);
  const [senhaBusy, setSenhaBusy] = useState(false);
  const [senhaSucesso, setSenhaSucesso] = useState(false);

  // Registro do service worker e assinatura push
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey || !('PushManager' in window)) return;
    let active = true;
    async function assinarPush() {
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const perm = await Notification.requestPermission();
          if (!active || perm !== 'granted') return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
        if (!active) return;
        await supabase.from('push_subscriptions').upsert(
          { paciente_id: user.id, subscription: sub.toJSON() },
          { onConflict: 'paciente_id' }
        );
      } catch { /* push não crítico */ }
    }
    assinarPush();
    return () => { active = false; };
  }, [user]);

  const isChat = location.pathname === '/paciente/chat';
  const primeiroNome = profile?.nome?.split(' ')[0] ?? '';

  // Cores personalizadas da paciente: aplicadas APENAS neste elemento raiz,
  // nunca no document.documentElement, para não vazar pro app da nutri.
  const pc = tema.pacConfig ?? {};
  const pacStyle = {
    ...(pc.pac_bg  && { '--bg': pc.pac_bg, '--bg-soft': mistura(pc.pac_bg, '#ffffff', 0.5), '--bg-deep': mistura(pc.pac_bg, '#000000', 0.08) }),
    ...(pc.pac_card && { '--paper': pc.pac_card }),
    ...(pc.pac_btn  && {
      '--dark':       pc.pac_btn,
      '--dark-shade': mistura(pc.pac_btn, '#000000', 0.15),
      '--dark-line':  mistura(pc.pac_btn, '#000000', 0.25),
      '--gold-deep':  pc.pac_btn,
      '--gold':       mistura(pc.pac_btn, '#ffffff', 0.2),
      '--amber':      mistura(pc.pac_btn, '#ffffff', 0.2),
    }),
    ...(pc.pac_text && { '--ink': pc.pac_text, '--ink-soft': mistura(pc.pac_text, '#ffffff', 0.25) }),
    ...(pc.pac_tabbar         && { '--pac-tabbar-bg':      pc.pac_tabbar }),
    ...(pc.pac_tabbar_txt     && { '--pac-tabbar-txt':     pc.pac_tabbar_txt }),
    ...(pc.pac_header_ref     && { '--pac-header-ref-bg':  pc.pac_header_ref }),
    ...(pc.pac_header_ref_txt && { '--pac-header-ref-txt': pc.pac_header_ref_txt }),
    ...(pc.pac_macro          && { '--pac-macro':          pc.pac_macro }),
    ...(pc.pac_titulo         && { '--pac-titulo':         pc.pac_titulo }),
    ...(pc.pac_hero      && { '--pac-hero':      pc.pac_hero }),
    ...(pc.pac_btn_plano      && { '--pac-btn-plano':      pc.pac_btn_plano }),
    ...(pc.pac_avatar         && { '--pac-avatar':         pc.pac_avatar }),
  };

  // Conta mensagens não lidas vindas da nutri
  useEffect(() => {
    if (!user) return;
    let active = true;

    async function recarregar() {
      const { count } = await supabase
        .from('mensagens')
        .select('id', { count: 'exact', head: true })
        .eq('paciente_id', user.id)
        .eq('de', 'nutri')
        .eq('lida', false);
      if (active) setUnreadChat(count ?? 0);
    }

    recarregar();
    const channel = supabase
      .channel(`paciente-unread-${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'mensagens',
        filter: `paciente_id=eq.${user.id}`,
      }, recarregar)
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [user]);

  // Badge de evolução: mostra ⚠️ se menos de 3 fotos enviadas no mês atual
  useEffect(() => {
    if (!user) return;
    const mes = new Date().toISOString().slice(0, 7);
    supabase
      .from('fotos_evolucao')
      .select('tipo', { count: 'exact', head: true })
      .eq('paciente_id', user.id)
      .gte('data_foto', `${mes}-01`)
      .lte('data_foto', `${mes}-31`)
      .then(({ count }) => setEvolucaoBadge((count ?? 0) < 3));
  }, [user]);

  const header = useMemo(() => {
    const factory = HEADERS[location.pathname];
    return factory ? factory(primeiroNome, tema.nutri_nome) : { eyebrow: '', title: '' };
  }, [location.pathname, primeiroNome, tema.nutri_nome]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  async function handleAlterarSenha(e) {
    e.preventDefault();
    setSenhaErro(null);
    if (novaSenha.length < 6) return setSenhaErro('A senha precisa ter pelo menos 6 caracteres.');
    if (novaSenha !== confirmarSenha) return setSenhaErro('As senhas não conferem.');
    setSenhaBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) { setSenhaErro(error.message); return; }
      setSenhaSucesso(true);
      setNovaSenha(''); setConfirmarSenha('');
      setTimeout(() => { setAlterarSenhaOpen(false); setSenhaSucesso(false); }, 2000);
    } catch (err) {
      setSenhaErro(err?.message || 'Erro inesperado.');
    } finally {
      setSenhaBusy(false);
    }
  }

  return (
    <div className="paciente-app" style={pacStyle}>
      <header className="app-header">
        {isChat && (
          <button
            onClick={() => navigate('/paciente/inicio')}
            aria-label="Voltar"
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, flexShrink: 0, marginBottom: 4,
            }}>
            <i className="ti ti-chevron-left" style={{ fontSize: 22, color: 'var(--ink)' }} aria-hidden="true"></i>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {header.eyebrow && <div className="eyebrow">{header.eyebrow}</div>}
          <div className="app-title">{header.title}</div>
          {header.subtitle && <div className="app-subtitle">{header.subtitle}</div>}
        </div>
        <div className="header-right">
          <div className="header-avatar">{iniciais(profile?.nome)}</div>
        </div>
      </header>

      <div className="body">
        <Outlet />
        <BrandFooter compact />
      </div>

      {!isChat && (
        <nav className="tabbar" role="tablist">
          {TABS.map(t => {
            const active = t.path
              ? location.pathname === t.path
              : ['/paciente/checkin', '/paciente/compras', '/paciente/suplementos', '/paciente/habitos', '/paciente/prescricoes', '/paciente/ebooks', '/paciente/recibos', '/paciente/chat', '/paciente/receitas', '/paciente/exames'].includes(location.pathname);

            if (!t.path) {
              return (
                <button
                  key={t.id}
                  className={`tab ${active ? 'active' : ''}`}
                  onClick={() => setMoreOpen(true)}
                  role="tab"
                  style={{ position: 'relative' }}
                >
                  <i className={`ti ti-${t.icon}`} aria-hidden="true"></i>
                  <span>{t.label}</span>
                  {unreadChat > 0 && (
                    <span style={{
                      position: 'absolute', top: 2, right: 'calc(50% - 18px)',
                      background: 'var(--red)', color: 'var(--paper)',
                      fontSize: 9, fontWeight: 600,
                      minWidth: 14, height: 14, borderRadius: 7,
                      padding: '0 4px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid var(--paper)',
                    }}>{unreadChat}</span>
                  )}
                </button>
              );
            }

            return (
              <NavLink
                key={t.id}
                to={t.path}
                className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
                role="tab"
                style={{ position: 'relative' }}
              >
                <i className={`ti ti-${t.icon}`} aria-hidden="true"></i>
                <span>{t.label}</span>
                {t.id === 'evolucao' && evolucaoBadge && (
                  <span style={{
                    position: 'absolute', top: 2, right: 'calc(50% - 18px)',
                    background: '#95380A', color: '#fff',
                    fontSize: 9, fontWeight: 700,
                    width: 14, height: 14, borderRadius: 7,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid var(--paper)',
                  }}>!</span>
                )}
              </NavLink>
            );
          })}
        </nav>
      )}

      {alterarSenhaOpen && (
        <div className="sheet-backdrop" onClick={() => setAlterarSenhaOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grabber"></div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 6 }}>Alterar senha</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
              Mínimo de 6 caracteres.
            </div>
            {senhaSucesso ? (
              <div style={{
                fontSize: 13, color: 'var(--green)', background: 'var(--green-soft)',
                padding: '12px 14px', borderRadius: 10, textAlign: 'center', lineHeight: 1.5,
              }}>
                Senha atualizada com sucesso!
              </div>
            ) : (
              <form onSubmit={handleAlterarSenha}>
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 5, fontWeight: 500 }}>
                    Nova senha
                  </span>
                  <input
                    type="password"
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    required minLength={6} autoFocus
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 13,
                      background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                      borderRadius: 10, outline: 'none', color: 'var(--ink)',
                      fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                    }}
                  />
                </label>
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 5, fontWeight: 500 }}>
                    Confirmar nova senha
                  </span>
                  <input
                    type="password"
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                    required minLength={6}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 13,
                      background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                      borderRadius: 10, outline: 'none', color: 'var(--ink)',
                      fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                    }}
                  />
                </label>
                {senhaErro && (
                  <div style={{
                    fontSize: 12, color: 'var(--red)', background: 'var(--red-soft)',
                    padding: '8px 12px', borderRadius: 8, marginBottom: 12,
                  }}>{senhaErro}</div>
                )}
                <button type="submit" disabled={senhaBusy} style={{
                  width: '100%', padding: '11px 18px',
                  background: 'var(--ink)', color: 'var(--bg-soft)',
                  borderRadius: 12, fontSize: 13, fontWeight: 500, border: 'none',
                  opacity: senhaBusy ? .6 : 1, cursor: senhaBusy ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)', marginBottom: 8,
                }}>
                  {senhaBusy ? 'Salvando...' : 'Atualizar senha'}
                </button>
                <button type="button" onClick={() => setAlterarSenhaOpen(false)} style={{
                  width: '100%', padding: '10px', background: 'none', border: 'none',
                  fontSize: 13, color: 'var(--muted)', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}>
                  Cancelar
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grabber"></div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Mais</div>
            {MAIS_ITEMS.map(item => {
              const isChatItem = item.path === '/paciente/chat';
              return (
                <button key={item.path}
                  className="sheet-item"
                  onClick={() => { setMoreOpen(false); navigate(item.path); }}>
                  <div className="icon-wrap"><i className={`ti ti-${item.icon}`} aria-hidden="true"></i></div>
                  <div style={{ flex: 1 }}>
                    <div className="label">{item.label}</div>
                    <div className="sub">{item.sub}</div>
                  </div>
                  {isChatItem && unreadChat > 0 && (
                    <span style={{
                      background: 'var(--red)', color: 'var(--paper)',
                      fontSize: 10, fontWeight: 600,
                      minWidth: 18, height: 18, borderRadius: 9,
                      padding: '0 6px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{unreadChat}</span>
                  )}
                  <i className="ti ti-chevron-right" style={{ color: 'var(--muted)' }} aria-hidden="true"></i>
                </button>
              );
            })}

            <button key="alterar-senha"
              className="sheet-item"
              onClick={() => {
                setMoreOpen(false);
                setNovaSenha(''); setConfirmarSenha('');
                setSenhaErro(null); setSenhaSucesso(false);
                setAlterarSenhaOpen(true);
              }}>
              <div className="icon-wrap"><i className="ti ti-lock" aria-hidden="true"></i></div>
              <div style={{ flex: 1 }}>
                <div className="label">Alterar senha</div>
                <div className="sub">Trocar a senha de acesso</div>
              </div>
              <i className="ti ti-chevron-right" style={{ color: 'var(--muted)' }} aria-hidden="true"></i>
            </button>

            <div style={{ height: 1, background: 'var(--hair)', margin: '12px 0 8px' }}></div>

            <button
              className="sheet-item"
              onClick={async () => {
                if (window.confirm('Tem certeza que deseja sair?')) {
                  setMoreOpen(false);
                  await handleSignOut();
                }
              }}>
              <div className="icon-wrap" style={{ background: 'var(--red-soft)' }}>
                <i className="ti ti-logout" style={{ color: 'var(--red)' }} aria-hidden="true"></i>
              </div>
              <div style={{ flex: 1 }}>
                <div className="label" style={{ color: 'var(--red)' }}>Sair</div>
                <div className="sub">Encerrar sessão</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
