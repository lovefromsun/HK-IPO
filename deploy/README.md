# 部署说明（前端 + Node API + SQLite）

当前版本：**前端静态文件（Vite `dist/`）+ 本机 Node API（Express）+ SQLite**。数据在服务器上的 `.sqlite` 文件中，多设备通过同一域名登录共享数据。

**环境要求**

- 服务器：**Node.js ≥ 22.5**（使用内置 `node:sqlite`）
- 进程管理：推荐 **PM2**
- 反向代理：**Nginx**（HTTPS、静态资源、`/api/hk-ipo` → API）

---

## SSH 登录（你之前用过的方式，Windows）

在旧版部署文档里记录过（与博客同机腾讯云），可按需改用你自己的密钥路径：

| 项 | 值 |
|----|-----|
| 公网 IP | `150.158.75.100`（若记成 `50.158.x.x` 多为笔误） |
| SSH（PowerShell / CMD） | `ssh -i C:\Users\cx\.ssh\MYY.pem ubuntu@150.158.75.100` |
| 应用访问（域名） | `https://lovefromsun.cloud/hk-ipo/`（末尾需带 `/`） |
| 应用访问（IP） | `http://150.158.75.100/hk-ipo/` 或 HTTPS 同路径（证书对 IP 可能报警） |
| 服务器源码目录 | `/var/www/hk-ipo-src`（`git pull` 后在此构建） |
| 静态文件目录 | `/var/www/hk-ipo-app`（Nginx `alias`） |
| Nginx 静态片段（若已装） | `/etc/nginx/snippets/hk-ipo-static.conf` |

登录后即在 Ubuntu 上执行下文「克隆与构建」「PM2」「nginx -t」等命令。

---

## 一、与博客同域子路径（示例：`https://lovefromsun.cloud/hk-ipo/`）

与你仓库里历史部署一致时，可按下面做。

### 1. 目录约定（可按需改路径）

| 项 | 示例路径 |
|----|-----------|
| 源码（git pull & build） | `/var/www/hk-ipo-src` |
| 静态站点（Nginx `alias`） | `/var/www/hk-ipo-app` |
| SQLite 数据（勿提交 git） | `/var/data/hk-ipo/hk-ipo.sqlite` |
| API 进程工作目录 | `/var/www/hk-ipo-src/server` |

```bash
sudo mkdir -p /var/www/hk-ipo-app /var/data/hk-ipo
sudo chown -R "$USER":"$USER" /var/data/hk-ipo
```

### 2. 克隆与构建前端

```bash
sudo mkdir -p /var/www/hk-ipo-src
sudo chown -R "$USER":"$USER" /var/www/hk-ipo-src
cd /var/www/hk-ipo-src
git clone https://github.com/lovefromsun/HK-IPO.git .
# 或已有仓库则：git pull

npm ci
(cd server && npm ci)

VITE_BASE_PATH=/hk-ipo/ VITE_API_BASE_URL=/api/hk-ipo npm run build
sudo rsync -a --delete dist/ /var/www/hk-ipo-app/
sudo chown -R www-data:www-data /var/www/hk-ipo-app
```

### 3. 配置并启动 API（PM2）

复制示例并修改密钥与路径：

```bash
cp deploy/pm2-hk-ipo-api.example.cjs ~/pm2-hk-ipo-api.cjs
# 编辑：JWT_SECRET、HK_IPO_ADMIN_PASSWORD、cwd、SQLITE_PATH
pm2 start ~/pm2-hk-ipo-api.cjs
pm2 save
```

**必填环境变量**

- `JWT_SECRET`：至少 16 位随机串  
- `HK_IPO_ADMIN_PASSWORD`：首次创建库时的 `admin` 密码  

**推荐**

- `SQLITE_PATH`：如 `/var/data/hk-ipo/hk-ipo.sqlite`（持久化、备份方便）  
- `DATA_FILE`：可选，指向旧版 `snapshot.json` 时，**首次**建库可导入后再用（见 `server` 代码）

本地健康检查（在服务器上）：

```bash
curl -sS http://127.0.0.1:3001/api/health
# 应看到 {"ok":true,"storage":"sqlite"}
```

### 4. Nginx

- **静态**：使用 [nginx-hk-ipo-snippet.conf](./nginx-hk-ipo-snippet.conf) 提供 `/hk-ipo/`（或与现有 `snippets/hk-ipo-static.conf` 一致）。  
- **API**：在 `location / { proxy_pass ... }` **之前** 加入 [nginx-api-location.example.conf](./nginx-api-location.example.conf)，将 `/api/hk-ipo/` 反代到 `http://127.0.0.1:3001/api/`。

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 5. 访问注意

- 子路径务必带尾部斜杠：`https://你的域名/hk-ipo/`  
- 仅 IP 访问时若 `/hk-ipo` 被博客抢走，需依赖已为 `/hk-ipo` → `/hk-ipo/` 的 301（见历史说明）

---

## 二、子域名（例如 `https://ipo.你的域名.com`）

1. `npm ci && (cd server && npm ci)`  
2. **不要**子路径时：`unset VITE_BASE_PATH` 或 `VITE_BASE_PATH=/`，仍设置 `VITE_API_BASE_URL=/api/hk-ipo`，`npm run build`。  
3. Nginx：`root` 指向 `dist` 对应目录；`location /api/hk-ipo/` 与上面相同反代到 `127.0.0.1:3001`。  

---

## 三、一键脚本（仅构建并同步静态文件）

在服务器克隆仓库后：

```bash
chmod +x deploy/server-deploy.sh
# 子路径（默认会设置 VITE_BASE_PATH 与 VITE_API_BASE_URL）
sudo WEB_ROOT=/var/www/hk-ipo-app REPO_DIR=/var/www/hk-ipo-src ./deploy/server-deploy.sh subpath
```

脚本会在 `REPO_DIR` 里 `git pull`、`npm ci`、**并在 `server/` 内 `npm ci`**。API 进程仍需单独用 PM2 启动一次并配置环境变量。

---

## 四、更新上线（例行）

```bash
cd /var/www/hk-ipo-src && git pull && npm ci && (cd server && npm ci)
VITE_BASE_PATH=/hk-ipo/ VITE_API_BASE_URL=/api/hk-ipo npm run build
sudo rsync -a --delete dist/ /var/www/hk-ipo-app/
pm2 restart hk-ipo-api
sudo nginx -t && sudo systemctl reload nginx
```

---

## 五、数据与安全

- **SQLite 文件**含账号、新股、中签记录与用户密码哈希，请限制权限，并做定期备份（管理员「数据备份」导出 JSON 或拷贝 `.sqlite`）。  
- **勿**将 `server/data/` 或生产用 `.sqlite` 提交到 Git（`.gitignore` 已忽略 `server/data/`）。  
- 生产环境务必使用强 `JWT_SECRET` 与强管理员密码。

---

## 其他 Web 服务器

Caddy 等：静态托管 `dist`，并对 SPA 回退 `index.html`；`/api/hk-ipo/*` 反代到本机 `3001` 的 `/api/*`，思路与 Nginx 相同。

---

## 参考仓库

源码：<https://github.com/lovefromsun/HK-IPO>
