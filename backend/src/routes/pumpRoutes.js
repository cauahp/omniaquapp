import { Router } from "express";
import { pool } from "../config/db.js";
import {
  reservarDosagem
} from "../services/doseService.js";
import {
  normalizarDiasSemana
} from "../services/scheduleService.js";
import {
  publicarComando,
  obterStatusDispositivo
} from "../config/mqtt.js";
import { validarDosagem } from "../services/calibrationService.js";

const router = Router();

// ========================================================
// 1. Listar todas as bombas cadastradas
// ========================================================
router.get("/bombas", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM bombas WHERE ativo = true ORDER BY id ASC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: "Falha ao consultar bombas", detalhe: error.message });
  }
});

// ========================================================
// 2. Disparo Manual Imediato ("Dosar Agora")
// ========================================================

router.post("/bombas/:id/dosar", async (req, res) => {
  const id = Number(req.params.id);
  const { volume_ml } = req.body;

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    return res.status(400).json({
      erro: "Identificador de bomba inválido."
    });
  }

  if (!obterStatusDispositivo().online) {
    return res.status(503).json({
      erro: "Dispositivo indisponível. Dosagem não enviada."
    });
  }

  let dosagem;

  try {
    dosagem = await reservarDosagem(
      id,
      volume_ml,
      "MANUAL"
    );

  } catch (erro) {
    return res.status(
      erro.statusCode || 400
    ).json({
      erro: erro.message
    });
  }

  try {
    await publicarComando(
      dosagem.comandoId,
      id,
      dosagem.tempoMs
    );

    res.json({
      sucesso: true,
      comando_id: dosagem.comandoId,
      id_bomba: id,
      volume_ml: dosagem.volume,
      tempo_ms: dosagem.tempoMs,
      mensagem: "Comando enviado com sucesso."
    });

  } catch (erro) {
    console.error(
      "[Dosagem] Falha na publicação:",
      erro.message
    );

    res.status(503).json({
      erro: "Publicação não confirmada. Consulte o histórico antes de repetir a dosagem.",
      comando_id: dosagem.comandoId
    });
  }
});

// ========================================================
// 3. Listar Agendamentos
// ========================================================
router.get("/agendamentos", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, b.nome as nome_bomba, b.solucao 
      FROM agendamentos a 
      JOIN bombas b ON a.bomba_id = b.id 
      ORDER BY a.horario ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: "Falha ao listar agendamentos", detalhe: error.message });
  }
});

// ========================================================
// 4. Cadastrar Novo Agendamento
// ========================================================

router.post("/agendamentos", async (req, res) => {
  const {
    bomba_id,
    volume_ml,
    horario,
    dias_semana = "ALL"
  } = req.body;

  if (
    typeof bomba_id !== "number" &&
    typeof bomba_id !== "string"
  ) {
    return res.status(400).json({
      erro: "Identificador de bomba inválido."
    });
  }

  const id = Number(bomba_id);

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    return res.status(400).json({
      erro: "Identificador de bomba inválido."
    });
  }

  if (
    typeof horario !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(horario)
  ) {
    return res.status(400).json({
      erro: "Informe um horário válido."
    });
  }

  let dias;

  try {
    dias = normalizarDiasSemana(dias_semana);
  } catch (erro) {
    return res.status(400).json({
      erro: erro.message
    });
  }

  try {
    const bombaRes = await pool.query(
      "SELECT * FROM bombas WHERE id = $1 AND ativo = true",
      [id]
    );

    if (bombaRes.rows.length === 0) {
      return res.status(404).json({
        erro: "Bomba não encontrada ou inativa."
      });
    }

    let volume;

    try {
      const dosagem = validarDosagem(
        volume_ml,
        bombaRes.rows[0],
        false
      );

      volume = dosagem.volume;

    } catch (erro) {
      return res.status(400).json({
        erro: erro.message
      });
    }

    // Verifica conflitos no mesmo horário.
    const existentes = await pool.query(
      `SELECT id, dias_semana
       FROM agendamentos
       WHERE horario = $1
         AND ativo = true`,
      [horario]
    );

    const conflito = existentes.rows.some(item => {
      if (
        dias === "ALL" ||
        item.dias_semana === "ALL"
      ) {
        return true;
      }

      const diasExistentes =
        item.dias_semana.split(",");

      return dias.split(",").some(
        dia => diasExistentes.includes(dia)
      );
    });

    if (conflito) {
      return res.status(409).json({
        erro: "Já existe uma dosagem agendada para esse horário em um dos dias selecionados."
      });
    }

    const result = await pool.query(
      `INSERT INTO agendamentos
        (bomba_id, volume_ml, horario, dias_semana)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, volume, horario, dias]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error(
      "Erro ao cadastrar agendamento:",
      error
    );

    res.status(500).json({
      erro: "Falha ao cadastrar agendamento."
    });
  }
});

// ========================================================
// 5. Excluir Agendamento
// ========================================================
router.delete("/agendamentos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM agendamentos WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Agendamento não encontrado." });
    }
    res.json({ sucesso: true, id_removido: id });
  } catch (error) {
    res.status(500).json({ erro: "Falha ao remover agendamento", detalhe: error.message });
  }
});

// ========================================================
// 6. Consultar Histórico Recente de Dosagens
// ========================================================
router.get("/historico", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, b.nome as nome_bomba, b.solucao 
      FROM historico_dosagens h
      JOIN bombas b ON h.bomba_id = b.id
      ORDER BY h.disparado_em DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ erro: "Falha ao consultar histórico", detalhe: error.message });
  }
});


// ========================================================
// 7. Consultar o status de uma dosagem específica
// ========================================================
router.get("/historico/:comando_id", async (req, res) => {
  const { comando_id } = req.params;

  const uuidValido =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidValido.test(comando_id)) {
    return res.status(400).json({
      erro: "Identificador de comando inválido."
    });
  }

  try {
    const result = await pool.query(
      `SELECT h.*, b.nome AS nome_bomba, b.solucao
       FROM historico_dosagens h
       JOIN bombas b ON h.bomba_id = b.id
       WHERE h.comando_id = $1`,
      [comando_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        erro: "Dosagem não encontrada."
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error("Erro ao consultar dosagem:", error);

    res.status(500).json({
      erro: "Falha ao consultar o status da dosagem."
    });
  }
});

// ========================================================
// 8. Consultar disponibilidade do dispositivo
// ========================================================
router.get("/dispositivo/status", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(obterStatusDispositivo());
});

export default router;

