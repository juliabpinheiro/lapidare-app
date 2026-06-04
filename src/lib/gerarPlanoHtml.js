function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const _CAT_LABELS = { carbo: 'Carboidrato', prot: 'Proteína', leg: 'Leguminosa', fruta: 'Fruta', bebida: 'Bebida' };
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
  return (text + '').split('\n').filter(l => l.trim()).map(l => `<li>${esc(l.trim())}</li>`).join('');
}

function subsHtml(mealKey, subsTexto) {
  if (!subsTexto || !mealKey) return '';
  if ((subsTexto._meta?.removed ?? []).includes(mealKey)) return '';
  const cats = subsTexto[mealKey];
  if (!cats) return '';
  const order = _CAT_ORDER[mealKey] ?? Object.keys(cats);
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
    return `<tr><td>${esc(a.nome)}</td><td>${esc(a.qty ?? a.quantidade ?? '—')}</td>${tdExtra}</tr>`;
  }).join('');

  return `<table class="alimento-tabela">
    <thead><tr><th>Alimento</th><th>Medida Caseira</th>${thExtra}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function pagina(conteudo) {
  return `<div class="pagina">${conteudo}</div>`;
}

function pag1(pacienteNome, macros, e) {
  const cho = fmtNum(macros?.cho_g);
  const prot = fmtNum(macros?.prot_g);
  const lip = fmtNum(macros?.lip_g);
  const kcal = fmtNum(macros?.kcal);
  const fibras = macros?.fibras_g ? `${macros.fibras_g}g` : '—';
  const agua = macros?.agua_l ? `${macros.agua_l}L` : '—';
  const dadosPac = (e.dados_paciente ?? '').split('\n').filter(l => l.trim())
    .map(l => esc(l)).join('<br>') || '—';

  return pagina(`
  <div style="text-align:center;padding:24px 0 20px 0;border-bottom:1px solid var(--begeR);margin-bottom:24px">
    <div style="font-family:'Lato',sans-serif;font-size:9px;font-weight:500;letter-spacing:4px;text-transform:uppercase;color:var(--terra);margin-bottom:20px">
      Método Pinheiro · Nutrição Feminina Estratégica
    </div>
    <div style="font-family:'Playfair Display',serif;font-style:italic;font-size:24px;font-weight:400;color:var(--txtL);line-height:1;margin-bottom:2px">plano</div>
    <div style="font-family:'Playfair Display',serif;font-size:58px;font-weight:700;color:var(--verde);line-height:1;margin-bottom:18px;letter-spacing:-1px">Alimentar</div>
    <div style="font-family:'Lato',sans-serif;font-size:9px;letter-spacing:4px;text-transform:uppercase;color:var(--txt);margin-bottom:6px">${esc(pacienteNome?.toUpperCase())}</div>
    <div style="font-size:10px;color:var(--txtL);line-height:1.9">
      ${esc(e.capa_info ?? '')}<br>
      Objetivo: ${esc(e.capa_objetivo ?? '')}
    </div>
    <div style="font-family:'Lato',sans-serif;font-size:9px;font-weight:500;letter-spacing:3px;text-transform:uppercase;color:var(--txtL);margin-top:12px">
      ${esc(e.consulta_info ?? '')}
    </div>
  </div>
  <div class="dados-macros">
    <div>
      <div class="secao-titulo">Dados da Paciente</div>
      <div class="dados-paciente">${dadosPac}</div>
    </div>
    <div>
      <div class="macros-titulo">Macronutrientes do Plano</div>
      <div class="macros-grid">
        <div class="macro-box">
          <div class="macro-nome">carboidratos</div>
          <div class="macro-val">${cho}<span class="macro-unit">g</span></div>
        </div>
        <div class="macro-box">
          <div class="macro-nome">proteínas</div>
          <div class="macro-val">${prot}<span class="macro-unit">g</span></div>
        </div>
        <div class="macro-box">
          <div class="macro-nome">gorduras</div>
          <div class="macro-val">${lip}<span class="macro-unit">g</span></div>
        </div>
      </div>
      <div class="calorias-total"><strong>${kcal} kcal</strong> · total diário</div>
      <div class="circunf-grid" style="margin-top:10px">
        <div class="circunf-box"><div class="circunf-nome">fibras</div><div class="circunf-val">${fibras}</div></div>
        <div class="circunf-box"><div class="circunf-nome">água/dia</div><div class="circunf-val">${agua}</div></div>
      </div>
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
  const horarioLinha = [ref.horario, ref.kcal ? ref.kcal + ' kcal' : null].filter(Boolean).join(' · ');

  return pagina(`
  <div class="refeicao">
    <div class="ref-titulo">${esc((ref.nome ?? '').toLowerCase())}</div>
    ${horarioLinha ? `<div class="ref-horario">${esc(horarioLinha)}</div>` : ''}
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
.btn-pdf:hover{background:#7a2d08}
@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  html,body{width:210mm;background:white!important;margin:0;padding:0}
  .btn-container{display:none!important}
  .pagina{width:210mm!important;min-height:297mm!important;margin:0!important;padding:16mm 16mm 16mm 20mm!important;box-shadow:none!important;page-break-after:always}
  .pagina:last-child{page-break-after:avoid}
  @page{size:A4;margin:0}
}
:root{--verde:#173103;--terra:#95380A;--bege:#E9E5DD;--begeR:#DED3C6;--branco:#FFF;--txt:#1a1a1a;--txtL:#5a5a5a;--ok:#173103;--warn:#b97d00;--err:#c0392b}
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
.dados-macros{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:16px}
.dados-paciente{font-size:10px;color:var(--txtL);line-height:2}
.dados-paciente strong{color:var(--txt);font-weight:500}
.macros-titulo{font-family:'Playfair Display',serif;font-size:18px;color:var(--verde);margin-bottom:12px}
.macros-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px}
.macro-box{background:var(--bege);border-radius:6px;padding:10px 6px;text-align:center}
.macro-nome{font-family:'Playfair Display',serif;font-style:italic;font-size:10px;color:var(--txtL);margin-bottom:4px}
.macro-val{font-family:'Playfair Display',serif;font-size:20px;color:var(--verde);font-weight:700;line-height:1}
.macro-unit{font-size:8px;color:var(--terra)}
.calorias-total{text-align:center;font-size:10px;color:var(--txtL);margin-top:6px}
.calorias-total strong{color:var(--verde);font-size:13px}
.circunf-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.circunf-box{background:var(--bege);border-radius:6px;padding:8px;text-align:center}
.circunf-nome{font-family:'Playfair Display',serif;font-style:italic;font-size:9px;color:var(--txtL)}
.circunf-val{font-size:14px;font-weight:600;color:var(--verde)}
.pms-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pms-box{background:var(--bege);border-radius:6px;padding:14px;margin-bottom:0}
.pms-titulo{font-family:'Playfair Display',serif;font-style:italic;font-size:20px;color:var(--verde);margin-bottom:10px;line-height:1}
.pms-body{font-size:10px;color:var(--txt);line-height:1.8}
.pms-body li{list-style:none;padding-left:12px;position:relative;margin-bottom:1px}
.pms-body li::before{content:'—';position:absolute;left:0;color:var(--terra)}
.ref-titulo{font-family:'Playfair Display',serif;font-style:italic;font-size:28px;color:var(--verde);line-height:1;margin-bottom:2px}
.ref-horario{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:var(--txtL);margin-bottom:10px}
.ref-sugestao{font-style:italic;font-size:10px;color:var(--txtL);margin-bottom:10px}
.alimento-tabela{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10px}
.alimento-tabela th{font-family:'Lato',sans-serif;font-size:7px;letter-spacing:1.5px;text-transform:uppercase;color:var(--txtL);padding:4px 6px;text-align:left;border-bottom:1px solid var(--begeR)}
.alimento-tabela td{padding:5px 6px;border-bottom:1px solid var(--bege);color:var(--txt)}
.alimento-tabela tr:last-child td{border-bottom:none}
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

export function gerarPlanoHtml({ pacienteNome, plano, extras, subsTexto, nutriNome, nutriCrn, nutriEmail }) {
  const e = extras ?? {};
  const macros = plano?.macros ?? {};
  const refeicoes = plano?.refeicoes ?? [];

  const paginas = [
    pag1(pacienteNome, macros, e),
    pag2(e),
    ...refeicoes.map((ref, i) => pagRef(ref, i, e, subsTexto)),
    pagCustomMeals(subsTexto),
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
<style>${CSS}</style>
</head>
<body>
<div class="btn-container">
  <button class="btn-pdf" onclick="window.print()">⬇ Baixar PDF</button>
</div>
<div id="plano-content">
${paginas.join('\n')}
</div>
</body>
</html>`;
}
