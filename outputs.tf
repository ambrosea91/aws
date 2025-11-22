# Terraform Outputs
# This file defines outputs that will be displayed after terraform apply

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

# Subnet Outputs
output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

# Security Group Outputs
output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

# RDS Outputs
output "db_instance_id" {
  description = "RDS instance ID"
  value       = aws_db_instance.postgres.id
}

output "db_instance_arn" {
  description = "ARN of the RDS instance"
  value       = aws_db_instance.postgres.arn
}

output "db_endpoint" {
  description = "Connection endpoint for the database"
  value       = aws_db_instance.postgres.endpoint
}

output "db_address" {
  description = "Hostname of the database"
  value       = aws_db_instance.postgres.address
}

output "db_port" {
  description = "Port of the database"
  value       = aws_db_instance.postgres.port
}

output "db_name" {
  description = "Name of the database"
  value       = aws_db_instance.postgres.db_name
}

output "db_username" {
  description = "Master username of the database"
  value       = aws_db_instance.postgres.username
  sensitive   = true
}

output "db_resource_id" {
  description = "Resource ID of the database"
  value       = aws_db_instance.postgres.resource_id
}

output "db_status" {
  description = "Status of the database"
  value       = aws_db_instance.postgres.status
}

# Connection String Output
output "connection_string" {
  description = "PostgreSQL connection string (without password)"
  value       = "postgresql://${aws_db_instance.postgres.username}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}"
  sensitive   = true
}

output "psql_command" {
  description = "Command to connect using psql (without password)"
  value       = "psql -h ${aws_db_instance.postgres.address} -U ${aws_db_instance.postgres.username} -d ${aws_db_instance.postgres.db_name} -p ${aws_db_instance.postgres.port}"
  sensitive   = true
}

# CloudWatch Alarms
output "cloudwatch_alarm_cpu_arn" {
  description = "ARN of CPU utilization CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.database_cpu.arn
}

output "cloudwatch_alarm_storage_arn" {
  description = "ARN of storage space CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.database_storage.arn
}

output "cloudwatch_alarm_connections_arn" {
  description = "ARN of database connections CloudWatch alarm"
  value       = aws_cloudwatch_metric_alarm.database_connections.arn
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "region" {
  description = "AWS region"
  value       = var.aws_region
}

# Full Connection Details (for automation)
output "connection_details" {
  description = "Full connection details for the database"
  value = {
    endpoint = aws_db_instance.postgres.endpoint
    address  = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    database = aws_db_instance.postgres.db_name
    username = aws_db_instance.postgres.username
  }
  sensitive = true
}

# Secrets Manager Outputs
output "secrets_manager_secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = var.use_secrets_manager ? aws_secretsmanager_secret.db_password[0].arn : null
}

output "secrets_manager_secret_name" {
  description = "Name of the Secrets Manager secret containing database credentials"
  value       = var.use_secrets_manager ? aws_secretsmanager_secret.db_password[0].name : null
}

# Resource Group Outputs
output "resource_group_name" {
  description = "Name of the resource group containing all project resources"
  value       = aws_resourcegroups_group.rds_project.name
}

output "resource_group_arn" {
  description = "ARN of the resource group containing all project resources"
  value       = aws_resourcegroups_group.rds_project.arn
}
