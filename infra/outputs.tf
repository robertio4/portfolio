# ═══════════════════════════════════════════════════════════════════════════════
# outputs.tf — Valores que Terraform muestra al terminar
#
# CONCEPTO CLAVE: Outputs en Terraform
# ──────────────────────────────────────
# Los outputs son los "resultados" del apply: la información que necesitas
# después de crear la infraestructura. Terraform los imprime al final del
# `terraform apply` y los puedes consultar en cualquier momento con
# `terraform output`.
#
# También sirven para pasar valores entre módulos de Terraform (si en el
# futuro divides la infra en módulos), pero para este proyecto los usamos
# simplemente como información de operaciones.
# ═══════════════════════════════════════════════════════════════════════════════

output "instance_public_ip" {
  description = "IP pública fija del servidor (Elastic IP). Apunta tu DNS aquí."
  value       = aws_eip.portfolio.public_ip
}

output "instance_id" {
  description = "ID de la instancia EC2. Útil para AWS CLI y consola."
  value       = aws_instance.portfolio.id
}

output "ssh_command" {
  description = "Comando SSH listo para copiar y pegar."
  value       = "ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_eip.portfolio.public_ip}"
}

output "scp_api_env" {
  description = "Comando para copiar api/.env al servidor."
  value       = "scp -i ~/.ssh/${var.key_pair_name}.pem api/.env ubuntu@${aws_eip.portfolio.public_ip}:~/portfolio/api/.env"
}

output "scp_agent_env" {
  description = "Comando para copiar agent/.env al servidor."
  value       = "scp -i ~/.ssh/${var.key_pair_name}.pem agent/.env ubuntu@${aws_eip.portfolio.public_ip}:~/portfolio/agent/.env"
}

output "next_steps" {
  description = "Pasos manuales tras el apply."
  value       = <<-EOT

    ── Pasos manuales después del terraform apply ──────────────────────────

    1. Actualiza el DNS de ${var.domain} con esta IP:
         A record → ${aws_eip.portfolio.public_ip}

    2. Copia los secrets al servidor:
         scp -i ~/.ssh/${var.key_pair_name}.pem api/.env   ubuntu@${aws_eip.portfolio.public_ip}:~/portfolio/api/.env
         scp -i ~/.ssh/${var.key_pair_name}.pem agent/.env ubuntu@${aws_eip.portfolio.public_ip}:~/portfolio/agent/.env

    3. Conéctate y lanza el stack:
         ssh -i ~/.ssh/${var.key_pair_name}.pem ubuntu@${aws_eip.portfolio.public_ip}
         cd portfolio
         docker compose up -d --build

    4. Verifica que todo funciona:
         curl https://${var.domain}/health

    ────────────────────────────────────────────────────────────────────────
  EOT
}
