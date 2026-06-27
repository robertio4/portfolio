# ═══════════════════════════════════════════════════════════════════════════════
# variables.tf — Parámetros configurables de la infraestructura
#
# CONCEPTO CLAVE: Variables en Terraform
# ───────────────────────────────────────
# Las variables separan la *configuración* (qué quieres) de la *lógica*
# (cómo construirlo). Lo mismo que las variables de entorno en tu app.
#
# Terraform las lee de tres sitios, en orden de prioridad:
#   1. terraform.tfvars (fichero local, gitignoreado — tus valores reales)
#   2. Variables de entorno: TF_VAR_nombre=valor
#   3. El campo `default` definido aquí (fallback)
#
# Para empezar: copia infra/terraform.tfvars.example → infra/terraform.tfvars
# y rellena tus valores.
# ═══════════════════════════════════════════════════════════════════════════════

variable "aws_region" {
  description = "Región de AWS donde se desplegará la EC2."
  type        = string
  default     = "eu-west-1" # Irlanda — la más cercana a España en free tier
}

variable "key_pair_name" {
  description = <<-EOT
    Nombre del Key Pair de AWS para acceder por SSH.
    Créalo en la consola: EC2 → Key Pairs → Create key pair.
    Guarda el fichero .pem en un sitio seguro (~/.ssh/).
  EOT
  type        = string
  # Sin default — es obligatorio. Terraform fallará si no se proporciona.
}

variable "ssh_allowed_cidr" {
  description = <<-EOT
    IP desde la que se permite el acceso SSH, en formato CIDR.
    Usa tu IP pública con /32 para restringir solo a tu máquina:
      curl https://checkip.amazonaws.com  →  203.0.113.42
      ssh_allowed_cidr = "203.0.113.42/32"
    Nunca uses 0.0.0.0/0 — dejaría el puerto 22 abierto a internet.
  EOT
  type        = string
}

variable "github_repo_url" {
  description = "URL HTTPS del repositorio git a clonar en el servidor."
  type        = string
  default     = "https://github.com/robertio4/portfolio.git"
}

variable "domain" {
  description = <<-EOT
    Dominio público del portfolio (sin https://).
    Caddy lo usará para obtener el certificado TLS de Let's Encrypt.
    El DNS del dominio debe apuntar a la Elastic IP del servidor.
  EOT
  type        = string
  default     = "robertorf.dev"
}
