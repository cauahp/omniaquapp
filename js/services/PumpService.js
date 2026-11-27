
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
    throw new Error(
      "Identificador de bomba inválido."
    );
  }

  if (!Number.isFinite(volume) || volume <= 0) {
    throw new Error(
      "Informe um volume maior que zero."
    );
  }

  if (volume > 999.99) {
    throw new Error(
      "O volume não pode ultrapassar 999,99 ml."
    );
  }

  if (
    Math.abs(
      volume * 100 - Math.round(volume * 100)
    ) > 0.000001
  ) {
    throw new Error(
      "Informe um volume com até duas casas decimais."
    );
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

// Consulta a disponibilidade do dispositivo.
async getDeviceStatus() {
  return this.request("/dispositivo/status", {
    cache: "no-store",
    signal: AbortSignal.timeout(3000)
  });
}

// Consulta o status de uma dosagem pelo identificador.
async getDoseStatus(comandoId) {
  return this.request(
    `/historico/${encodeURIComponent(comandoId)}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(5000)
    }
  );
}

// Aguarda a confirmação da execução pelo dispositivo.

async waitForDoseConfirmation(
  comandoId,
  timeout = 50000
) {
  const inicio = Date.now();

  const statusFinais = [
    "CONCLUIDO",
    "FALHA",
    "FALHA_PUBLICACAO",
    "PUBLICACAO_INCERTA",
    "SEM_CONFIRMACAO"
  ];

  while (Date.now() - inicio < timeout) {
    try {
      const dosagem = await this.getDoseStatus(
        comandoId
      );

      const status = String(
        dosagem.status || ""
      );

      if (
        statusFinais.includes(status) ||
        status.startsWith("ERRO_")
      ) {
        return dosagem;
      }

    } catch (erro) {
      console.warn(
        "Aguardando confirmação:",
        erro.message
      );
    }

    await new Promise(
      resolve => setTimeout(resolve, 1000)
    );
  }

  throw new Error(
    "Dosagem não confirmada. Consulte o histórico antes de solicitar outra dosagem."
  );
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

  async getSchedules() {
  return this.request("/agendamentos", {
    cache: "no-store"
  });
}

async deleteSchedule(id) {
  return this.request(
    `/agendamentos/${encodeURIComponent(id)}`,
    {
      method: "DELETE"
    }
  );
}

  // Cadastra um agendamento de dosagem.
  
async scheduleDose(id, volume, time, dias = "ALL") {
  this.validateDose(id, volume);

  if (
    typeof time !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    throw new Error(
      "Informe um horário válido."
    );
  }

  if (
    dias !== "ALL" &&
    (
      !Array.isArray(dias) ||
      dias.length === 0 ||
      dias.some(dia => !/^[1-7]$/.test(String(dia)))
    )
  ) {
    throw new Error(
      "Selecione pelo menos um dia válido."
    );
  }

  return this.request("/agendamentos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      bomba_id: id,
      volume_ml: volume,
      horario: time,
      dias_semana: dias
    })
  });
}
}
