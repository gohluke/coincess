module.exports = {
  apps: [
    {
      name: "coincess-monitor",
      script: "npx",
      args: "tsx src/index.ts",
      cwd: "/opt/coincess-monitor",
      env: {
        NODE_ENV: "production",
      },
      restart_delay: 5000,
      max_restarts: 50,
      exp_backoff_restart_delay: 100,
    },
  ],
};
