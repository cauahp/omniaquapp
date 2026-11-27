import mqtt from "mqtt";
import dotenv from "dotenv";
import { pool } from "./db.js";

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
      console.log("[MQTT] Confirmação recebida da ESP8266:", data);

      const { comando_id, id_bomba, status } = data;

      if (!comando_id) return;

      // Atualiza o histórico de auditoria no PostgreSQL
      const query = `
        UPDATE historico_dosagens
        SET status = $1, confirmado_em = NOW()
        WHERE comando_id = $2
        RETURNING volume_ml, bomba_id;
      `;
      const res = await pool.query(query, [status, comando_id]);

      // Se foi concluído com sucesso, debita o volume usado do reservatório
      if (status === "CONCLUIDO" && res.rows.length > 0) {
        const { volume_ml, bomba_id } = res.rows[0];
        await pool.query(
          `UPDATE bombas SET volume_restante_ml = GREATEST(0, volume_restante_ml - $1) WHERE id = $2`,
          [volume_ml, bomba_id]
        );
        console.log(`[PostgreSQL] Volume da Bomba ${bomba_id} atualizado (-${volume_ml} ml).`);
      }
    } catch (err) {
      console.error("[MQTT] Erro ao processar mensagem de status:", err.message);
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

