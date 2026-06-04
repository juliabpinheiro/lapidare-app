// Dados de substituições alimentares compartilhados entre PacientePerfil e o gerador de HTML

const _FRUTAS = [
  'Banana prata — 1 unidade', 'Uva — 15 unidades', 'Morango — 15 unidades',
  'Melão — 300g', 'Mamão — 150g', 'Melancia — 350g', 'Manga — 200g',
  'Maçã — 1 unidade', 'Tangerina — 1 unidade', 'Laranja — 1 unidade',
  'Kiwi — 2 unidades', 'Abacate — 50g', 'Abacaxi — 150g', 'Pera — 1 unidade',
  'Coco seco — 15g', 'Caqui — 1 unidade grande', 'Pêssego — 2 grandes',
  'Acerola — 200g', 'Jabuticaba — 200g', 'Cajá — 200g', 'Figo — 150g',
  'Goiaba — 200g', 'Jambo — 300g', 'Mangaba — 180g', 'Pitaya — 200g',
];

const _PROT_ALM_JAN = [
  'Peito de frango — 100g', 'Sobrecoxa sem pele — 90g', 'Fígado — 100g',
  'Moela — 100g', 'Picanha sem gordura — 80g', 'Músculo — 120g',
  'Patinho moído — 100g', 'Bife de alcatra — 100g', 'Hambúrguer caseiro — 100g',
  'Whey protein — 30g', 'Lombo suíno — 100g', 'Picanha suína — 90g',
  'Tilápia — 150g', 'Salmão — 100g', 'Filé de merluza — 110g',
  'Camarão — 120g', 'Sardinha enlatada em água — 105g',
  'Atum enlatado em água — 100g', 'Ovo de galinha — 2 unidades',
  'Drumette sem osso — 90g', 'Iogurte proteico — 1 unidade',
];

const _CARBO_ALM_JAN = [
  'Arroz branco ou integral — 100g', 'Batata inglesa — 120g',
  'Aipim (mandioca) — 100g', 'Batata doce — 105g', 'Inhame — 100g',
  'Batata baroa (mandioquinha) — 150g', 'Milho para pipoca — 30g',
  'Farelo de aveia — 30g', 'Quinoa já cozida — 80g',
  'Macarrão tradicional ou integral — 100g', 'Macarrão sem glúten já cozido — 40g',
  'Abóbora — 170g', 'Milho — 120g', 'Farofa — 25g',
  'Cuscuz já pronto — 100g', 'Pão de forma — 2 fatias',
  'Pão de hambúrguer — 50g', 'Rap10 — 1 unidade',
];

const _LEG = [
  'Feijão — 150g', 'Lentilha — 150g', 'Soja — 75g', 'Grão de bico — 75g',
];

const _CARBO_CAFE = [
  'Pão de forma tradicional ou integral sem grãos — 2 fatias',
  'Pão francês sem miolo — 1 unidade', 'Torrada integral — 4 unidades',
  'Rap10 — 1 unidade', 'Goma de tapioca — 45g', 'Pão sírio — 50g',
  'Cuscuz já pronto — 100g', '1 fatia pão de forma + 20g geleia light Linea',
  'Pão bisnaguinha — 3 unidades', 'Torrada Lev Magic Toast — 7 unidades',
];

export const SUBS_GRUPOS = [
  {
    refeicao: 'Café da Manhã',
    categorias: [
      { id: 'carbo-cafe', label: 'Carboidrato', itens: _CARBO_CAFE },
      {
        id: 'prot-cafe', label: 'Proteína',
        itens: [
          'Ovo — 1 unidade', 'Queijo Minas Frescal — 30g',
          'Queijo Minas Padrão — 20g', 'Queijo Meia Cura — 20g',
          'Queijo Curado — 20g', 'Muçarela — 20g', 'Ricota — 40g',
          'Muçarela de búfala — 20g', 'Queijo Coalho — 15g',
        ],
      },
      { id: 'fruta-cafe', label: 'Fruta', itens: _FRUTAS },
      {
        id: 'bebida-cafe', label: 'Bebida',
        itens: [
          'Café puro', 'Café com adoçante', 'Suco de limão com adoçante',
          'Suco de morango com adoçante', 'Suco de melancia com adoçante',
          'Suco de acerola com adoçante', 'Suco de maracujá com adoçante',
        ],
      },
    ],
  },
  {
    refeicao: 'Lanche da Manhã',
    categorias: [
      { id: 'carbo-lanche-manha', label: 'Carboidrato', itens: _CARBO_CAFE },
      { id: 'fruta-lanche-manha', label: 'Fruta', itens: _FRUTAS },
    ],
  },
  {
    refeicao: 'Almoço',
    categorias: [
      { id: 'prot-almoco', label: 'Proteína', itens: _PROT_ALM_JAN },
      { id: 'carbo-almoco', label: 'Carboidrato', itens: _CARBO_ALM_JAN },
      { id: 'leg-almoco', label: 'Leguminosa', itens: _LEG },
    ],
  },
  {
    refeicao: 'Lanche da Tarde',
    categorias: [
      {
        id: 'prot-lanche-tarde', label: 'Proteína',
        itens: [
          'Iogurte natural desnatado — 160g', 'Itambé Fit sabor morango — 160ml',
          'Iogurte grego zero — 1 unidade', 'Batavo Pense Zero — 160ml',
          'Leite desnatado — 150ml', 'Leite em pó desnatado — 2 colheres de sopa',
          'Piracanjuba Whey — 1 unidade', 'YoPro — 1 unidade',
          'Itambé Pro Whey — 1 unidade', 'Verde Campo Natural Whey — 1 unidade',
        ],
      },
      { id: 'fruta-lanche-tarde', label: 'Fruta', itens: _FRUTAS },
    ],
  },
  {
    refeicao: 'Jantar',
    categorias: [
      { id: 'prot-jantar', label: 'Proteína', itens: _PROT_ALM_JAN },
      { id: 'carbo-jantar', label: 'Carboidrato', itens: _CARBO_ALM_JAN },
      { id: 'leg-jantar', label: 'Leguminosa', itens: _LEG },
    ],
  },
  {
    refeicao: 'Ceia',
    categorias: [
      { id: 'fruta-ceia', label: 'Fruta', itens: _FRUTAS },
    ],
  },
];

export function getMealSubsIdx(nomeMeal) {
  const n = (nomeMeal ?? '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim();
  if (n.includes('ceia')) return 5;
  if (n.includes('jantar')) return 4;
  if (n.includes('lanche') && (n.includes('tarde') || n.includes('16') || n.includes('15'))) return 3;
  if (n.includes('almoco')) return 2;
  if (n.includes('lanche')) return 1;
  return 0;
}
