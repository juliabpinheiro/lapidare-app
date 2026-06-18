import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { useTheme } from '../../lib/theme.jsx';
import { dataBR } from '../../lib/utils.js';

export default function ReceitasPaciente() {
  const { user, profile } = useSession();
  const tema = useTheme();
  const nutriNome = tema.nutri_nome ?? 'Sua nutri';
  const [receitas, setReceitas] = useState(undefined);
  // URLs pré-geradas: window.open deve ser chamado sincronamente no iOS
  const [urls, setUrls] = useState({});

  useEffect(() => {
    if (!user || !profile?.nutri_id) return;
    let active = true;

    async function carregar() {
      const { data } = await supabase
        .from('receitas')
        .select('id, nome, storage_path, tamanho_bytes, created_at')
        .eq('nutri_id', profile.nutri_id)
        .order('created_at', { ascending: false });
      if (!active) return;
      setReceitas(data ?? []);

      const novasUrls = {};
      for (const r of data ?? []) {
        const { data: d } = await supabase.storage
          .from('receitas').createSignedUrl(r.storage_path, 3600);
        if (d?.signedUrl) novasUrls[r.id] = d.signedUrl;
      }
      if (active) setUrls(novasUrls);
    }

    carregar();
    return () => { active = false; };
  }, [user, profile?.nutri_id]);

  // iOS: window.open deve ser chamado no mesmo tick do clique (sem await antes)
  function baixar(id) {
    const url = urls[id];
    if (url) window.open(url, '_blank');
  }

  if (receitas === undefined) {
    return <div className="empty-state"><div className="empty-sub">Carregando…</div></div>;
  }

  if (receitas.length === 0) {
    return (
      <div className="empty-state">
        <i className="ti ti-chef-hat empty-icon" aria-hidden="true"></i>
        <div className="empty-title">Nenhuma receita ainda</div>
        <div className="empty-sub">
          {nutriNome} ainda não adicionou receitas. Em breve!
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {receitas.map(r => {
        const urlPronta = !!urls[r.id];
        return (
          <div key={r.id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'var(--paper, var(--white))',
            borderRadius: 14,
            border: '0.5px solid var(--hair, #e2e0da)',
            padding: '12px 14px',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: 'var(--gold-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <i className="ti ti-file-text" style={{ fontSize: 22, color: 'var(--gold-deep)' }} aria-hidden="true"></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600, lineHeight: 1.3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                color: 'var(--ink)',
              }}>
                {r.nome}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {dataBR(r.created_at)}
              </div>
            </div>
            <button
              onClick={() => baixar(r.id)}
              disabled={!urlPronta}
              style={{
                flexShrink: 0,
                padding: '9px 14px', borderRadius: 10,
                background: urlPronta ? 'var(--ink)' : 'var(--bg-soft)',
                color: urlPronta ? 'var(--paper, #fff)' : 'var(--muted)',
                border: 'none', cursor: urlPronta ? 'pointer' : 'default',
                fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--font-sans)',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                transition: 'background .15s',
              }}
            >
              <i className="ti ti-download" style={{ fontSize: 15 }} aria-hidden="true"></i>
              {urlPronta ? 'Baixar' : '…'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
