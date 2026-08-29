// Cálculos do "Resumo" da paciente (hábitos, medidas, check-ins, evolução).
// Usado tanto no dashboard /nutri/resumo (todas as pacientes) quanto na
// aba Resumo dentro do perfil de uma paciente.

export function cutoffISO(dias = 30) {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
}

// Mesmo critério de "bateu meta" usado em app/paciente/Habitos.jsx
export function bateuMeta(habito, valor) {
  if (habito.tipo === 'boolean') return valor >= 1;
  if (habito.tipo === 'numero') return habito.meta ? valor >= habito.meta : valor > 0;
  if (habito.tipo === 'escala') return valor >= 4;
  return false;
}

// habitosPaciente: linhas de `habitos` de UMA paciente
// logsPaciente: linhas de `habitos_logs` de UMA paciente (já filtradas pelos últimos `dias`)
export function resumoHabitos(habitosPaciente, logsPaciente, dias = 30) {
  const logsPorHabito = new Map();
  for (const log of logsPaciente) {
    if (!logsPorHabito.has(log.habito_id)) logsPorHabito.set(log.habito_id, []);
    logsPorHabito.get(log.habito_id).push(log);
  }

  const porHabito = habitosPaciente.filter(h => h.ativo).map(h => {
    const logs = logsPorHabito.get(h.id) ?? [];
    const diasComMeta = logs.filter(l => bateuMeta(h, l.valor)).length;
    return {
      id: h.id, nome: h.nome, emoji: h.emoji, tipo: h.tipo, meta: h.meta, unidade: h.unidade,
      pct: Math.round((diasComMeta / dias) * 100),
    };
  });

  function mediaPorNome(regex) {
    const alvo = habitosPaciente.filter(h => h.tipo === 'numero' && regex.test(h.nome));
    const valores = alvo.flatMap(h => logsPorHabito.get(h.id) ?? []).map(l => Number(l.valor));
    if (!valores.length) return null;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  }

  return {
    mediaAgua: mediaPorNome(/água|agua/i),
    mediaSono: mediaPorNome(/sono/i),
    porHabito,
  };
}

// pesoRegistrosPaciente: linhas de `peso_registros` de UMA paciente
export function ultimaMedida(pesoRegistrosPaciente) {
  if (!pesoRegistrosPaciente.length) return null;
  return [...pesoRegistrosPaciente].sort((a, b) => b.data.localeCompare(a.data))[0];
}

export function evolucaoPeso(pesoRegistrosPaciente) {
  if (pesoRegistrosPaciente.length < 2) return null;
  const ordenados = [...pesoRegistrosPaciente].sort((a, b) => a.data.localeCompare(b.data));
  const primeiro = ordenados[0];
  const ultimo = ordenados[ordenados.length - 1];
  const diff = (a, b) => (a != null && b != null ? b - a : null);
  return {
    primeiro, ultimo,
    deltaKg: diff(primeiro.kg, ultimo.kg),
    deltaCintura: diff(primeiro.cintura_cm, ultimo.cintura_cm),
    deltaPgc: diff(primeiro.pgc, ultimo.pgc),
  };
}
