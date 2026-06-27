# ═══════════════════════════════════════════════════════════════════════════════
# main.tf — Infraestructura principal
#
# CONCEPTO CLAVE: Recursos en Terraform
# ──────────────────────────────────────
# Terraform trabaja con "recursos" — cada resource {} describe un componente
# de infraestructura que Terraform debe crear, actualizar o destruir.
#
# Cuando ejecutas `terraform apply`, Terraform:
#   1. Lee todos los .tf del directorio
#   2. Compara el estado deseado (estos ficheros) con el estado actual
#      (guardado en terraform.tfstate)
#   3. Calcula el plan de cambios
#   4. Aplica solo los cambios necesarios
#
# Recursos en este fichero:
#   - aws_security_group  → el firewall del servidor
#   - aws_instance        → la EC2 t4g.micro
#   - aws_eip             → una IP pública fija (Elastic IP)
#   - aws_eip_association → vincula la EIP a la instancia
# ═══════════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"  # Acepta 5.x pero no 6.x (semver conservador)
    }
  }
}

# ── Provider ────────────────────────────────────────────────────────────────
#
# El provider es el "conector" de Terraform con una plataforma.
# "hashicorp/aws" habla con la API de AWS usando tus credenciales.
#
# Las credenciales las lee de ~/.aws/credentials o de variables de entorno
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY. Nunca se escriben en los .tf.
#
provider "aws" {
  region = var.aws_region
}

# ── AMI: Amazon Linux 2023 ARM64 ─────────────────────────────────────────────
#
# En vez de hardcodear un AMI ID (que cambia por región y con cada update),
# usamos un "data source" para que Terraform busque la última versión
# de Amazon Linux 2023 para ARM64 en la región configurada.
#
# data {} → consulta información existente (no crea recursos)
# resource {} → crea o modifica recursos
#
data "aws_ami" "al2023_arm64" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ── Security Group — el firewall del servidor ────────────────────────────────
#
# Un Security Group es el firewall de AWS: define qué tráfico puede entrar
# (ingress) y salir (egress) de la instancia.
#
# Reglas de este stack:
#   - Puerto 22  (SSH): solo desde tu IP — nunca abierto a todo internet
#   - Puerto 80  (HTTP): abierto — Caddy redirige a HTTPS
#   - Puerto 443 (HTTPS): abierto — el tráfico real del portfolio
#   - Puertos 8787/8788 NO están aquí — esos son internos a Docker, nunca al exterior
#
resource "aws_security_group" "portfolio" {
  name        = "portfolio-sg"
  description = "Portfolio: SSH restringido + HTTP/HTTPS publico"

  # SSH: solo desde tu IP
  ingress {
    description = "SSH desde IP del operador"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  # HTTP: Caddy lo redirige a HTTPS y lo necesita para el challenge ACME
  ingress {
    description = "HTTP publico (redireccion a HTTPS + ACME challenge)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  # HTTPS: el tráfico real del portfolio
  ingress {
    description = "HTTPS publico"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  # Egress: salida libre — el servidor necesita internet para pull de imágenes
  # Docker, llamadas a Groq/Gemini/OpenRouter, renovar certificados TLS, etc.
  egress {
    description = "Salida libre a internet"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"  # Todos los protocolos
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name    = "portfolio-sg"
    Project = "portfolio"
  }
}

# ── EC2 Instance ─────────────────────────────────────────────────────────────
#
# t4g.small: instancia ARM Graviton (2 vCPU, 2 GB RAM).
# Usamos t4g.small porque es lo que tiene el servidor existente importado.
# (t4g.micro tiene solo 1 GB RAM — puede quedarse corto con Docker + agent Python)
#
resource "aws_instance" "portfolio" {
  ami                    = data.aws_ami.al2023_arm64.id
  instance_type          = "t4g.small"
  key_name               = var.key_pair_name
  vpc_security_group_ids = [aws_security_group.portfolio.id]

  # user_data: el script de bootstrap.
  # templatefile() sustituye las variables ${github_repo_url} y ${domain}
  # antes de enviar el script a AWS. Es como un .env para el script de bootstrap.
  user_data = templatefile("${path.module}/user_data.sh", {
    github_repo_url = var.github_repo_url
    domain          = var.domain
  })

  # lifecycle.ignore_changes: le dice a Terraform que ignore cambios en estos
  # atributos después del primer apply o import.
  #
  # - ami: la instancia importada usa una AMI existente. Si el data source
  #   encuentra una versión más nueva, Terraform querría RECREAR la instancia
  #   (destruir + crear) — demasiado agresivo para producción. Ignoramos el AMI
  #   y solo lo actualizaríamos cuando decidamos hacerlo conscientemente.
  #
  # - user_data: el servidor ya está bootstrapeado. user_data solo corre en el
  #   primer arranque — no tiene sentido actualizarlo en una instancia en marcha.
  lifecycle {
    ignore_changes = [ami, user_data]
  }

  # El volumen raíz: 20 GB es suficiente para el OS + Docker images + datos.
  # gp3 es más barato y rápido que gp2.
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    delete_on_termination = true

    tags = {
      Name    = "portfolio-root"
      Project = "portfolio"
    }
  }

  tags = {
    Name    = "portfolio"
    Project = "portfolio"
  }
}

# ── Elastic IP — IP pública fija ─────────────────────────────────────────────
#
# Por defecto, AWS asigna una IP pública nueva cada vez que una instancia
# se para y se vuelve a arrancar. Con una Elastic IP la dirección es fija:
# tu DNS siempre apunta a la misma IP sin importar reinicios.
#
# Una EIP no asociada tiene coste (~$0.005/hora). Solo es gratis cuando
# está asociada a una instancia en ejecución — que es nuestro caso.
#
resource "aws_eip" "portfolio" {
  domain = "vpc"

  tags = {
    Name    = "portfolio-eip"
    Project = "portfolio"
  }
}

# Vincula la EIP a la instancia EC2
resource "aws_eip_association" "portfolio" {
  instance_id   = aws_instance.portfolio.id
  allocation_id = aws_eip.portfolio.id
}
