
export default class PumpService {
  constructor(apiUrl = "http://localhost:3000/api") {
    this.apiUrl = apiUrl;
  }

  async getPumps() {
  const bombas = await this.request("/bombas");

  if (!Array.isArray(bombas)) {
    throw new Error("Resposta inválida ao consultar as bombas.");
  }

  return bombas.map(bomba => ({
    id: Number(bomba.id),
    nome: bomba.nome,
    solucao: bomba.solucao,
    cor: bomba.cor,
    vazao: Number(bomba.vazao_ml_min),
    capacidade: Number(bomba.capacidade_recipiente_ml),
    volumeRestante: Number(bomba.volume_restante_ml),
    volume: "",
    horario: ""
  }));
}

  validateDose(id, volume) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error("Identificador de bomba inválido.");
    }

    if (!Number.isFinite(volume) || volume <= 0) {
      throw new Error("Informe um volume maior que zero.");
    }
  }

  // Centraliza as requisições HTTP e o tratamento de erros.
  async request(endpoint, options = {}) {
    let resposta;

    try {
      resposta = await fetch(`${this.apiUrl}${endpoint}`, options);
    } catch {
      throw new Error(
        "Falha de comunicação com o servidor. Verifique o estado da operação antes de repetir."
      );
    }

    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      throw new Error(
        dados?.detalhe ||
        dados?.erro ||
        `Erro na API: ${resposta.status}`
      );
    }

    if (!dados) {
      throw new Error(
        "Resposta inválida do servidor. Verifique o estado da operação antes de repetir."
      );
    }

    return dados;
  }

  // Envia uma solicitação de dosagem manual.
  async doseNow(id, volume) {
    this.validateDose(id, volume);

    return this.request(`/bombas/${id}/dosar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        volume_ml: volume
      })
    });
  }

  // Cadastra um agendamento de dosagem.
  async scheduleDose(id, volume, time) {
    this.validateDose(id, volume);

    if (
      typeof time !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ) {
      throw new Error("Informe um horário válido no formato HH:MM.");
    }

    return this.request("/agendamentos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bomba_id: id,
        volume_ml: volume,
        horario: time
      })
    });
  }
}
