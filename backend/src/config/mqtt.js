import mqtt from "mqtt";
import dotenv from "dotenv";
import {
  confirmarDosagem
} from "../services/doseService.js";

dotenv.config();

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const topicCommand = process.env.MQTT_TOPIC_COMMAND || "omniaqua/bombas/comando";
const topicStatus = process.env.MQTT_TOPIC_STATUS || "omniaqua/bombas/status";
const topicLwt = process.env.MQTT_TOPIC_LWT || "omniaqua/dispositivo/status";

let statusDispositivo = "desconhecido";
let ultimaAtualizacao = null;

// Disponibiliza o estado da comunicação MQTT.
export function obterStatusDispositivo() {
  return {
    broker_online: mqttClient.connected,
    status: mqttClient.connected
      ? statusDispositivo
      : "desconhecido",
    online: mqttClient.connected && statusDispositivo === "online",
    ultima_atualizacao: ultimaAtualizacao
  };
}

export const mqttClient = mqtt.connect(brokerUrl, {
  clientId: process.env.MQTT_CLIENT_ID || `OmniAqua_Backend_${Math.random().toString(16).slice(2, 8)}`,
  clean: true,
  reconnectPeriod: 3000,
  connectTimeout: 5000,
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
});

mqttClient.on("connect", () => {
  console.log(`[MQTT] Conectado ao Broker em ${brokerUrl}`);

  // Inscrição nos tópicos de feedback e status
  mqttClient.subscribe([topicStatus, topicLwt], { qos: 1 }, (err) => {
    if (err) {
      console.error("[MQTT] Erro ao assinar tópicos:", err);
    } else {
      console.log(`[MQTT] Assinado nos tópicos: ${topicStatus}, ${topicLwt}`);
    }
  });
});

mqttClient.on("message", async (topic, message) => {
  const payloadStr = message.toString();

  if (topic === topicLwt) {
  const status = payloadStr.trim().toLowerCase();

  if (status === "online" || status === "offline") {
    statusDispositivo = status;
    ultimaAtualizacao = new Date().toISOString();

    console.log(`[MQTT] Status da ESP8266: ${status.toUpperCase()}`);
  }

  return;
}
  
if (topic === topicStatus) {
  try {
    const data = JSON.parse(payloadStr);

    const {
      comando_id,
      id_bomba,
      status
    } = data;

    console.log(
      "[MQTT] Confirmação recebida:",
      data
    );

    const processado = await confirmarDosagem(
      comando_id,
      id_bomba,
      status
    );

    if (!processado) {
      console.warn(
        `[MQTT] Confirmação duplicada ou inválida ignorada: ${comando_id}`
      );

      return;
    }

    console.log(
      `[MQTT] Confirmação processada: ${comando_id} - ${status}`
    );

  } catch (erro) {
    console.error(
      "[MQTT] Erro ao processar confirmação:",
      erro.message
    );
  }
}

});

// Invalida o estado conhecido quando a conexão é perdida.
mqttClient.on("close", () => {
  statusDispositivo = "desconhecido";
  ultimaAtualizacao = null;
});

mqttClient.on("offline", () => {
  statusDispositivo = "desconhecido";
  ultimaAtualizacao = null;
});

mqttClient.on("error", (err) => {
  console.error("[MQTT] Erro na conexão do cliente MQTT:", err.message);
});

/**
 * Publica comando no tópico de dosagem
 */
export function publicarComando(comandoId, idBomba, tempoMs) {
  return new Promise((resolve, reject) => {
    if (!obterStatusDispositivo().online) {
      return reject(
        new Error("Dispositivo indisponível. Comando não publicado.")
      );
    }
    const payload = JSON.stringify({
      comando_id: comandoId,
      id_bomba: Number(idBomba),
      tempo_ms: Number(tempoMs),
      timestamp: Math.floor(Date.now() / 1000),
    });

    mqttClient.publish(topicCommand, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] Falha ao publicar comando ${comandoId}:`, err);
        return reject(err);
      }
      console.log(`[MQTT] Comando ${comandoId} publicado para a Bomba ${idBomba} (${tempoMs} ms).`);
      resolve(payload);
    });
  });
}

