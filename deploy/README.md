# 部署说明（与已有博客共存）

本项目是 **Vite 构建的纯前端静态站**，构建产物在 `dist/`，用 Nginx（或 Caddy）提供静态文件即可，**不需要**和博客抢同一个进程或端口。

## 推荐：子域名（例如 `ipo.你的域名.com`）

与博客 **零冲突**：博客继续用原来的 `server` 块，本应用单独一个 `server`。

1. 服务器安装 Node.js（仅用于构建，可选在本地构建后只上传 `dist`）。
2. `git clone https://github.com/lovefromsun/HK-IPO.git` 到任意目录，在项目根执行 `npm ci && npm run build`。
3. 将 `dist/` 内**所有文件**拷贝到 Web 目录，例如 `/var/www/hk-ipo/`（`index.html` 就在该目录下）。
4. 参考 [nginx-subdomain.example.conf](./nginx-subdomain.example.conf) 新增站点，把 `server_name` 和 `root` 改成你的域名与目录。
5. `nginx -t && sudo systemctl reload nginx`，并用 Certbot 等配置 HTTPS。

访问地址：`https://ipo.你的域名.com`

## 可选：同域子路径（例如 `https://博客域名/hk-ipo/`）

构建时必须指定 base（已写在 `vite.config.ts`）：

```bash
VITE_BASE_PATH=/hk-ipo/ npm run build
```

把 `dist/` 里的内容放到 **Nginx `alias` 指向的目录**（本机已与博客同机部署为 `/var/www/hk-ipo-app/`，见下节）。

在你**现有博客**的 `server { }` 里增加 `include /etc/nginx/snippets/hk-ipo-static.conf;`（内容与 [nginx-hk-ipo-snippet.conf](./nginx-hk-ipo-snippet.conf) 一致），或直接把其中 `location /hk-ipo/` 块贴进配置；**不要**改博客原来的 `location /` 反代规则。

## 当前生产环境（与博客同机）

博客项目（Next.js + PM2）与 Nginx 配置可参考本机目录 `testno1` / `blognew` 仓库中的 `deploy/`。

| 项 | 值 |
|----|-----|
| 公网 IP | `150.158.75.100`（若你记成 `50.158...` 多为笔误） |
| SSH（Windows） | `ssh -i C:\Users\cx\.ssh\MYY.pem ubuntu@150.158.75.100` |
| 本应用访问 | `https://lovefromsun.cloud/hk-ipo/` 或 `http://150.158.75.100/hk-ipo/`（见下「IP 访问说明」） |
| 源码目录（服务器） | `/var/www/hk-ipo-src`（`git pull` 后在此构建） |
| 静态文件目录 | `/var/www/hk-ipo-app`（由 Nginx `alias` 提供） |
| Nginx 片段 | `/etc/nginx/snippets/hk-ipo-static.conf` |

**IP 访问说明（备案期间）**

- 请使用 **末尾带斜杠** 的地址：`http://150.158.75.100/hk-ipo/` 或 `https://150.158.75.100/hk-ipo/`。若省略末尾 `/`，浏览器常访问的是 `/hk-ipo`，会优先落到博客的 Next 路由从而 **404**；服务器已为 `/hk-ipo` 配置 **301 跳转到 `/hk-ipo/`**。
- 若仍打不开，请用 **HTTP** 先试：`http://150.158.75.100/hk-ipo/`（部分环境对 IP 直连 HTTPS 证书会报警，属正常）。

**更新部署（在服务器执行）**（启用集中存储时须带 `VITE_API_BASE_URL`，见下节）：

```bash
cd /var/www/hk-ipo-src && git pull && npm ci
VITE_BASE_PATH=/hk-ipo/ VITE_API_BASE_URL=/api/hk-ipo npm run build
sudo rsync -a --delete dist/ /var/www/hk-ipo-app/
sudo chown -R www-data:www-data /var/www/hk-ipo-app
```

## 集中存储（多设备、多浏览器共享同一套数据）

默认仅 **IndexedDB**（各浏览器各一份）。若希望 **手机/家里/公司** 打开同一网址都能看到同一批账号与新股数据，需要启用 **Node API + 服务器快照文件**：

1. **环境变量（构建前端）**：`VITE_API_BASE_URL=/api/hk-ipo`（与 Nginx 反代路径一致，勿加引号）。
2. **Node 服务**：仓库内 `server/` 目录，`npm ci && node index.mjs`，监听 `127.0.0.1:3001`，数据文件默认 `DATA_FILE=/var/data/hk-ipo/snapshot.json`。
3. **Nginx**：在博客的 HTTPS `server` 与 IP:80 的 `server` 中，在 `location /` **之前**加入 [nginx-api-location.example.conf](./nginx-api-location.example.conf) 片段。
4. **进程管理**：建议 `pm2 start server/index.mjs --name hk-ipo-api`，并设置环境变量：
   - `JWT_SECRET`：至少 16 位随机字符串（必填）
   - `DATA_FILE`：如 `/var/data/hk-ipo/snapshot.json`
   - `HK_IPO_ADMIN_PASSWORD`：首次初始化时的 `admin` 密码（可与本地一致便于迁移）

首次启动 API 若尚无快照文件，会自动创建 **admin** 用户（密码见 `HK_IPO_ADMIN_PASSWORD`）。前端登录后会把服务器快照 **下载到本机 IndexedDB**，并约每 15 秒 **上传**一次；切回标签页会 **拉取** 最新快照。多设备同时编辑以 **最后保存为准**。

**未设置 `VITE_API_BASE_URL` 时**：行为与旧版一致，全部为浏览器本地存储；仍可用「数据备份」JSON 做一次性迁移。

**本地数据一次性同步到线上（未启用 API 时）**

用管理员 **数据备份** 导出 JSON，在线上 **数据备份** 导入。启用集中存储并导入后，数据会写入服务器快照。

## 服务器一键脚本

将仓库克隆到 `~/HK-IPO` 后：

```bash
chmod +x deploy/server-deploy.sh
# 子域名（默认发布到 /var/www/hk-ipo，可用环境变量 WEB_ROOT 覆盖）
sudo WEB_ROOT=/var/www/hk-ipo ./deploy/server-deploy.sh

# 子路径（会设置 VITE_BASE_PATH=/hk-ipo/）
sudo WEB_ROOT=/var/www/你的博客根/hk-ipo ./deploy/server-deploy.sh subpath
```

## 数据与安全说明

- **未启用 API**：数据仅在各浏览器 **IndexedDB**。
- **启用 API**：权威数据在服务器 **snapshot.json**（含与客户端相同结构的密码哈希）；浏览器侧仍有 IndexedDB 作为缓存并与服务器同步。备份 JSON 仍含敏感信息，勿泄露。

## 其他 Web 服务器

若博客用 Caddy：用 `file_server` 指向 `dist` 目录，并对 SPA 配置 `try_files` 或 `handle_path` 回退到 `index.html` 即可，思路与 Nginx 相同。
