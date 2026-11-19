
import PumpService from "../services/PumpService.js";
import PumpView from "../views/PumpView.js";
import FeedbackView from "../views/FeedbackView.js";
import { initializeOcean } from "../views/OceanView.js";

export default class AppController {
  constructor(service = new PumpService()) {
    this.service = service;
    this.container = document.getElementById("bombas");
    this.view = new PumpView(this.container);
    this.feedback = new FeedbackView(document.getElementById("aviso"));
    this.pendentes = new WeakSet();

    this.formAgendamento = document.getElementById("form-agendamento");
    this.listaAgendamentos = document.getElementById("lista-agendamentos");
    this.agendamentos = [];
    this.proximoId = 1;

    this.listaHistorico = document.getElementById("lista-historico");
    this.historico = [];

    this.service.getPumps().forEach(bomba => this.view.render(bomba));

    this.container.addEventListener("submit", evento => {
      evento.preventDefault();
      this.execute(evento.target, true);
    });

    this.container.addEventListener("click", evento => {
      const botao = evento.target.closest(".dosar");
      if (botao) this.execute(botao.form, false);
    });

    this.formAgendamento.addEventListener("submit", evento => {
      evento.preventDefault();
      this.adicionarAgendamento();
    });

    this.listaAgendamentos.addEventListener("click", evento => {
      const botao = evento.target.closest(".remover-agendamento");

      if (botao) {
        this.removerAgendamento(Number(botao.dataset.id));
      }
    });

    this.renderizarAgendamentos();
    this.renderizarHistorico();
    initializeOcean();
  }

  // Execução demonstrativa das dosagens
  async execute(formulario, agendar) {
    if (this.pendentes.has(formulario)) return;

    const { volume, horario } = formulario.elements;
    const valido = agendar
      ? formulario.reportValidity()
      : volume.reportValidity();

    if (!valido) return;

    const id = Number(formulario.dataset.bombaId);
    const quantidade = volume.valueAsNumber;
    const hora = horario.value;
    const botoes = formulario.querySelectorAll("button");

    this.pendentes.add(formulario);
    formulario.setAttribute("aria-busy", "true");
    botoes.forEach(botao => { botao.disabled = true; });

    try {
      if (agendar) {
        await this.service.scheduleDose(id, quantidade, hora);
        this.registrarAgendamento(id, quantidade, hora);
        this.feedback.showMessage("Agendamento demonstrativo registrado.");
      } else {
        await this.service.doseNow(id, quantidade);
        this.registrarHistorico(id, quantidade);
        this.feedback.showDose(id, quantidade);
      }
    } catch (erro) {
      console.error(erro);
      this.feedback.showMessage("Não foi possível concluir a operação. Tente novamente.");
    } finally {
      this.pendentes.delete(formulario);
      formulario.removeAttribute("aria-busy");
      botoes.forEach(botao => { botao.disabled = false; });
    }
  }

  // Cadastro de agendamentos demonstrativos
  adicionarAgendamento() {
    if (!this.formAgendamento.reportValidity()) return;

    const dados = new FormData(this.formAgendamento);
    const idBomba = Number(dados.get("bomba"));
    const volume = Number(dados.get("volume"));
    const horario = dados.get("horario");

    this.registrarAgendamento(idBomba, volume, horario);

    this.formAgendamento.reset();
    this.feedback.showMessage("Agendamento demonstrativo adicionado.");
  }

  // Registro de um agendamento
  registrarAgendamento(idBomba, volume, horario) {
    const bombas = {
      1: "Cálcio (Ca)",
      2: "Alcalinidade (KH)",
      3: "Magnésio (Mg)"
    };

    this.agendamentos.push({
      id: this.proximoId++,
      bombaId: idBomba,
      solucao: bombas[idBomba],
      volume,
      horario
    });

    this.agendamentos.sort((a, b) =>
      a.horario.localeCompare(b.horario)
    );

    this.renderizarAgendamentos();
  }

  // Exibição da lista de agendamentos
  renderizarAgendamentos() {
    this.listaAgendamentos.replaceChildren();

    if (this.agendamentos.length === 0) {
      const mensagem = document.createElement("p");
      mensagem.className = "mensagem-vazia";
      mensagem.textContent = "Nenhum agendamento cadastrado.";
      this.listaAgendamentos.append(mensagem);
      return;
    }

    this.agendamentos.forEach(agendamento => {
      const item = document.createElement("article");
      item.className = "item-agendamento";

      const informacoes = document.createElement("div");
      informacoes.className = "informacoes-agendamento";

      const solucao = document.createElement("strong");
      solucao.textContent = agendamento.solucao;

      const detalhes = document.createElement("span");
      detalhes.textContent = `${agendamento.volume} ml · ${agendamento.horario}`;

      const remover = document.createElement("button");
      remover.type = "button";
      remover.className = "remover-agendamento";
      remover.dataset.id = agendamento.id;
      remover.textContent = "Excluir";
      remover.setAttribute(
        "aria-label",
        `Excluir agendamento de ${agendamento.solucao}`
      );

      informacoes.append(solucao, detalhes);
      item.append(informacoes, remover);
      this.listaAgendamentos.append(item);
    });
  }

  // Exclusão de agendamentos
  removerAgendamento(id) {
    this.agendamentos = this.agendamentos.filter(
      item => item.id !== id
    );

    this.renderizarAgendamentos();
    this.feedback.showMessage("Agendamento demonstrativo removido.");
  }

  // Registro das dosagens no histórico
  registrarHistorico(id, volume) {
    const bombas = {
      1: "Cálcio (Ca)",
      2: "Alcalinidade (KH)",
      3: "Magnésio (Mg)"
    };

    this.historico.unshift({
      solucao: bombas[id],
      volume,
      data: new Date()
    });

    this.renderizarHistorico();
  }

  // Exibição do histórico
  renderizarHistorico() {
    this.listaHistorico.replaceChildren();

    if (this.historico.length === 0) {
      const mensagem = document.createElement("p");
      mensagem.className = "mensagem-vazia";
      mensagem.textContent = "Nenhuma dosagem registrada.";
      this.listaHistorico.append(mensagem);
      return;
    }

    this.historico.forEach(registro => {
      const item = document.createElement("article");
      item.className = "item-historico";

      const informacoes = document.createElement("div");
      informacoes.className = "informacoes-historico";

      const solucao = document.createElement("strong");
      solucao.textContent = registro.solucao;

      const detalhes = document.createElement("span");
      const data = registro.data.toLocaleDateString("pt-BR");
      const horario = registro.data.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });

      detalhes.textContent = `${registro.volume} ml · ${data} às ${horario}`;

      const status = document.createElement("span");
      status.className = "status-historico";
      status.textContent = "Simulação realizada";

      informacoes.append(solucao, detalhes);
      item.append(informacoes, status);
      this.listaHistorico.append(item);
    });
  }
}
