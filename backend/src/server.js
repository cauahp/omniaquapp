import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testDbConnection } from "./config/db.js";
import { inicializarAgendador } from "./services/schedulerService.js";
import pumpRoutes from "./routes/pumpRoutes.js";
import {
  iniciarMonitoramentoDosagens
} from "./services/doseService.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de Healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "online", servico: "OmniAqua Backend API", timestamp: new Date().toISOString() });
});

// Rotas da API
app.use("/api", pumpRoutes);

// Inicialização do Servidor
app.listen(port, async () => {
  console.log(`===============================================`);
  console.log(`  OmniAqua Backend API rodando na porta ${port}`);
  console.log(`===============================================`);

  // Testa conexão com o banco de dados
  await testDbConnection();

  // Inicia o motor de agendamentos em background
  inicializarAgendador();
  iniciarMonitoramentoDosagens();
});

