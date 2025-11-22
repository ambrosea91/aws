# Production Environment Configuration

environment = "prod"
aws_region  = "us-east-2"

# Network Configuration
# Option 1: Use existing VPC and subnets (recommended for production)
# use_existing_vpc    = true
# existing_vpc_id     = "vpc-xxxxxxxxxxxxxxxxx"
# existing_subnet_ids = ["subnet-xxxxxxxxxxxxxxxxx", "subnet-yyyyyyyyyyyyyyyyy", "subnet-zzzzzzzzzzzzzzzzz"]

# Option 2: Create new VPC and subnets (default)
use_existing_vpc     = false
vpc_cidr             = "10.2.0.0/16"
availability_zones   = ["us-east-2a", "us-east-2b", "us-east-2c"]
public_subnet_cidrs  = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
private_subnet_cidrs = ["10.2.11.0/24", "10.2.12.0/24", "10.2.13.0/24"]

# Restrict access to VPC only (most secure)
allowed_cidr_blocks = ["10.2.0.0/16"]

# RDS Configuration - production-grade instance
instance_class        = "db.t3.medium"
engine_version        = "15.4"
engine_version_family = "15"
allocated_storage     = 100
max_allocated_storage = 500
storage_type          = "gp3"
storage_encrypted     = true

# Database Configuration
database_name               = "proddb"
master_username             = "postgres"
publicly_accessible         = false # Never public in production
use_secrets_manager         = true  # Store password in Secrets Manager
secret_recovery_window_days = 30

# Backup Configuration - comprehensive for production
backup_retention_period = 30
backup_window           = "03:00-04:00"
maintenance_window      = "sun:04:00-sun:05:00"
skip_final_snapshot     = false
deletion_protection     = true # Prevent accidental deletion

# Monitoring - full monitoring for production
enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
monitoring_interval             = 60
performance_insights_enabled    = true
auto_minor_version_upgrade      = false # Manual control in production

# High Availability - enabled for production
multi_az = true

# Alerting - configure your SNS topic ARN
# alarm_actions = ["arn:aws:sns:us-east-1:906266478329:production-critical-alerts"]
alarm_actions             = []
max_connections_threshold = 100

# Additional Tags
additional_tags = {
  CostCenter  = "Production"
  Owner       = "OpsTeam"
  Compliance  = "Required"
  Criticality = "High"
}
