/**
 * 复制到服务器（如 ~/pm2-hk-ipo-api.cjs），修改 cwd / JWT_SECRET / 密码与路径后：
 *   pm2 start ~/pm2-hk-ipo-api.cjs
 *   pm2 save
 *
 * 需要 Node.js >= 22.5（node:sqlite）
 */
module.exports = {
  apps: [
    {
      name: 'hk-ipo-api',
      cwd: '/var/www/hk-ipo-src/server',
      script: 'index.mjs',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        /** 生产库路径（与 deploy/README.md 一致） */
        SQLITE_PATH: '/var/data/hk-ipo/hk-ipo.sqlite',
        /** 可选：若路径上存在旧版 snapshot.json，首次建库可据此导入（见 sqlite-store） */
        DATA_FILE: '/var/data/hk-ipo/snapshot.json',
        JWT_SECRET: '请替换为至少32位随机字符串',
        HK_IPO_ADMIN_PASSWORD: '请替换为强密码',
      },
    },
  ],
}
