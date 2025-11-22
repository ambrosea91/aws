# Development Environment Configuration

environment = "dev"
aws_region  = "us-east-2"

# Network Configuration
# Option 1: Use existing VPC and subnets (uncomment and configure)
# use_existing_vpc    = true
# existing_vpc_id     = "vpc-xxxxxxxxxxxxxxxxx"
# existing_subnet_ids = ["subnet-xxxxxxxxxxxxxxxxx", "subnet-yyyyyyyyyyyyyyyyy"]

# Option 2: Create new VPC and subnets (default)
use_existing_vpc     = false
vpc_cidr             = "10.0.0.0/16"
availability_zones   = ["us-east-2a", "us-east-2b"]
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24"]

# Allow access from VPC only (secure by default)
# To allow access from your IP: ["10.0.0.0/16", "YOUR_IP/32"]
# To allow from anywhere (NOT RECOMMENDED): ["0.0.0.0/0"]
allowed_cidr_blocks = ["10.0.0.0/16"]

# RDS Configuration - smaller instance for dev
instance_class        = "db.t3.micro"
engine_version        = "15.4"
engine_version_family = "15"
allocated_storage     = 20
max_allocated_storage = 50
storage_type          = "gp3"
storage_encrypted     = true

# Database Configuration
database_name       = "devdb"
master_username     = "postgres"
publicly_accessible = false # Set to true only if you need external access (not recommended)

# Backup Configuration - minimal for dev
backup_retention_period = 1
backup_window           = "03:00-04:00"
maintenance_window      = "sun:04:00-sun:05:00"
skip_final_snapshot     = true # Skip snapshot on destroy for dev
deletion_protection     = false

# Monitoring - basic for dev
enabled_cloudwatch_logs_exports = ["postgresql"]
monitoring_interval             = 0 # Disable enhanced monitoring for dev to save cost
performance_insights_enabled    = false
auto_minor_version_upgrade      = true

# High Availability - disabled for dev
multi_az = false

# Alerting - empty for dev
alarm_actions              = []
max_connections_threshold  = 50

# Additional Tags
additional_tags = {
  CostCenter = "Development"
  Owner      = "DevTeam"
}
