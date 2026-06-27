#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# user_data.sh — Script de bootstrap de la EC2 (Ubuntu)
#
# CONCEPTO CLAVE: User Data
# ──────────────────────────
# AWS ejecuta este script UNA SOLA VEZ, como root, justo después de que
# la instancia EC2 arranca por primera vez. Es el equivalente al "setup
# manual" que harías por SSH, pero automatizado e idempotente.
#
# SO: Ubuntu (usa apt). Si migras a Amazon Linux 2023, cambia apt → dnf
#     y el usuario ubuntu → ec2-user.
#
# Lo que hace este script:
#   1. Instala Docker y el plugin Docker Compose
#   2. Clona el repositorio git
#   3. Crea el fichero .env raíz con el DOMAIN de producción
#
# Lo que NO hace (debe hacerlo el operador manualmente):
#   - Copiar api/.env y agent/.env con los secrets reales
#   - Ejecutar `docker compose up -d`
#
# Por qué no automatizamos el arranque:
#   Los secrets no están en el repo (correcto) ni en Terraform (peligroso).
#   El servidor queda listo para arrancar; el operador copia los .env y lanza.
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail  # Aborta si cualquier comando falla

LOG=/var/log/user-data.log
exec > >(tee -a "$LOG") 2>&1  # Todo output va al log Y a la consola
echo "=== user_data.sh iniciado: $(date) ==="

# ── 1. Actualizar el sistema ─────────────────────────────────────────────────
apt-get update -y

# ── 2. Instalar Docker ───────────────────────────────────────────────────────
apt-get install -y docker.io git

# Habilitar e iniciar el servicio Docker
systemctl enable --now docker

# Añadir ubuntu al grupo docker para no tener que usar sudo
usermod -aG docker ubuntu

# ── 3. Instalar Docker Compose (plugin ARM64) ────────────────────────────────
#
# Docker Compose v2 se instala como un plugin del CLI de Docker.
# La ubicación estándar es /usr/local/lib/docker/cli-plugins/
# La arquitectura es aarch64 (ARM64) porque usamos una t4g.* Graviton.
#
COMPOSE_VERSION=$(curl -fsSL https://api.github.com/repos/docker/compose/releases/latest \
  | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')

mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL \
  "https://github.com/docker/compose/releases/download/v$${COMPOSE_VERSION}/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "Docker Compose instalado: $(docker compose version)"

# ── 4. Clonar el repositorio ─────────────────────────────────────────────────
#
# ${github_repo_url} y ${domain} son sustituidos por Terraform
# usando la función templatefile() antes de enviar este script a AWS.
#
REPO_URL="${github_repo_url}"
DEPLOY_DIR="/home/ubuntu/portfolio"

git clone "$REPO_URL" "$DEPLOY_DIR"
chown -R ubuntu:ubuntu "$DEPLOY_DIR"

# ── 5. Crear el .env raíz con el dominio de producción ───────────────────────
#
# Este .env es el que lee docker compose para la variable DOMAIN.
# Los secrets (api/.env, agent/.env) los copia el operador por SCP.
#
cat > "$DEPLOY_DIR/.env" << EOF
# Generado por user_data.sh — $(date)
DOMAIN=${domain}
EOF

chown ubuntu:ubuntu "$DEPLOY_DIR/.env"

echo ""
echo "=== Bootstrap completado: $(date) ==="
echo ""
echo "Pasos manuales pendientes:"
echo "  1. scp api/.env  ubuntu@<ip>:~/portfolio/api/.env"
echo "  2. scp agent/.env ubuntu@<ip>:~/portfolio/agent/.env"
echo "  3. ssh ubuntu@<ip>"
echo "  4. cd portfolio && docker compose up -d --build"
echo ""
echo "Logs disponibles en: $LOG"
