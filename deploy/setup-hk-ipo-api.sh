#!/usr/bin/env bash
# 在服务器上执行：bash deploy/setup-hk-ipo-api.sh
set -euo pipefail
JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
cat > /tmp/hk-ecosystem.cjs <<EOF
module.exports = {
  apps: [{
    name: 'hk-ipo-api',
    cwd: '/var/www/hk-ipo-src/server',
    script: 'index.mjs',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATA_FILE: '/var/data/hk-ipo/snapshot.json',
      JWT_SECRET: '${JWT}',
      HK_IPO_ADMIN_PASSWORD: 'admin123456',
    },
  }],
}
EOF
echo "[hk-ipo-api] JWT_SECRET (请仅自己保存): ${JWT}"
pm2 delete hk-ecosystem 2>/dev/null || true
pm2 delete hk-ipo-api 2>/dev/null || true
cp /tmp/hk-ecosystem.cjs /var/www/hk-ipo-src/ecosystem.config.cjs
cd /var/www/hk-ipo-src && pm2 start ecosystem.config.cjs
pm2 save
echo "[hk-ipo-api] pm2 started. Test: curl -s http://127.0.0.1:3001/api/health"
