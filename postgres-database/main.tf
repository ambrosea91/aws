module "aurora_postgres" {
  source = "./modules/aurora"

  app_name           = var.app_name
  environment        = var.environment
  env_suffix         = var.env_suffix
  initial_db_name    = var.initial_db_name
  master_username    = var.master_username
  master_password    = var.master_password
  kms_key_id         = var.kms_key_id
  security_group_id  = var.security_group_id
  db_subnet_group    = var.db_subnet_group
  db_port            = var.db_port
  created_by         = var.created_by
  sns_topic_arn      = var.sns_topic_arn
}

module "state_backend" {
  source = "./modules/backend"

  s3_bucket      = var.s3_bucket
  dynamodb_table = var.dynamodb_table
  created_by     = var.created_by
}