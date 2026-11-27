
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

  // Carrega as bombas cadastradas no banco de dados.
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

  // Executa uma dosagem manual ou cadastra um agendamento.
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
        const comando = await this.service.doseNow(id, quantidade);

        if (!comando.comando_id) {
          throw new Error(
            "Comando sem identificador. Consulte o histórico antes de repetir."
          );
        }

        this.feedback.showMessage(
          `Bomba ${id}: aguardando confirmação do dispositivo...`,
          0
        );

        const dosagem = await this.service.waitForDoseConfirmation(
          comando.comando_id
        );

        switch (dosagem.status) {
          case "CONCLUIDO":
            this.feedback.showMessage(
              `Bomba ${id}: execução da dosagem confirmada pelo dispositivo!`
            );
            break;

          case "ERRO_DISPOSITIVO_OCUPADO":
            throw new Error(
              "O dispositivo está ocupado."
            );

          case "ERRO_PARAMETRO_INVALIDO":
            throw new Error(
              "O dispositivo rejeitou os parâmetros da dosagem."
            );

          case "ERRO_BOMBA_NAO_ENCONTRADA":
            throw new Error(
              "Bomba não reconhecida pelo dispositivo."
            );

          default:
            throw new Error(
              `Falha na dosagem: ${dosagem.status}`
            );
        }
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
