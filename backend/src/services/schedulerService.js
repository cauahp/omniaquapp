import cron from "node-cron";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db.js";
import {
  publicarComando,
  obterStatusDispositivo
} from "../config/mqtt.js";
import { calcularTempoAcionamentoMs } from "./calibrationService.js";

/**
 * Inicializa o agendador de dosagens periódicas
 * Avalia o banco a cada minuto para disparar dosagens programadas
 */
export function inicializarAgendador() {
  console.log("[Scheduler] Agendador de dosagens (Cron) iniciado. Avaliando a cada minuto.");

  cron.schedule("* * * * *", async () => {
    const agora = new Date();
    const hora = String(agora.getHours()).padStart(2, "0");
    const minuto = String(agora.getMinutes()).padStart(2, "0");
    const horarioAtual = `${hora}:${minuto}:00`;

    try {
      // Busca agendamentos ativos compatíveis com o horário atual
      const sql = `
        SELECT a.id, a.bomba_id, a.volume_ml, b.vazao_ml_min, b.nome
        FROM agendamentos a
        JOIN bombas b ON a.bomba_id = b.id
        WHERE a.ativo = true AND a.horario = $1 AND b.ativo = true;
      `;
      const result = await pool.query(sql, [horarioAtual]);

      if (result.rows.length === 0) return;

      console.log(`[Scheduler] Encontrado(s) ${result.rows.length} agendamento(s) para o horário ${horarioAtual}`);

      for (const agendamento of result.rows) {

        if (!obterStatusDispositivo().online) {
  console.warn(
    `[Scheduler] Agendamento ${agendamento.id} não executado: dispositivo indisponível.`
  );

  continue;
}
        const comandoId = uuidv4();
        const tempoMs = calcularTempoAcionamentoMs(agendamento.volume_ml, agendamento.vazao_ml_min);

        // 1. Registra no histórico como ENVIADO
        await pool.query(
          `INSERT INTO historico_dosagens (comando_id, bomba_id, volume_ml, tempo_ms, tipo_disparo, status)
           VALUES ($1, $2, $3, $4, 'AGENDADO', 'ENVIADO')`,
          [comandoId, agendamento.bomba_id, agendamento.volume_ml, tempoMs]
        );

        // 2. Dispara mensagem MQTT para a ESP8266
        await publicarComando(comandoId, agendamento.bomba_id, tempoMs);
      }
    } catch (error) {
      console.error("[Scheduler] Erro ao executar agendamentos periódicos:", error.message);
    }
  });
}

