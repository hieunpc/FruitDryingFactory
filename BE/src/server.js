const app = require("./app");
const env = require("./config/env");
const { getPool } = require("./config/db");
const { startMqtt } = require("./config/mqtt");
const { ingestSensorValue } = require("./services/sensorService");
const { processScheduledBatches } = require("./services/batchService");
const { initSimulation } = require("./services/simulationService");

const SCHEDULED_BATCH_POLL_SECONDS = 1;

async function bootstrap() {
  await getPool();
  // eslint-disable-next-line no-console
  console.log("PostgreSQL connected");

  startMqtt(async (sensorId, value, source) => {
    await ingestSensorValue(sensorId, value, source);
  });

  // Auto-start simulation if persisted state is active
  initSimulation();

  setInterval(() => {
    processScheduledBatches().catch((error) => {
      // eslint-disable-next-line no-console
      console.error("Scheduled batch processor error", error);
    });
  }, SCHEDULED_BATCH_POLL_SECONDS * 1000);

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server is running on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to bootstrap server", error);
  process.exit(1);
});
