import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../config/db.js";
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
  const { id } = req.params;
  const { volume_ml } = req.body;

  if (!obterStatusDispositivo().online) {
  return res.status(503).json({
    erro: "Dispositivo indisponível. Dosagem não enviada."
  });
}
  try {
    // Busca informações da bomba para verificar calibração
    const bombaRes = await pool.query("SELECT * FROM bombas WHERE id = $1 AND ativo = true", [id]);
    if (bombaRes.rows.length === 0) {
      return res.status(404).json({ erro: "Bomba não encontrada ou inativa." });
    }

    const bomba = bombaRes.rows[0];

const { volume, tempoMs } = validarDosagem(
  volume_ml,
  bomba
);
    const comandoId = uuidv4();

    // Registra na auditoria
    await pool.query(
      `INSERT INTO historico_dosagens (comando_id, bomba_id, volume_ml, tempo_ms, tipo_disparo, status)
       VALUES ($1, $2, $3, $4, 'MANUAL', 'ENVIADO')`,
      [comandoId, id, volume, tempoMs]
    );

    // Publica no MQTT
    await publicarComando(comandoId, id, tempoMs);

    res.json({
      sucesso: true,
      comando_id: comandoId,
      id_bomba: Number(id),
      volume_ml: volume,
      tempo_ms: tempoMs,
      mensagem: "Comando enviado para a ESP8266 com sucesso.",
    });
  } catch (error) {
    res.status(400).json({ erro: "Falha ao processar disparo de dose", detalhe: error.message });
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

// ========================================================
// 4. Cadastrar Novo Agendamento
// ========================================================
router.post("/agendamentos", async (req, res) => {
  const { bomba_id, volume_ml, horario } = req.body;

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
      erro: "Informe um horário válido no formato HH:MM."
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

    const bomba = bombaRes.rows[0];

    let volume;

    try {
      const dosagem = validarDosagem(
        volume_ml,
        bomba,
        false
      );

      volume = dosagem.volume;

    } catch (erro) {
      return res.status(400).json({
        erro: erro.message
      });
    }

    const result = await pool.query(
      `INSERT INTO agendamentos
        (bomba_id, volume_ml, horario)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, volume, horario]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("Erro ao cadastrar agendamento:", error);

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

