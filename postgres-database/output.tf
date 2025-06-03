output "rds_cluster_id" {
  description = "Aurora PostgreSQL cluster ID"
  value       = module.aurora_postgres.rds_cluster_id
}