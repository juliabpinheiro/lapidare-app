import { Navigate, useLocation } from 'react-router-dom';
import { useSession, signOut } from '../lib/session.jsx';

function Loading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', color: 'var(--muted)', fontSize: 13,
      fontFamily: 'var(--font-sans)'
    }}>
      Carregando…
    </div>
  );
}

export default function RequireAuth({ children, role }) {
  const { session, role: userRole, profile, loading } = useSession();
  const location = useLocation();

  if (loading) return <Loading />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Paciente inativada pela nutricionista
  if (userRole === 'paciente' && profile?.ativo === false) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', padding: 32, textAlign: 'center',
        fontFamily: 'var(--font-sans)', color: 'var(--ink-soft)', maxWidth: 440, margin: '0 auto',
      }}>
        <i className="ti ti-lock" style={{ fontSize: 48, color: 'var(--muted)', marginBottom: 16 }} aria-hidden="true"></i>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginBottom: 8 }}>
          Acesso temporariamente suspenso
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
          Seu acesso está temporariamente suspenso. Entre em contato com sua nutricionista para mais informações.
        </p>
        <button onClick={signOut} style={{
          background: 'var(--dark)', color: '#fff', border: 'none',
          borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}>Sair</button>
      </div>
    );
  }

  if (role && userRole && userRole !== role) {
    const dest = userRole === 'nutri' ? '/nutri/visao' : '/paciente/inicio';
    return <Navigate to={dest} replace />;
  }

  if (role && !userRole) {
    return (
      <div style={{
        padding: 40, textAlign: 'center', fontFamily: 'var(--font-sans)',
        color: 'var(--ink-soft)', maxWidth: 480, margin: '60px auto'
      }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 8 }}>
          Conta sem perfil
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Este email está autenticado, mas não está vinculado a uma nutricionista nem a uma paciente.
          Faça logout e use um convite válido.
        </p>
      </div>
    );
  }

  return children;
}
