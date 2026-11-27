
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

    this.loadPumps();

    this.container.addEventListener("submit", evento => {
      evento.preventDefault();
      this.execute(evento.target, true);
    });

    this.container.addEventListener("click", evento => {
      const botao = evento.target.closest(".dosar");
      if (botao) this.execute(botao.form, false);
    });

    initializeOcean();
  }

  async loadPumps() {
  this.container.textContent = "Carregando bombas...";

  try {
    const bombas = await this.service.getPumps();

    this.container.replaceChildren();

    if (bombas.length === 0) {
      this.container.textContent = "Nenhuma bomba ativa cadastrada.";
      return;
    }

    bombas.forEach(bomba => {
      this.view.render(bomba);
    });

  } catch (erro) {
    console.error(erro);

    this.container.textContent =
      "Não foi possível carregar as bombas. Atualize a página após verificar o servidor.";

    this.feedback.showMessage(erro.message);
  }
}
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

    botoes.forEach(botao => {
      botao.disabled = true;
    });

    try {
      if (agendar) {
        await this.service.scheduleDose(id, quantidade, hora);

        this.feedback.showMessage(
          "Agendamento cadastrado com sucesso!"
        );
      } else {
        await this.service.doseNow(id, quantidade);

        this.feedback.showMessage(
          "Comando enviado. Aguardando confirmação do dispositivo."
        );
      }
    } catch (erro) {
      console.error(erro);

      this.feedback.showMessage(
        erro.message || "Não foi possível concluir a operação."
      );
    } finally {
      this.pendentes.delete(formulario);
      formulario.removeAttribute("aria-busy");

      botoes.forEach(botao => {
        botao.disabled = false;
      });
    }
  }
}
