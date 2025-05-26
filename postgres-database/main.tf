module "rds_aurora" {
  source  = "terraform-aws-modules/rds-aurora/aws"
  version = "9.13.0"

  name                        = var.db_cluster_name
  engine                      = "aurora-postgresql"
  engine_version              = var.engine_version
  master_username             = var.master_username
  master_password             = var.master_password
  database_name               = var.database_name

  vpc_id                      = var.vpc_id
  subnets                     = var.subnet_ids
  security_group_ids          = var.security_group_ids

  instance_class              = var.instance_class
  instances                   = var.instances
  apply_immediately           = true
  skip_final_snapshot         = true
  storage_encrypted           = true

  backup_retention_period     = 7
  preferred_backup_window     = "07:00-09:00"
  preferred_maintenance_window = "mon:03:00-mon:04:00"

  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}
