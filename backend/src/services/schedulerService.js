import {
  reservarDosagem,
  registrarFalhaPublicacao
} from "./doseService.js";
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

import {
  FUSO_HORARIO,
  obterHorarioAtual,
  deveExecutarHoje
} from "./scheduleService.js";

let executando = false;

// Registra dosagens programadas no histórico.
async function registrarDosagem(
  comandoId,
  agendamento,
  tempoMs,
  status
) {
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
     VALUES ($1, $2, $3, $4, 'AGENDADO', $5)`,
    [
      comandoId,
      agendamento.bomba_id,
      agendamento.volume_ml,
      tempoMs,
      status
    ]
  );
}

export function inicializarAgendador() {
  console.log(
    `[Scheduler] Agendador iniciado. Fuso: ${FUSO_HORARIO}`
  );

  cron.schedule("* * * * *", async () => {
    if (executando) return;

    executando = true;

    try {
      const {
        horario,
        diaSemana
      } = obterHorarioAtual();

      const result = await pool.query(
        `SELECT
          a.id,
          a.bomba_id,
          a.volume_ml,
          a.dias_semana,
          b.nome,
          b.vazao_ml_min,
          b.capacidade_recipiente_ml,
          b.volume_restante_ml
         FROM agendamentos a
         JOIN bombas b ON a.bomba_id = b.id
         WHERE a.ativo = true
           AND a.horario = $1
           AND b.ativo = true
         ORDER BY a.id ASC`,
        [horario]
      );

      let comandoPublicado = false;

      for (const agendamento of result.rows) {
        try {
          if (
            !deveExecutarHoje(
              agendamento.dias_semana,
              diaSemana
            )
          ) {
            continue;
          }

          const comandoId = uuidv4();

          if (!obterStatusDispositivo().online) {
            await registrarDosagem(
              comandoId,
              agendamento,
              0,
              "NAO_EXECUTADO_OFFLINE"
            );

            continue;
          }

          if (comandoPublicado) {
            await registrarDosagem(
              comandoId,
              agendamento,
              0,
              "NAO_EXECUTADO_CONFLITO"
            );

            continue;
          }

          let dosagem;

          try {
            dosagem = validarDosagem(
              agendamento.volume_ml,
              agendamento
            );

          } catch (erro) {
            await registrarDosagem(
              comandoId,
              agendamento,
              0,
              "NAO_EXECUTADO_INVALIDO"
            );

            console.error(
              "[Scheduler] Dosagem inválida:",
              erro.message
            );

            continue;
          }

let reserva;

try {
  reserva = await reservarDosagem(
    agendamento.bomba_id,
    agendamento.volume_ml,
    "AGENDADO"
  );

} catch (erro) {
  if (erro.statusCode === 409) {
    await registrarDosagem(
      comandoId,
      agendamento,
      0,
      "NAO_EXECUTADO_CONFLITO"
    );

    continue;
  }

  throw erro;
}

comandoPublicado = true;


try {
  await publicarComando(
    reserva.comandoId,
    agendamento.bomba_id,
    reserva.tempoMs
  );

} catch (erro) {
  await registrarFalhaPublicacao(
    reserva.comandoId,
    erro.publicacaoIncerta !== false
  );

  throw erro;
}


          console.log(
  `[Scheduler] Comando enviado: ${reserva.comandoId}`
);

        } catch (erro) {
          console.error(
            `[Scheduler] Erro no agendamento ${agendamento.id}:`,
            erro.message
          );
        }
      }

    } catch (erro) {
      console.error(
        "[Scheduler] Erro:",
        erro.message
      );

    } finally {
      executando = false;
    }
  }, {
    timezone: FUSO_HORARIO
  });
}
