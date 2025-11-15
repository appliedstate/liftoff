module.exports = {
  apps: [
    {
      name: 'strategist-backend',
      script: 'npm',
      args: 'run start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'strategist-daily-ingest',
      script: 'node',
      cwd: __dirname,
      args: 'node_modules/ts-node/dist/bin.js src/scripts/runDailyIngest.ts',
      cron_restart: '0 6 * * *', // 06:00 server time
      autorestart: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'strategist-backfill-tplus1',
      script: 'node',
      cwd: __dirname,
      args: 'node_modules/ts-node/dist/bin.js src/scripts/backfill.ts',
      cron_restart: '0 8 * * *', // 08:00 server time (T+1 overlay refresh window)
      autorestart: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'strategist-autofix',
      script: 'node',
      cwd: __dirname,
      args: 'node_modules/ts-node/dist/bin.js src/scripts/autofix.ts',
      cron_restart: '*/30 * * * *', // every 30 minutes
      autorestart: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};


