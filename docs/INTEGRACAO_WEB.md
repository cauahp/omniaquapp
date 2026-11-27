
# Integração Web - OmniAqua

## Objetivo

Aprimorar a integração entre a interface web,
o backend, o banco de dados e o dispositivo
responsável pelas dosagens do aquário.

## Branch de desenvolvimento

feature/integracao-web

## Melhorias implementadas

### Frontend

- Carregamento das bombas diretamente pela API.
- Tratamento de erros de comunicação.
- Indicador de disponibilidade do dispositivo.
- Confirmação de execução das dosagens.
- Gerenciamento de agendamentos.
- Seleção dos dias da semana.
- Histórico de dosagens na interface.
- Atualização automática dos reservatórios.
- Notificações de dosagens agendadas.

### Backend

- Validação dos volumes solicitados.
- Validação da capacidade e saldo dos reservatórios.
- Limites de segurança de acionamento.
- Controle de concorrência das dosagens.
- Processamento idempotente das confirmações MQTT.
- Atualização transacional dos reservatórios.
- Identificação de falhas de publicação MQTT.
- Monitoramento de comandos sem confirmação.
- Prevenção de conflitos de agendamentos.
- Configuração do fuso horário America/Recife.

## Executando o ambiente

Na raiz do projeto:

    docker compose up -d

Na pasta backend:

    npm install

Configurar o arquivo .env com base no .env.example.

Iniciar o backend:

    npm run dev

Em outro terminal, iniciar o simulador:

    npm run simulate

Abrir o index.html utilizando o Live Server.

## Endpoints principais

- GET /api/bombas
- POST /api/bombas/:id/dosar
- GET /api/dispositivo/status
- GET /api/agendamentos
- POST /api/agendamentos
- DELETE /api/agendamentos/:id
- GET /api/historico
- GET /api/historico/:comando_id

## Segurança das dosagens

O backend bloqueia novas dosagens quando existe
um comando em andamento ou com resultado incerto.

Confirmações repetidas não devem gerar novos
descontos no volume dos reservatórios.

Não existe reenvio automático de dosagens pela
aplicação em caso de confirmação desconhecida.

## Ambiente de validação

Os testes foram realizados utilizando o simulador
ESP8266, PostgreSQL, MQTT e a interface web.

Nenhum teste físico foi realizado nesta branch.

## Limitações e pendências

- Validar a integração com o equipamento físico.
- Definir um procedimento seguro de reconciliação
  de dosagens sem confirmação.
- Avaliar a deduplicação de comandos no firmware.
- Implementar idempotência de solicitações HTTP.
- Avaliar a proteção persistente contra repetição
  de ocorrências de agendamentos.
- Avaliar mecanismos adicionais de disponibilidade
  do dispositivo, como heartbeat.

## Escopo

As alterações foram realizadas no frontend,
backend e simulador.

O firmware original foi preservado.


## Teste de confirmações duplicadas

O teste foi realizado utilizando o script:

    backend/scripts/test_duplicate_ack.js

Após uma dosagem concluída, uma confirmação MQTT
com o mesmo comando_id foi enviada novamente.

Resultados:

- Conexão com o broker MQTT: aprovada.
- Envio da confirmação duplicada: aprovado.
- Identificação da duplicidade: aprovada.
- Preservação do saldo do reservatório: aprovada.
- Integridade do histórico: aprovada.

O teste confirmou que o backend não realiza um
segundo desconto no reservatório ao receber uma
confirmação repetida de um comando concluído.

Todos os testes foram realizados em ambiente
local utilizando o simulador ESP8266.
