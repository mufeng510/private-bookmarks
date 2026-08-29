import { APP_VERSION } from '@private-bookmarks/shared';
import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { startBackupScheduler } from './backup.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const { app, handle, close } = await buildApp(config);

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    handle.close();
    process.exit(1);
  }

  startBackupScheduler(config, handle, app.log);
  app.log.info(`Private Bookmarks v${APP_VERSION} ready at http://${config.host}:${config.port}`);
  if (!config.sessionSecretConfigured) {
    app.log.warn('SESSION_SECRET is not set: sessions will be invalidated on every restart. Set it in .env');
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`${signal} received, shutting down`);
    await close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main();
