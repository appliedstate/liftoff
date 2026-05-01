module.exports = {
  apps: [
    {
      name: "liftoff-buyer-dashboard",
      cwd: __dirname,
      script: "npm",
      args: "run start -- -p 3002 -H 127.0.0.1",
      env: {
        NODE_ENV: "production",
        PORT: 3002,
      },
    },
  ],
};

