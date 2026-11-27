
import mqtt from "mqtt";

const comandoId = process.argv[2];
const idBomba = Number(process.argv[3] || 1);

if (!comandoId) {
  console.error("Informe o comando_id.");
  process.exit(1);
}

const client = mqtt.connect("mqtt://localhost:1883");

client.on("connect", () => {
  console.log("Conectado ao broker MQTT.");

  const mensagem = JSON.stringify({
    comando_id: comandoId,
    id_bomba: idBomba,
    status: "CONCLUIDO"
  });

  client.publish(
    "omniaqua/bombas/status",
    mensagem,
    { qos: 1 },
    erro => {
      if (erro) {
        console.error(erro.message);
        process.exitCode = 1;
      } else {
        console.log("Confirmação duplicada enviada.");
      }

      client.end();
    }
  );
});

client.on("error", erro => {
  console.error(erro.message);
  client.end(true);
  process.exitCode = 1;
});
