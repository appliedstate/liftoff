module.exports = {
  apps: [
    {
      name: 'meta-policy-api',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
  ],
};
