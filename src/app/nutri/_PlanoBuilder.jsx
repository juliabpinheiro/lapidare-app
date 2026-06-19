import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase.js';
import { gerarPlanoHtml } from '../../lib/gerarPlanoHtml.js';

/* ── Constantes ─────────────────────────────────────────────── */
const CATS = [
  { key: 'carbo',   label: 'Carboidrato' },
  { key: 'prot',    label: 'Proteína' },
  { key: 'gordura', label: 'Gordura' },
  { key: 'fruta',   label: 'Fruta' },
  { key: 'leg',     label: 'Leguminosa' },
  { key: 'bebida',  label: 'Bebida' },
];

const SUGESTOES = [
  { nome: 'Café da Manhã',   horario: '08:00' },
  { nome: 'Lanche da Manhã', horario: '10:30' },
  { nome: 'Almoço',          horario: '12:30' },
  { nome: 'Lanche da Tarde', horario: '15:30' },
  { nome: 'Jantar',          horario: '19:00' },
  { nome: 'Ceia',            horario: '21:00' },
];

/* ── Utilitários ────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 9); }
function rd(v, d = 1) { if (v == null) return null; const m = 10 ** d; return Math.round(v * m) / m; }
function fmt(v, d = 1) { if (v == null || isNaN(v)) return '—'; return Number(v).toFixed(d); }

function servingG(food) {
  if (food?.serving_g > 0) return food.serving_g;
  const s = food?.serving ?? '';
  const m = s.match(/\((\d+(?:\.\d+)?)\s*g\)/i) || s.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  return m ? parseFloat(m[1]) : 100;
}

function calcMacros(food, gramas) {
  const f = gramas / servingG(food);
  return {
    nome:   food.name,
    qty:    `${gramas}g`,
    kcal:   rd((food.kcal   ?? 0) * f, 0),
    prot_g: rd((food.prot_g ?? 0) * f, 1),
    cho_g:  rd((food.carb_g ?? 0) * f, 1),
    lip_g:  rd((food.fat_g  ?? 0) * f, 1),
  };
}

function somaAlimentos(alimentos) {
  return alimentos.reduce((a, al) => ({
    kcal:   a.kcal   + (al.kcal   ?? 0),
    prot_g: a.prot_g + (al.prot_g ?? 0),
    cho_g:  a.cho_g  + (al.cho_g  ?? 0),
    lip_g:  a.lip_g  + (al.lip_g  ?? 0),
  }), { kcal: 0, prot_g: 0, cho_g: 0, lip_g: 0 });
}

function normMealKey(nome) {
  const n = (nome ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').trim();
  if (n.includes('ceia'))   return 'ceia';
  if (n.includes('jantar')) return 'jantar';
  if (n.includes('lanche') && (n.includes('tarde') || n.includes('15') || n.includes('16'))) return 'lanche_tarde';
  if (n.includes('almoco')) return 'almoco';
  if (n.includes('lanche')) return 'lanche_manha';
  return 'cafe_manha';
}

function guessCatKey(al) {
  const p = al.prot_g ?? 0, c = al.cho_g ?? 0;
  return p > 5 && p >= c ? 'prot' : 'carbo';
}

function buildSubsTexto(refeicoes) {
  const result = {};
  for (const ref of refeicoes) {
    const mk = normMealKey(ref.nome);
    for (const al of ref.alimentos) {
      if (!al.subs?.length) continue;
      const ck = al.catKey || guessCatKey(al);
      if (!result[mk]) result[mk] = {};
      const partes = [`${al.nome} ${al.qty}`, ...al.subs.map(s => `${s.nome} ${s.qty || ''}`.trim())];
      result[mk][ck] = result[mk][ck] ? `${result[mk][ck]} · ${partes.join(' · ')}` : partes.join(' · ');
    }
  }
  return Object.keys(result).length ? result : null;
}

/* ── Tabela TACO (por 100g) ─────────────────────────────────── */
const TACO_DATA = [
  // Cereais e derivados
  { nome: 'Arroz branco cozido',        cat: 'carbo', kcal: 128, prot_g: 2.5,  cho_g: 28.1, lip_g: 0.2 },
  { nome: 'Arroz integral cozido',      cat: 'carbo', kcal: 124, prot_g: 2.6,  cho_g: 25.8, lip_g: 1.0 },
  { nome: 'Macarrão cozido',            cat: 'carbo', kcal: 157, prot_g: 4.9,  cho_g: 31.4, lip_g: 0.9 },
  { nome: 'Pão francês',               cat: 'carbo', kcal: 300, prot_g: 8.0,  cho_g: 58.6, lip_g: 3.1 },
  { nome: 'Pão de forma integral',      cat: 'carbo', kcal: 253, prot_g: 8.2,  cho_g: 47.1, lip_g: 3.4 },
  { nome: 'Aveia em flocos',            cat: 'carbo', kcal: 394, prot_g: 13.9, cho_g: 66.6, lip_g: 8.5 },
  { nome: 'Batata inglesa cozida',      cat: 'carbo', kcal: 52,  prot_g: 1.7,  cho_g: 11.4, lip_g: 0.1 },
  { nome: 'Batata-doce cozida',         cat: 'carbo', kcal: 77,  prot_g: 0.6,  cho_g: 18.4, lip_g: 0.1 },
  { nome: 'Inhame cozido',              cat: 'carbo', kcal: 78,  prot_g: 1.7,  cho_g: 18.5, lip_g: 0.2 },
  { nome: 'Mandioca cozida',            cat: 'carbo', kcal: 125, prot_g: 0.6,  cho_g: 30.1, lip_g: 0.3 },
  { nome: 'Farinha de mandioca',        cat: 'carbo', kcal: 361, prot_g: 1.6,  cho_g: 87.0, lip_g: 0.3 },
  { nome: 'Tapioca',                    cat: 'carbo', kcal: 360, prot_g: 0.3,  cho_g: 88.7, lip_g: 0.0 },
  { nome: 'Milho cozido',               cat: 'carbo', kcal: 77,  prot_g: 2.9,  cho_g: 14.7, lip_g: 1.0 },
  { nome: 'Cuscuz de milho cozido',     cat: 'carbo', kcal: 112, prot_g: 2.0,  cho_g: 23.8, lip_g: 0.8 },
  { nome: 'Biscoito de arroz',          cat: 'carbo', kcal: 387, prot_g: 7.7,  cho_g: 81.1, lip_g: 4.1 },
  // Leguminosas
  { nome: 'Feijão carioca cozido',      cat: 'leg',   kcal: 76,  prot_g: 4.8,  cho_g: 13.6, lip_g: 0.5 },
  { nome: 'Feijão preto cozido',        cat: 'leg',   kcal: 77,  prot_g: 4.5,  cho_g: 14.0, lip_g: 0.5 },
  { nome: 'Lentilha cozida',            cat: 'leg',   kcal: 93,  prot_g: 6.3,  cho_g: 16.3, lip_g: 0.5 },
  { nome: 'Grão-de-bico cozido',        cat: 'leg',   kcal: 164, prot_g: 8.9,  cho_g: 27.4, lip_g: 2.6 },
  { nome: 'Ervilha cozida',             cat: 'leg',   kcal: 67,  prot_g: 4.7,  cho_g: 11.2, lip_g: 0.4 },
  { nome: 'Soja cozida',                cat: 'leg',   kcal: 141, prot_g: 12.4, cho_g: 11.5, lip_g: 6.0 },
  // Proteínas animais
  { nome: 'Frango peito grelhado',      cat: 'prot',  kcal: 159, prot_g: 32.0, cho_g: 0.0,  lip_g: 3.2 },
  { nome: 'Frango coxa grelhada',       cat: 'prot',  kcal: 180, prot_g: 23.0, cho_g: 0.0,  lip_g: 9.5 },
  { nome: 'Carne bovina patinho cozida',cat: 'prot',  kcal: 219, prot_g: 32.0, cho_g: 0.0,  lip_g: 9.5 },
  { nome: 'Carne bovina acém cozida',   cat: 'prot',  kcal: 245, prot_g: 29.0, cho_g: 0.0,  lip_g: 14.0 },
  { nome: 'Carne moída refogada',       cat: 'prot',  kcal: 208, prot_g: 26.0, cho_g: 0.0,  lip_g: 11.2 },
  { nome: 'Ovos inteiros cozidos',      cat: 'prot',  kcal: 146, prot_g: 13.3, cho_g: 0.6,  lip_g: 9.5 },
  { nome: 'Ovo mexido',                 cat: 'prot',  kcal: 181, prot_g: 12.9, cho_g: 1.7,  lip_g: 13.7 },
  { nome: 'Atum em conserva',           cat: 'prot',  kcal: 109, prot_g: 25.3, cho_g: 0.0,  lip_g: 0.8 },
  { nome: 'Sardinha assada',            cat: 'prot',  kcal: 181, prot_g: 27.0, cho_g: 0.0,  lip_g: 7.8 },
  { nome: 'Tilápia grelhada',           cat: 'prot',  kcal: 96,  prot_g: 20.1, cho_g: 0.0,  lip_g: 1.7 },
  { nome: 'Camarão cozido',             cat: 'prot',  kcal: 77,  prot_g: 16.9, cho_g: 0.0,  lip_g: 1.0 },
  { nome: 'Lombo suíno assado',         cat: 'prot',  kcal: 197, prot_g: 27.5, cho_g: 0.0,  lip_g: 9.5 },
  // Laticínios
  { nome: 'Leite integral',             cat: 'prot',  kcal: 61,  prot_g: 3.2,  cho_g: 4.7,  lip_g: 3.3 },
  { nome: 'Leite desnatado',            cat: 'prot',  kcal: 35,  prot_g: 3.4,  cho_g: 5.0,  lip_g: 0.2 },
  { nome: 'Iogurte natural integral',   cat: 'prot',  kcal: 61,  prot_g: 3.5,  cho_g: 4.9,  lip_g: 3.0 },
  { nome: 'Iogurte grego',              cat: 'prot',  kcal: 97,  prot_g: 9.0,  cho_g: 3.6,  lip_g: 5.0 },
  { nome: 'Queijo minas frescal',       cat: 'prot',  kcal: 264, prot_g: 17.4, cho_g: 3.0,  lip_g: 20.2 },
  { nome: 'Queijo cottage',             cat: 'prot',  kcal: 97,  prot_g: 11.1, cho_g: 3.4,  lip_g: 4.3 },
  { nome: 'Queijo muçarela',            cat: 'prot',  kcal: 314, prot_g: 21.6, cho_g: 2.6,  lip_g: 24.0 },
  { nome: 'Requeijão cremoso',          cat: 'prot',  kcal: 235, prot_g: 7.8,  cho_g: 4.5,  lip_g: 21.0 },
  { nome: 'Whey protein (pó)',          cat: 'prot',  kcal: 400, prot_g: 80.0, cho_g: 8.0,  lip_g: 5.0 },
  // Frutas
  { nome: 'Banana prata',               cat: 'fruta', kcal: 98,  prot_g: 1.3,  cho_g: 26.0, lip_g: 0.1 },
  { nome: 'Banana maçã',                cat: 'fruta', kcal: 87,  prot_g: 1.1,  cho_g: 22.8, lip_g: 0.1 },
  { nome: 'Maçã',                       cat: 'fruta', kcal: 56,  prot_g: 0.3,  cho_g: 15.2, lip_g: 0.2 },
  { nome: 'Laranja',                    cat: 'fruta', kcal: 37,  prot_g: 1.0,  cho_g: 8.9,  lip_g: 0.1 },
  { nome: 'Mamão papaia',               cat: 'fruta', kcal: 45,  prot_g: 0.5,  cho_g: 11.8, lip_g: 0.1 },
  { nome: 'Melão',                      cat: 'fruta', kcal: 29,  prot_g: 0.9,  cho_g: 6.6,  lip_g: 0.2 },
  { nome: 'Morango',                    cat: 'fruta', kcal: 30,  prot_g: 0.8,  cho_g: 6.8,  lip_g: 0.3 },
  { nome: 'Uva niágara',                cat: 'fruta', kcal: 69,  prot_g: 1.0,  cho_g: 17.4, lip_g: 0.1 },
  { nome: 'Manga tommy',                cat: 'fruta', kcal: 64,  prot_g: 0.4,  cho_g: 17.0, lip_g: 0.3 },
  { nome: 'Abacaxi',                    cat: 'fruta', kcal: 48,  prot_g: 0.9,  cho_g: 12.3, lip_g: 0.1 },
  { nome: 'Melancia',                   cat: 'fruta', kcal: 33,  prot_g: 0.9,  cho_g: 7.7,  lip_g: 0.4 },
  { nome: 'Pêra',                       cat: 'fruta', kcal: 55,  prot_g: 0.5,  cho_g: 14.9, lip_g: 0.1 },
  { nome: 'Kiwi',                       cat: 'fruta', kcal: 61,  prot_g: 1.0,  cho_g: 14.9, lip_g: 0.6 },
  { nome: 'Abacate',                    cat: 'fruta', kcal: 96,  prot_g: 1.2,  cho_g: 6.0,  lip_g: 8.4 },
  // Legumes e verduras
  { nome: 'Brócolis cozido',            cat: 'carbo', kcal: 25,  prot_g: 2.9,  cho_g: 3.6,  lip_g: 0.4 },
  { nome: 'Cenoura crua',               cat: 'carbo', kcal: 34,  prot_g: 1.3,  cho_g: 7.7,  lip_g: 0.2 },
  { nome: 'Abobrinha cozida',           cat: 'carbo', kcal: 19,  prot_g: 1.2,  cho_g: 3.6,  lip_g: 0.2 },
  { nome: 'Tomate cru',                 cat: 'carbo', kcal: 15,  prot_g: 1.1,  cho_g: 2.9,  lip_g: 0.2 },
  { nome: 'Alface crespa crua',         cat: 'carbo', kcal: 11,  prot_g: 1.3,  cho_g: 1.7,  lip_g: 0.2 },
  { nome: 'Espinafre cozido',           cat: 'carbo', kcal: 24,  prot_g: 2.1,  cho_g: 3.7,  lip_g: 0.5 },
  { nome: 'Beterraba cozida',           cat: 'carbo', kcal: 39,  prot_g: 1.5,  cho_g: 8.5,  lip_g: 0.1 },
  { nome: 'Pepino cru',                 cat: 'carbo', kcal: 10,  prot_g: 0.7,  cho_g: 1.9,  lip_g: 0.1 },
  { nome: 'Chuchu cozido',              cat: 'carbo', kcal: 21,  prot_g: 0.9,  cho_g: 4.5,  lip_g: 0.2 },
  { nome: 'Berinjela cozida',           cat: 'carbo', kcal: 24,  prot_g: 0.6,  cho_g: 5.7,  lip_g: 0.2 },
  { nome: 'Pimentão verde cru',         cat: 'carbo', kcal: 23,  prot_g: 0.9,  cho_g: 5.0,  lip_g: 0.2 },
  { nome: 'Couve manteiga crua',        cat: 'carbo', kcal: 25,  prot_g: 2.1,  cho_g: 4.6,  lip_g: 0.4 },
  // Gorduras e oleaginosas
  { nome: 'Azeite de oliva',            cat: 'carbo', kcal: 884, prot_g: 0.0,  cho_g: 0.0,  lip_g: 100.0 },
  { nome: 'Óleo de coco',               cat: 'carbo', kcal: 892, prot_g: 0.0,  cho_g: 0.0,  lip_g: 99.1 },
  { nome: 'Manteiga',                   cat: 'carbo', kcal: 726, prot_g: 0.7,  cho_g: 0.1,  lip_g: 81.0 },
  { nome: 'Amendoim torrado',           cat: 'prot',  kcal: 581, prot_g: 24.4, cho_g: 21.4, lip_g: 44.7 },
  { nome: 'Pasta de amendoim',          cat: 'prot',  kcal: 598, prot_g: 25.0, cho_g: 20.0, lip_g: 50.0 },
  { nome: 'Castanha-do-pará',           cat: 'carbo', kcal: 643, prot_g: 14.3, cho_g: 12.3, lip_g: 63.5 },
  { nome: 'Castanha de caju torrada',   cat: 'carbo', kcal: 570, prot_g: 14.0, cho_g: 29.0, lip_g: 46.0 },
  { nome: 'Amêndoas',                   cat: 'carbo', kcal: 597, prot_g: 18.7, cho_g: 19.5, lip_g: 52.5 },
  { nome: 'Nozes',                      cat: 'carbo', kcal: 650, prot_g: 14.3, cho_g: 14.0, lip_g: 62.5 },
  // Outros
  { nome: 'Mel',                        cat: 'carbo', kcal: 309, prot_g: 0.3,  cho_g: 82.4, lip_g: 0.0 },
  { nome: 'Açúcar refinado',            cat: 'carbo', kcal: 387, prot_g: 0.0,  cho_g: 99.9, lip_g: 0.0 },
  { nome: 'Chocolate meio amargo 70%',  cat: 'carbo', kcal: 566, prot_g: 8.0,  cho_g: 46.0, lip_g: 40.0 },
  { nome: 'Café preto sem açúcar',      cat: 'carbo', kcal: 2,   prot_g: 0.1,  cho_g: 0.0,  lip_g: 0.0 },
  { nome: 'Suco de laranja natural',    cat: 'carbo', kcal: 40,  prot_g: 0.7,  cho_g: 9.8,  lip_g: 0.1 },
  { nome: 'Leite de coco',              cat: 'carbo', kcal: 197, prot_g: 2.0,  cho_g: 3.3,  lip_g: 21.3 },
  { nome: 'Aipim frito',                cat: 'carbo', kcal: 209, prot_g: 0.9,  cho_g: 34.5, lip_g: 7.7 },
  { nome: 'Granola',                    cat: 'carbo', kcal: 394, prot_g: 7.6,  cho_g: 64.9, lip_g: 13.7 },
  { nome: 'Linhaça',                    cat: 'carbo', kcal: 495, prot_g: 18.3, cho_g: 28.9, lip_g: 34.4 },
  { nome: 'Chia',                       cat: 'carbo', kcal: 490, prot_g: 16.5, cho_g: 42.1, lip_g: 30.7 },
  // Pães e torradas adicionais
  { nome: 'Pão de forma branco',        cat: 'carbo', kcal: 266, prot_g: 8.0,  cho_g: 51.5, lip_g: 3.5  },
  { nome: 'Pão sírio',                  cat: 'carbo', kcal: 264, prot_g: 8.6,  cho_g: 54.2, lip_g: 1.9  },
  { nome: 'Torrada tradicional',        cat: 'carbo', kcal: 418, prot_g: 12.0, cho_g: 78.5, lip_g: 6.5  },
  { nome: 'Torrada integral',           cat: 'carbo', kcal: 396, prot_g: 12.5, cho_g: 72.0, lip_g: 7.0  },
  { nome: 'Bisnaguinha',                cat: 'carbo', kcal: 310, prot_g: 8.5,  cho_g: 55.5, lip_g: 5.8  },
  { nome: 'Pão de mel',                 cat: 'carbo', kcal: 363, prot_g: 5.0,  cho_g: 72.5, lip_g: 5.5  },
  { nome: 'Broa de milho',              cat: 'carbo', kcal: 333, prot_g: 5.5,  cho_g: 62.0, lip_g: 7.5  },
  // Cuscuz e massas adicionais
  { nome: 'Cuscuz paulista cozido',     cat: 'carbo', kcal: 165, prot_g: 6.0,  cho_g: 27.0, lip_g: 3.8  },
  { nome: 'Nhoque de batata cozido',    cat: 'carbo', kcal: 145, prot_g: 3.5,  cho_g: 28.5, lip_g: 2.3  },
  // Carnes bovinas adicionais
  { nome: 'Alcatra grelhada',           cat: 'prot',  kcal: 185, prot_g: 26.0, cho_g: 0.0,  lip_g: 9.0  },
  { nome: 'Fraldinha grelhada',         cat: 'prot',  kcal: 178, prot_g: 25.5, cho_g: 0.0,  lip_g: 8.2  },
  { nome: 'Filé mignon grelhado',       cat: 'prot',  kcal: 195, prot_g: 28.0, cho_g: 0.0,  lip_g: 8.8  },
  { nome: 'Costela bovina cozida',      cat: 'prot',  kcal: 292, prot_g: 25.0, cho_g: 0.0,  lip_g: 20.5 },
  { nome: 'Linguiça bovina grelhada',   cat: 'prot',  kcal: 250, prot_g: 14.0, cho_g: 2.5,  lip_g: 21.0 },
  // Aves adicionais
  { nome: 'Frango sobrecoxa cozida s/p',cat: 'prot',  kcal: 190, prot_g: 22.0, cho_g: 0.0,  lip_g: 11.0 },
  { nome: 'Ovo frito',                  cat: 'prot',  kcal: 196, prot_g: 13.6, cho_g: 0.5,  lip_g: 15.6 },
  { nome: 'Clara de ovo cozida',        cat: 'prot',  kcal: 52,  prot_g: 10.9, cho_g: 0.7,  lip_g: 0.2  },
  // Suínos adicionais
  { nome: 'Pernil suíno assado',        cat: 'prot',  kcal: 215, prot_g: 25.5, cho_g: 0.0,  lip_g: 12.5 },
  { nome: 'Linguiça de porco grelhada', cat: 'prot',  kcal: 345, prot_g: 16.0, cho_g: 2.5,  lip_g: 29.5 },
  { nome: 'Costela suína assada',       cat: 'prot',  kcal: 308, prot_g: 19.5, cho_g: 0.0,  lip_g: 25.5 },
  { nome: 'Presunto',                   cat: 'prot',  kcal: 145, prot_g: 18.0, cho_g: 3.5,  lip_g: 6.5  },
  { nome: 'Apresuntado',                cat: 'prot',  kcal: 130, prot_g: 14.5, cho_g: 4.5,  lip_g: 6.0  },
  // Peixes adicionais
  { nome: 'Salmão grelhado',            cat: 'prot',  kcal: 208, prot_g: 20.1, cho_g: 0.0,  lip_g: 13.5 },
  { nome: 'Merluza cozida',             cat: 'prot',  kcal: 78,  prot_g: 16.8, cho_g: 0.0,  lip_g: 1.1  },
  { nome: 'Bacalhau cozido',            cat: 'prot',  kcal: 152, prot_g: 32.8, cho_g: 0.0,  lip_g: 2.0  },
  { nome: 'Atum fresco grelhado',       cat: 'prot',  kcal: 184, prot_g: 29.9, cho_g: 0.0,  lip_g: 6.8  },
  // Laticínios adicionais
  { nome: 'Leite semidesnatado',        cat: 'prot',  kcal: 46,  prot_g: 3.3,  cho_g: 4.8,  lip_g: 1.5  },
  { nome: 'Iogurte natural desnatado',  cat: 'prot',  kcal: 50,  prot_g: 5.0,  cho_g: 6.5,  lip_g: 0.3  },
  // Queijos adicionais
  { nome: 'Queijo coalho',              cat: 'prot',  kcal: 264, prot_g: 15.0, cho_g: 1.0,  lip_g: 22.5 },
  { nome: 'Queijo ricota',              cat: 'prot',  kcal: 155, prot_g: 11.0, cho_g: 3.5,  lip_g: 11.0 },
  { nome: 'Queijo minas padrão',        cat: 'prot',  kcal: 283, prot_g: 21.0, cho_g: 3.0,  lip_g: 21.0 },
  // Legumes adicionais
  { nome: 'Couve-flor cozida',          cat: 'carbo', kcal: 23,  prot_g: 2.4,  cho_g: 3.6,  lip_g: 0.2  },
  { nome: 'Couve refogada',             cat: 'carbo', kcal: 63,  prot_g: 3.5,  cho_g: 9.5,  lip_g: 0.8  },
  { nome: 'Agrião cru',                 cat: 'carbo', kcal: 19,  prot_g: 1.7,  cho_g: 2.9,  lip_g: 0.3  },
  { nome: 'Repolho cru',                cat: 'carbo', kcal: 22,  prot_g: 1.3,  cho_g: 5.0,  lip_g: 0.1  },
  { nome: 'Acelga cozida',              cat: 'carbo', kcal: 16,  prot_g: 1.4,  cho_g: 2.4,  lip_g: 0.3  },
  { nome: 'Ervilha fresca',             cat: 'leg',   kcal: 75,  prot_g: 5.2,  cho_g: 13.7, lip_g: 0.4  },
  // Frutas adicionais
  { nome: 'Banana nanica',              cat: 'fruta', kcal: 89,  prot_g: 1.4,  cho_g: 23.1, lip_g: 0.1  },
  { nome: 'Limão',                      cat: 'fruta', kcal: 29,  prot_g: 0.9,  cho_g: 7.4,  lip_g: 0.4  },
  { nome: 'Coco fresco',                cat: 'fruta', kcal: 354, prot_g: 3.3,  cho_g: 14.3, lip_g: 33.5 },
  { nome: 'Goiaba',                     cat: 'fruta', kcal: 54,  prot_g: 1.1,  cho_g: 14.3, lip_g: 0.5  },
  { nome: 'Acerola',                    cat: 'fruta', kcal: 32,  prot_g: 0.8,  cho_g: 7.3,  lip_g: 0.2  },
  // Oleaginosas e sementes adicionais
  { nome: 'Macadâmia',                  cat: 'carbo', kcal: 718, prot_g: 7.9,  cho_g: 13.8, lip_g: 75.8 },
  { nome: 'Pistache torrado',           cat: 'carbo', kcal: 562, prot_g: 20.2, cho_g: 27.5, lip_g: 45.5 },
  { nome: 'Avelã',                      cat: 'carbo', kcal: 628, prot_g: 15.0, cho_g: 16.7, lip_g: 60.8 },
  { nome: 'Linhaça dourada',            cat: 'carbo', kcal: 495, prot_g: 18.0, cho_g: 29.0, lip_g: 34.2 },
  { nome: 'Quinoa em grão cru',         cat: 'carbo', kcal: 368, prot_g: 14.1, cho_g: 64.2, lip_g: 6.1  },
  // Bebidas adicionais
  { nome: 'Água de coco',               cat: 'carbo', kcal: 19,  prot_g: 0.7,  cho_g: 3.7,  lip_g: 0.2  },
  { nome: 'Café com leite',             cat: 'carbo', kcal: 30,  prot_g: 1.5,  cho_g: 2.5,  lip_g: 1.3  },
  // Doces e açúcares adicionais
  { nome: 'Açúcar mascavo',             cat: 'carbo', kcal: 350, prot_g: 0.7,  cho_g: 90.0, lip_g: 0.1  },
  { nome: 'Chocolate ao leite',         cat: 'carbo', kcal: 535, prot_g: 7.5,  cho_g: 59.5, lip_g: 29.0 },
  // Gorduras adicionais
  { nome: 'Óleo de soja',               cat: 'carbo', kcal: 884, prot_g: 0.0,  cho_g: 0.0,  lip_g: 100.0},
];

/* ── Tabela TBCA — USP (por 100g) ───────────────────────────── */
const TBCA_DATA = [
  // Cereais, pães e derivados
  { nome: 'Quinoa cozida',                    cat: 'carbo', kcal: 120, prot_g: 4.4,  cho_g: 21.3, lip_g: 1.9  },
  { nome: 'Amaranto cozido',                  cat: 'carbo', kcal: 102, prot_g: 3.8,  cho_g: 18.7, lip_g: 1.6  },
  { nome: 'Trigo bulgur cozido',              cat: 'carbo', kcal: 83,  prot_g: 3.1,  cho_g: 18.6, lip_g: 0.2  },
  { nome: 'Cevada em grão cozida',            cat: 'carbo', kcal: 123, prot_g: 2.3,  cho_g: 28.2, lip_g: 0.4  },
  { nome: 'Arroz parboilizado cozido',        cat: 'carbo', kcal: 133, prot_g: 2.7,  cho_g: 29.3, lip_g: 0.2  },
  { nome: 'Macarrão integral cozido',         cat: 'carbo', kcal: 142, prot_g: 6.0,  cho_g: 27.2, lip_g: 0.9  },
  { nome: 'Pão de queijo assado',             cat: 'carbo', kcal: 327, prot_g: 4.6,  cho_g: 40.6, lip_g: 16.4 },
  { nome: 'Bolo simples de fubá',             cat: 'carbo', kcal: 296, prot_g: 4.7,  cho_g: 49.9, lip_g: 9.1  },
  { nome: 'Biscoito cream cracker',           cat: 'carbo', kcal: 441, prot_g: 9.2,  cho_g: 68.4, lip_g: 15.5 },
  // Leguminosas e derivados
  { nome: 'Feijão vermelho cozido',           cat: 'leg',   kcal: 72,  prot_g: 4.6,  cho_g: 12.8, lip_g: 0.6  },
  { nome: 'Feijão-fradinho cozido',           cat: 'leg',   kcal: 78,  prot_g: 5.5,  cho_g: 14.0, lip_g: 0.5  },
  { nome: 'Feijão-de-corda cozido',           cat: 'leg',   kcal: 67,  prot_g: 4.2,  cho_g: 11.7, lip_g: 0.6  },
  { nome: 'Tofu',                             cat: 'prot',  kcal: 76,  prot_g: 8.1,  cho_g: 1.9,  lip_g: 4.2  },
  { nome: 'Edamame cozido',                   cat: 'prot',  kcal: 121, prot_g: 11.9, cho_g: 8.9,  lip_g: 5.2  },
  // Proteínas animais
  { nome: 'Carne-seca cozida desfiada',       cat: 'prot',  kcal: 188, prot_g: 33.0, cho_g: 0.0,  lip_g: 6.0  },
  { nome: 'Linguiça defumada grelhada',       cat: 'prot',  kcal: 272, prot_g: 15.0, cho_g: 3.0,  lip_g: 22.5 },
  { nome: 'Frango assado com pele',           cat: 'prot',  kcal: 215, prot_g: 24.9, cho_g: 0.0,  lip_g: 12.6 },
  { nome: 'Peru peito assado',                cat: 'prot',  kcal: 135, prot_g: 29.0, cho_g: 0.0,  lip_g: 1.7  },
  { nome: 'Polvo cozido',                     cat: 'prot',  kcal: 82,  prot_g: 14.9, cho_g: 2.2,  lip_g: 1.0  },
  { nome: 'Tambaqui assado',                  cat: 'prot',  kcal: 154, prot_g: 24.0, cho_g: 0.0,  lip_g: 6.3  },
  { nome: 'Linguado grelhado',                cat: 'prot',  kcal: 91,  prot_g: 18.8, cho_g: 0.0,  lip_g: 1.9  },
  // Laticínios
  { nome: 'Queijo prato',                     cat: 'prot',  kcal: 354, prot_g: 24.0, cho_g: 1.5,  lip_g: 28.0 },
  { nome: 'Queijo parmesão ralado',           cat: 'prot',  kcal: 392, prot_g: 35.7, cho_g: 3.2,  lip_g: 25.8 },
  { nome: 'Creme de leite 20%',              cat: 'prot',  kcal: 194, prot_g: 2.5,  cho_g: 3.0,  lip_g: 19.5 },
  { nome: 'Coalhada seca',                    cat: 'prot',  kcal: 136, prot_g: 9.5,  cho_g: 4.0,  lip_g: 9.0  },
  { nome: 'Iogurte líquido desnatado',        cat: 'prot',  kcal: 45,  prot_g: 4.0,  cho_g: 6.2,  lip_g: 0.2  },
  // Frutas
  { nome: 'Caju',                             cat: 'fruta', kcal: 43,  prot_g: 0.9,  cho_g: 10.0, lip_g: 0.3  },
  { nome: 'Açaí polpa',                       cat: 'fruta', kcal: 58,  prot_g: 1.1,  cho_g: 6.1,  lip_g: 3.3  },
  { nome: 'Cupuaçu',                          cat: 'fruta', kcal: 49,  prot_g: 1.4,  cho_g: 10.8, lip_g: 0.5  },
  { nome: 'Graviola',                         cat: 'fruta', kcal: 65,  prot_g: 1.0,  cho_g: 16.3, lip_g: 0.3  },
  { nome: 'Maracujá polpa',                   cat: 'fruta', kcal: 64,  prot_g: 2.4,  cho_g: 13.4, lip_g: 0.4  },
  { nome: 'Carambola',                        cat: 'fruta', kcal: 32,  prot_g: 0.6,  cho_g: 6.9,  lip_g: 0.3  },
  { nome: 'Nectarina',                        cat: 'fruta', kcal: 44,  prot_g: 1.1,  cho_g: 10.5, lip_g: 0.3  },
  // Verduras e legumes
  { nome: 'Quiabo cozido',                    cat: 'carbo', kcal: 33,  prot_g: 2.0,  cho_g: 5.8,  lip_g: 0.4  },
  { nome: 'Jiló cozido',                      cat: 'carbo', kcal: 23,  prot_g: 1.2,  cho_g: 4.2,  lip_g: 0.3  },
  { nome: 'Rúcula crua',                      cat: 'carbo', kcal: 25,  prot_g: 2.6,  cho_g: 3.7,  lip_g: 0.7  },
  { nome: 'Abóbora moranga cozida',           cat: 'carbo', kcal: 26,  prot_g: 0.7,  cho_g: 6.0,  lip_g: 0.1  },
  { nome: 'Cará cozido',                      cat: 'carbo', kcal: 98,  prot_g: 1.5,  cho_g: 23.0, lip_g: 0.2  },
  { nome: 'Maxixe cozido',                    cat: 'carbo', kcal: 18,  prot_g: 0.8,  cho_g: 2.6,  lip_g: 0.5  },
  // Oleaginosas e outros
  { nome: 'Gergelim',                         cat: 'carbo', kcal: 573, prot_g: 17.7, cho_g: 23.5, lip_g: 49.7 },
  { nome: 'Tahine (pasta de gergelim)',       cat: 'prot',  kcal: 595, prot_g: 17.0, cho_g: 21.2, lip_g: 53.8 },
  { nome: 'Semente de abóbora',              cat: 'carbo', kcal: 559, prot_g: 30.2, cho_g: 17.0, lip_g: 45.8 },
  { nome: 'Margarina',                        cat: 'carbo', kcal: 718, prot_g: 0.5,  cho_g: 0.5,  lip_g: 80.0 },
  { nome: 'Azeite de dendê',                  cat: 'carbo', kcal: 884, prot_g: 0.0,  cho_g: 0.0,  lip_g: 100.0},
  { nome: 'Farofa de manteiga',               cat: 'carbo', kcal: 413, prot_g: 2.5,  cho_g: 68.5, lip_g: 15.0 },
  { nome: 'Paçoca de amendoim',               cat: 'carbo', kcal: 460, prot_g: 12.0, cho_g: 58.0, lip_g: 20.0 },
  { nome: 'Brigadeiro',                       cat: 'carbo', kcal: 388, prot_g: 5.5,  cho_g: 68.5, lip_g: 10.5 },
  // Massas e preparações adicionais
  { nome: 'Yakisoba cozido',                  cat: 'carbo', kcal: 117, prot_g: 4.5,  cho_g: 16.8, lip_g: 3.5  },
  { nome: 'Lasanha de carne',                 cat: 'prot',  kcal: 155, prot_g: 8.5,  cho_g: 14.5, lip_g: 7.0  },
  // Suínos adicionais
  { nome: 'Bacon',                            cat: 'prot',  kcal: 541, prot_g: 37.0, cho_g: 1.4,  lip_g: 42.0 },
  // Queijos adicionais
  { nome: 'Queijo cheddar',                   cat: 'prot',  kcal: 404, prot_g: 25.0, cho_g: 1.3,  lip_g: 33.0 },
  { nome: 'Queijo brie',                      cat: 'prot',  kcal: 334, prot_g: 20.8, cho_g: 0.5,  lip_g: 27.7 },
  { nome: 'Queijo gorgonzola',                cat: 'prot',  kcal: 353, prot_g: 21.4, cho_g: 2.3,  lip_g: 28.7 },
  // Sementes adicionais
  { nome: 'Semente de girassol',              cat: 'carbo', kcal: 582, prot_g: 23.4, cho_g: 20.0, lip_g: 51.5 },
  { nome: 'Psyllium',                         cat: 'carbo', kcal: 37,  prot_g: 0.5,  cho_g: 8.7,  lip_g: 0.3  },
  // Bebidas vegetais adicionais
  { nome: 'Leite de aveia',                   cat: 'carbo', kcal: 47,  prot_g: 1.0,  cho_g: 8.0,  lip_g: 1.5  },
  { nome: 'Leite de amêndoas',                cat: 'carbo', kcal: 17,  prot_g: 0.6,  cho_g: 0.6,  lip_g: 1.5  },
  // Chás e bebidas
  { nome: 'Chá verde',                        cat: 'carbo', kcal: 1,   prot_g: 0.2,  cho_g: 0.2,  lip_g: 0.0  },
  { nome: 'Chá preto',                        cat: 'carbo', kcal: 1,   prot_g: 0.2,  cho_g: 0.1,  lip_g: 0.0  },
  { nome: 'Refrigerante cola',                cat: 'carbo', kcal: 39,  prot_g: 0.0,  cho_g: 10.0, lip_g: 0.0  },
  { nome: 'Refrigerante zero',                cat: 'carbo', kcal: 0,   prot_g: 0.0,  cho_g: 0.0,  lip_g: 0.0  },
  // Doces adicionais
  { nome: 'Bolo de chocolate',                cat: 'carbo', kcal: 383, prot_g: 5.0,  cho_g: 54.0, lip_g: 16.5 },
  { nome: 'Sorvete de creme',                 cat: 'carbo', kcal: 207, prot_g: 3.5,  cho_g: 23.5, lip_g: 11.5 },
  { nome: 'Gelatina',                         cat: 'carbo', kcal: 48,  prot_g: 1.5,  cho_g: 10.7, lip_g: 0.0  },
];

/* ── Tabela Tucunduva (por 100g / porção indicada) ──────────── */
const TUCUNDUVA_DATA = [
  // Nordeste
  { nome: 'Baião-de-dois',                    cat: 'carbo', kcal: 151, prot_g: 5.7,  cho_g: 25.8, lip_g: 3.2  },
  { nome: 'Carne-de-sol grelhada',            cat: 'prot',  kcal: 195, prot_g: 30.0, cho_g: 0.0,  lip_g: 8.0  },
  { nome: 'Cuscuz nordestino com queijo',     cat: 'carbo', kcal: 194, prot_g: 6.5,  cho_g: 27.3, lip_g: 6.8  },
  { nome: 'Pirão de peixe',                   cat: 'carbo', kcal: 85,  prot_g: 4.5,  cho_g: 15.5, lip_g: 1.0  },
  { nome: 'Tapioca com coco',                 cat: 'carbo', kcal: 228, prot_g: 1.5,  cho_g: 39.2, lip_g: 7.5  },
  { nome: 'Mungunzá (canjica branca)',        cat: 'carbo', kcal: 145, prot_g: 3.5,  cho_g: 27.8, lip_g: 2.5  },
  { nome: 'Canjica amarela com coco',         cat: 'carbo', kcal: 178, prot_g: 3.0,  cho_g: 32.0, lip_g: 4.5  },
  { nome: 'Sarapatel',                        cat: 'prot',  kcal: 166, prot_g: 14.0, cho_g: 5.0,  lip_g: 10.0 },
  { nome: 'Buchada de bode',                  cat: 'prot',  kcal: 142, prot_g: 16.5, cho_g: 1.5,  lip_g: 7.5  },
  // Amazônia
  { nome: 'Açaí com banana e granola (tigela)', cat: 'fruta', kcal: 157, prot_g: 2.8, cho_g: 28.5, lip_g: 4.5 },
  { nome: 'Tacacá',                           cat: 'carbo', kcal: 45,  prot_g: 3.2,  cho_g: 7.5,  lip_g: 0.5  },
  { nome: 'Tucumã',                           cat: 'fruta', kcal: 157, prot_g: 1.3,  cho_g: 24.5, lip_g: 6.0  },
  { nome: 'Pupunha cozida',                   cat: 'carbo', kcal: 167, prot_g: 3.3,  cho_g: 24.5, lip_g: 6.5  },
  { nome: 'Buriti polpa',                     cat: 'fruta', kcal: 193, prot_g: 1.5,  cho_g: 33.0, lip_g: 6.0  },
  { nome: 'Bacaba polpa',                     cat: 'fruta', kcal: 97,  prot_g: 1.2,  cho_g: 14.5, lip_g: 4.0  },
  { nome: 'Pirarucu assado',                  cat: 'prot',  kcal: 115, prot_g: 25.0, cho_g: 0.0,  lip_g: 1.5  },
  { nome: 'Filhote/Dourada grelhado',         cat: 'prot',  kcal: 109, prot_g: 22.5, cho_g: 0.0,  lip_g: 2.0  },
  { nome: 'Maniçoba',                         cat: 'leg',   kcal: 185, prot_g: 9.0,  cho_g: 12.5, lip_g: 10.5 },
  // Sul e Sudeste
  { nome: 'Feijão tropeiro',                  cat: 'carbo', kcal: 187, prot_g: 9.5,  cho_g: 22.8, lip_g: 5.5  },
  { nome: 'Tutu de feijão',                   cat: 'leg',   kcal: 148, prot_g: 6.8,  cho_g: 21.5, lip_g: 3.8  },
  { nome: 'Angu (polenta de milho)',          cat: 'carbo', kcal: 78,  prot_g: 1.8,  cho_g: 16.5, lip_g: 0.8  },
  { nome: 'Pinhão cozido',                    cat: 'carbo', kcal: 165, prot_g: 3.6,  cho_g: 35.7, lip_g: 1.0  },
  { nome: 'Quirera de milho cozida',          cat: 'carbo', kcal: 90,  prot_g: 2.0,  cho_g: 19.5, lip_g: 0.5  },
  // Bahia e outras regiões
  { nome: 'Moqueca de peixe (porção)',        cat: 'prot',  kcal: 142, prot_g: 15.5, cho_g: 5.5,  lip_g: 6.0  },
  { nome: 'Vatapá',                           cat: 'carbo', kcal: 218, prot_g: 8.5,  cho_g: 22.0, lip_g: 11.0 },
  { nome: 'Acarajé (unidade)',                cat: 'carbo', kcal: 265, prot_g: 6.0,  cho_g: 27.5, lip_g: 15.5 },
  { nome: 'Caruru',                           cat: 'carbo', kcal: 125, prot_g: 5.5,  cho_g: 12.0, lip_g: 5.5  },
  { nome: 'Xinxim de galinha',                cat: 'prot',  kcal: 173, prot_g: 16.0, cho_g: 5.5,  lip_g: 9.5  },
  // Vegetais regionais
  { nome: 'Ora-pro-nóbis refogada',           cat: 'carbo', kcal: 40,  prot_g: 3.2,  cho_g: 5.5,  lip_g: 0.8  },
  { nome: 'Taioba refogada',                  cat: 'carbo', kcal: 32,  prot_g: 2.5,  cho_g: 4.8,  lip_g: 0.5  },
  { nome: 'Vinagreira refogada',              cat: 'carbo', kcal: 22,  prot_g: 1.8,  cho_g: 3.5,  lip_g: 0.3  },
  // Doces e sobremesas típicas
  { nome: 'Cocada branca',                    cat: 'carbo', kcal: 414, prot_g: 2.8,  cho_g: 73.5, lip_g: 13.0 },
  { nome: 'Bolo de rolo',                     cat: 'carbo', kcal: 334, prot_g: 4.5,  cho_g: 55.0, lip_g: 11.5 },
  { nome: 'Quindim',                          cat: 'carbo', kcal: 318, prot_g: 5.0,  cho_g: 48.5, lip_g: 12.0 },
  { nome: 'Pé-de-moleque',                    cat: 'carbo', kcal: 480, prot_g: 11.5, cho_g: 57.0, lip_g: 23.0 },
  { nome: 'Cuscuz doce de coco',              cat: 'carbo', kcal: 218, prot_g: 2.5,  cho_g: 40.0, lip_g: 5.5  },
  { nome: 'Paçoca de rapadura',               cat: 'carbo', kcal: 415, prot_g: 10.5, cho_g: 61.0, lip_g: 15.5 },
];

/* ── Sub-componente: busca em tabela estática ─────────────────── */
function TabTabela({ dados, rotulo, onAdicionar }) {
  const [busca, setBusca] = useState('');
  const [sel, setSel]     = useState(null);
  const [qtd, setQtd]     = useState('100');

  const filtrado = busca.trim().length < 2
    ? dados
    : dados.filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()));

  const g = parseFloat(qtd);
  const preview = sel && g > 0 ? {
    kcal:   rd(sel.kcal   * g / 100, 0),
    prot_g: rd(sel.prot_g * g / 100, 1),
    cho_g:  rd(sel.cho_g  * g / 100, 1),
    lip_g:  rd(sel.lip_g  * g / 100, 1),
  } : null;

  function confirmar() {
    if (!sel || !g || g <= 0) return;
    const f = g / 100;
    onAdicionar({
      id: uid(), nome: sel.nome, qty: `${g}g`,
      kcal:   rd(sel.kcal   * f, 0),
      prot_g: rd(sel.prot_g * f, 1),
      cho_g:  rd(sel.cho_g  * f, 1),
      lip_g:  rd(sel.lip_g  * f, 1),
      subs: [], catKey: sel.cat || '',
    });
  }

  return (
    <>
      <input
        value={busca}
        onChange={e => { setBusca(e.target.value); setSel(null); }}
        placeholder={`Buscar na tabela ${rotulo}…`}
        style={{ width: '100%', fontSize: 14, marginBottom: 8 }}
        autoFocus
      />
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
        {filtrado.length} alimentos · valores por 100g ({rotulo})
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 300, overflowY: 'auto', marginBottom: 12 }}>
        {filtrado.length === 0 && (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
            Nenhum alimento encontrado.
          </div>
        )}
        {filtrado.map((al, i) => {
          const ativo = sel?.nome === al.nome;
          return (
            <div key={al.nome}>
              <button
                onClick={() => { setSel(ativo ? null : al); setQtd('100'); }}
                style={{
                  width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
                  padding: '8px 12px', background: ativo ? '#fffbf5' : 'transparent',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: ativo ? 600 : 400, color: 'var(--dark)' }}>{al.nome}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {al.kcal} kcal · {al.prot_g}g prot · {al.cho_g}g carb · {al.lip_g}g gord
                </div>
              </button>
              {ativo && (
                <div style={{ padding: '10px 12px 14px', background: '#fffbf5', borderTop: '1px solid var(--border)' }}>
                  {preview && (
                    <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                      {[
                        { l: 'kcal', v: preview.kcal },
                        { l: 'prot', v: `${preview.prot_g}g` },
                        { l: 'carb', v: `${preview.cho_g}g` },
                        { l: 'gord', v: `${preview.lip_g}g` },
                      ].map(m => (
                        <div key={m.l} style={{ textAlign: 'center', minWidth: 44 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1, color: 'var(--dark)' }}>{m.v}</div>
                          <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 2 }}>{m.l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number" min="1" max="5000" value={qtd}
                      onChange={e => setQtd(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && confirmar()}
                      style={{ width: 80, fontSize: 14, textAlign: 'center' }}
                      autoFocus
                    />
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>g</span>
                    <button className="btn" style={{ fontSize: 13 }} onClick={confirmar} disabled={!qtd || parseFloat(qtd) <= 0}>
                      Confirmar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ── Lista pronta de substituições ──────────────────────────── */
const LISTA_PRONTA_DATA = [
  { cat: 'carbo', label: 'Carboidrato', itens: [
    { nome: 'Pão de forma tradicional ou integral sem grãos',  qty: '2 fatias' },
    { nome: 'Pão francês sem miolo',                           qty: '1 unidade' },
    { nome: 'Torrada integral',                                qty: '4 unidades' },
    { nome: 'Rap10',                                           qty: '1 unidade' },
    { nome: 'Goma de tapioca',                                 qty: '45g' },
    { nome: 'Pão sírio',                                       qty: '50g' },
    { nome: 'Cuscuz já pronto',                                qty: '100g' },
    { nome: 'Pão bisnaguinha',                                 qty: '3 unidades' },
    { nome: 'Torrada Lev Magic Toast',                         qty: '7 unidades' },
    { nome: 'Arroz branco ou integral',                        qty: '100g' },
    { nome: 'Batata inglesa',                                  qty: '120g' },
    { nome: 'Aipim/mandioca',                                  qty: '100g' },
    { nome: 'Batata-doce',                                     qty: '105g' },
    { nome: 'Inhame',                                          qty: '100g' },
    { nome: 'Batata baroa/mandioquinha',                       qty: '150g' },
    { nome: 'Milho para pipoca',                               qty: '30g' },
    { nome: 'Farelo de aveia',                                 qty: '30g' },
    { nome: 'Quinoa cozida',                                   qty: '80g' },
    { nome: 'Macarrão tradicional ou integral',                qty: '100g' },
    { nome: 'Abóbora',                                         qty: '170g' },
    { nome: 'Milho',                                           qty: '120g' },
    { nome: 'Farofa',                                          qty: '25g' },
    { nome: 'Pão de hambúrguer',                               qty: '50g' },
  ]},
  { cat: 'prot', label: 'Proteína', itens: [
    { nome: 'Ovo',                                             qty: '1 unidade' },
    { nome: 'Queijo minas frescal',                            qty: '30g' },
    { nome: 'Queijo minas padrão',                             qty: '20g' },
    { nome: 'Queijo meia cura',                                qty: '20g' },
    { nome: 'Queijo curado',                                   qty: '20g' },
    { nome: 'Muçarela',                                        qty: '20g' },
    { nome: 'Ricota',                                          qty: '40g' },
    { nome: 'Muçarela de búfala',                              qty: '20g' },
    { nome: 'Queijo coalho',                                   qty: '15g' },
    { nome: 'Peito de frango',                                 qty: '100g' },
    { nome: 'Sobrecoxa sem pele',                              qty: '90g' },
    { nome: 'Fígado',                                          qty: '100g' },
    { nome: 'Moela',                                           qty: '100g' },
    { nome: 'Picanha sem gordura',                             qty: '80g' },
    { nome: 'Músculo',                                         qty: '120g' },
    { nome: 'Patinho moído',                                   qty: '100g' },
    { nome: 'Bife de alcatra',                                 qty: '100g' },
    { nome: 'Whey protein',                                    qty: '30g' },
    { nome: 'Lombo suíno',                                     qty: '100g' },
    { nome: 'Picanha suína',                                   qty: '90g' },
    { nome: 'Tilápia',                                         qty: '150g' },
    { nome: 'Salmão',                                          qty: '100g' },
    { nome: 'Filé de merluza',                                 qty: '110g' },
    { nome: 'Camarão',                                         qty: '120g' },
    { nome: 'Sardinha enlatada em água',                       qty: '105g' },
    { nome: 'Atum enlatado em água',                           qty: '100g' },
    { nome: 'Ovo de galinha',                                  qty: '2 unidades' },
  ]},
  { cat: 'prot', label: 'Proteína Líquida', itens: [
    { nome: 'Iogurte natural desnatado (somente com 2 ingredientes) — Nestlé, Batavo ou Paulista', qty: '160g' },
    { nome: 'Itambé Fit sabor morango',                        qty: '160ml' },
    { nome: 'Iogurte grego zero',                              qty: '1 unidade' },
    { nome: 'Batavo Pense Zero',                               qty: '160ml' },
    { nome: 'Leite desnatado',                                 qty: '150ml' },
    { nome: 'Leite em pó desnatado',                           qty: '2 colheres de sopa' },
  ]},
  { cat: 'fruta', label: 'Fruta', itens: [
    { nome: 'Banana prata',                                    qty: '1 unidade' },
    { nome: 'Uva',                                             qty: '15 unidades' },
    { nome: 'Morango',                                         qty: '15 unidades' },
    { nome: 'Melão',                                           qty: '300g' },
    { nome: 'Mamão',                                           qty: '150g' },
    { nome: 'Melancia',                                        qty: '350g' },
    { nome: 'Manga',                                           qty: '200g' },
    { nome: 'Maçã',                                            qty: '1 unidade' },
    { nome: 'Tangerina',                                       qty: '1 unidade' },
    { nome: 'Laranja',                                         qty: '1 unidade' },
    { nome: 'Kiwi',                                            qty: '2 unidades' },
    { nome: 'Abacate',                                         qty: '50g' },
    { nome: 'Abacaxi',                                         qty: '150g' },
    { nome: 'Pera',                                            qty: '1 unidade' },
    { nome: 'Coco seco',                                       qty: '15g' },
    { nome: 'Caqui',                                           qty: '1 unidade' },
    { nome: 'Pêssego',                                         qty: '2 unidades' },
    { nome: 'Acerola',                                         qty: '200g' },
    { nome: 'Jabuticaba',                                      qty: '200g' },
    { nome: 'Cajá',                                            qty: '200g' },
    { nome: 'Figo',                                            qty: '150g' },
    { nome: 'Goiaba',                                          qty: '200g' },
    { nome: 'Jambo',                                           qty: '300g' },
    { nome: 'Mangaba',                                         qty: '180g' },
    { nome: 'Pitaya',                                          qty: '200g' },
  ]},
  { cat: 'leg', label: 'Leguminosa', itens: [
    { nome: 'Feijão',                                          qty: '150g' },
    { nome: 'Lentilha',                                        qty: '150g' },
    { nome: 'Soja',                                            qty: '75g' },
    { nome: 'Grão-de-bico',                                    qty: '75g' },
  ]},
  { cat: 'bebida', label: 'Bebida', itens: [
    { nome: 'Café puro',                                       qty: '' },
    { nome: 'Café com adoçante',                               qty: '' },
    { nome: 'Suco de limão com adoçante',                      qty: '' },
    { nome: 'Suco de morango com adoçante',                    qty: '' },
    { nome: 'Suco de melancia com adoçante',                   qty: '' },
    { nome: 'Suco de acerola com adoçante',                    qty: '' },
    { nome: 'Suco de maracujá com adoçante',                   qty: '' },
  ]},
];

/* ── Modal: adicionar alimento ou substituto ────────────────── */
function ModalAlimento({ isSub, nutriId, onConfirm, onConfirmMulti, onFechar }) {
  const [tab, setTab]           = useState(isSub ? 'lista' : 'taco');
  const [listaSel, setListaSel] = useState(new Map()); // key → qty editável
  const [manual, setManual]     = useState({ nome: '', qty: '', kcal: '', prot_g: '', cho_g: '', lip_g: '' });
  const [salvos, setSalvos]     = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroManual, setErroManual] = useState(null);

  useEffect(() => {
    if ((tab !== 'manual' && tab !== 'meus') || !nutriId) return;
    supabase.from('alimentos_personalizados')
      .select('*').eq('nutri_id', nutriId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setSalvos(data ?? []));
  }, [tab, nutriId]);

  async function salvarManual() {
    if (!manual.nome.trim()) return;
    setSalvando(true); setErroManual(null);
    const n = v => parseFloat(v) || null;
    const item = {
      nutri_id: nutriId,
      nome:     manual.nome.trim(),
      qty:      manual.qty.trim() || '',
      kcal:     n(manual.kcal),
      prot_g:   n(manual.prot_g),
      cho_g:    n(manual.cho_g),
      lip_g:    n(manual.lip_g),
    };
    const { data, error } = await supabase.from('alimentos_personalizados').insert(item).select().single();
    setSalvando(false);
    if (error) { setErroManual(error.message); return; }
    if (data) setSalvos(prev => [data, ...prev]);
    onConfirm({ id: uid(), nome: item.nome, qty: item.qty || '—', kcal: item.kcal, prot_g: item.prot_g, cho_g: item.cho_g, lip_g: item.lip_g, subs: [], catKey: '' });
  }

  async function atualizarSalvo() {
    if (!editandoId) return;
    const n = v => parseFloat(v) || null;
    const upd = { nome: editForm.nome?.trim() || '', qty: editForm.qty?.trim() || '', kcal: n(editForm.kcal), prot_g: n(editForm.prot_g), cho_g: n(editForm.cho_g), lip_g: n(editForm.lip_g) };
    await supabase.from('alimentos_personalizados').update(upd).eq('id', editandoId);
    setSalvos(prev => prev.map(s => s.id === editandoId ? { ...s, ...upd } : s));
    setEditandoId(null);
  }

  async function excluirSalvo(id) {
    await supabase.from('alimentos_personalizados').delete().eq('id', id);
    setSalvos(prev => prev.filter(s => s.id !== id));
  }

  function toggleLista(key, defaultQty) {
    setListaSel(prev => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key); else next.set(key, defaultQty);
      return next;
    });
  }

  function setListaQty(key, qty) {
    setListaSel(prev => {
      const next = new Map(prev);
      next.set(key, qty);
      return next;
    });
  }

  function confirmarLista() {
    const selecionados = [];
    for (const cat of LISTA_PRONTA_DATA) {
      for (const item of cat.itens) {
        const key = `${cat.cat}::${item.nome}`;
        if (listaSel.has(key)) {
          const qty = listaSel.get(key) ?? item.qty;
          selecionados.push({ id: uid(), nome: item.nome, qty: qty || '', kcal: null, prot_g: null, cho_g: null, lip_g: null, subs: [], catKey: cat.cat });
        }
      }
    }
    if (!selecionados.length) return;
    onConfirmMulti(selecionados);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onFechar()}
    >
      <div style={{ background: 'var(--white)', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,.25)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: 'var(--dark)' }}>
            {isSub ? 'Adicionar substituto' : 'Adicionar alimento'}
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', padding: '10px 20px 0', borderBottom: '1px solid var(--border)', marginTop: 6, overflowX: 'auto' }}>
          {(isSub
            ? [['lista', 'Lista pronta'], ['meus', 'Meus alimentos'], ['taco', 'TACO'], ['tbca', 'TBCA (USP)'], ['tucunduva', 'Tucunduva'], ['manual', 'Digitar']]
            : [['meus', 'Meus alimentos'], ['taco', 'TACO'], ['tbca', 'TBCA (USP)'], ['tucunduva', 'Tucunduva'], ['manual', 'Digitar']]
          ).map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '7px 12px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
              background: 'none', color: tab === id ? 'var(--dark)' : 'var(--text3)',
              borderBottom: tab === id ? '2px solid var(--green)' : '2px solid transparent',
              marginBottom: -1,
            }}>{lbl}</button>
          ))}
        </div>

        {/* Corpo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {/* ── Lista pronta ── */}
          {tab === 'lista' && (
            <>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
                Selecione os substitutos — edite a quantidade se necessário — e clique em "Adicionar selecionados".
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {LISTA_PRONTA_DATA.map(cat => (
                  <div key={`${cat.cat}::${cat.label}`}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--terra)', marginBottom: 8 }}>
                      {cat.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {cat.itens.map(item => {
                        const key = `${cat.cat}::${item.nome}`;
                        const checked = listaSel.has(key);
                        const qty = checked ? (listaSel.get(key) ?? item.qty) : item.qty;
                        return (
                          <div
                            key={key}
                            onClick={() => toggleLista(key, item.qty)}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                              border: `1px solid ${checked ? 'var(--green)' : 'var(--border)'}`,
                              background: checked ? '#f5fbf0' : '#fafafa',
                              transition: 'all .12s',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLista(key, item.qty)}
                              onClick={e => e.stopPropagation()}
                              style={{ width: 17, height: 17, marginTop: 2, accentColor: 'var(--verde)', flexShrink: 0, cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', lineHeight: 1.4 }}>{item.nome}</div>
                              {checked ? (
                                <input
                                  value={qty}
                                  onChange={e => setListaQty(key, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  placeholder="Quantidade"
                                  style={{ marginTop: 5, fontSize: 12, width: '100%', maxWidth: 200 }}
                                />
                              ) : (
                                item.qty
                                  ? <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{item.qty}</div>
                                  : null
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: 'sticky', bottom: 0, background: 'var(--white)', paddingTop: 14, marginTop: 14, borderTop: '1px solid var(--border)' }}>
                <button className="btn" style={{ width: '100%', fontSize: 14 }} onClick={confirmarLista} disabled={listaSel.size === 0}>
                  Adicionar selecionados {listaSel.size > 0 ? `(${listaSel.size})` : ''}
                </button>
              </div>
            </>
          )}

          {/* ── TACO ── */}
          {tab === 'taco' && <TabTabela dados={TACO_DATA} rotulo="TACO" onAdicionar={onConfirm} />}

          {/* ── TBCA ── */}
          {tab === 'tbca' && <TabTabela dados={TBCA_DATA} rotulo="TBCA (USP)" onAdicionar={onConfirm} />}

          {/* ── Tucunduva ── */}
          {tab === 'tucunduva' && <TabTabela dados={TUCUNDUVA_DATA} rotulo="Tucunduva" onAdicionar={onConfirm} />}

          {/* ── Meus alimentos ── */}
          {tab === 'meus' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {salvos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>Nenhum alimento cadastrado ainda.</div>
                  <div style={{ fontSize: 12 }}>Use a aba <strong>Digitar</strong> para criar e salvar alimentos personalizados.</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
                    {salvos.length} alimento{salvos.length !== 1 ? 's' : ''} — clique para adicionar ao plano
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {salvos.map(s => (
                      <div key={s.id}>
                        {editandoId === s.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: '#fffbf5', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                              <div>
                                <label className="field-label">Nome</label>
                                <input value={editForm.nome ?? ''} onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))} autoFocus />
                              </div>
                              <div>
                                <label className="field-label">Quantidade</label>
                                <input value={editForm.qty ?? ''} onChange={e => setEditForm(p => ({ ...p, qty: e.target.value }))} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                              {[['kcal','Kcal'],['prot_g','Prot'],['cho_g','Carb'],['lip_g','Gord']].map(([k, lbl]) => (
                                <div key={k}>
                                  <label className="field-label">{lbl}</label>
                                  <input inputMode="decimal" value={editForm[k] ?? ''} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} />
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn" style={{ fontSize: 11, padding: '5px 12px' }} onClick={atualizarSalvo}>Salvar</button>
                              <button className="btn-outline" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setEditandoId(null)}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 6, border: '1px solid var(--border)', background: '#fafafa' }}>
                            <button
                              onClick={() => onConfirm({ id: uid(), nome: s.nome, qty: s.qty || '—', kcal: s.kcal, prot_g: s.prot_g, cho_g: s.cho_g, lip_g: s.lip_g, subs: [], catKey: '' })}
                              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <div style={{ fontSize: 13, color: 'var(--dark)', fontWeight: 500 }}>{s.nome}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
                                {[s.qty, s.kcal != null && `${s.kcal} kcal`, s.prot_g != null && `P:${s.prot_g}g`, s.cho_g != null && `C:${s.cho_g}g`, s.lip_g != null && `G:${s.lip_g}g`].filter(Boolean).join(' · ')}
                              </div>
                            </button>
                            <button title="Editar" onClick={() => { setEditandoId(s.id); setEditForm({ nome: s.nome, qty: s.qty ?? '', kcal: s.kcal ?? '', prot_g: s.prot_g ?? '', cho_g: s.cho_g ?? '', lip_g: s.lip_g ?? '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', fontSize: 13 }}>
                              <i className="ti ti-pencil" aria-hidden="true" />
                            </button>
                            <button title="Excluir" onClick={() => excluirSalvo(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', fontSize: 13 }}>
                              <i className="ti ti-trash" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Digitar manualmente ── */}
          {tab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Alimentos já cadastrados */}
              {salvos.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--terra)', marginBottom: 8 }}>
                    Alimentos cadastrados — clique para usar
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 210, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 4 }}>
                    {salvos.map(s => (
                      <div key={s.id}>
                        {editandoId === s.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: '#fffbf5', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                              <div>
                                <label className="field-label">Nome</label>
                                <input value={editForm.nome ?? ''} onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))} autoFocus />
                              </div>
                              <div>
                                <label className="field-label">Quantidade</label>
                                <input value={editForm.qty ?? ''} onChange={e => setEditForm(p => ({ ...p, qty: e.target.value }))} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                              {[['kcal','Kcal'],['prot_g','Prot'],['cho_g','Carb'],['lip_g','Gord']].map(([k, lbl]) => (
                                <div key={k}>
                                  <label className="field-label">{lbl}</label>
                                  <input inputMode="decimal" value={editForm[k] ?? ''} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} />
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn" style={{ fontSize: 11, padding: '5px 12px' }} onClick={atualizarSalvo}>Salvar</button>
                              <button className="btn-outline" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setEditandoId(null)}>Cancelar</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 6px', borderRadius: 5 }}>
                            <button
                              onClick={() => onConfirm({ id: uid(), nome: s.nome, qty: s.qty || '—', kcal: s.kcal, prot_g: s.prot_g, cho_g: s.cho_g, lip_g: s.lip_g, subs: [], catKey: '' })}
                              style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <div style={{ fontSize: 13, color: 'var(--dark)', fontWeight: 500 }}>{s.nome}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                                {[s.qty, s.kcal != null && `${s.kcal} kcal`, s.prot_g != null && `P:${s.prot_g}g`, s.cho_g != null && `C:${s.cho_g}g`, s.lip_g != null && `G:${s.lip_g}g`].filter(Boolean).join(' · ')}
                              </div>
                            </button>
                            <button title="Editar" onClick={() => { setEditandoId(s.id); setEditForm({ nome: s.nome, qty: s.qty ?? '', kcal: s.kcal ?? '', prot_g: s.prot_g ?? '', cho_g: s.cho_g ?? '', lip_g: s.lip_g ?? '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', fontSize: 13 }}>
                              <i className="ti ti-pencil" aria-hidden="true" />
                            </button>
                            <button title="Excluir" onClick={() => excluirSalvo(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text3)', fontSize: 13 }}>
                              <i className="ti ti-trash" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Novo alimento */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--terra)', marginBottom: 8 }}>
                  {salvos.length > 0 ? 'Novo alimento' : 'Cadastrar alimento'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label className="field-label">Nome *</label>
                    <input value={manual.nome} onChange={e => setManual(p => ({ ...p, nome: e.target.value }))} placeholder="ex: Banana prata" autoFocus />
                  </div>
                  <div>
                    <label className="field-label">Quantidade</label>
                    <input value={manual.qty} onChange={e => setManual(p => ({ ...p, qty: e.target.value }))} placeholder="ex: 1 unidade / 70g" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
                  {[['kcal','Kcal'],['prot_g','Prot (g)'],['cho_g','Carb (g)'],['lip_g','Gord (g)']].map(([k, lbl]) => (
                    <div key={k}>
                      <label className="field-label">{lbl}</label>
                      <input inputMode="decimal" value={manual[k]} onChange={e => setManual(p => ({ ...p, [k]: e.target.value }))} placeholder="0" />
                    </div>
                  ))}
                </div>
                {erroManual && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{erroManual}</div>}
                <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={salvarManual} disabled={salvando || !manual.nome.trim()}>
                  <i className="ti ti-plus" aria-hidden="true" /> {salvando ? 'Salvando…' : 'Salvar e adicionar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Cabeçalho de coluna da tabela ──────────────────────────── */
const TH = ({ children }) => (
  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
    {children}
  </th>
);

/* ── Geração automática de lista de compras ─────────────────── */
const _LC_CATS = [
  { id: 'hortifruti', label: 'Hortifruti',
    kw: ['banana','maca','laranja','abacaxi','morango','uva','melao','manga','mamao','melancia','kiwi','pera','abacate','cenoura','brocolis','abobrinha','espinafre','alface','tomate','beterraba','pepino','chuchu','couve','pimentao','berinjela','batata','inhame','mandioca','aipim','milho','abobora','mandioquinha','tangerina','caqui','pessego','acerola','jabuticaba','goiaba','pitaya','coco','figo','caja','mangaba','jambo','fruta'] },
  { id: 'proteinas', label: 'Proteínas',
    kw: ['frango','carne','peixe','atum','sardinha','salmao','tilapia','ovo','whey','lombo','picanha','patinho','alcatra','musculo','figado','moela','camarao','merluza','sobrecoxa','peito'] },
  { id: 'graos', label: 'Grãos e Cereais',
    kw: ['arroz','aveia','macarrao','quinoa','cuscuz','tapioca','farinha','farelo','pao','torrada','rap10','bisnaga','hamburguer','pipoca','granola','chia','linhaca','feijao','lentilha','grao','ervilha','soja'] },
  { id: 'laticinios', label: 'Laticínios',
    kw: ['leite','iogurte','queijo','ricota','requeijao','manteiga','mucarela','mussarela','bufala','coalho','cottage','minas'] },
  { id: 'mercearia', label: 'Mercearia e Temperos', kw: [] },
  { id: 'outros',    label: 'Outros',               kw: [] },
];
const _TEMPEROS = ['Sal','Azeite de oliva','Alho','Cebola','Limão','Salsinha','Cebolinha','Pimenta-do-reino','Açafrão/Cúrcuma','Orégano','Vinagre'];

function _lcNorm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,' ').trim();
}
function _lcCat(nome) {
  const n = _lcNorm(nome);
  for (const c of _LC_CATS.slice(0, 4)) {
    if (c.kw.some(kw => n.includes(kw))) return c.id;
  }
  return 'outros';
}
function _lcLimpar(nome) {
  return nome.replace(/\s+\d+(?:[.,]\d+)?\s*(?:g|ml|kg|l|mg)\s*$/i,'').trim();
}

function gerarListaCompras(refeicoes) {
  const porCat = Object.fromEntries(_LC_CATS.map(c => [c.id, new Set()]));
  for (const t of _TEMPEROS) porCat.mercearia.add(t);
  for (const ref of refeicoes) {
    for (const al of ref.alimentos ?? []) {
      const nomes = [al.nome, ...(al.subs ?? []).map(s => s.nome)].filter(Boolean);
      for (const nome of nomes) {
        const limpo = _lcLimpar(nome);
        if (limpo) porCat[_lcCat(limpo)].add(limpo);
      }
    }
  }
  return {
    lista: _LC_CATS
      .map(c => ({ categoria: c.label, itens: [...porCat[c.id]] }))
      .filter(c => c.itens.length > 0),
  };
}

/* ── Componente principal ───────────────────────────────────── */
function _calcIdade(nascimento) {
  if (!nascimento) return null;
  const n = new Date(nascimento + 'T12:00:00');
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

export default function PlanoBuilder({ pacienteId, nutriId, pacienteNome, paciente, onLiberar }) {
  const DRAFT_KEY  = `plano_rascunho_${pacienteId}`;
  const ORIENT_KEY = `plano_orientacoes_${pacienteId}`;
  const DADOS_KEY  = `plano_dados_pdf_${pacienteId}`;

  const [refeicoes, setRefeicoes] = useState(() => {
    try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [orientacoes, setOrientacoes] = useState(() => {
    const base = { prioridades: '', metas: '', suplementacao: '', consulta_n: '', agua_diaria: '' };
    try {
      const s = localStorage.getItem(`plano_orientacoes_${pacienteId}`);
      return s ? { ...base, ...JSON.parse(s) } : base;
    } catch { return base; }
  });
  const [modal, setModal]         = useState(null); // { refId, alimentoId: string|null }
  const [publicando, setPublicando] = useState(false);
  const [feedback, setFeedback]   = useState(null);
  const [nutriInfo, setNutriInfo] = useState({ nome: '', crn: '', email: '' });
  const [pesoInfo, setPesoInfo]   = useState({ kg: null, altura_cm: null, pgc: null, cintura_cm: null, quadril_cm: null });
  const [pacienteDadosPdf, setPacienteDadosPdf] = useState(() => {
    const idadeAuto = _calcIdade(paciente?.nascimento);
    const auto = {
      nome:       paciente?.nome ?? '',
      idade:      idadeAuto != null ? String(idadeAuto) : '',
      objetivo:   paciente?.objetivo ?? '',
      peso_kg: '', altura_cm: '', cintura_cm: '', quadril_cm: '',
    };
    try {
      const saved = localStorage.getItem(`plano_dados_pdf_${pacienteId}`);
      if (saved) return { ...auto, ...JSON.parse(saved) };
    } catch {}
    return auto;
  });
  const [draft, setDraft]         = useState('salvo'); // 'salvo' | 'salvando'
  const [previaTab, setPreviaTab] = useState('app');
  const draftTimer                = useRef(null);
  const [imagensPorRef, setImagensPorRef] = useState({}); // { [refId]: [{id, url, path, ordem}] }
  const [uploadandoRef, setUploadandoRef] = useState(null);
  const fileInputsRef             = useRef({});

  /* Carrega info da nutri para o PDF */
  useEffect(() => {
    supabase.from('nutris').select('nome, crn, email').eq('id', nutriId).maybeSingle()
      .then(({ data }) => { if (data) setNutriInfo(data); });
  }, [nutriId]);

  /* Carrega peso e altura mais recentes para o PDF */
  useEffect(() => {
    supabase.from('peso_registros').select('kg, altura_cm, pgc, cintura_cm, quadril_cm')
      .eq('paciente_id', pacienteId)
      .order('data', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPesoInfo({ kg: data.kg, altura_cm: data.altura_cm, pgc: data.pgc, cintura_cm: data.cintura_cm, quadril_cm: data.quadril_cm });
          setPacienteDadosPdf(prev => ({
            ...prev,
            ...(prev.peso_kg    === '' && data.kg != null         ? { peso_kg:    String(data.kg)         } : {}),
            ...(prev.altura_cm  === '' && data.altura_cm != null  ? { altura_cm:  String(data.altura_cm)  } : {}),
            ...(prev.cintura_cm === '' && data.cintura_cm != null ? { cintura_cm: String(data.cintura_cm) } : {}),
            ...(prev.quadril_cm === '' && data.quadril_cm != null ? { quadril_cm: String(data.quadril_cm) } : {}),
          }));
        }
      });
  }, [pacienteId]);

  /* Auto-save orientações no localStorage */
  useEffect(() => {
    try { localStorage.setItem(ORIENT_KEY, JSON.stringify(orientacoes)); } catch {}
  }, [orientacoes, ORIENT_KEY]);

  /* Auto-save dados do PDF no localStorage */
  useEffect(() => {
    try { localStorage.setItem(DADOS_KEY, JSON.stringify(pacienteDadosPdf)); } catch {}
  }, [pacienteDadosPdf, DADOS_KEY]);

  /* Carrega orientações do último plano publicado se o localStorage estiver vazio */
  useEffect(() => {
    if (Object.values(orientacoes).some(v => v)) return;
    supabase.from('planos').select('dados')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => {
        const o = data?.dados?.orientacoes;
        if (o?.prioridades || o?.metas || o?.suplementacao) setOrientacoes(prev => ({ ...prev, ...o }));
      });
  }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Carrega o último plano publicado do Supabase quando não há rascunho local
     (ex.: a nutri abre o plano em outro dispositivo, onde o localStorage está vazio) */
  useEffect(() => {
    async function carregarDoSupabase() {
      if (!pacienteId) return;

      // Verifica se localStorage tem refeições reais (não array vazio)
      const localDraft = (() => {
        try {
          const s = localStorage.getItem(DRAFT_KEY);
          if (!s) return null;
          const parsed = JSON.parse(s);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch { return null; }
      })();

      if (localDraft) {
        setRefeicoes(localDraft);
        return;
      }

      // localStorage vazio — busca do Supabase (planos + planos_visuais em paralelo)
      const [{ data, error }, { data: visual }] = await Promise.all([
        supabase
          .from('planos')
          .select('dados')
          .eq('paciente_id', pacienteId)
          .eq('nutri_id', nutriId)
          .order('publicado_em', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('planos_visuais')
          .select('dados')
          .eq('paciente_id', pacienteId)
          .eq('nutri_id', nutriId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (error) console.error('[PlanoBuilder] erro Supabase:', error);
      console.log('[PlanoBuilder] dados completos:', JSON.stringify(data?.dados, null, 2));

      if (data?.dados?.refeicoes?.length) {
        let refs = data.dados.refeicoes; // subs devem estar aqui

        // Compatibilidade com planos antigos: se nenhum alimento tem subs,
        // tenta reconstruir a partir do texto salvo em dados.subs_texto
        const temSubs = refs.some(r => r.alimentos?.some(a => a.subs?.length));
        console.log('[subs check] temSubs:', temSubs, 'primeiro alimento subs:', data?.dados?.refeicoes?.[0]?.alimentos?.[0]?.subs);
        const subsTexto = data.dados.subs_texto || data.dados.subsTexto;
        if (!temSubs && subsTexto) {
          refs = refs.map(r => {
            const mk = normMealKey(r.nome);
            const grupo = subsTexto[mk];
            if (!grupo) return r;
            return {
              ...r,
              alimentos: r.alimentos.map(a => {
                if (a.subs?.length) return a;
                const ck = a.catKey || guessCatKey(a);
                const texto = grupo[ck];
                if (!texto) return a;
                const partes = texto.split(' · ').slice(1); // ignora o próprio alimento
                if (!partes.length) return a;
                const subs = partes.map(p => {
                  const m = p.match(/^(.*?)\s+([\d.,]+\s*\S*)$/);
                  return { id: uid(), nome: m ? m[1].trim() : p.trim(), qty: m ? m[2].trim() : '' };
                });
                return { ...a, subs };
              }),
            };
          });
        }

        setRefeicoes(refs);
      }
      if (data?.dados?.orientacoes) {
        setOrientacoes(prev => ({ ...prev, ...data.dados.orientacoes }));
      }

      // Refeições completas com subs de planos_visuais (fonte mais confiável)
      if (visual?.dados?.refeicoes?.length) {
        const temSubs = visual.dados.refeicoes.some(r => r.alimentos?.some(a => a.subs?.length));
        if (temSubs) {
          setRefeicoes(visual.dados.refeicoes);
        }
      }

      // Restaura dados da capa do PDF — ficam em planos_visuais.dados.paciente_dados
      if (visual?.dados?.paciente_dados) {
        const pd = visual.dados.paciente_dados;
        setPacienteDadosPdf(prev => ({
          ...prev,
          nome:       pd.nome       || prev.nome,
          idade:      pd.idade      ? String(pd.idade)      : prev.idade,
          peso_kg:    pd.peso_kg    ? String(pd.peso_kg)    : prev.peso_kg,
          altura_cm:  pd.altura_cm  ? String(pd.altura_cm)  : prev.altura_cm,
          cintura_cm: pd.cintura_cm ? String(pd.cintura_cm) : prev.cintura_cm,
          quadril_cm: pd.quadril_cm ? String(pd.quadril_cm) : prev.quadril_cm,
          objetivo:   pd.objetivo   || prev.objetivo,
        }));
      }

      // Restaura orientações de planos_visuais (prioridades, metas, etc)
      if (visual?.dados?.prioridades || visual?.dados?.metas) {
        setOrientacoes(prev => ({
          ...prev,
          prioridades:  visual.dados.prioridades  || prev.prioridades,
          metas:        visual.dados.metas         || prev.metas,
          suplementacao: visual.dados.suplementos  || prev.suplementacao,
          consulta_n:   visual.dados.consulta_n   || prev.consulta_n,
          agua_diaria:  visual.dados.agua_diaria  || prev.agua_diaria,
        }));
      }
    }
    carregarDoSupabase();
  }, [pacienteId, nutriId, DRAFT_KEY]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Carrega imagens das refeições do Supabase */
  useEffect(() => {
    if (!nutriId || !pacienteId) return;
    supabase.from('refeicao_imagens')
      .select('*')
      .eq('nutri_id', nutriId)
      .eq('paciente_id', pacienteId)
      .order('ordem')
      .then(({ data }) => {
        if (!data?.length) return;
        const grouped = {};
        for (const img of data) {
          if (!grouped[img.refeicao_id]) grouped[img.refeicao_id] = [];
          grouped[img.refeicao_id].push(img);
        }
        setImagensPorRef(grouped);
      });
  }, [nutriId, pacienteId]);

  /* Auto-save rascunho (debounce 2s) */
  useEffect(() => {
    setDraft('salvando');
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(refeicoes)); } catch {}
      setDraft('salvo');
    }, 2000);
    return () => clearTimeout(draftTimer.current);
  }, [refeicoes, DRAFT_KEY]);

  /* ── Handlers de imagem ──────────────────────────────────── */
  async function adicionarImagem(refId, file) {
    if (!file || uploadandoRef) return;
    setUploadandoRef(refId);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { setUploadandoRef(null); alert('Sessão expirada. Faça login novamente.'); return; }
    const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${currentUser.id}/${pacienteId}/${refId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('plano-imagens').upload(path, file, { upsert: false });
    if (upErr) { setUploadandoRef(null); alert('Erro ao enviar imagem: ' + upErr.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('plano-imagens').getPublicUrl(path);
    const ordem = imagensPorRef[refId]?.length ?? 0;
    const { data: inserted, error: insErr } = await supabase.from('refeicao_imagens').insert({
      refeicao_id: refId, nutri_id: currentUser.id, paciente_id: pacienteId,
      url: publicUrl, path, ordem,
    }).select().single();
    setUploadandoRef(null);
    if (insErr || !inserted) return;
    setImagensPorRef(prev => ({ ...prev, [refId]: [...(prev[refId] ?? []), inserted] }));
  }

  async function removerImagem(refId, imgId, imgPath) {
    await supabase.storage.from('plano-imagens').remove([imgPath]);
    await supabase.from('refeicao_imagens').delete().eq('id', imgId);
    setImagensPorRef(prev => ({ ...prev, [refId]: (prev[refId] ?? []).filter(i => i.id !== imgId) }));
  }

  /* ── Handlers de refeição ─────────────────────────────────── */
  function adicionarRefeicao() {
    const sug = SUGESTOES[refeicoes.length] ?? { nome: '', horario: '' };
    setRefeicoes(prev => [...prev, { id: uid(), nome: sug.nome, horario: sug.horario, alimentos: [], obs: '' }]);
  }

  function removerRefeicao(refId) {
    if (!window.confirm('Remover esta refeição?')) return;
    setRefeicoes(prev => prev.filter(r => r.id !== refId));
  }

  function setRefField(refId, field, val) {
    setRefeicoes(prev => prev.map(r => r.id === refId ? { ...r, [field]: val } : r));
  }

  /* ── Handlers de alimento ────────────────────────────────── */
  function adicionarAlimento(refId, alimento) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId ? { ...r, alimentos: [...r.alimentos, alimento] } : r
    ));
  }

  function removerAlimento(refId, alId) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId ? { ...r, alimentos: r.alimentos.filter(a => a.id !== alId) } : r
    ));
  }

  function setCatKey(refId, alId, catKey) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId
        ? { ...r, alimentos: r.alimentos.map(a => a.id === alId ? { ...a, catKey } : a) }
        : r
    ));
  }

  /* ── Handlers de substituto ──────────────────────────────── */
  function adicionarSub(refId, alId, sub) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId
        ? { ...r, alimentos: r.alimentos.map(a =>
            a.id === alId ? { ...a, subs: [...(a.subs ?? []), { ...sub, id: uid() }] } : a
          )}
        : r
    ));
  }

  function removerSub(refId, alId, subId) {
    setRefeicoes(prev => prev.map(r =>
      r.id === refId
        ? { ...r, alimentos: r.alimentos.map(a =>
            a.id === alId ? { ...a, subs: a.subs.filter(s => s.id !== subId) } : a
          )}
        : r
    ));
  }

  /* ── Modal confirm ───────────────────────────────────────── */
  function handleConfirm(alimento) {
    if (!modal) return;
    if (modal.alimentoId) adicionarSub(modal.refId, modal.alimentoId, alimento);
    else adicionarAlimento(modal.refId, alimento);
    setModal(null);
  }

  function handleConfirmMulti(alimentos) {
    if (!modal?.alimentoId) return;
    setRefeicoes(prev => prev.map(r =>
      r.id === modal.refId
        ? { ...r, alimentos: r.alimentos.map(a =>
            a.id === modal.alimentoId
              ? { ...a, subs: [...(a.subs ?? []), ...alimentos.map(al => ({ ...al, id: uid() }))] }
              : a
          )}
        : r
    ));
    setModal(null);
  }

  /* ── Totais ──────────────────────────────────────────────── */
  const totDia = refeicoes.reduce((acc, ref) => {
    const t = somaAlimentos(ref.alimentos);
    return { kcal: acc.kcal + t.kcal, prot_g: acc.prot_g + t.prot_g, cho_g: acc.cho_g + t.cho_g, lip_g: acc.lip_g + t.lip_g };
  }, { kcal: 0, prot_g: 0, cho_g: 0, lip_g: 0 });

  const temAlimentos = refeicoes.some(r => r.alimentos.length > 0);

  const pdfHtml = useMemo(() => {
    if (!temAlimentos) return '';
    const n = v => parseFloat(v) || null;
    const pacienteDados = {
      nome:       pacienteDadosPdf.nome.trim() || pacienteNome,
      idade:      parseInt(pacienteDadosPdf.idade) || null,
      peso_kg:    n(pacienteDadosPdf.peso_kg),
      altura_cm:  n(pacienteDadosPdf.altura_cm),
      pgc:        null,
      cintura_cm: n(pacienteDadosPdf.cintura_cm),
      quadril_cm: n(pacienteDadosPdf.quadril_cm),
      objetivo:   pacienteDadosPdf.objetivo.trim() || null,
    };
    const imagensPorRefId = Object.fromEntries(
      Object.entries(imagensPorRef).map(([k, imgs]) => [k, imgs.map(i => i.url)])
    );
    return gerarPlanoHtml({
      pacienteNome,
      plano:      buildPlano(),
      extras:     { prioridades: orientacoes.prioridades, metas: orientacoes.metas, suplementos: orientacoes.suplementacao, consulta_n: orientacoes.consulta_n, agua_diaria: orientacoes.agua_diaria },
      subsTexto:  buildSubsTexto(refeicoes),
      nutriNome:  nutriInfo.nome,
      nutriCrn:   nutriInfo.crn,
      nutriEmail: nutriInfo.email,
      pacienteDados,
      imagensPorRefId,
    });
  }, [temAlimentos, refeicoes, orientacoes, nutriInfo, pacienteDadosPdf, pacienteNome, imagensPorRef]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Constrói objeto plano para salvar/PDF ───────────────── */
  function buildPlano() {
    const refs = refeicoes
      .filter(r => r.alimentos.length > 0)
      .map(r => {
        const tot = somaAlimentos(r.alimentos);
        return {
          id:        r.id,
          nome:      r.nome,
          horario:   r.horario,
          kcal:      rd(tot.kcal, 0),
          prot_g:    rd(tot.prot_g, 1),
          cho_g:     rd(tot.cho_g, 1),
          lip_g:     rd(tot.lip_g, 1),
          alimentos: r.alimentos.map(a => ({
            nome: a.nome, qty: a.qty, kcal: a.kcal, prot_g: a.prot_g, cho_g: a.cho_g, lip_g: a.lip_g, catKey: a.catKey || '',
            subs: (a.subs ?? []).map(s => ({ id: s.id, nome: s.nome, qty: s.qty, kcal: s.kcal, prot_g: s.prot_g, cho_g: s.cho_g, lip_g: s.lip_g })),
          })),
          obs: r.obs?.trim() || '',
        };
      });
    return {
      macros: { kcal: rd(totDia.kcal, 0), prot_g: rd(totDia.prot_g, 1), cho_g: rd(totDia.cho_g, 1), lip_g: rd(totDia.lip_g, 1) },
      refeicoes: refs,
      orientacoes,
    };
  }

  /* ── Gerar PDF ───────────────────────────────────────────── */
  function gerarPdf() {
    if (!temAlimentos) return;
    const n = v => parseFloat(v) || null;
    const pacienteDados = {
      nome:       pacienteDadosPdf.nome.trim() || pacienteNome,
      idade:      parseInt(pacienteDadosPdf.idade) || null,
      peso_kg:    n(pacienteDadosPdf.peso_kg),
      altura_cm:  n(pacienteDadosPdf.altura_cm),
      pgc:        null,
      cintura_cm: n(pacienteDadosPdf.cintura_cm),
      quadril_cm: n(pacienteDadosPdf.quadril_cm),
      objetivo:   pacienteDadosPdf.objetivo.trim() || null,
    };
    const imagensPorRefId = Object.fromEntries(
      Object.entries(imagensPorRef).map(([k, imgs]) => [k, imgs.map(i => i.url)])
    );
    const html = gerarPlanoHtml({
      pacienteNome,
      plano:         buildPlano(),
      extras:        {
        prioridades:  orientacoes.prioridades,
        metas:        orientacoes.metas,
        suplementos:  orientacoes.suplementacao,
        consulta_n:   orientacoes.consulta_n,
        agua_diaria:  orientacoes.agua_diaria,
      },
      subsTexto:     buildSubsTexto(refeicoes),
      nutriNome:     nutriInfo.nome,
      nutriCrn:      nutriInfo.crn,
      nutriEmail:    nutriInfo.email,
      pacienteDados,
      imagensPorRefId,
    });
    const win = window.open('', '_blank');
    if (!win) { alert('Permita pop-ups para abrir o PDF.'); return; }
    win.document.write(html);
    win.document.close();
  }

  /* ── Liberar para paciente ───────────────────────────────── */
  async function liberarParaPaciente() {
    if (!temAlimentos) return;
    const plano = buildPlano();
    const subsTexto = buildSubsTexto(refeicoes);
    const dados = { ...plano, ...(subsTexto ? { subs_texto: subsTexto } : {}) };

    setPublicando(true);
    setFeedback(null);
    const { error } = await supabase.from('planos').insert({ paciente_id: pacienteId, nutri_id: nutriId, dados });

    if (error) {
      setPublicando(false);
      return setFeedback({ tipo: 'erro', msg: error.message });
    }

    // Salva todos os dados necessários para o PDF da paciente
    const _n = v => parseFloat(v) || null;
    const visualDados = {
      prioridades:    orientacoes.prioridades,
      metas:          orientacoes.metas,
      suplementos:    orientacoes.suplementacao,
      consulta_n:     orientacoes.consulta_n,
      agua_diaria:    orientacoes.agua_diaria,
      paciente_dados: {
        nome:       pacienteDadosPdf.nome.trim() || pacienteNome,
        idade:      parseInt(pacienteDadosPdf.idade) || null,
        peso_kg:    _n(pacienteDadosPdf.peso_kg),
        altura_cm:  _n(pacienteDadosPdf.altura_cm),
        pgc:        null,
        cintura_cm: _n(pacienteDadosPdf.cintura_cm),
        quadril_cm: _n(pacienteDadosPdf.quadril_cm),
        objetivo:   pacienteDadosPdf.objetivo.trim() || null,
      },
      nutri_nome:  nutriInfo.nome,
      nutri_crn:   nutriInfo.crn,
      nutri_email: nutriInfo.email,
      refeicoes: refeicoes.map(r => ({
        ...r,
        alimentos: r.alimentos.map(a => ({
          ...a,
          subs: a.subs ?? [],
        })),
      })),
      ...(subsTexto ? { subs_texto: subsTexto } : {}),
    };
    await supabase.from('planos_visuais').insert({
      paciente_id: pacienteId,
      nutri_id: nutriId,
      dados: visualDados,
      publicado: true,
      publicado_em: new Date().toISOString(),
    });

    setPublicando(false);
    setFeedback({ tipo: 'ok', msg: 'Plano liberado! Abrindo lista de compras…' });
    const lista = gerarListaCompras(refeicoes);
    onLiberar?.(lista);
  }

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Barra de ações ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn-outline" onClick={adicionarRefeicao}>
          <i className="ti ti-plus" aria-hidden="true" /> Adicionar refeição
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
          {draft === 'salvando' ? 'Salvando rascunho…' : 'Rascunho salvo'}
        </span>
        <button className="btn-outline" onClick={gerarPdf} disabled={!temAlimentos}>
          <i className="ti ti-printer" aria-hidden="true" /> Gerar PDF
        </button>
        <button className="btn" onClick={liberarParaPaciente} disabled={publicando || !temAlimentos}>
          <i className="ti ti-send" aria-hidden="true" />
          {publicando ? 'Liberando…' : 'Liberar para paciente'}
        </button>
      </div>

      {feedback && (
        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, background: feedback.tipo === 'ok' ? '#e6f0d4' : '#fbeaf0', color: feedback.tipo === 'ok' ? 'var(--green)' : 'var(--red)' }}>
          <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`} style={{ marginRight: 6 }} />
          {feedback.msg}
        </div>
      )}

      {/* ── Estado vazio ── */}
      {refeicoes.length === 0 && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text3)' }}>
          <i className="ti ti-salad" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: .25 }} aria-hidden="true" />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Nenhuma refeição ainda</div>
          <div style={{ fontSize: 13, opacity: .7, marginBottom: 20 }}>Clique em "+ Adicionar refeição" para começar</div>
          <button className="btn" onClick={adicionarRefeicao}>
            <i className="ti ti-plus" aria-hidden="true" /> Adicionar primeira refeição
          </button>
        </div>
      )}

      {/* ── Cards de refeição ── */}
      {refeicoes.map(ref => {
        const totRef = somaAlimentos(ref.alimentos);
        return (
          <div key={ref.id} className="card" style={{ overflow: 'hidden', padding: 0 }}>

            {/* Header */}
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px', background: '#f5f1eb', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={ref.nome}
                onChange={e => setRefField(ref.id, 'nome', e.target.value)}
                placeholder="Nome da refeição"
                style={{ flex: '1 1 160px', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px' }}
              />
              <input
                type="time"
                value={ref.horario}
                onChange={e => setRefField(ref.id, 'horario', e.target.value)}
                style={{ width: 100, fontSize: 13 }}
              />
              {ref.alimentos.length > 0 && (
                <span style={{ fontSize: 11, color: '#95380A', fontWeight: 600 }}>
                  {fmt(totRef.kcal, 0)} kcal · P:{fmt(totRef.prot_g)}g · C:{fmt(totRef.cho_g)}g · G:{fmt(totRef.lip_g)}g
                </span>
              )}
              <button onClick={() => removerRefeicao(ref.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4, marginLeft: 'auto' }}>
                <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" />
              </button>
            </div>

            {/* Tabela de alimentos */}
            {ref.alimentos.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#faf7f2' }}>
                      <TH>Alimento</TH>
                      <TH>Quantidade</TH>
                      <TH>Kcal</TH>
                      <TH>Prot</TH>
                      <TH>Carb</TH>
                      <TH>Gord</TH>
                      <TH>Cat.</TH>
                      <TH></TH>
                    </tr>
                  </thead>
                  <tbody>
                    {ref.alimentos.flatMap(al => [
                      /* ── Alimento principal ── */
                      <tr key={al.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                        <td style={{ padding: '7px 10px', color: 'var(--dark)', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{al.nome}</td>
                        <td style={{ padding: '7px 10px', color: 'var(--text3)' }}>{al.qty}</td>
                        <td style={{ padding: '7px 10px' }}>{al.kcal ?? '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{al.prot_g != null ? `${al.prot_g}g` : '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{al.cho_g  != null ? `${al.cho_g}g`  : '—'}</td>
                        <td style={{ padding: '7px 10px' }}>{al.lip_g  != null ? `${al.lip_g}g`  : '—'}</td>
                        <td style={{ padding: '7px 6px' }}>
                          <select
                            value={al.catKey || ''}
                            onChange={e => setCatKey(ref.id, al.id, e.target.value)}
                            style={{ fontSize: 10, padding: '2px 4px', maxWidth: 90 }}
                            title="Categoria para PDF"
                          >
                            <option value="">cat…</option>
                            {CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => setModal({ refId: ref.id, alimentoId: al.id })}
                            style={{ background: 'none', border: '1px solid var(--red)', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: 'var(--red)', fontWeight: 600, padding: '2px 7px', marginRight: 4 }}
                            title="Adicionar substituto"
                          >
                            + sub
                          </button>
                          <button onClick={() => removerAlimento(ref.id, al.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                            <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>,

                      /* ── Substitutos do alimento ── */
                      ...(al.subs ?? []).map(sub => (
                        <tr key={sub.id} style={{ background: '#fdf9f4', borderBottom: '0.5px solid var(--border)' }}>
                          <td style={{ padding: '5px 10px 5px 22px', color: 'var(--text3)', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: 'var(--terra)', marginRight: 5, fontSize: 10 }}>↳</span>
                            {sub.nome}
                          </td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.qty}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.kcal ?? '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.prot_g != null ? `${sub.prot_g}g` : '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.cho_g  != null ? `${sub.cho_g}g`  : '—'}</td>
                          <td style={{ padding: '5px 10px', fontSize: 12, color: 'var(--text3)' }}>{sub.lip_g  != null ? `${sub.lip_g}g`  : '—'}</td>
                          <td />
                          <td style={{ padding: '5px 10px' }}>
                            <button onClick={() => removerSub(ref.id, al.id, sub.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                              <i className="ti ti-x" style={{ fontSize: 11 }} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      )),
                    ])}

                    {/* Subtotal */}
                    <tr style={{ background: '#eee8de' }}>
                      <td colSpan={2} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--verde)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Subtotal</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--verde)' }}>{fmt(totRef.kcal, 0)}</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--verde)' }}>{fmt(totRef.prot_g)}g</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--verde)' }}>{fmt(totRef.cho_g)}g</td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--verde)' }}>{fmt(totRef.lip_g)}g</td>
                      <td colSpan={2} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Imagens da refeição */}
            {((imagensPorRef[ref.id]?.length ?? 0) > 0 || uploadandoRef === ref.id) && (
              <div style={{ padding: '8px 16px 4px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                  {(imagensPorRef[ref.id] ?? []).map(img => (
                    <div key={img.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', aspectRatio: '1 / 1', background: '#f0ebe3' }}>
                      <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button
                        onClick={() => removerImagem(ref.id, img.id, img.path)}
                        title="Remover imagem"
                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.55)', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, padding: 0 }}
                      >
                        <i className="ti ti-x" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                  {uploadandoRef === ref.id && (
                    <div style={{ borderRadius: 8, background: '#f0ebe3', aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text3)', flexDirection: 'column', gap: 4 }}>
                      <i className="ti ti-loader-2" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }} aria-hidden="true" />
                      <span>Enviando…</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observação da nutri */}
            <div style={{ padding: '10px 16px 0' }}>
              <textarea
                value={ref.obs ?? ''}
                onChange={e => setRefField(ref.id, 'obs', e.target.value)}
                placeholder="Observação da nutri (aparece no PDF)..."
                rows={2}
                style={{
                  width: '100%', fontSize: 12, resize: 'vertical',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '7px 10px', fontFamily: 'var(--font-sans)',
                  color: 'var(--dark)', background: 'var(--bg-soft)',
                  lineHeight: 1.5,
                }}
              />
            </div>

            {/* Footer: adicionar alimento + imagem */}
            <div style={{ padding: '10px 16px', borderTop: ref.alimentos.length > 0 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => setModal({ refId: ref.id, alimentoId: null })}>
                <i className="ti ti-plus" aria-hidden="true" /> Adicionar alimento
              </button>
              <button
                className="btn-outline"
                style={{ fontSize: 12 }}
                onClick={() => fileInputsRef.current[ref.id]?.click()}
                disabled={uploadandoRef === ref.id}
              >
                <i className="ti ti-photo-plus" aria-hidden="true" /> {uploadandoRef === ref.id ? 'Enviando…' : 'Adicionar imagem'}
              </button>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={el => { fileInputsRef.current[ref.id] = el; }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) adicionarImagem(ref.id, f);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        );
      })}

      {/* ── Total do dia ── */}
      {temAlimentos && (
        <div style={{ background: '#173103', borderRadius: 10, padding: '14px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.12em', marginBottom: 10 }}>
            Total do dia
          </div>
          <div style={{ display: 'flex' }}>
            {[
              { label: 'kcal',        v: fmt(totDia.kcal, 0),       cor: '#fff' },
              { label: 'proteína',    v: `${fmt(totDia.prot_g)}g`,  cor: '#a5c8ff' },
              { label: 'carboidrato', v: `${fmt(totDia.cho_g)}g`,   cor: '#ffd98a' },
              { label: 'gordura',     v: `${fmt(totDia.lip_g)}g`,   cor: '#a8e6a3' },
            ].map((m, i) => (
              <div key={m.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,.15)' : 'none', padding: '0 8px' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.cor, lineHeight: 1 }}>{m.v}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Orientações do Plano ── */}
      <div className="card" style={{ padding: 20 }}>
        <div className="section-title" style={{ marginBottom: 14 }}>Orientações do Plano</div>

        {/* Dados da paciente — capa do PDF */}
        <div style={{ marginBottom: 18, padding: '14px 16px', background: '#fafaf8', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500 }}>
            Dados da paciente — capa do PDF
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[
              { field: 'nome',      label: 'Nome completo', placeholder: 'Nome da paciente' },
              { field: 'idade',     label: 'Idade (anos)',  placeholder: 'Ex: 28'  },
              { field: 'peso_kg',   label: 'Peso (kg)',     placeholder: 'Ex: 65'  },
              { field: 'altura_cm', label: 'Altura (cm)',   placeholder: 'Ex: 165' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500 }}>{label}</div>
                <input
                  value={pacienteDadosPdf[field]}
                  onChange={e => setPacienteDadosPdf(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
            {[
              { field: 'objetivo',   label: 'Objetivo',     placeholder: 'Ex: Emagrecimento saudável' },
              { field: 'cintura_cm', label: 'Cintura (cm)', placeholder: 'Ex: 78'  },
              { field: 'quadril_cm', label: 'Quadril (cm)', placeholder: 'Ex: 100' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500 }}>{label}</div>
                <input
                  value={pacienteDadosPdf[field]}
                  onChange={e => setPacienteDadosPdf(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500 }}>Nº da consulta</div>
            <input
              value={orientacoes.consulta_n ?? ''}
              onChange={ev => setOrientacoes(prev => ({ ...prev, consulta_n: ev.target.value }))}
              placeholder="Ex: 1ª consulta, retorno"
              style={{ width: 200, fontSize: 13 }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 500 }}>Água diária</div>
            <input
              value={orientacoes.agua_diaria ?? ''}
              onChange={ev => setOrientacoes(prev => ({ ...prev, agua_diaria: ev.target.value }))}
              placeholder="Ex: 2,5L"
              style={{ width: 120, fontSize: 13 }}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { key: 'prioridades',   label: 'prioridades',  ph: 'Ex:\n— Fracionar refeições\n— Reduzir ultraprocessados' },
            { key: 'metas',         label: 'metas',        ph: 'Ex:\n— Perder 2 kg em 30 dias\n— Beber 2L de água por dia' },
            { key: 'suplementacao', label: 'suplemento',   ph: 'Ex:\n— Whey 30g após treino\n— Magnésio 200mg à noite' },
          ].map(({ key, label, ph }) => (
            <div key={key}>
              <div style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 17,
                color: 'var(--verde)',
                marginBottom: 8,
                lineHeight: 1,
              }}>
                {label}
              </div>
              <textarea
                value={orientacoes[key]}
                onChange={ev => setOrientacoes(prev => ({ ...prev, [key]: ev.target.value }))}
                placeholder={ph}
                rows={9}
                style={{
                  width: '100%',
                  resize: 'vertical',
                  fontSize: 12,
                  lineHeight: 1.65,
                  fontFamily: 'var(--font-sans)',
                  padding: '8px 10px',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Prévia ── */}
      {temAlimentos && (
        <div className="card" style={{ padding: 20 }}>
          {/* Cabeçalho + abas */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Prévia</div>
            <div style={{ display: 'flex', background: '#f5f1eb', borderRadius: 8, padding: 3, gap: 2 }}>
              {[
                { id: 'app', label: 'Como vai aparecer no app' },
                { id: 'pdf', label: 'Como vai aparecer no PDF' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setPreviaTab(t.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500,
                    background: previaTab === t.id ? '#fff' : 'transparent',
                    color:      previaTab === t.id ? '#222222' : '#888888',
                    boxShadow:  previaTab === t.id ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                    transition: 'all .15s',
                  }}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* ── Aba: Como vai aparecer no app ── */}
          {previaTab === 'app' && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 8px' }}>
              {/* Moldura do celular */}
              <div style={{
                width: 288, flexShrink: 0,
                background: '#1a1a2e',
                borderRadius: 44,
                padding: '14px 8px',
                boxShadow: '0 24px 72px rgba(0,0,0,.32), inset 0 0 0 1px rgba(255,255,255,.08)',
                border: '6px solid #0d0d1a',
              }}>
                {/* Notch */}
                <div style={{ width: 80, height: 20, background: '#0d0d1a', borderRadius: 10, margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2a2a3a', border: '1.5px solid #333' }} />
                  <div style={{ width: 40, height: 5, borderRadius: 3, background: '#2a2a3a' }} />
                </div>
                {/* Tela */}
                <div style={{ background: '#f0ebe3', borderRadius: 34, overflow: 'hidden', height: 560 }}>
                  {/* App bar com macros do dia */}
                  <div style={{ background: '#a08456', padding: '10px 14px 8px' }}>
                    <div style={{ fontSize: 8, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Meu Plano</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { l: 'Kcal', v: fmt(totDia.kcal, 0) },
                        { l: 'Prot', v: `${fmt(totDia.prot_g)}g` },
                        { l: 'Carb', v: `${fmt(totDia.cho_g)}g` },
                        { l: 'Gord', v: `${fmt(totDia.lip_g)}g` },
                      ].map((m, i) => (
                        <div key={m.l} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,.2)' : 'none' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{m.v}</div>
                          <div style={{ fontSize: 7, color: 'rgba(255,255,255,.55)', textTransform: 'uppercase', letterSpacing: .5, marginTop: 2 }}>{m.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Cards de refeições */}
                  <div style={{ overflowY: 'auto', height: 492, padding: '10px 10px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {refeicoes.filter(r => r.alimentos.length > 0).map(ref => {
                      const tot = somaAlimentos(ref.alimentos);
                      return (
                        <div key={ref.id} style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                          <div style={{ padding: '7px 10px', background: '#f5f0e8', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#3a3028' }}>{ref.nome || 'Refeição'}</div>
                            <div style={{ fontSize: 8, color: '#8c7b6b' }}>{ref.horario}</div>
                          </div>
                          <div style={{ padding: '6px 10px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {ref.alimentos.slice(0, 5).map(al => (
                              <div key={al.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ fontSize: 9, color: '#3a3028', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{al.nome}</span>
                                <span style={{ fontSize: 9, color: '#8c7b6b', flexShrink: 0 }}>{al.qty}</span>
                              </div>
                            ))}
                            {ref.alimentos.length > 5 && (
                              <div style={{ fontSize: 8, color: '#b4a896', fontStyle: 'italic' }}>+{ref.alimentos.length - 5} mais</div>
                            )}
                          </div>
                          <div style={{ padding: '4px 10px 6px', display: 'flex', gap: 8, borderTop: '0.5px solid #f0ebe3' }}>
                            {[
                              { l: 'kcal', v: fmt(tot.kcal, 0) },
                              { l: 'P', v: `${fmt(tot.prot_g)}g` },
                              { l: 'C', v: `${fmt(tot.cho_g)}g` },
                              { l: 'G', v: `${fmt(tot.lip_g)}g` },
                            ].map(m => (
                              <span key={m.l} style={{ fontSize: 8, color: '#8c7b6b' }}>
                                <strong style={{ color: '#5a4a3a' }}>{m.v}</strong> {m.l}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Aba: Como vai aparecer no PDF ── */}
          {previaTab === 'pdf' && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '0 0 8px' }}>
              <div>
                <div style={{ fontSize: 11, color: '#888888', marginBottom: 8, textAlign: 'center' }}>
                  Prévia — capa (página 1). Use "Gerar PDF" para ver o documento completo.
                </div>
                <div style={{
                  width: Math.round(794 * 0.4),
                  height: Math.round(1123 * 0.4),
                  overflow: 'hidden',
                  borderRadius: 6,
                  border: '1px solid #d9d3c9',
                  boxShadow: '0 4px 20px rgba(0,0,0,.15)',
                  flexShrink: 0,
                }}>
                  <iframe
                    srcDoc={pdfHtml}
                    title="Prévia PDF"
                    style={{
                      width: 794,
                      height: 1123,
                      border: 'none',
                      transform: 'scale(0.4)',
                      transformOrigin: 'top left',
                      pointerEvents: 'none',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <ModalAlimento
          isSub={!!modal.alimentoId}
          nutriId={nutriId}
          onConfirm={handleConfirm}
          onConfirmMulti={handleConfirmMulti}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
