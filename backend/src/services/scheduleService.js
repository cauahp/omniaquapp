
export const FUSO_HORARIO =
  process.env.TZ_AGENDAMENTOS || "America/Recife";

// Valida e padroniza os dias da semana.
export function normalizarDiasSemana(dias = "ALL") {
  if (dias === "ALL") {
    return "ALL";
  }

  const lista = Array.isArray(dias)
    ? dias
    : typeof dias === "string"
      ? dias.split(",")
      : [];

  if (
    lista.length === 0 ||
    lista.some(dia => !/^[1-7]$/.test(String(dia)))
  ) {
    throw new Error(
      "Selecione dias da semana válidos."
    );
  }

  const normalizados = [...new Set(lista.map(Number))]
    .sort((a, b) => a - b);

  return normalizados.length === 7
    ? "ALL"
    : normalizados.join(",");
}

// Obtém o horário e o dia no fuso configurado.
export function obterHorarioAtual(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO_HORARIO,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(data);

  const valores = Object.fromEntries(
    partes.map(parte => [parte.type, parte.value])
  );

  const dias = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  };

  return {
    horario: `${valores.hour}:${valores.minute}:00`,
    diaSemana: dias[valores.weekday]
  };
}

// Verifica se o agendamento deve executar hoje.
export function deveExecutarHoje(dias, diaSemana) {
  const normalizados = normalizarDiasSemana(dias);

  if (normalizados === "ALL") {
    return true;
  }

  return normalizados
    .split(",")
    .includes(String(diaSemana));
}
