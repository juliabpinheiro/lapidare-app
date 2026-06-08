import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase.js';
import { gerarPlanoHtml } from '../../lib/gerarPlanoHtml.js';

/* ── Constantes ─────────────────────────────────────────────── */
const CATS = [
  { key: 'carbo',  label: 'Carboidrato' },
  { key: 'prot',   label: 'Proteína' },
  { key: 'fruta',  label: 'Fruta' },
  { key: 'leg',    label: 'Leguminosa' },
  { key: 'bebida', label: 'Bebida' },
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
];

/* ── Lista pronta de substituições ──────────────────────────── */
const LISTA_PRONTA_DATA = [
  { cat: 'carbo', label: 'Carboidrato', itens: [
    'Pão de forma tradicional ou integral sem grãos – 2 fatias',
    'Pão francês sem miolo – 1 unidade',
    'Torrada integral – 4 unidades',
    'Rap10 – 1 unidade',
    'Goma de tapioca 45g',
    'Pão sírio 50g',
    'Cuscuz já pronto 100g',
    'Pão bisnaguinha 3 unidades',
    'Torrada lev magic toast 7 unidades',
    'Arroz branco ou integral 100g',
    'Batata inglesa 120g',
    'Aipim/mandioca 100g',
    'Batata doce 105g',
    'Inhame 100g',
    'Batata baroa/mandioquinha 150g',
    'Milho para pipoca 30g',
    'Farelo de aveia 30g',
    'Quinoa já cozida 80g',
    'Macarrão tradicional ou integral 100g',
    'Abóbora 170g',
    'Milho 120g',
    'Farofa 25g',
    'Pão de hambúrguer 50g',
  ]},
  { cat: 'prot', label: 'Proteína', itens: [
    'Ovo – 1 unidade',
    'Queijo Minas Frescal 30g',
    'Queijo minas padrão 20g',
    'Queijo meia cura 20g',
    'Queijo curado 20g',
    'Muçarela 20g',
    'Ricota 40g',
    'Muçarela de búfala 20g',
    'Queijo coalho 15g',
    'Peito de frango 100g',
    'Sobrecoxa sem pele 90g',
    'Fígado 100g',
    'Moela 100g',
    'Picanha sem gordura 80g',
    'Músculo 120g',
    'Patinho moído 100g',
    'Bife de alcatra 100g',
    'Whey protein 30g',
    'Lombo suíno 100g',
    'Picanha suína 90g',
    'Tilápia 150g',
    'Salmão 100g',
    'Filé de merluza 110g',
    'Camarão 120g',
    'Sardinha enlatada em água 105g',
    'Atum enlatado em água 100g',
    'Ovo de galinha 2 unidades',
    'Iogurte natural desnatado 160g',
    'Iogurte grego zero 1 unidade',
    'Leite desnatado 150ml',
  ]},
  { cat: 'fruta', label: 'Fruta', itens: [
    'Banana prata – 1 unidade',
    'Uva 15 unidades',
    'Morango 15 unidades',
    'Melão 300g',
    'Mamão 150g',
    'Melancia 350g',
    'Manga 200g',
    'Maçã 1 unidade',
    'Tangerina 1 unidade',
    'Laranja 1 unidade',
    'Kiwi 2 unidades',
    'Abacate 50g',
    'Abacaxi 150g',
    'Pera 1 unidade',
    'Coco seco 15g',
    'Caqui 1 unidade',
    'Pêssego 2 unidades',
    'Acerola 200g',
    'Jabuticaba 200g',
    'Cajá 200g',
    'Figo 150g',
    'Goiaba 200g',
    'Jambo 300g',
    'Mangaba 180g',
    'Pitaya 200g',
  ]},
  { cat: 'leg', label: 'Leguminosa', itens: [
    'Feijão 150g',
    'Lentilha 150g',
    'Soja 75g',
    'Grão de bico 75g',
  ]},
  { cat: 'bebida', label: 'Bebida', itens: [
    'Café puro',
    'Café com adoçante',
    'Suco de limão com adoçante',
    'Suco de morango com adoçante',
    'Suco de melancia com adoçante',
    'Suco de acerola com adoçante',
    'Suco de maracujá com adoçante',
  ]},
];

/* ── Modal: adicionar alimento ou substituto ────────────────── */
function ModalAlimento({ isSub, onConfirm, onConfirmMulti, onFechar }) {
  const [tab, setTab]             = useState(isSub ? 'lista' : 'fatsecret');
  const [listaSel, setListaSel]   = useState(new Set());
  const [busca, setBusca]         = useState('');
  const [resultados, setRes]      = useState([]);
  const [loading, setLoading]     = useState(false);
  const [erro, setErro]           = useState(null);
  const [sel, setSel]             = useState(null);
  const [detalhe, setDetalhe]     = useState(null);
  const [loadDet, setLoadDet]     = useState(false);
  const [qtd, setQtd]             = useState('100');
  const [manual, setManual]       = useState({ nome: '', qty: '', kcal: '', prot_g: '', cho_g: '', lip_g: '' });
  const [tacoBusca, setTacoBusca] = useState('');
  const [tacoSel, setTacoSel]     = useState(null);
  const [tacoQtd, setTacoQtd]     = useState('100');

  useEffect(() => {
    if (!sel) { setDetalhe(null); return; }
    setLoadDet(true);
    fetch(`/.netlify/functions/fatsecret?food_id=${sel.food_id}`)
      .then(r => r.json())
      .then(d => { if (d && !d.error) setDetalhe(d); })
      .catch(() => {})
      .finally(() => setLoadDet(false));
  }, [sel?.food_id]);

  async function buscar() {
    if (!busca.trim()) return;
    setLoading(true); setErro(null); setRes([]); setSel(null);
    try {
      const res = await fetch(`/.netlify/functions/fatsecret?q=${encodeURIComponent(busca)}`);
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Erro na busca');
      setRes(d.foods ?? []);
    } catch (e) { setErro(e.message); }
    finally { setLoading(false); }
  }

  function confirmarFS() {
    const g = parseFloat(qtd);
    if (!g || !sel) return;
    onConfirm({ id: uid(), ...calcMacros(detalhe ?? sel, g), subs: [], catKey: '' });
  }

  function toggleLista(key) {
    setListaSel(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function confirmarLista() {
    const selecionados = [];
    for (const cat of LISTA_PRONTA_DATA) {
      for (const item of cat.itens) {
        if (listaSel.has(`${cat.cat}::${item}`)) {
          selecionados.push({ id: uid(), nome: item, qty: '', kcal: null, prot_g: null, cho_g: null, lip_g: null, subs: [], catKey: cat.cat });
        }
      }
    }
    if (selecionados.length === 0) return;
    onConfirmMulti(selecionados);
  }

  function confirmarManual() {
    if (!manual.nome.trim()) return;
    const n = v => parseFloat(v) || null;
    onConfirm({ id: uid(), nome: manual.nome.trim(), qty: manual.qty || '—', kcal: n(manual.kcal), prot_g: n(manual.prot_g), cho_g: n(manual.cho_g), lip_g: n(manual.lip_g), subs: [], catKey: '' });
  }

  function confirmarTaco() {
    const g = parseFloat(tacoQtd);
    if (!g || !tacoSel) return;
    const f = g / 100;
    onConfirm({
      id: uid(), nome: tacoSel.nome, qty: `${g}g`,
      kcal:   rd(tacoSel.kcal   * f, 0),
      prot_g: rd(tacoSel.prot_g * f, 1),
      cho_g:  rd(tacoSel.cho_g  * f, 1),
      lip_g:  rd(tacoSel.lip_g  * f, 1),
      subs: [], catKey: tacoSel.cat || '',
    });
  }

  const tacoFiltrado = tacoBusca.trim().length < 2
    ? TACO_DATA
    : TACO_DATA.filter(a => a.nome.toLowerCase().includes(tacoBusca.toLowerCase()));

  const tacoG = parseFloat(tacoQtd);
  const tacoPreview = tacoSel && tacoG > 0 ? {
    kcal:   rd(tacoSel.kcal   * tacoG / 100, 0),
    prot_g: rd(tacoSel.prot_g * tacoG / 100, 1),
    cho_g:  rd(tacoSel.cho_g  * tacoG / 100, 1),
    lip_g:  rd(tacoSel.lip_g  * tacoG / 100, 1),
  } : null;

  const src     = detalhe ?? sel;
  const g       = parseFloat(qtd);
  const preview = src && g > 0 ? calcMacros(src, g) : null;

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
        <div style={{ display: 'flex', padding: '10px 20px 0', borderBottom: '1px solid var(--border)', marginTop: 6 }}>
          {(isSub
            ? [['lista', 'Lista pronta'], ['fatsecret', 'Buscar no FatSecret'], ['manual', 'Digitar manualmente']]
            : [['fatsecret', 'Buscar no FatSecret'], ['taco', 'Tabela TACO'], ['manual', 'Digitar manualmente']]
          ).map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
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
                Selecione os substitutos e clique em "Adicionar selecionados".
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {LISTA_PRONTA_DATA.map(cat => (
                  <div key={cat.cat}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--terra)', marginBottom: 6 }}>
                      {cat.label}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {cat.itens.map(item => {
                        const key = `${cat.cat}::${item}`;
                        const checked = listaSel.has(key);
                        return (
                          <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: checked ? '#fffbf5' : 'transparent' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLista(key)}
                              style={{ marginTop: 2, accentColor: 'var(--verde)', flexShrink: 0 }}
                            />
                            <span style={{ fontSize: 13, color: 'var(--dark)', lineHeight: 1.4 }}>{item}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: 'sticky', bottom: 0, background: 'var(--white)', paddingTop: 14, marginTop: 14, borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn"
                  style={{ width: '100%', fontSize: 14 }}
                  onClick={confirmarLista}
                  disabled={listaSel.size === 0}
                >
                  Adicionar selecionados {listaSel.size > 0 ? `(${listaSel.size})` : ''}
                </button>
              </div>
            </>
          )}

          {/* ── FatSecret ── */}
          {tab === 'fatsecret' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={busca} onChange={e => setBusca(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscar()}
                  placeholder="Ex: banana, frango, aveia, greek yogurt…"
                  style={{ flex: 1, fontSize: 14 }}
                  autoFocus
                />
                <button className="btn" style={{ fontSize: 13 }} onClick={buscar} disabled={loading || !busca.trim()}>
                  {loading ? '…' : 'Buscar'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
                💡 Tente em inglês para mais resultados: chicken, oat, sweet potato…
              </div>

              {erro && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{erro}</div>}

              {resultados.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                  {resultados.slice(0, 10).map((food, i) => {
                    const ativo = sel?.food_id === food.food_id;
                    return (
                      <div key={food.food_id}>
                        <button
                          onClick={() => { setSel(ativo ? null : food); setQtd('100'); }}
                          style={{
                            width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                            borderTop: i > 0 ? '0.5px solid var(--border)' : 'none',
                            padding: '9px 12px', background: ativo ? '#fffbf5' : 'transparent',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: ativo ? 600 : 400, color: 'var(--dark)' }}>{food.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {food.serving && `${food.serving} · `}
                            {food.kcal != null && `${Math.round(food.kcal)} kcal`}
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
                                {loadDet && <span style={{ fontSize: 11, color: 'var(--text3)', alignSelf: 'center', fontStyle: 'italic' }}>refinando…</span>}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <input
                                type="number" min="1" max="5000" value={qtd}
                                onChange={e => setQtd(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && confirmarFS()}
                                style={{ width: 80, fontSize: 14, textAlign: 'center' }}
                                autoFocus
                              />
                              <span style={{ fontSize: 13, color: 'var(--text3)' }}>g</span>
                              <button className="btn" style={{ fontSize: 13 }} onClick={confirmarFS} disabled={!qtd || parseFloat(qtd) <= 0}>
                                Confirmar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!loading && resultados.length === 0 && busca && !erro && (
                <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
                  Sem resultados. Tente em inglês ou use "Digitar manualmente".
                </div>
              )}
            </>
          )}

          {/* ── TACO ── */}
          {tab === 'taco' && (
            <>
              <input
                value={tacoBusca}
                onChange={e => { setTacoBusca(e.target.value); setTacoSel(null); }}
                placeholder="Buscar alimento (ex: frango, banana, arroz…)"
                style={{ width: '100%', fontSize: 14, marginBottom: 10 }}
                autoFocus
              />
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
                {tacoFiltrado.length} alimentos · valores por 100g (TACO)
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 340, overflowY: 'auto', marginBottom: 12 }}>
                {tacoFiltrado.length === 0 && (
                  <div style={{ padding: 16, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
                    Nenhum alimento encontrado.
                  </div>
                )}
                {tacoFiltrado.map((al, i) => {
                  const ativo = tacoSel?.nome === al.nome;
                  return (
                    <div key={al.nome}>
                      <button
                        onClick={() => { setTacoSel(ativo ? null : al); setTacoQtd('100'); }}
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
                          {tacoPreview && (
                            <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                              {[
                                { l: 'kcal', v: tacoPreview.kcal },
                                { l: 'prot', v: `${tacoPreview.prot_g}g` },
                                { l: 'carb', v: `${tacoPreview.cho_g}g` },
                                { l: 'gord', v: `${tacoPreview.lip_g}g` },
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
                              type="number" min="1" max="5000" value={tacoQtd}
                              onChange={e => setTacoQtd(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && confirmarTaco()}
                              style={{ width: 80, fontSize: 14, textAlign: 'center' }}
                              autoFocus
                            />
                            <span style={{ fontSize: 13, color: 'var(--text3)' }}>g</span>
                            <button className="btn" style={{ fontSize: 13 }} onClick={confirmarTaco} disabled={!tacoQtd || parseFloat(tacoQtd) <= 0}>
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
          )}

          {/* ── Manual ── */}
          {tab === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Nome *</label>
                  <input value={manual.nome} onChange={e => setManual(p => ({ ...p, nome: e.target.value }))} placeholder="ex: Banana prata" autoFocus />
                </div>
                <div>
                  <label className="field-label">Quantidade</label>
                  <input value={manual.qty} onChange={e => setManual(p => ({ ...p, qty: e.target.value }))} placeholder="ex: 1 unidade / 70g" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[['kcal','Kcal'],['prot_g','Prot (g)'],['cho_g','Carb (g)'],['lip_g','Gord (g)']].map(([k, lbl]) => (
                  <div key={k}>
                    <label className="field-label">{lbl}</label>
                    <input inputMode="decimal" value={manual[k]} onChange={e => setManual(p => ({ ...p, [k]: e.target.value }))} placeholder="0" />
                  </div>
                ))}
              </div>
              <button className="btn" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={confirmarManual} disabled={!manual.nome.trim()}>
                Confirmar
              </button>
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

  const [refeicoes, setRefeicoes] = useState(() => {
    try { const s = localStorage.getItem(DRAFT_KEY); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [orientacoes, setOrientacoes] = useState(() => {
    try {
      const s = localStorage.getItem(`plano_orientacoes_${pacienteId}`);
      return s ? JSON.parse(s) : { prioridades: '', metas: '', suplementacao: '' };
    } catch { return { prioridades: '', metas: '', suplementacao: '' }; }
  });
  const [modal, setModal]         = useState(null); // { refId, alimentoId: string|null }
  const [publicando, setPublicando] = useState(false);
  const [feedback, setFeedback]   = useState(null);
  const [nutriInfo, setNutriInfo] = useState({ nome: '', crn: '', email: '' });
  const [pesoInfo, setPesoInfo]   = useState({ kg: null, altura_cm: null, pgc: null, cintura_cm: null, quadril_cm: null });
  const [draft, setDraft]         = useState('salvo'); // 'salvo' | 'salvando'
  const draftTimer                = useRef(null);

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
      .then(({ data }) => { if (data) setPesoInfo({ kg: data.kg, altura_cm: data.altura_cm, pgc: data.pgc, cintura_cm: data.cintura_cm, quadril_cm: data.quadril_cm }); });
  }, [pacienteId]);

  /* Auto-save orientações no localStorage */
  useEffect(() => {
    try { localStorage.setItem(ORIENT_KEY, JSON.stringify(orientacoes)); } catch {}
  }, [orientacoes, ORIENT_KEY]);

  /* Carrega orientações do último plano publicado se o localStorage estiver vazio */
  useEffect(() => {
    if (Object.values(orientacoes).some(v => v)) return;
    supabase.from('planos').select('dados')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()
      .then(({ data }) => {
        const o = data?.dados?.orientacoes;
        if (o?.prioridades || o?.metas || o?.suplementacao) setOrientacoes(o);
      });
  }, [pacienteId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ── Handlers de refeição ─────────────────────────────────── */
  function adicionarRefeicao() {
    const sug = SUGESTOES[refeicoes.length] ?? { nome: '', horario: '' };
    setRefeicoes(prev => [...prev, { id: uid(), nome: sug.nome, horario: sug.horario, alimentos: [] }]);
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

  /* ── Constrói objeto plano para salvar/PDF ───────────────── */
  function buildPlano() {
    const refs = refeicoes
      .filter(r => r.alimentos.length > 0)
      .map(r => {
        const tot = somaAlimentos(r.alimentos);
        return {
          nome:      r.nome,
          horario:   r.horario,
          kcal:      rd(tot.kcal, 0),
          prot_g:    rd(tot.prot_g, 1),
          cho_g:     rd(tot.cho_g, 1),
          lip_g:     rd(tot.lip_g, 1),
          alimentos: r.alimentos.map(a => ({ nome: a.nome, qty: a.qty, kcal: a.kcal, prot_g: a.prot_g, cho_g: a.cho_g, lip_g: a.lip_g })),
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
    const pacienteDados = {
      nome:       paciente?.nome,
      idade:      _calcIdade(paciente?.nascimento),
      peso_kg:    pesoInfo.kg,
      altura_cm:  pesoInfo.altura_cm,
      pgc:        pesoInfo.pgc,
      cintura_cm: pesoInfo.cintura_cm,
      quadril_cm: pesoInfo.quadril_cm,
      objetivo:   paciente?.objetivo,
    };
    const html = gerarPlanoHtml({
      pacienteNome,
      plano:         buildPlano(),
      extras:        {
        prioridades: orientacoes.prioridades,
        metas:       orientacoes.metas,
        suplementos: orientacoes.suplementacao,
      },
      subsTexto:     buildSubsTexto(refeicoes),
      nutriNome:     nutriInfo.nome,
      nutriCrn:      nutriInfo.crn,
      nutriEmail:    nutriInfo.email,
      pacienteDados,
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

    // Salva extras visuais para o PDF da paciente (prioridades, metas, suplementos, subs)
    const visualDados = {
      prioridades: orientacoes.prioridades,
      metas: orientacoes.metas,
      suplementos: orientacoes.suplementacao,
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
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 10, color: 'var(--text3)', padding: '2px 7px', marginRight: 4 }}
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

            {/* Footer: adicionar alimento */}
            <div style={{ padding: '10px 16px', borderTop: ref.alimentos.length > 0 ? '1px solid var(--border)' : 'none' }}>
              <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => setModal({ refId: ref.id, alimentoId: null })}>
                <i className="ti ti-plus" aria-hidden="true" /> Adicionar alimento
              </button>
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
        <div className="section-title" style={{ marginBottom: 16 }}>Orientações do Plano</div>
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

      {/* ── Modal ── */}
      {modal && (
        <ModalAlimento
          isSub={!!modal.alimentoId}
          onConfirm={handleConfirm}
          onConfirmMulti={handleConfirmMulti}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
