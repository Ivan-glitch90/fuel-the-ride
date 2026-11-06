import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import './models/index.js';

const config = loadConfig();
await connectDb(config.mongoUri);

const app = createApp(config);
const server = app.listen(config.port, () => {
  console.log(`Fuel the Ride API listening on port ${config.port} (${config.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await disconnectDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
