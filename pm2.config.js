module.exports = {
  apps: [
    {
      name: 'filetools-backend',
      cwd: './apps/backend',
      script: 'dist/server.js',
      watch: false,
      autorestart: true,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
    // {
    //   name: 'filetools-frontend',
    //   cwd: './apps/frontend',
    //   script: 'npm',
    //   args: 'run preview',
    //   watch: false,
    //   autorestart: true,
    //   env: {
    //     NODE_ENV: 'production',
    //   },
    // },
  ],
};
