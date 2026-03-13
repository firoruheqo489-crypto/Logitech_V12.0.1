#!/usr/bin/env bash
# ============================================================================
# deploy.sh — 阿里云轻量服务器一键部署脚本
# ============================================================================
#
# 使用方法:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# 首次使用前，请先配置 SSH 免密登录（见脚本末尾说明）
# ============================================================================

set -euo pipefail

# ======================== 配置区 ========================
# ⚠️ 请根据你的服务器信息修改以下变量
SERVER_IP="120.27.153.140"        # 阿里云轻量服务器
SERVER_USER="root"                # SSH 用户名
SERVER_PORT="22"                  # SSH 端口（阿里云默认 22）
REMOTE_DIR="/var/www/logitech"    # 服务器上的部署目录
PM2_APP_NAME="mold-gantt-v3"      # PM2 进程名称（需与 ecosystem.config.cjs 一致）
# ========================================================

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# SSH 快捷命令
SSH_CMD="ssh -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP}"
SCP_CMD="scp -P ${SERVER_PORT}"

# ======================== 检查配置 ========================
if [[ "$SERVER_IP" == "你的服务器IP" ]]; then
  err "请先编辑 deploy.sh，填写 SERVER_IP、SERVER_USER 等配置"
fi

# ======================== 第1步：本地构建 ========================
log "开始本地构建..."
pnpm build
log "构建完成 → dist/"

# ======================== 第2步：上传文件 ========================
log "上传文件到服务器 ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR} ..."

# 确保远程目录存在
${SSH_CMD} "mkdir -p ${REMOTE_DIR}"

# 上传前备份当前可运行版本（用于自动回滚）
${SSH_CMD} "if [ -d ${REMOTE_DIR}/dist ]; then rm -rf ${REMOTE_DIR}/dist.prev && cp -a ${REMOTE_DIR}/dist ${REMOTE_DIR}/dist.prev; fi"

# 上传 dist（前端 + 后端 bundle）
${SCP_CMD} -r dist/ ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/

# 上传 package.json 和 lockfile（用于 pnpm install）
${SCP_CMD} package.json pnpm-lock.yaml ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/

# 上传 PM2 配置
${SCP_CMD} ecosystem.config.cjs ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/

# 上传 patches 目录（pnpm patch 依赖）
${SCP_CMD} -r patches/ ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/

# 上传 .env（环境变量，含数据库连接等）
${SCP_CMD} .env ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/

# 上传 drizzle 目录（数据库迁移，可选）
${SCP_CMD} -r drizzle/ ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/

log "文件上传完成"

# ======================== 第3步：服务器端安装依赖 ========================
log "在服务器上安装生产依赖..."
${SSH_CMD} << 'ENDSSH'
cd /var/www/logitech

# 确保全局 PM2 可用
if ! command -v pm2 > /dev/null 2>&1; then
  npm install -g pm2
fi

# 配置 PM2 开机自启（幂等，已存在则跳过）
if command -v systemctl > /dev/null 2>&1; then
  if [ ! -f /etc/systemd/system/pm2-root.service ]; then
    pm2 startup systemd -u root --hp /root || true
  fi
fi

# 安装生产依赖
pnpm install --prod

echo "依赖安装完成"
ENDSSH

log "依赖安装完成"

# ======================== 第4步：PM2 重启 ========================
log "重启 PM2 进程..."
${SSH_CMD} << ENDSSH
cd ${REMOTE_DIR}

# 检查 PM2 进程是否存在
if pm2 describe ${PM2_APP_NAME} > /dev/null 2>&1; then
  pm2 restart ecosystem.config.cjs --only ${PM2_APP_NAME} --update-env
  echo "PM2 进程已重启"
else
  # 首次部署：启动新进程
  pm2 start ecosystem.config.cjs --only ${PM2_APP_NAME} --env production
  pm2 save
  echo "PM2 进程已创建并保存"
fi

pm2 status
ENDSSH

log "部署完成 🎉"

# ======================== 第5步：健康检查 ========================
log "执行部署后健康检查..."
${SSH_CMD} << 'ENDSSH'
set -e

HEALTH_URL="http://127.0.0.1:3000/api/health"
CHECK_OK=0

for i in {1..10}; do
  if command -v curl > /dev/null 2>&1; then
    RESPONSE=$(curl -fsS "${HEALTH_URL}" || true)
  else
    RESPONSE=$(wget -qO- "${HEALTH_URL}" || true)
  fi

  if echo "${RESPONSE}" | grep -q '"ok":true'; then
    echo "健康检查通过: ${RESPONSE}"
    CHECK_OK=1
    break
  fi

  echo "健康检查重试 ${i}/10..."
  sleep 2
done

if [ "${CHECK_OK}" -ne 1 ]; then
  echo "部署后健康检查失败: ${HEALTH_URL}"
  echo "开始自动回滚到上一版本..."

  if [ -d /var/www/logitech/dist.prev ]; then
    rm -rf /var/www/logitech/dist
    mv /var/www/logitech/dist.prev /var/www/logitech/dist
    pm2 restart ecosystem.config.cjs --only mold-gantt-v3 --update-env || true

    ROLLBACK_OK=0
    for j in {1..5}; do
      if command -v curl > /dev/null 2>&1; then
        RB_RESPONSE=$(curl -fsS "${HEALTH_URL}" || true)
      else
        RB_RESPONSE=$(wget -qO- "${HEALTH_URL}" || true)
      fi

      if echo "${RB_RESPONSE}" | grep -q '"ok":true'; then
        echo "自动回滚成功，服务已恢复: ${RB_RESPONSE}"
        ROLLBACK_OK=1
        break
      fi

      echo "回滚后健康检查重试 ${j}/5..."
      sleep 2
    done

    if [ "${ROLLBACK_OK}" -ne 1 ]; then
      echo "自动回滚后健康检查仍失败，请立即人工介入。"
    fi
  else
    echo "未找到 /var/www/logitech/dist.prev，无法自动回滚。"
  fi

  echo "--- PM2 最近日志(80行) ---"
  pm2 logs mold-gantt-v3 --lines 80 --nostream || true
  echo "--- 回滚建议 ---"
  echo "1) 检查 /var/www/logitech/dist 与 /var/www/logitech/dist.prev 状态"
  echo "2) 重新执行: pm2 restart ecosystem.config.cjs --only mold-gantt-v3 --update-env"
  echo "3) 检查 .env 中 DATABASE_URL 与端口配置"
  exit 1
fi
ENDSSH

log "健康检查通过 ✅"
echo ""
echo "访问地址: http://${SERVER_IP}:3000"
echo ""

# ============================================================================
# SSH 免密登录配置指南
# ============================================================================
#
# 1. 在本地生成 SSH 密钥（如果还没有）:
#    ssh-keygen -t ed25519 -C "your_email@example.com"
#    （一路回车即可，密钥保存在 ~/.ssh/id_ed25519）
#
# 2. 将公钥上传到服务器:
#    ssh-copy-id -p 22 root@你的服务器IP
#    （需要输入一次服务器密码）
#
# 3. 测试免密登录:
#    ssh -p 22 root@你的服务器IP
#    （应该直接登录，不再要求密码）
#
# 4. 如果 ssh-copy-id 不可用（Windows），手动操作:
#    a. 查看本地公钥: type %USERPROFILE%\.ssh\id_ed25519.pub
#    b. 登录服务器，将公钥内容追加到:
#       ~/.ssh/authorized_keys
#    c. 确保权限正确:
#       chmod 700 ~/.ssh
#       chmod 600 ~/.ssh/authorized_keys
#
# ============================================================================
# 服务器首次环境准备（只需执行一次）
# ============================================================================
#
# 1. 安装 Node.js (推荐 v20 LTS):
#    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
#    sudo apt-get install -y nodejs
#
# 2. 安装 pnpm:
#    npm install -g pnpm
#
# 3. 安装 PM2:
#    npm install -g pm2
#
# 4. 配置 PM2 开机自启:
#    pm2 startup
#    （按提示执行输出的命令）
#
# 5. 配置防火墙（阿里云控制台 + 系统防火墙）:
#    - 阿里云控制台 → 轻量服务器 → 防火墙 → 添加规则 → 端口 3000
#    - 服务器上: sudo ufw allow 3000
#
# 6. （可选）配置 Nginx 反向代理:
#    sudo apt install nginx
#    然后配置 /etc/nginx/sites-available/logitech:
#
#    server {
#        listen 80;
#        server_name your-domain.com;
#
#        location / {
#            proxy_pass http://127.0.0.1:3000;
#            proxy_http_version 1.1;
#            proxy_set_header Upgrade $http_upgrade;
#            proxy_set_header Connection 'upgrade';
#            proxy_set_header Host $host;
#            proxy_set_header X-Real-IP $remote_addr;
#            proxy_cache_bypass $http_upgrade;
#        }
#    }
#
#    sudo ln -s /etc/nginx/sites-available/logitech /etc/nginx/sites-enabled/
#    sudo nginx -t && sudo systemctl reload nginx
#
# ============================================================================
