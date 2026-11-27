
export default class ScheduleView {
  constructor(container) {
    this.container = container;
  }

  formatarDias(dias) {
    if (dias === "ALL") {
      return "Todos os dias";
    }

    const nomes = {
      1: "Seg",
      2: "Ter",
      3: "Qua",
      4: "Qui",
      5: "Sex",
      6: "Sáb",
      7: "Dom"
    };

    return String(dias)
      .split(",")
      .map(dia => nomes[dia] || "?")
      .join(", ");
  }

  render(agendamentos) {
    this.container.replaceChildren();

    if (agendamentos.length === 0) {
      this.container.textContent =
        "Nenhum agendamento cadastrado.";

      return;
    }

    agendamentos.forEach(agendamento => {
      const item = document.createElement("article");

      item.className = "item-agendamento";

      const informacoes = document.createElement("div");
      const titulo = document.createElement("strong");
      const detalhes = document.createElement("p");
      const botao = document.createElement("button");

      titulo.textContent =
        `${agendamento.nome_bomba} — ${Number(agendamento.volume_ml)} ml`;

      detalhes.textContent =
        `${String(agendamento.horario).slice(0, 5)} • ` +
        this.formatarDias(agendamento.dias_semana) +
        (agendamento.ativo ? "" : " • Inativo");

      botao.type = "button";
      botao.className = "excluir-agendamento";
      botao.dataset.id = agendamento.id;
      botao.textContent = "Excluir";

      informacoes.append(titulo, detalhes);
      item.append(informacoes, botao);

      this.container.append(item);
    });
  }

  showError(mensagem) {
    this.container.textContent = mensagem;
  }
}
