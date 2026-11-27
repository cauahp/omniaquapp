
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db.js";
import { validarDosagem } from "./calibrationService.js";

export async function reservarDosagem(
  idBomba,
  volumeMl,
  tipoDisparo
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serializa as solicitações de dosagem.
    await client.query(
      "SELECT pg_advisory_xact_lock(91001)"
    );

    const pendentes = await client.query(`
      SELECT comando_id
      FROM historico_dosagens
      WHERE status IN ('PENDENTE', 'ENVIADO')
      LIMIT 1
    `);

    if (pendentes.rows.length > 0) {
      const erro = new Error(
        "Existe uma dosagem em andamento ou aguardando confirmação."
      );

      erro.statusCode = 409;
      throw erro;
    }

    const bombaRes = await client.query(
      `SELECT *
       FROM bombas
       WHERE id = $1 AND ativo = true
       FOR UPDATE`,
      [idBomba]
    );

    if (bombaRes.rows.length === 0) {
      const erro = new Error(
        "Bomba não encontrada ou inativa."
      );

      erro.statusCode = 404;
      throw erro;
    }

    const { volume, tempoMs } = validarDosagem(
      volumeMl,
      bombaRes.rows[0]
    );

    const comandoId = uuidv4();

    await client.query(
      `INSERT INTO historico_dosagens
        (
          comando_id,
          bomba_id,
          volume_ml,
          tempo_ms,
          tipo_disparo,
          status
        )
       VALUES ($1, $2, $3, $4, $5, 'ENVIADO')`,
      [
        comandoId,
        idBomba,
        volume,
        tempoMs,
        tipoDisparo
      ]
    );

    await client.query("COMMIT");

    return {
      comandoId,
      volume,
      tempoMs
    };

  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;

  } finally {
    client.release();
  }
}

// Processa uma confirmação apenas uma vez.
export async function confirmarDosagem(
  comandoId,
  idBomba,
  status
) {
  const statusPermitidos = [
    "CONCLUIDO",
    "FALHA",
    "ERRO_DISPOSITIVO_OCUPADO",
    "ERRO_PARAMETRO_INVALIDO",
    "ERRO_BOMBA_NAO_ENCONTRADA"
  ];

  if (!statusPermitidos.includes(status)) {
    return false;
  }

  if (
    typeof comandoId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(comandoId)
  ) {
    return false;
  }

  if (
    !Number.isInteger(idBomba) ||
    idBomba <= 0 ||
    idBomba > 2147483647
  ) {
    return false;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock(91001)"
    );

    const resultado = await client.query(
      `UPDATE historico_dosagens
       SET status = $1,
           confirmado_em = NOW()
       WHERE comando_id = $2
         AND bomba_id = $3
         AND status = 'ENVIADO'
       RETURNING volume_ml, bomba_id`,
      [status, comandoId, idBomba]
    );

    if (resultado.rows.length === 0) {
      await client.query("COMMIT");
      return false;
    }

    if (status === "CONCLUIDO") {
      const { volume_ml, bomba_id } =
        resultado.rows[0];

      await client.query(
        `UPDATE bombas
         SET volume_restante_ml =
           GREATEST(0, volume_restante_ml - $1)
         WHERE id = $2`,
        [volume_ml, bomba_id]
      );
    }

    await client.query("COMMIT");

    return true;

  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;

  } finally {
    client.release();
  }
}
