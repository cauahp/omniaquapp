
export default class HistoryView {
  constructor(container) {
    this.container = container;
  }

  formatarData(data) {
    if (!data) return "—";

    const valor = new Date(data);

    if (Number.isNaN(valor.getTime())) {
      return "—";
    }

    return valor.toLocaleString("pt-BR", {
      timeZone: "America/Recife"
    });
  }

  formatarStatus(status) {
    const nomes = {
      CONCLUIDO: "Concluído",
      ENVIADO: "Aguardando confirmação",
      PENDENTE: "Pendente",
      FALHA: "Falha",
      FALHA_PUBLICACAO: "Falha na publicação",
      PUBLICACAO_INCERTA: "Publicação incerta",
      SEM_CONFIRMACAO: "Sem confirmação",
      FALHA_CONFIRMACAO: "Falha de confirmação",
      NAO_EXECUTADO_OFFLINE: "Dispositivo offline",
      NAO_EXECUTADO_CONFLITO: "Conflito de dosagem",
      NAO_EXECUTADO_INVALIDO: "Dosagem inválida",
      ERRO_DISPOSITIVO_OCUPADO: "Dispositivo ocupado",
      ERRO_PARAMETRO_INVALIDO: "Parâmetro inválido",
      ERRO_BOMBA_NAO_ENCONTRADA: "Bomba não encontrada"
    };

    return nomes[status] || status || "Desconhecido";
  }

  classeStatus(status) {
    if (status === "CONCLUIDO") {
      return "historico-sucesso";
    }

    if ([
      "ENVIADO",
      "PENDENTE",
      "SEM_CONFIRMACAO",
      "PUBLICACAO_INCERTA"
    ].includes(status)) {
      return "historico-pendente";
    }

    return "historico-falha";
  }

  render(historico) {
    this.container.replaceChildren();

    if (historico.length === 0) {
      this.container.textContent =
        "Nenhuma dosagem registrada.";

      return;
    }

    for (const dosagem of historico) {
      const linha = document.createElement("tr");

      const valores = [
        this.formatarData(dosagem.disparado_em),
        dosagem.nome_bomba ||
          `Bomba ${dosagem.bomba_id}`,
        dosagem.solucao || "—",
        `${Number(dosagem.volume_ml)
          .toLocaleString("pt-BR")} ml`,
        dosagem.tipo_disparo === "AGENDADO"
          ? "Agendada"
          : dosagem.tipo_disparo === "MANUAL"
            ? "Manual"
            : dosagem.tipo_disparo,
        this.formatarStatus(dosagem.status)
      ];

      valores.forEach((valor, indice) => {
        const coluna = document.createElement("td");

        coluna.textContent = valor;

        if (indice === 5) {
          coluna.className =
            this.classeStatus(dosagem.status);
        }

        linha.append(coluna);
      });

      this.container.append(linha);
    }
  }
}
