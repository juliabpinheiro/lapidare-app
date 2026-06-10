import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { useSession } from './session.jsx';

/**
 * ThemeContext expõe a personalização ATIVA:
 *  - Pra nutri logada: usa o profile dela
 *  - Pra paciente logada: busca via RPC os dados da nutri dela
 *  - Pra anônimo (Login, signup, etc.): valores default Lapidare
 *
 * Aplica automaticamente:
 *  - CSS variables --gold-deep e --amber
 *  - data-tipografia no <html> (CSS controla o resto)
 *  - Disponibiliza marca/logo via hook useTheme()
 */

const DEFAULT_TEMA = {
  marca_nome: 'Lapidare',
  marca_subtitulo: null,
  logo_url: null,
  cor_primaria: '#a08456',
  cor_secundaria: '#c9a96e',
  cor_sidebar: null,        // null = usa cor_primaria
  cor_fundo_nutri: null,    // null = derivado da primária
  cor_abas: null,           // null = usa cor_primaria
  cor_card_nutri: null,     // null = usa --white padrão
  cor_texto: '#000000',
  tipografia: 'classica',
  mensagem_login: null,
  mensagem_termo: null,
  cor_texto_sidebar: null,  // null = auto-calcula por luminância
  cor_nav_item: null,       // null = --dark-muted derivado
  cor_nav_grupo: null,      // null = --dark-label derivado
  cor_sidebar_nome: null,   // null = --dark-text derivado
  cor_nav_divider: null,    // null = --dark-shade derivado
  cor_nav_active: null,     // null = --dark-shade derivado
  cor_sidebar_detail: null, // null = --sidebar-text derivado
  cor_topbar: null,         // null = usa --dark (mesma cor da sidebar)
  cor_topbar_texto: null,   // null = --dark-text derivado
  cor_aba: null,            // null = usa --bg2 derivado
  cor_btn_sec: null,        // null = transparent
  cor_btn_txt: null,        // null = --dark
  nutri_nome: 'Sua nutri',
  nutri_foto_url: null,
};

const ThemeContext = createContext(DEFAULT_TEMA);

export function ThemeProvider({ children }) {
  const { profile, role } = useSession();
  const [tema, setTema] = useState(DEFAULT_TEMA);

  useEffect(() => {
    let active = true;
    async function carregar() {
      // Nutri logada: usa profile direto
      if (role === 'nutri' && profile) {
        if (!active) return;
        setTema({
          ...DEFAULT_TEMA,
          marca_nome:        profile.marca_nome      ?? 'Lapidare',
          marca_subtitulo:   profile.marca_subtitulo ?? null,
          logo_url:          profile.logo_url        ?? null,
          cor_primaria:      profile.cor_primaria    ?? DEFAULT_TEMA.cor_primaria,
          cor_secundaria:    profile.cor_secundaria  ?? DEFAULT_TEMA.cor_secundaria,
          cor_sidebar:       profile.cor_sidebar     ?? null,
          cor_fundo_nutri:   profile.cor_fundo_nutri ?? null,
          cor_abas:          profile.cor_abas        ?? null,
          cor_card_nutri:    profile.cor_card_nutri   ?? null,
          cor_texto:         profile.cor_texto        ?? '#000000',
          tipografia:        profile.tipografia       ?? 'classica',
          mensagem_login:    profile.mensagem_login   ?? null,
          mensagem_termo:    profile.mensagem_termo   ?? null,
          cor_texto_sidebar: profile.cor_texto_sidebar ?? null,
          cor_nav_item:      profile.cor_nav_item     ?? null,
          cor_nav_grupo:     profile.cor_nav_grupo    ?? null,
          cor_sidebar_nome:  profile.cor_sidebar_nome ?? null,
          cor_nav_divider:    profile.cor_nav_divider   ?? null,
          cor_nav_active:     profile.cor_nav_active    ?? null,
          cor_sidebar_detail: profile.cor_sidebar_detail ?? null,
          cor_topbar:         profile.cor_topbar        ?? null,
          cor_topbar_texto:  profile.cor_topbar_texto ?? null,
          cor_aba:           profile.cor_aba          ?? null,
          cor_btn_sec:       profile.cor_btn_sec      ?? null,
          cor_btn_txt:       profile.cor_btn_txt      ?? null,
          nutri_nome:        profile.nome             ?? 'Sua nutri',
          nutri_foto_url:    profile.foto_url         ?? null,
        });
        return;
      }
      // Paciente logada: busca personalização da nutri + cores customizadas da paciente
      if (role === 'paciente' && profile?.nutri_id) {
        const [personRes, configRes] = await Promise.all([
          supabase.rpc('buscar_personalizacao_nutri', { p_nutri_id: profile.nutri_id }),
          supabase.from('configuracoes').select('tema').eq('nutri_id', profile.nutri_id).maybeSingle(),
        ]);
        if (!active) return;
        const p = personRes.data?.[0];
        const pacConfig = configRes.data?.tema ?? {};
        setTema(p
          ? { ...DEFAULT_TEMA, ...p, pacConfig }
          : { ...DEFAULT_TEMA, pacConfig });
        return;
      }
      // Anônimo (Login, signup, etc): busca a marca da "dona" do deploy
      // (a primeira/única nutri cadastrada), pra personalizar a tela de Login.
      // Se ainda não tem nutri criada (primeiro acesso), cai no fallback Lapidare.
      try {
        const { data } = await supabase.rpc('buscar_marca_principal');
        if (!active) return;
        const p = data?.[0];
        setTema(p ? { ...DEFAULT_TEMA, ...p } : DEFAULT_TEMA);
      } catch {
        if (!active) return;
        setTema(DEFAULT_TEMA);
      }
    }
    carregar();
    return () => { active = false; };
  }, [profile, role]);

  // Aplica CSS variables + tipografia
  useEffect(() => {
    const r = document.documentElement;
    const primaria   = tema.cor_primaria   ?? '#a08456';
    const secundaria = tema.cor_secundaria ?? '#c9a96e';
    // cor_sidebar controla --sidebar-bg (fundo do sidebar) apenas.
    // --dark nunca usa cor_sidebar; deriva só de cor_primaria.
    const sidebar    = tema.cor_sidebar    ?? primaria;

    // ─── Acento / destaque ───
    r.style.setProperty('--gold-deep', primaria);
    r.style.setProperty('--amber',     secundaria);
    r.style.setProperty('--gold',      secundaria);

    // ─── Botões primários e texto de destaque — derivado APENAS de cor_primaria ───
    r.style.setProperty('--dark', primaria);
    // --sidebar-bg: fundo do .sidebar — única variável que recebe cor_sidebar
    r.style.setProperty('--sidebar-bg', sidebar);

    // ─── Abas ativas ───
    r.style.setProperty('--aba-cor', tema.cor_abas ?? primaria);

    // ─── Texto principal ───
    const corTexto = tema.cor_texto ?? '#000000';
    r.style.setProperty('--ink',      corTexto);
    r.style.setProperty('--ink-soft', mistura(corTexto, '#ffffff', 0.25));

    // ─── Variantes do --dark (sidebar): shade/line calculados a partir da cor da sidebar ───
    const lum = luminancia(sidebar);
    const sidebarEhClara = lum > 0.45;

    r.style.setProperty('--dark-shade', mistura(sidebar, '#000000', 0.15));
    r.style.setProperty('--dark-line',  mistura(sidebar, '#000000', 0.25));

    // --sidebar-text: cor de texto dedicada para itens do sidebar
    // Usa cor_texto_sidebar se definida; senão, branco ou preto puro por contraste.
    // NUNCA herda de --dark-muted/--dark-label (que são blends do fundo).
    const lum_sidebar = luminancia(sidebar);
    const sidebarTxt = tema.cor_texto_sidebar
      ? tema.cor_texto_sidebar
      : (lum_sidebar > 0.50 ? '#1a1612' : '#faf8f5');
    r.style.setProperty('--sidebar-text', sidebarTxt);

    const overrideTexto = tema.cor_texto_sidebar;
    if (overrideTexto) {
      r.style.setProperty('--dark-text',  overrideTexto);
      r.style.setProperty('--dark-muted', mistura(overrideTexto, sidebar, 0.40));
      r.style.setProperty('--dark-label', mistura(overrideTexto, sidebar, 0.60));
    } else if (sidebarEhClara) {
      const textoBase = '#1a1612';
      r.style.setProperty('--dark-text',  textoBase);
      r.style.setProperty('--dark-muted', mistura(textoBase, sidebar, 0.35));
      r.style.setProperty('--dark-label', mistura(textoBase, sidebar, 0.55));
    } else {
      const textoBase = '#faf8f5';
      r.style.setProperty('--dark-text',  textoBase);
      r.style.setProperty('--dark-muted', mistura(textoBase, sidebar, 0.40));
      r.style.setProperty('--dark-label', mistura(textoBase, sidebar, 0.60));
    }

    r.style.setProperty('--gold-soft', mistura(primaria, '#ffffff', 0.82));
    r.style.setProperty('--amber-bg',  mistura(secundaria, '#ffffff', 0.88));

    // ─── Fundo principal ───
    // cor_fundo_nutri tem prioridade; se não set, deriva da primária.
    if (tema.cor_fundo_nutri) {
      r.style.setProperty('--bg',      tema.cor_fundo_nutri);
      r.style.setProperty('--bg-soft', mistura(tema.cor_fundo_nutri, '#ffffff', 0.50));
      r.style.setProperty('--bg-deep', mistura(tema.cor_fundo_nutri, '#000000', 0.06));
    } else {
      r.style.setProperty('--bg',      mistura(primaria, '#faf7f2', 0.95));
      r.style.setProperty('--bg-soft', mistura(primaria, '#faf7f2', 0.92));
      r.style.setProperty('--bg-deep', mistura(primaria, '#faf7f2', 0.86));
    }

    r.dataset.tipografia = tema.tipografia ?? 'classica';

    // ─── Card do painel da nutri ───
    if (tema.cor_card_nutri) {
      r.style.setProperty('--nutri-card', tema.cor_card_nutri);
    } else {
      r.style.removeProperty('--nutri-card');
    }

    // ─── Sidebar: itens de nav e categorias ───
    if (tema.cor_nav_item) r.style.setProperty('--nav-item-text', tema.cor_nav_item);
    else r.style.removeProperty('--nav-item-text');

    if (tema.cor_nav_grupo) r.style.setProperty('--nav-grupo-text', tema.cor_nav_grupo);
    else r.style.removeProperty('--nav-grupo-text');

    if (tema.cor_sidebar_nome) r.style.setProperty('--sidebar-nome-text', tema.cor_sidebar_nome);
    else r.style.removeProperty('--sidebar-nome-text');

    if (tema.cor_nav_divider) r.style.setProperty('--nav-divider-color', tema.cor_nav_divider);
    else r.style.removeProperty('--nav-divider-color');

    if (tema.cor_nav_active) r.style.setProperty('--nav-active-bg', tema.cor_nav_active);
    else r.style.removeProperty('--nav-active-bg');

    if (tema.cor_sidebar_detail) r.style.setProperty('--sidebar-detail-color', tema.cor_sidebar_detail);
    else r.style.removeProperty('--sidebar-detail-color');

    // ─── Fundo sólido do painel da nutri (nunca gradiente) ───
    if (tema.cor_fundo_nutri) {
      r.style.setProperty('--fundo-nutri', tema.cor_fundo_nutri);
    } else {
      r.style.setProperty('--fundo-nutri', mistura(primaria, '#faf7f2', 0.95));
    }

    // ─── Topbar ───
    if (tema.cor_topbar) r.style.setProperty('--topbar-bg', tema.cor_topbar);
    else r.style.removeProperty('--topbar-bg');

    if (tema.cor_topbar_texto) r.style.setProperty('--topbar-text', tema.cor_topbar_texto);
    else r.style.removeProperty('--topbar-text');

    // ─── Abas (tab bar) ───
    if (tema.cor_aba) {
      r.style.setProperty('--tab-bg', tema.cor_aba);
      r.style.setProperty('--tab-txt', luminancia(tema.cor_aba) > 0.45 ? '#3a3028' : '#faf8f5');
    } else {
      r.style.removeProperty('--tab-bg');
      r.style.removeProperty('--tab-txt');
    }
    if (tema.cor_abas) {
      r.style.setProperty('--tab-ativa-bg', tema.cor_abas);
      r.style.setProperty('--tab-ativa-txt', luminancia(tema.cor_abas) > 0.45 ? '#1a1612' : '#ffffff');
    } else {
      r.style.removeProperty('--tab-ativa-bg');
      r.style.removeProperty('--tab-ativa-txt');
    }

    // ─── Botões secundários (btn-outline) ───
    if (tema.cor_btn_sec) r.style.setProperty('--btn-sec-bg', tema.cor_btn_sec);
    else r.style.removeProperty('--btn-sec-bg');

    if (tema.cor_btn_txt) r.style.setProperty('--btn-sec-txt', tema.cor_btn_txt);
    else r.style.removeProperty('--btn-sec-txt');

    // ─── Cores exclusivas do app da paciente ───
    // Aplicadas por cima das cores de marca; só presentes quando role=paciente.
    const pc = tema.pacConfig;
    if (pc) {
      if (pc.pac_bg) {
        r.style.setProperty('--bg',      pc.pac_bg);
        r.style.setProperty('--bg-soft', mistura(pc.pac_bg, '#ffffff', 0.5));
        r.style.setProperty('--bg-deep', mistura(pc.pac_bg, '#000000', 0.08));
      }
      if (pc.pac_card) {
        r.style.setProperty('--paper', pc.pac_card);
      }
      if (pc.pac_btn) {
        r.style.setProperty('--dark',       pc.pac_btn);
        r.style.setProperty('--dark-shade', mistura(pc.pac_btn, '#000000', 0.15));
        r.style.setProperty('--dark-line',  mistura(pc.pac_btn, '#000000', 0.25));
        r.style.setProperty('--gold-deep',  pc.pac_btn);
        r.style.setProperty('--gold',       mistura(pc.pac_btn, '#ffffff', 0.2));
        r.style.setProperty('--amber',      mistura(pc.pac_btn, '#ffffff', 0.2));
      }
      if (pc.pac_text) {
        r.style.setProperty('--ink',      pc.pac_text);
        r.style.setProperty('--ink-soft', mistura(pc.pac_text, '#ffffff', 0.25));
      }
    }
  }, [tema.cor_primaria, tema.cor_secundaria, tema.cor_sidebar, tema.cor_fundo_nutri, tema.cor_abas, tema.cor_card_nutri, tema.cor_texto, tema.tipografia, tema.cor_texto_sidebar, tema.cor_nav_item, tema.cor_nav_grupo, tema.cor_sidebar_nome, tema.cor_nav_divider, tema.cor_nav_active, tema.cor_sidebar_detail, tema.cor_topbar, tema.cor_topbar_texto, tema.cor_aba, tema.cor_btn_sec, tema.cor_btn_txt, tema.pacConfig]);

  return (
    <ThemeContext.Provider value={tema}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}


/**
 * Mistura linear entre duas cores hex. peso = quanto da segunda cor (0..1).
 * mistura('#a08456', '#ffffff', 0.8) → cor primária com 80% de branco = soft.
 */
function mistura(hex1, hex2, peso) {
  const a = parseHex(hex1);
  const b = parseHex(hex2);
  if (!a || !b) return hex1;
  const r = Math.round(a.r * (1 - peso) + b.r * peso);
  const g = Math.round(a.g * (1 - peso) + b.g * peso);
  const bl = Math.round(a.b * (1 - peso) + b.b * peso);
  return `#${[r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '');
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/**
 * Luminância relativa percebida (WCAG-like, simplificado).
 * Retorna 0 (preto puro) a 1 (branco puro).
 * Usado pra decidir se a cor de texto deve ser clara ou escura.
 */
function luminancia(hex) {
  const c = parseHex(hex);
  if (!c) return 0.5;
  // Fórmula percebida (não a WCAG exata, mas suficiente pra decidir contraste)
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}
