/**
 * OmniAqua - Simulador de Hardware ESP8266 (Mock de Bancada)
 * 
 * Este script emula o comportamento do firmware da placa ESP8266 via MQTT.
 * Permite que os desenvolvedores de Backend e Frontend testem o fluxo
 * completo de ponta a ponta sem precisar da placa física conectada.
 * 
 * Uso:
 *   node backend/scripts/simulate_esp8266.js
 */

import mqtt from "mqtt";

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const TOPICO_COMANDO = "omniaqua/bombas/comando";
const TOPICO_STATUS = "omniaqua/bombas/status";
const TOPICO_LWT = "omniaqua/dispositivo/status";

console.log("=================================================");
console.log("  [SIMULADOR ESP8266] Iniciando dispositivo virtual...");
console.log("=================================================");

const client = mqtt.connect(BROKER_URL, {
  clientId: "OmniAqua_ESP8266_Simulator",
  will: {
    topic: TOPICO_LWT,
    payload: "offline",
    qos: 1,
    retain: true,
  },
});

let startTime = Date.now();
let bombaEmExecucao = false;

client.on("connect", () => {
  console.log(`[SIMULADOR ESP8266] Conectado ao broker MQTT em ${BROKER_URL}`);

  // Envia disponibilidade LWT (online)
  client.publish(TOPICO_LWT, "online", { qos: 1, retain: true });

  // Assina os comandos
  client.subscribe(TOPICO_COMANDO, { qos: 1 }, (err) => {
    if (err) {
      console.error("[SIMULADOR ESP8266] Falha ao assinar tópico de comando:", err);
    } else {
      console.log(`[SIMULADOR ESP8266] Pronto! Aguardando comandos em: ${TOPICO_COMANDO}`);
    }
  });
});

client.on("message", (topic, message) => {
  if (topic !== TOPICO_COMANDO) return;

  try {
    const payload = JSON.parse(message.toString());
    console.log("\n-------------------------------------------------");
    console.log("[SIMULADOR ESP8266] Comando recebido!");
    console.log(`  - Comando ID : ${payload.comando_id}`);
    console.log(`  - Bomba ID   : ${payload.id_bomba}`);
    console.log(`  - Duração    : ${payload.tempo_ms} ms`);

    const { comando_id, id_bomba, tempo_ms } = payload;

    // Validação de ocupação
    if (bombaEmExecucao) {
      console.warn("[SIMULADOR ESP8266] AVISO: Bomba já está dosando. Rejeitando comando.");
      enviarAck(comando_id, id_bomba, "ERRO_DISPOSITIVO_OCUPADO", 0);
      return;
    }

    // Validação de segurança
    if (!tempo_ms || tempo_ms <= 0 || tempo_ms > 30000) {
      console.warn("[SIMULADOR ESP8266] SEGURANÇA: Tempo de acionamento inválido!");
      enviarAck(comando_id, id_bomba, "ERRO_PARAMETRO_INVALIDO", 0);
      return;
    }

    // Inicia simulação de acionamento
    bombaEmExecucao = true;
    console.log(`⚡ [SIMULADOR ESP8266] Pino D1 (GPIO 5) -> HIGH (Bomba ${id_bomba} LIGADA)`);

    setTimeout(() => {
      console.log(`🛑 [SIMULADOR ESP8266] Pino D1 (GPIO 5) -> LOW (Bomba ${id_bomba} DESLIGADA)`);
      bombaEmExecucao = false;
      enviarAck(comando_id, id_bomba, "CONCLUIDO", tempo_ms);
    }, tempo_ms);

  } catch (error) {
    console.error("[SIMULADOR ESP8266] Erro ao decodificar JSON:", error.message);
  }
});

function enviarAck(comandoId, idBomba, status, tempoExecutadoMs) {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const ackPayload = {
    comando_id: comandoId,
    id_bomba: Number(idBomba),
    status: status,
    tempo_executado_ms: tempoExecutadoMs,
    rssi: -58,
    uptime_s: uptime,
  };

  client.publish(TOPICO_STATUS, JSON.stringify(ackPayload), { qos: 1 }, (err) => {
    if (err) {
      console.error("[SIMULADOR ESP8266] Erro ao publicar ACK:", err);
    } else {
      console.log(`[SIMULADOR ESP8266] Confirmação (ACK) enviada para ${TOPICO_STATUS}:`, ackPayload);
    }
  });
}
// Informa o desligamento antes de encerrar o simulador.
let encerrando = false;

function desligarSimulador() {
  if (encerrando) return;
  encerrando = true;

  console.log(
    "[SIMULADOR ESP8266] Encerrando dispositivo..."
  );

  const limite = setTimeout(() => {
    process.exit(1);
  }, 3000);

  client.publish(
    TOPICO_LWT,
    "offline",
    { qos: 1, retain: true },
    (erro) => {
      if (erro) {
        console.error(
          "[SIMULADOR ESP8266] Erro ao informar desligamento:",
          erro.message
        );

        process.exit(1);
        return;
      }

      client.end(false, () => {
        clearTimeout(limite);
        process.exit(0);
      });
    }
  );
}

process.on("SIGINT", desligarSimulador);
process.on("SIGTERM", desligarSimulador);

