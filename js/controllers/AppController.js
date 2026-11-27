
import PumpService from "../services/PumpService.js";
import PumpView from "../views/PumpView.js";
import FeedbackView from "../views/FeedbackView.js";
import { initializeOcean } from "../views/OceanView.js";

export default class AppController {
  constructor(service = new PumpService()) {
    this.service = service;
    this.container = document.getElementById("bombas");
    this.view = new PumpView(this.container);
    this.feedback = new FeedbackView(
      document.getElementById("aviso")
    );

    this.pendentes = new WeakSet();

    this.statusElement = document.getElementById(
      "status-dispositivo"
    );

    this.dispositivoOnline = false;

    this.loadPumps();
    this.monitorarDispositivo();

    this.container.addEventListener("submit", evento => {
      evento.preventDefault();
      this.execute(evento.target, true);
    });

    this.container.addEventListener("click", evento => {
      const botao = evento.target.closest(".dosar");

      if (botao) {
        this.execute(botao.form, false);
      }
    });

    initializeOcean();
  }

  // Consulta periodicamente o status do dispositivo.
  async monitorarDispositivo() {
    try {
      const dados = await this.service.getDeviceStatus();

      this.dispositivoOnline =
        dados.online === true && dados.broker_online === true;

      if (this.dispositivoOnline) {
        this.atualizarIndicador("online", "Online");

      } else if (!dados.broker_online) {
        this.atualizarIndicador(
          "desconhecido",
          "MQTT desconectado"
        );

      } else if (dados.status === "offline") {
        this.atualizarIndicador("offline", "Offline");

      } else {
        this.atualizarIndicador(
          "desconhecido",
          "Aguardando dispositivo"
        );
      }

    } catch (erro) {
      this.dispositivoOnline = false;

      this.atualizarIndicador(
        "desconhecido",
        "Servidor indisponível"
      );

    } finally {
      this.atualizarBotoes();

      setTimeout(() => {
        this.monitorarDispositivo();
      }, 3000);
    }
  }

  // Atualiza o indicador no cabeçalho.
  atualizarIndicador(status, mensagem) {
    this.statusElement.classList.remove(
      "status-offline",
      "status-desconhecido"
    );

    if (status !== "online") {
      this.statusElement.classList.add(`status-${status}`);
    }

    this.statusElement.textContent = mensagem;
  }

  // Controla a disponibilidade dos botões.
  atualizarBotoes() {
    const formularios = this.container.querySelectorAll("form");

    formularios.forEach(formulario => {
      const ocupado = this.pendentes.has(formulario);

      const botaoDosar = formulario.querySelector(".dosar");
      const botaoAgendar = formulario.querySelector(".agendar");

      if (botaoDosar) {
        botaoDosar.disabled =
          ocupado || !this.dispositivoOnline;
      }

      if (botaoAgendar) {
        botaoAgendar.disabled = ocupado;
      }
    });
  }

  // Carrega as bombas cadastradas no banco de dados.
  async loadPumps() {
    this.container.textContent = "Carregando bombas...";

    try {
      const bombas = await this.service.getPumps();

      this.container.replaceChildren();

      if (bombas.length === 0) {
        this.container.textContent =
          "Nenhuma bomba ativa cadastrada.";

        return;
      }

      bombas.forEach(bomba => {
        this.view.render(bomba);
      });

      this.atualizarBotoes();

    } catch (erro) {
      console.error(erro);

      this.container.textContent =
        "Não foi possível carregar as bombas. Atualize a página após verificar o servidor.";

      this.feedback.showMessage(erro.message);
    }
  }

  // Executa dosagens manuais ou cadastra agendamentos.
  async execute(formulario, agendar) {
    if (this.pendentes.has(formulario)) return;

    if (!agendar && !this.dispositivoOnline) {
      this.feedback.showMessage(
        "Dispositivo indisponível. Dosagem não enviada."
      );

      return;
    }

    const { volume, horario } = formulario.elements;

    const valido = agendar
      ? formulario.reportValidity()
      : volume.reportValidity();

    if (!valido) return;

    const id = Number(formulario.dataset.bombaId);
    const quantidade = volume.valueAsNumber;
    const hora = horario.value;

    this.pendentes.add(formulario);
    formulario.setAttribute("aria-busy", "true");

    this.atualizarBotoes();

    try {
      if (agendar) {
        await this.service.scheduleDose(
          id,
          quantidade,
          hora
        );

        this.feedback.showMessage(
          "Agendamento cadastrado com sucesso!"
        );

      } else {
        const comando = await this.service.doseNow(
          id,
          quantidade
        );

        if (!comando.comando_id) {
          throw new Error(
            "Comando sem identificador. Consulte o histórico antes de repetir."
          );
        }

        this.feedback.showMessage(
          `Bomba ${id}: aguardando confirmação do dispositivo...`,
          0
        );

        const dosagem =
          await this.service.waitForDoseConfirmation(
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

      this.atualizarBotoes();
    }
  }
}
