region             = "us-east-1"
aws_profile        = "default"

db_cluster_name    = "aurora-postgres-cluster"
engine_version     = "13.7"
master_username    = "aurora_admin"
master_password    = "yourStrongP@ssw0rd"
database_name      = "app_db"

vpc_id             = "vpc-0a1b2c3d4e5f6g7h"
subnet_ids         = ["subnet-12345678", "subnet-23456789", "subnet-34567890"]
security_group_ids = ["sg-0123456789abcdef0"]

instance_class     = "db.r6g.large"
instances          = 2

environment        = "dev"
