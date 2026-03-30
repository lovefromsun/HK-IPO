/** 复制到服务器后填写 JWT_SECRET，再：pm2 start pm2-hk-ipo-api.cjs && pm2 save */
module.exports = {
  apps: [
    {
      name: 'hk-ipo-api',
      cwd: '/var/www/hk-ipo-src/server',
      script: 'index.mjs',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATA_FILE: '/var/data/hk-ipo/snapshot.json',
        JWT_SECRET: '请替换为至少32位随机字符串',
        HK_IPO_ADMIN_PASSWORD: 'admin123456',
      },
    },
  ],
}
