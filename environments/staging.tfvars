# Staging Environment Configuration

environment = "staging"
aws_region  = "us-east-1"

# Network Configuration
# Option 1: Use existing VPC and subnets (uncomment and configure)
# use_existing_vpc    = true
# existing_vpc_id     = "vpc-xxxxxxxxxxxxxxxxx"
# existing_subnet_ids = ["subnet-xxxxxxxxxxxxxxxxx", "subnet-yyyyyyyyyyyyyyyyy"]

# Option 2: Create new VPC and subnets (default)
use_existing_vpc     = false
vpc_cidr             = "10.1.0.0/16"
availability_zones   = ["us-east-1a", "us-east-1b"]
public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24"]
private_subnet_cidrs = ["10.1.11.0/24", "10.1.12.0/24"]

# Restrict access to VPC only (more secure)
allowed_cidr_blocks = ["10.1.0.0/16"]

# RDS Configuration - medium instance for staging
instance_class        = "db.t3.small"
engine_version        = "15.4"
engine_version_family = "15"
allocated_storage     = 50
max_allocated_storage = 100
storage_type          = "gp3"
storage_encrypted     = true

# Database Configuration
database_name       = "stagingdb"
master_username     = "postgres"
publicly_accessible = false # More secure

# Backup Configuration - moderate for staging
backup_retention_period = 7
backup_window           = "03:00-04:00"
maintenance_window      = "sun:04:00-sun:05:00"
skip_final_snapshot     = false
deletion_protection     = true

# Monitoring - enhanced for staging
enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
monitoring_interval             = 60
performance_insights_enabled    = true
auto_minor_version_upgrade      = true

# High Availability - optional for staging
multi_az = false

# Alerting - configure SNS topic ARN if you have one
# alarm_actions = ["arn:aws:sns:us-east-1:906266478329:database-alerts"]
alarm_actions             = []
max_connections_threshold = 80

# Additional Tags
additional_tags = {
  CostCenter = "Staging"
  Owner      = "QATeam"
}
