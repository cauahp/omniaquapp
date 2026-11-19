
export default class PumpService {
  constructor(apiUrl = "http://localhost:3000/api") {
    this.apiUrl = apiUrl;
  }

  // Dados demonstrativos das soluções
  getPumps() {
    return [
      {
        id: 1,
        solucao: "Cálcio (Ca)",
        cor: "#74e3d2",
        volume: 5,
        horario: "08:00"
      },
      {
        id: 2,
        solucao: "Alcalinidade (KH)",
        cor: "#94cfff",
        volume: 5,
        horario: "08:10"
      },
      {
        id: 3,
        solucao: "Magnésio (Mg)",
        cor: "#c3b4fa",
        volume: 5,
        horario: "08:20"
      }
    ];
  }

  // Validação dos dados de dosagem
  validateDose(id, volume) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Identificador de bomba inválido.");
    }

    if (!Number.isFinite(volume) || volume <= 0) {
      throw new Error("Informe um volume maior que zero.");
    }
  }

  // Dosagem demonstrativa
  async doseNow(id, volume) {
    this.validateDose(id, volume);

    await Promise.resolve();

    return {
      id_bomba: id,
      volume_ml: volume,
      modo: "demonstracao"
    };
  }

  // Agendamento demonstrativo
  async scheduleDose(id, volume, time) {
    this.validateDose(id, volume);

    if (
      typeof time !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ) {
      throw new Error("Informe um horário válido no formato HH:MM.");
    }

    await Promise.resolve();

    return {
      id_bomba: id,
      volume_ml: volume,
      horario: time,
      modo: "demonstracao"
    };
  }
}
