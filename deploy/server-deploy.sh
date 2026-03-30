#!/usr/bin/env bash
# 在服务器上执行：拉代码、安装依赖、构建、发布静态文件
# 用法：
#   chmod +x server-deploy.sh
#   ./server-deploy.sh              # 子域名部署（根路径 /）
#   ./server-deploy.sh subpath      # 子路径 /hk-ipo/（需与 nginx 示例一致）

set -euo pipefail

MODE="${1:-root}"
REPO_DIR="${REPO_DIR:-$HOME/HK-IPO}"
WEB_ROOT="${WEB_ROOT:-/var/www/hk-ipo}"

if [[ "$MODE" == "subpath" ]]; then
  export VITE_BASE_PATH="${VITE_BASE_PATH:-/hk-ipo/}"
  export VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api/hk-ipo}"
  echo "构建 base: $VITE_BASE_PATH API: $VITE_API_BASE_URL（需 Nginx 反代 API，见 deploy/README.md）"
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "请先克隆仓库：git clone https://github.com/lovefromsun/HK-IPO.git $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"
git pull

if command -v npm >/dev/null 2>&1; then
  npm ci
  if [[ "$MODE" == "subpath" ]]; then
    npm run build
  else
    unset VITE_BASE_PATH
    npm run build
  fi
else
  echo "未找到 npm，请先安装 Node.js LTS（建议 20+）"
  exit 1
fi

sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete dist/ "$WEB_ROOT/"
echo "已发布到 $WEB_ROOT ，请 nginx -t && sudo systemctl reload nginx"
