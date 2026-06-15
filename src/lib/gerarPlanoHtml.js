function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const _CAT_LABELS = { carbo: 'Carboidrato', prot: 'Proteína', gordura: 'Gordura', leg: 'Leguminosa', fruta: 'Fruta', bebida: 'Bebida' };
const _CAT_ORDER = { cafe_manha: ['carbo','prot','fruta','bebida'], lanche_manha: ['fruta'], almoco: ['prot','carbo','leg'], lanche_tarde: ['prot','fruta'], jantar: ['prot','carbo','leg'], ceia: ['fruta'] };
const _MEAL_KEYS = ['cafe_manha','lanche_manha','almoco','lanche_tarde','jantar','ceia'];

function normMealKey(nomeMeal) {
  const n = (nomeMeal ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,'').trim();
  if (n.includes('ceia')) return 'ceia';
  if (n.includes('jantar')) return 'jantar';
  if (n.includes('lanche') && (n.includes('tarde') || n.includes('16') || n.includes('15'))) return 'lanche_tarde';
  if (n.includes('almoco')) return 'almoco';
  if (n.includes('lanche')) return 'lanche_manha';
  return 'cafe_manha';
}

function bullets(text) {
  if (!text) return '';
  return (text + '').split('\n').filter(l => l.trim())
    .map(l => `<li>${esc(l.trim().replace(/^[-—]\s*/, ''))}</li>`).join('');
}

function subsHtml(mealKey, subsTexto) {
  if (!subsTexto || !mealKey) return '';
  if ((subsTexto._meta?.removed ?? []).includes(mealKey)) return '';
  const cats = subsTexto[mealKey];
  if (!cats) return '';
  // Usa _CAT_ORDER como ordem preferida, mas inclui todas as cats com conteúdo
  const baseOrder = _CAT_ORDER[mealKey] ?? [];
  const order = [
    ...baseOrder.filter(k => cats[k]?.trim()),
    ...Object.keys(cats).filter(k => !baseOrder.includes(k) && cats[k]?.trim()),
  ];
  if (!order.length) return '';
  return order.map(catKey => {
    const texto = cats[catKey];
    if (!texto?.trim()) return '';
    return `<div class="grupo">
      <div class="grupo-label">${esc(_CAT_LABELS[catKey] ?? catKey)} (Escolha 1 Opção)</div>
      <div class="grupo-caixa">${esc(texto)}</div>
    </div>`;
  }).join('');
}

function pagCustomMeals(subsTexto) {
  const custom = subsTexto?._meta?.custom ?? [];
  const com_conteudo = custom.filter(c => c.content?.trim());
  if (!com_conteudo.length) return '';
  const secoes = com_conteudo.map(c => `
    <div class="refeicao">
      <div class="ref-titulo">${esc((c.label ?? '').toLowerCase())}</div>
      <div class="grupo">
        <div class="grupo-label">Opções (Escolha 1 Opção)</div>
        <div class="grupo-caixa">${esc(c.content)}</div>
      </div>
    </div>`).join('');
  return pagina(secoes);
}

function fmtNum(v) { return v != null ? String(v) : '—'; }

function foodTable(alimentos) {
  if (!alimentos?.length) return '';
  const hasCho = alimentos.some(a => a.cho_g != null);
  const hasLip = alimentos.some(a => a.lip_g != null);
  const hasGramas = alimentos.some(a => a.gramas != null);

  const thExtra = (hasGramas ? '<th>Gramas</th>' : '') +
    '<th>kcal</th><th>Prot</th>' +
    (hasCho ? '<th>CHO</th>' : '') +
    (hasLip ? '<th>Lip</th>' : '');

  const rows = alimentos.map(a => {
    const tdExtra = (hasGramas ? `<td>${esc(a.gramas ?? '—')}</td>` : '') +
      `<td>${esc(a.kcal ?? '—')}</td><td>${esc(a.prot_g != null ? a.prot_g + 'g' : '—')}</td>` +
      (hasCho ? `<td>${esc(a.cho_g != null ? a.cho_g + 'g' : '—')}</td>` : '') +
      (hasLip ? `<td>${esc(a.lip_g != null ? a.lip_g + 'g' : '—')}</td>` : '');
    const catLabel = _CAT_LABELS[a.catKey ?? ''];
    const nomeTd = catLabel
      ? `<span class="cat-prefix">${esc(catLabel)} — </span>${esc(a.nome)}`
      : esc(a.nome);
    return `<tr><td>${nomeTd}</td><td>${esc(a.qty ?? a.quantidade ?? '—')}</td>${tdExtra}</tr>`;
  }).join('');

  const totKcal  = alimentos.reduce((s, a) => s + (a.kcal   ?? 0), 0);
  const totProt  = alimentos.reduce((s, a) => s + (a.prot_g ?? 0), 0);
  const totCho   = alimentos.reduce((s, a) => s + (a.cho_g  ?? 0), 0);
  const totLip   = alimentos.reduce((s, a) => s + (a.lip_g  ?? 0), 0);
  const totGramas = alimentos.reduce((s, a) => {
    const g = a.gramas ?? (a.qty ? parseFloat(a.qty) : null);
    return s + (g ?? 0);
  }, 0);

  const tdSubExtra = (hasGramas ? `<td>${totGramas ? Math.round(totGramas) + 'g' : '—'}</td>` : '') +
    `<td>${Math.round(totKcal)} kcal</td><td>${totProt.toFixed(1)}g</td>` +
    (hasCho ? `<td>${totCho.toFixed(1)}g</td>` : '') +
    (hasLip ? `<td>${totLip.toFixed(1)}g</td>` : '');

  const subtotalRow = `<tr class="subtotal"><td colspan="2">Subtotal</td>${tdSubExtra}</tr>`;

  return `<table class="alimento-tabela">
    <thead><tr><th>Alimento</th><th>Medida Caseira</th>${thExtra}</tr></thead>
    <tbody>${rows}${subtotalRow}</tbody>
  </table>`;
}

function pagina(conteudo) {
  return `<div class="pagina">${conteudo}</div>`;
}

/* ── Helpers de dados clínicos ──────────────────────────────── */
function _hoje() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function _validoAte() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function _calcImc(kg, alt_cm) {
  if (!kg || !alt_cm) return null;
  return Math.round((kg / ((alt_cm / 100) ** 2)) * 10) / 10;
}
function _classImc(imc) {
  if (imc == null) return '';
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25)   return 'Peso normal';
  if (imc < 30)   return 'Sobrepeso';
  return 'Obesidade';
}
function _calcRcq(cintura, quadril) {
  if (!cintura || !quadril) return null;
  return Math.round((cintura / quadril) * 100) / 100;
}
function _classRcq(rcq) {
  if (rcq == null) return '';
  if (rcq < 0.80) return 'Baixo risco';
  if (rcq < 0.85) return 'Risco moderado';
  return 'Alto risco';
}

/* ── Página 1: Capa ─────────────────────────────────────────── */
function pag1(pacienteNome, macros, e, pacienteDados) {
  const pd = pacienteDados ?? {};
  const imc = _calcImc(pd.peso_kg, pd.altura_cm);
  const rcq = _calcRcq(pd.cintura_cm, pd.quadril_cm);
  const kcalTotal = macros?.kcal ?? 0;

  const cho  = macros?.cho_g  ?? null;
  const prot = macros?.prot_g ?? null;
  const lip  = macros?.lip_g  ?? null;
  const choP  = (cho  != null && kcalTotal > 0) ? Math.round(cho  * 4 / kcalTotal * 100) : null;
  const protP = (prot != null && kcalTotal > 0) ? Math.round(prot * 4 / kcalTotal * 100) : null;
  const lipP  = (lip  != null && kcalTotal > 0) ? Math.round(lip  * 9 / kcalTotal * 100) : null;

  const bioPartes = [
    pd.idade     != null ? `${pd.idade} anos`    : null,
    pd.peso_kg   != null ? `${pd.peso_kg} kg`    : null,
    pd.altura_cm != null ? `${pd.altura_cm} cm`  : null,
    imc          != null ? `IMC ${imc}`           : null,
  ].filter(Boolean);

  function dadoRow(label, val, extra) {
    if (val == null || val === '') return '';
    return `<div class="dado-row">
      <span class="dado-label">${label}</span>
      <span class="dado-val">${esc(String(val))}${extra ? `<span class="dado-extra"> — ${esc(extra)}</span>` : ''}</span>
    </div>`;
  }

  const alertaCintura = (pd.cintura_cm != null && pd.cintura_cm > 80)
    ? `<div class="alerta-cintura">Acima de 80 cm — risco aumentado</div>`
    : '';

  const consultaN = (e?.consulta_n ?? '').trim();

  return pagina(`
  <div class="capa-topo">
    <div class="capa-metodo">MÉTODO PINHEIRO · NUTRIÇÃO FEMININA ESTRATÉGICA</div>
    <div class="capa-plano-it">plano</div>
    <div class="capa-plano-bold">Alimentar</div>
    <div class="capa-nome">${esc((pacienteNome ?? '').toUpperCase())}</div>
    ${bioPartes.length ? `<div class="capa-bio">${bioPartes.map(esc).join(' · ')}</div>` : ''}
    ${pd.objetivo ? `<div class="capa-objetivo">Objetivo: ${esc(pd.objetivo)}</div>` : ''}
    <div class="capa-sep"></div>
    <div class="capa-consulta">${consultaN ? `CONSULTA Nº ${esc(consultaN)} · ` : ''}${_hoje()} · NUTRICIONISTA JÚLIA PINHEIRO | CRN 20100737</div>
  </div>
  <div class="dados-macros">
    <div>
      <div class="secao-titulo">Dados da Paciente</div>
      <div class="dados-rows">
        ${dadoRow('Peso', pd.peso_kg != null ? `${pd.peso_kg} kg` : null)}
        ${dadoRow('Altura', pd.altura_cm != null ? `${pd.altura_cm} cm` : null)}
        ${dadoRow('IMC', imc != null ? imc : null, imc != null ? _classImc(imc) : null)}
        ${dadoRow('% Gordura corporal', pd.pgc != null ? `${pd.pgc}%` : null)}
        ${pd.cintura_cm != null ? dadoRow('Circ. abdominal', `${pd.cintura_cm} cm`) + alertaCintura : ''}
        ${dadoRow('Quadril', pd.quadril_cm != null ? `${pd.quadril_cm} cm` : null)}
        ${dadoRow('RCQ', rcq != null ? rcq : null, rcq != null ? _classRcq(rcq) : null)}
        ${dadoRow('Retorno', '30 dias')}
        ${dadoRow('Válido até', _validoAte())}
      </div>
    </div>
    <div>
      <div class="macros-titulo">Macronutrientes do Plano</div>
      <div class="macros-grid">
        <div class="macro-box">
          <div class="macro-nome">carboidratos</div>
          <div class="macro-val">${cho != null ? cho : '—'}<span class="macro-unit">g</span></div>
          ${choP != null ? `<div class="macro-pct">${choP}%</div>` : ''}
          <div class="macro-cat">Energia</div>
        </div>
        <div class="macro-box">
          <div class="macro-nome">proteínas</div>
          <div class="macro-val">${prot != null ? prot : '—'}<span class="macro-unit">g</span></div>
          ${protP != null ? `<div class="macro-pct">${protP}%</div>` : ''}
          <div class="macro-cat">Construção muscular</div>
        </div>
        <div class="macro-box">
          <div class="macro-nome">gorduras</div>
          <div class="macro-val">${lip != null ? lip : '—'}<span class="macro-unit">g</span></div>
          ${lipP != null ? `<div class="macro-pct">${lipP}%</div>` : ''}
          <div class="macro-cat">Saúde hormonal</div>
        </div>
      </div>
      <div class="calorias-total"><strong>${kcalTotal ? Math.round(kcalTotal) : '—'} kcal</strong> · total diário</div>
      ${(e?.agua_diaria ?? '').trim() ? `<div class="circunf-grid" style="margin-top:10px"><div class="circunf-box"><div class="circunf-nome">água/dia</div><div class="circunf-val">${esc((e.agua_diaria ?? '').trim())}</div></div></div>` : ''}
    </div>
  </div>`);
}

function pag2(e) {
  const prio = bullets(e.prioridades);
  const supl = bullets(e.suplementos);
  const metas = bullets(e.metas);
  if (!prio && !supl && !metas) return '';
  return pagina(`
  <div class="pms-grid">
    <div>
      ${prio ? `<div class="pms-box"><div class="pms-titulo">prioridades</div><ul class="pms-body">${prio}</ul></div>` : ''}
      ${supl ? `<div class="pms-box" style="margin-top:16px"><div class="pms-titulo">suplemento</div><ul class="pms-body">${supl}</ul></div>` : ''}
    </div>
    ${metas ? `<div class="pms-box" style="height:fit-content"><div class="pms-titulo">metas</div><ul class="pms-body">${metas}</ul></div>` : ''}
  </div>`);
}

function pagRef(ref, idx, e, subsTexto) {
  const sugestao = e.sugestoes?.[idx] ?? '';
  const nota = e.notas?.[idx] ?? '';
  const mealKey = normMealKey(ref.nome ?? '');
  const subs = subsHtml(mealKey, subsTexto);

  const macrosParts = [
    ref.kcal   ? `${ref.kcal} kcal`         : null,
    ref.prot_g ? `${ref.prot_g}g prot`      : null,
    ref.cho_g  ? `${ref.cho_g}g cho`        : null,
    ref.lip_g  ? `${ref.lip_g}g lip`        : null,
  ].filter(Boolean);
  const horarioLinha = [ref.horario, ...macrosParts].filter(Boolean).join(' · ');

  return pagina(`
  <div class="refeicao">
    <div class="ref-titulo">${esc((ref.nome ?? '').toLowerCase())}</div>
    ${horarioLinha ? `<div class="ref-horario">${esc(horarioLinha)}</div>` : ''}
    <div class="ref-sugestao-label">Sugestão da nutri:</div>
    ${foodTable(ref.alimentos)}
    ${sugestao ? `<div class="ref-sugestao">Sugestão da nutri: ${esc(sugestao)}</div>` : ''}
    ${subs}
    ${nota ? `<div class="ref-nota">${esc(nota)}</div>` : ''}
  </div>`);
}

function pagTotais(e) {
  const veg = e.vegetais_liberados ?? 'Acelga, Agrião, Alface, Almeirão, Abobrinha, Berinjela, Beterraba, Brócolis, Cebola, Cenoura, Chicória, Chuchu, Couve, Couve-flor, Cogumelo, Espinafre, Maxixe, Nabo, Pepino, Pimentão, Quiabo, Rabanete, Repolho, Rúcula, Tomate';
  return pagina(`
  <div style="text-align:center;margin-bottom:16px">
    <div class="liberados-titulo-it">alimentos</div>
    <div class="liberados-titulo-bold">liberados</div>
    <div style="font-size:7.5px;letter-spacing:2px;text-transform:uppercase;color:var(--verde);margin-bottom:12px;font-weight:700">
      Lista de Vegetais e Legumes à Vontade — Coma o Quanto Quiser
    </div>
    <div class="liberados-caixa">${esc(veg)}</div>
    <div class="liberados-nota">
      Cru, cozido ou assado. Tempere com limão, vinagre, azeite (1 col. chá),
      cúrcuma, salsa, cebolinha, alho, orégano, coentro, alecrim, manjericão.
    </div>
  </div>`);
}

function pagOrientacoes(e) {
  const og = bullets(e.orientacoes_gerais);
  const ar = bullets(e.alimentos_reduzir);
  const obs = e.obs_personalizadas ?? '';
  const at = bullets(e.atencao);
  if (!og && !ar && !obs && !at) return '';
  return pagina(`
  <div class="secao-titulo" style="margin-bottom:14px">Orientações Personalizadas</div>
  <div class="orient-grid">
    ${og ? `<div class="orient-card"><div class="orient-card-titulo">Orientações Gerais</div><ul class="orient-card-body">${og}</ul></div>` : '<div></div>'}
    ${ar ? `<div class="orient-card"><div class="orient-card-titulo">Alimentos a Reduzir</div><ul class="orient-card-body">${ar}</ul></div>` : '<div></div>'}
  </div>
  ${obs ? `<div class="orient-card" style="margin-top:10px"><div class="orient-card-titulo">Observações Personalizadas</div><ul class="orient-card-body">${bullets(obs)}</ul></div>` : ''}
  ${at ? `<div class="atencao-box"><div class="atencao-titulo">A T E N Ç Ã O</div><ul class="atencao-body">${at}</ul></div>` : ''}`);
}

function pagEncerramento(pacienteNome, e, nutriNome, nutriCrn, nutriEmail) {
  const frase = e.frase_encerramento ?? '"Quem você quer ser é inegociável."';
  const validade = e.validade ?? '';
  return pagina(`
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:220mm">
    <div class="enc-frase">${esc(frase).replace(/\\n/g,'<br>')}</div>
    <div class="enc-nome">
      ${esc(nutriNome ? `Nutricionista ${nutriNome}` : '')}${nutriCrn ? ` · CRN ${esc(nutriCrn)}` : ''}<br>
      ${esc(nutriEmail ?? '')}
    </div>
    ${validade ? `<div class="enc-validade">Plano elaborado exclusivamente para ${esc(pacienteNome)} · Válido até ${esc(validade)}</div>` : ''}
  </div>`);
}

const CSS = `
.btn-container{position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:10px;z-index:999}
.btn-pdf{background:#95380A;color:#FFF;border:none;border-radius:6px;padding:12px 24px;font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;text-transform:uppercase}
.btn-word{background:#173103;color:#FFF;border:none;border-radius:6px;padding:12px 24px;font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;text-transform:uppercase}
.btn-voltar{background:transparent;color:#173103;border:1.5px solid #173103;border-radius:6px;padding:10px 20px;font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;text-transform:uppercase}
.btn-pdf:hover{background:#7a2d08}
.btn-word:hover{background:#0d1d02}
.btn-voltar:hover{background:#173103;color:#FFF}
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  html,body{width:210mm;background:white!important;margin:0;padding:0}
  .btn-container{display:none!important}
  .pagina{width:210mm!important;min-height:297mm!important;margin:0!important;padding:16mm 16mm 16mm 20mm!important;box-shadow:none!important;page-break-after:always}
  .pagina:last-child{page-break-after:avoid}
  @page{size:A4;margin:0}
}
:root{--verde:#173103;--terra:#95380A;--bege:#E9E5DD;--begeR:#DED3C6;--branco:#FFF;--txt:#173103;--txtL:#5a5a5a;--ok:#173103;--warn:#b97d00;--err:#c0392b}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Poppins',sans-serif;font-weight:300;background:#E9E5DD;color:var(--txt);font-size:10.5px;line-height:1.6;-webkit-font-smoothing:antialiased}
.pagina{width:210mm;min-height:297mm;margin:0 auto 16px auto;background:#FFF;padding:16mm 16mm 16mm 20mm;position:relative;box-shadow:0 2px 16px rgba(0,0,0,.10);overflow:hidden}
.pagina::before{content:'';position:absolute;left:0;top:0;width:5px;height:100%;background:linear-gradient(180deg,#95380A 0%,#173103 100%)}
.refeicao{page-break-inside:avoid;margin-bottom:14px}
.grupo{page-break-inside:avoid;margin-bottom:8px}
.pms-grid{page-break-inside:avoid}
.orient-card{page-break-inside:avoid}
.atencao-box{page-break-inside:avoid}
.liberados-caixa{page-break-inside:avoid}
h1,h2,h3{page-break-after:avoid}
.secao-titulo{font-family:'Lato',sans-serif;font-size:7.5px;letter-spacing:3px;text-transform:uppercase;color:var(--verde);margin-bottom:12px;font-weight:700}
/* ── Capa ── */
.capa-topo{text-align:center;padding:24px 0 16px 0;border-bottom:1px solid var(--begeR);margin-bottom:24px}
.capa-metodo{font-family:'Lato',sans-serif;font-size:9px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:var(--terra);margin-bottom:20px}
.capa-plano-it{font-family:'Playfair Display',serif;font-style:italic;font-size:24px;font-weight:400;color:var(--txtL);line-height:1;margin-bottom:2px}
.capa-plano-bold{font-family:'Playfair Display',serif;font-size:58px;font-weight:700;color:var(--verde);line-height:1;margin-bottom:18px;letter-spacing:-1px}
.capa-nome{font-family:'Lato',sans-serif;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:var(--txt);margin-bottom:8px;font-weight:500}
.capa-bio{font-size:10px;color:var(--txtL);margin-bottom:6px;letter-spacing:.5px}
.capa-objetivo{font-size:10px;color:var(--txtL);margin-bottom:16px}
.capa-sep{border-top:1px solid var(--begeR);margin:0 40px 10px}
.capa-consulta{font-family:'Lato',sans-serif;font-size:8px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:var(--txtL)}
/* ── Dados + Macros ── */
.dados-macros{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:16px}
.dados-rows{}
.dado-row{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--bege)}
.dado-label{font-family:'Lato',sans-serif;font-size:7.5px;letter-spacing:1.5px;text-transform:uppercase;color:var(--txtL);font-weight:500}
.dado-val{font-size:11px;color:var(--txt);font-weight:500;text-align:right}
.dado-extra{font-size:9px;color:var(--terra);font-weight:400}
.alerta-cintura{font-size:8px;color:var(--err);padding:2px 0 4px 0;letter-spacing:.3px;text-align:right}
/* ── Macros ── */
.macros-titulo{font-family:'Playfair Display',serif;font-size:18px;color:var(--verde);margin-bottom:12px}
.macros-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}
.macro-box{background:var(--bege);border-radius:6px;padding:10px 6px;text-align:center}
.macro-nome{font-family:'Playfair Display',serif;font-style:italic;font-size:10px;color:var(--txtL);margin-bottom:4px}
.macro-val{font-family:'Playfair Display',serif;font-size:20px;color:var(--verde);font-weight:700;line-height:1}
.macro-unit{font-size:8px;color:var(--terra)}
.macro-pct{font-size:9px;color:var(--terra);font-weight:600;margin-top:2px}
.macro-cat{font-size:7px;color:var(--txtL);margin-top:2px;letter-spacing:.3px}
.calorias-total{text-align:center;font-size:10px;color:var(--txtL);margin-top:6px}
.calorias-total strong{color:var(--verde);font-size:13px}
.circunf-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.circunf-box{background:var(--bege);border-radius:6px;padding:8px;text-align:center}
.circunf-nome{font-family:'Playfair Display',serif;font-style:italic;font-size:9px;color:var(--txtL)}
.circunf-val{font-size:14px;font-weight:600;color:var(--verde)}
/* ── Demais ── */
.pms-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pms-box{background:var(--bege);border-radius:6px;padding:14px;margin-bottom:0}
.pms-titulo{font-family:'Playfair Display',serif;font-style:italic;font-size:20px;color:var(--verde);margin-bottom:10px;line-height:1}
.pms-body{font-size:10px;color:var(--txt);line-height:1.8}
.pms-body li{list-style:none;padding-left:12px;position:relative;margin-bottom:1px}
.pms-body li::before{content:'—';position:absolute;left:0;color:var(--terra)}
.ref-titulo{font-family:'Playfair Display',serif;font-style:italic;font-size:28px;color:var(--verde);line-height:1;margin-bottom:2px}
.ref-horario{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--txtL);margin-bottom:10px}
.ref-sugestao-label{font-family:'Lato',sans-serif;font-size:7px;letter-spacing:2.5px;text-transform:uppercase;color:var(--txtL);font-weight:600;margin-bottom:4px}
.ref-sugestao{font-style:italic;font-size:10px;color:var(--txtL);margin-bottom:10px}
.cat-prefix{color:var(--txtL);font-size:9.5px}
.alimento-tabela{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10px}
.alimento-tabela th{font-family:'Lato',sans-serif;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--txtL);padding:4px 6px;text-align:left;border-bottom:1px solid var(--begeR)}
.alimento-tabela td{padding:5px 6px;border-bottom:1px solid var(--bege);color:var(--txt)}
.alimento-tabela tr:last-child td{border-bottom:none}
.alimento-tabela .subtotal td{font-weight:600;color:var(--verde);background:var(--bege);font-size:9px}
.grupo-label{font-family:'Lato',sans-serif;font-size:7px;letter-spacing:2px;text-transform:uppercase;color:var(--terra);font-weight:700;text-align:center;margin-bottom:4px}
.grupo-caixa{background:var(--bege);border-radius:6px;padding:10px 16px;text-align:center;font-size:10px;color:var(--txt);line-height:1.9}
.ref-nota{font-size:9px;font-style:italic;color:var(--terra);margin-top:6px;padding:6px 10px;background:#fdf3ee;border-radius:4px;border-left:3px solid var(--terra)}
.liberados-titulo-it{font-family:'Playfair Display',serif;font-style:italic;font-size:18px;color:var(--txtL);line-height:1}
.liberados-titulo-bold{font-family:'Playfair Display',serif;font-size:36px;font-weight:700;color:var(--verde);line-height:1;margin-bottom:16px}
.liberados-caixa{background:var(--bege);border-radius:6px;padding:18px 24px;font-size:11px;color:var(--txt);line-height:2;text-align:center;margin-bottom:8px}
.liberados-nota{font-size:9px;color:var(--txtL);font-style:italic;text-align:center}
.orient-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.orient-card{background:var(--bege);border-radius:6px;padding:12px}
.orient-card-titulo{font-family:'Lato',sans-serif;font-size:7px;letter-spacing:2px;text-transform:uppercase;color:var(--terra);font-weight:700;margin-bottom:8px}
.orient-card-body{font-size:9.5px;color:var(--txt);line-height:1.8}
.orient-card-body li{list-style:none;padding-left:12px;position:relative;margin-bottom:2px}
.orient-card-body li::before{content:'—';position:absolute;left:0;color:var(--terra)}
.atencao-box{border:1.5px solid var(--begeR);border-radius:6px;padding:16px 20px;margin-top:12px}
.atencao-titulo{font-family:'Playfair Display',serif;font-size:15px;letter-spacing:2px;color:var(--verde);text-align:center;margin-bottom:12px}
.atencao-body{font-size:9.5px;color:var(--txt);line-height:1.9}
.atencao-body li{list-style:none;padding-left:12px;position:relative;margin-bottom:2px}
.atencao-body li::before{content:'—';position:absolute;left:0;color:var(--terra)}
.enc-frase{font-family:'Playfair Display',serif;font-style:italic;font-size:26px;color:var(--verde);line-height:1.4;margin-bottom:28px;max-width:480px;text-align:center}
.enc-nome{font-family:'Lato',sans-serif;font-size:8px;letter-spacing:3px;text-transform:uppercase;color:var(--txtL);line-height:2;text-align:center}
.enc-validade{font-size:9px;color:var(--txtL);margin-top:14px;text-align:center}
`;

export function gerarPlanoHtml({ pacienteNome, plano, extras, subsTexto, nutriNome, nutriCrn, nutriEmail, pacienteDados }) {
  const e = extras ?? {};
  const macros = plano?.macros ?? {};
  const refeicoes = plano?.refeicoes ?? [];

  const subsEfetivo = subsTexto ?? plano?.subs_texto ?? null;

  const paginas = [
    pag1(pacienteNome, macros, e, pacienteDados),
    pag2(e),
    ...refeicoes.map((ref, i) => pagRef(ref, i, e, subsEfetivo)),
    pagCustomMeals(subsEfetivo),
    pagTotais(e),
    pagOrientacoes(e),
    pagEncerramento(pacienteNome, e, nutriNome, nutriCrn, nutriEmail),
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Plano Alimentar — ${esc(pacienteNome)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Poppins:wght@300;400;500&family=Lato:wght@300;400;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>${CSS}</style>
</head>
<body>
<div class="btn-container">
  <button class="btn-voltar" onclick="window.close()">&#8592; Voltar ao app</button>
  <button class="btn-word" onclick="baixarWord()">&#8659; Baixar Word</button>
  <button class="btn-pdf" onclick="baixarPdf()">&#8659; Baixar PDF</button>
</div>
<div id="plano-content">
${paginas.join('\n')}
</div>
<script>
function baixarPdf() {
  var btn = document.querySelector('.btn-container');
  if (btn) btn.style.display = 'none';
  var nomeTitulo = document.title.replace('Plano Alimentar — ', '').replace('Plano Alimentar - ', '').trim();
  var s = nomeTitulo;
  if (s.normalize) s = s.normalize('NFD');
  s = s.replace(/[^A-Za-z0-9 ]/g, '').toLowerCase().trim().replace(/ +/g, '_');
  var nomeArq = s || 'plano';
  document.fonts.ready.then(function() {
    html2pdf().from(document.getElementById('plano-content')).set({
      margin: 0,
      filename: 'plano_' + nomeArq + '.pdf',
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css'] }
    }).save().then(function() {
      if (btn) btn.style.display = 'flex';
    }).catch(function() {
      if (btn) btn.style.display = 'flex';
      window.print();
    });
  });
}
function baixarWord() {
  var nome = document.title.replace(/[<>:"/\\|?*]/g, '').trim();
  var estilos = Array.from(document.styleSheets).map(function(s) {
    try { return Array.from(s.cssRules).map(function(r){return r.cssText}).join('\\n'); } catch(e){return '';}
  }).join('\\n');
  var conteudo = document.getElementById('plano-content').innerHTML;
  var html = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>' + estilos + '</style></head><body>' + conteudo + '</body></html>';
  var blob = new Blob(['\\uFEFF', html], { type: 'application/msword' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = nome + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>
</body>
</html>`;
}
