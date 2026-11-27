
import cron from "node-cron";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db.js";

import {
  publicarComando,
  obterStatusDispositivo
} from "../config/mqtt.js";

import {
  validarDosagem
} from "./calibrationService.js";

/**
 * Inicializa o agendador de dosagens periódicas.
 */
export function inicializarAgendador() {
  console.log(
    "[Scheduler] Agendador de dosagens iniciado."
  );

  cron.schedule("* * * * *", async () => {
    const agora = new Date();

    const hora = String(
      agora.getHours()
    ).padStart(2, "0");

    const minuto = String(
      agora.getMinutes()
    ).padStart(2, "0");

    const horarioAtual = `${hora}:${minuto}:00`;

    try {
      const sql = `
        SELECT
          a.id,
          a.bomba_id,
          a.volume_ml,
          b.vazao_ml_min,
          b.nome,
          b.capacidade_recipiente_ml,
          b.volume_restante_ml
        FROM agendamentos a
        JOIN bombas b ON a.bomba_id = b.id
        WHERE a.ativo = true
          AND a.horario = $1
          AND b.ativo = true
      `;

      const result = await pool.query(
        sql,
        [horarioAtual]
      );

      if (result.rows.length === 0) return;

      console.log(
        `[Scheduler] ${result.rows.length} agendamento(s) encontrado(s).`
      );

      for (const agendamento of result.rows) {
        try {
          if (!obterStatusDispositivo().online) {
            console.warn(
              `[Scheduler] Agendamento ${agendamento.id} não executado: dispositivo indisponível.`
            );

            continue;
          }

          const { volume, tempoMs } = validarDosagem(
            agendamento.volume_ml,
            agendamento
          );

          const comandoId = uuidv4();

          await pool.query(
            `INSERT INTO historico_dosagens
              (
                comando_id,
                bomba_id,
                volume_ml,
                tempo_ms,
                tipo_disparo,
                status
              )
             VALUES
              ($1, $2, $3, $4, 'AGENDADO', 'ENVIADO')`,
            [
              comandoId,
              agendamento.bomba_id,
              volume,
              tempoMs
            ]
          );

          await publicarComando(
            comandoId,
            agendamento.bomba_id,
            tempoMs
          );

        } catch (erro) {
          console.error(
            `[Scheduler] Falha no agendamento ${agendamento.id}:`,
            erro.message
          );
        }
      }

    } catch (error) {
      console.error(
        "[Scheduler] Erro ao consultar agendamentos:",
        error.message
      );
    }
  });
}
