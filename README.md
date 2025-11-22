# AWS PostgreSQL RDS Infrastructure with Terraform

Production-ready infrastructure as code for deploying PostgreSQL RDS on AWS with automated CI/CD pipelines.

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
- [Usage](#usage)
- [Configuration](#configuration)
- [CI/CD Workflows](#cicd-workflows)
- [Monitoring](#monitoring)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Cost Estimation](#cost-estimation)
- [Maintenance](#maintenance)

---

## Quick Start

Deploy PostgreSQL RDS in 15 minutes:

### 1. Run AWS Setup Script (5 min)

```bash
chmod +x setup-aws-iam.sh
./setup-aws-iam.sh
```

This creates IAM user, S3 bucket for state, and DynamoDB table for locking.

### 2. Configure GitHub Secrets (2 min)

Go to `Settings → Secrets → Actions` and add:

| Secret Name | Value |
|-------------|-------|
| `AWS_ACCESS_KEY_ID` | From setup script output |
| `AWS_SECRET_ACCESS_KEY` | From setup script output |
| `TF_VAR_db_password` | Your secure password (8+ chars) |

### 3. Deploy Infrastructure (5 min)

**Option A: GitHub Actions**
1. Go to Actions tab
2. Click "Terraform Apply"
3. Select `dev` environment
4. Run workflow

**Option B: Local**
```bash
terraform init
terraform plan -var-file="environments/dev.tfvars"
terraform apply -var-file="environments/dev.tfvars"
```

### 4. Connect to Database

```bash
# Get connection details
terraform output db_endpoint

# Connect with psql
psql -h <endpoint> -U postgres -d devdb
```

---

## Features

### Infrastructure
- PostgreSQL 15.4 RDS instance
- Multi-AZ deployment (production)
- Automated daily backups
- Encrypted storage (AES-256)
- Auto-scaling storage
- VPC with public/private subnets
- Security groups with restricted access
- CloudWatch monitoring and alarms
- Performance Insights
- AWS Resource Groups for organization

### DevOps
- Infrastructure as Code (Terraform)
- Remote state management (S3 + DynamoDB)
- GitHub Actions CI/CD pipelines
- Jenkins pipeline support
- Multi-environment (dev, staging, prod)
- Automated validation and testing
- Support for existing VPC/subnets

---

## Architecture

### Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                        │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Public Subnet        │  │ Public Subnet        │        │
│  │ 10.0.1.0/24 (AZ-A)   │  │ 10.0.2.0/24 (AZ-B)   │        │
│  └──────────────────────┘  └──────────────────────┘        │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Private Subnet       │  │ Private Subnet       │        │
│  │ 10.0.11.0/24 (AZ-A)  │  │ 10.0.12.0/24 (AZ-B)  │        │
│  │  [RDS Primary]       │  │  [RDS Standby]       │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Component Overview

- **VPC**: Isolated network environment
- **Public Subnets**: NAT Gateway, optional bastion host
- **Private Subnets**: RDS instances (multi-AZ for prod)
- **Security Groups**: Firewall rules for database access
- **Internet Gateway**: Public internet access
- **Route Tables**: Network traffic routing

### Environment Comparison

| Feature | Dev | Staging | Production |
|---------|-----|---------|------------|
| Instance | db.t3.micro | db.t3.small | db.t3.medium |
| Multi-AZ | No | Optional | Yes |
| Public Access | Optional | No | No |
| Backups | 1 day | 7 days | 30 days |
| Storage | 20-50GB | 50-100GB | 100-500GB |
| Monitoring | Basic | Enhanced | Enhanced + PI |
| Cost/Month | ~$20-30 | ~$50-70 | ~$100-150 |

---

## Prerequisites

- AWS Account (Account ID: 906266478329)
- AWS CLI installed and configured
- Terraform v1.6.0 or higher
- GitHub account with admin access
- Git installed locally

---

## Setup Guide

### Step 1: AWS IAM Setup

#### Option A: Automated (Recommended)

```bash
chmod +x setup-aws-iam.sh
./setup-aws-iam.sh
```

#### Option B: Manual Setup

1. **Create IAM User**
```bash
aws iam create-user --user-name github-actions-terraform
```

2. **Create IAM Policy**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:*",
        "ec2:*",
        "kms:*",
        "secretsmanager:*",
        "cloudwatch:*",
        "logs:*",
        "iam:GetRole",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": [
        "arn:aws:s3:::terraform-state-906266478329",
        "arn:aws:s3:::terraform-state-906266478329/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:*"],
      "Resource": "arn:aws:dynamodb:*:906266478329:table/terraform-state-lock"
    }
  ]
}
```

3. **Create Access Keys**
```bash
aws iam create-access-key --user-name github-actions-terraform
```

Save the Access Key ID and Secret Access Key immediately.

### Step 2: Create S3 Bucket for State

```bash
# Create bucket
aws s3 mb s3://terraform-state-906266478329 --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket terraform-state-906266478329 \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket terraform-state-906266478329 \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket terraform-state-906266478329 \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### Step 3: Create DynamoDB Table

```bash
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### Step 4: Configure GitHub

1. Go to `Settings → Secrets and variables → Actions`
2. Add repository secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `TF_VAR_db_password` (min 8 characters)

3. (Optional) Create environments: dev, staging, prod
4. (Recommended) Enable required reviewers for prod

### Step 5: Configure Terraform Backend

Update `backend.tf` if using different bucket name:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-bucket-name"
    key            = "terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

---

## Usage

### Local Development

```bash
# Initialize Terraform
terraform init

# Format code
terraform fmt -recursive

# Validate configuration
terraform validate

# Plan changes
terraform plan -var-file="environments/dev.tfvars"

# Apply changes
terraform apply -var-file="environments/dev.tfvars"

# View outputs
terraform output

# Destroy resources
terraform destroy -var-file="environments/dev.tfvars"
```

### Using Existing VPC

Edit `environments/<env>.tfvars`:

```hcl
# Option 1: Use existing VPC and subnets
use_existing_vpc    = true
existing_vpc_id     = "vpc-xxxxx"
existing_subnet_ids = ["subnet-xxxxx", "subnet-yyyyy"]

# Option 2: Create new VPC (default)
use_existing_vpc = false
vpc_cidr         = "10.0.0.0/16"
# ... other VPC configuration
```

---

## Configuration

### Environment Variables

Key variables in `environments/*.tfvars`:

```hcl
# Project
project_name = "postgres"
environment  = "dev"  # dev, staging, prod
aws_region   = "us-east-1"

# Networking
use_existing_vpc = false
vpc_cidr         = "10.0.0.0/16"
availability_zones = ["us-east-1a", "us-east-1b"]

# Database
instance_class    = "db.t3.micro"
engine_version    = "15.4"
allocated_storage = 20
database_name     = "devdb"
master_username   = "postgres"

# Security
publicly_accessible = false
allowed_cidr_blocks = ["10.0.0.0/16"]

# Backups
backup_retention_period = 7
skip_final_snapshot     = false
deletion_protection     = true

# Monitoring
monitoring_interval          = 60
performance_insights_enabled = true

# High Availability
multi_az = false  # true for production
```

### Customization Examples

**Change instance size:**
```hcl
instance_class = "db.t3.small"
```

**Enable Multi-AZ:**
```hcl
multi_az = true
```

**Adjust backup retention:**
```hcl
backup_retention_period = 30
```

**Add your IP for access:**
```hcl
allowed_cidr_blocks = ["10.0.0.0/16", "YOUR_IP/32"]
```

---

## CI/CD Workflows

### 1. Terraform Validate (Automatic)

Runs on every push to validate code:
- Terraform format check
- Terraform validation
- Syntax verification

### 2. Terraform Plan (Pull Requests)

Runs on PRs to show planned changes:
- Initializes Terraform
- Generates plan for all environments
- Comments plan on PR
- No infrastructure changes

### 3. Terraform Apply (Manual)

Manually triggered to deploy:
- Select environment (dev/staging/prod)
- Choose action (apply/destroy)
- Requires approval for production
- Outputs saved as artifacts

### GitHub Actions Usage

```bash
# Trigger apply workflow
Actions → Terraform Apply → Run workflow → Select environment

# View plan on PR
Create PR → View automated comment with plan
```

### Jenkins Setup

1. Install plugins: AWS Credentials, Terraform, Pipeline
2. Add credentials with ID `aws-credentials`
3. Add secret text with ID `db-password`
4. Create pipeline pointing to `Jenkinsfile`

---

## Monitoring

### CloudWatch Alarms

Automatically configured alarms:

1. **CPU Utilization** (>80% for 10 min)
2. **Free Storage Space** (<2GB)
3. **Database Connections** (threshold configurable)

### CloudWatch Logs

Exported log types:
- PostgreSQL logs
- Upgrade logs
- Connection logs
- Query logs (slow queries >1s)

### Performance Insights

- Query performance monitoring
- Wait event analysis
- Top SQL queries
- Database load metrics

### Monitoring Commands

```bash
# View CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=postgres-dev-postgres \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average

# Check database status
aws rds describe-db-instances \
  --db-instance-identifier postgres-dev-postgres
```

---

## Security

### Network Security
- VPC isolation
- Private subnets for database
- Security groups with restrictive rules
- No public access in production

### Data Security
- Encryption at rest (AES-256)
- Encryption in transit (SSL/TLS)
- Encrypted backups and snapshots
- KMS key management

### Access Control
- IAM policies (least privilege)
- Database authentication
- Connection logging
- GitHub secrets for credentials

### Best Practices

1. Never commit secrets to repository
2. Use different passwords per environment
3. Rotate credentials every 90 days
4. Enable deletion protection for production
5. Restrict security group access
6. Enable Multi-AZ for production
7. Regular backup testing
8. Monitor CloudWatch alarms

---

## Troubleshooting

### Terraform State Lock

**Error:** `Error acquiring the state lock`

**Solution:**
```bash
# Force unlock (use with caution)
terraform force-unlock <LOCK_ID>

# Check DynamoDB for stuck locks
aws dynamodb scan --table-name terraform-state-lock
```

### AWS Authentication Issues

**Error:** `No valid credential sources found`

**Solution:**
1. Verify GitHub secrets are set correctly
2. Check secret names match exactly (case-sensitive)
3. Test credentials locally:
```bash
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
aws sts get-caller-identity
```

### Database Connection Issues

**Can't connect to database:**

1. Check security group allows your IP
2. Verify database is available
3. Check VPC and subnet configuration
4. For private databases, use bastion host or VPN

```bash
# Check security group
terraform output rds_security_group_id
aws ec2 describe-security-groups --group-ids <sg-id>

# Check database status
aws rds describe-db-instances \
  --db-instance-identifier postgres-dev-postgres \
  --query 'DBInstances[0].DBInstanceStatus'
```

### VPC/Subnet Errors

**Error:** `DBSubnetGroupDoesNotCoverEnoughAZs`

**Solution:** Ensure subnets span at least 2 availability zones:
```hcl
availability_zones = ["us-east-1a", "us-east-1b"]
```

### Resource Already Exists

**Error:** Resource exists but not in Terraform state

**Solution:**
```bash
# Import existing resource
terraform import aws_db_instance.postgres <instance-id>

# Or remove manually and redeploy
aws rds delete-db-instance \
  --db-instance-identifier <instance-id> \
  --skip-final-snapshot
```

### Debugging Commands

```bash
# Enable Terraform debug logging
export TF_LOG=DEBUG
terraform plan

# Check Terraform state
terraform state list
terraform state show aws_db_instance.postgres

# Refresh state from AWS
terraform refresh

# Validate configuration
terraform validate
```

---

## Cost Estimation

### Development Environment (~$20-30/month)
- RDS db.t3.micro: ~$15
- Storage (20GB gp3): ~$2.30
- Backup storage: ~$2
- Data transfer: minimal
- **Total: ~$20-30/month**

### Staging Environment (~$50-70/month)
- RDS db.t3.small: ~$30
- Storage (50GB gp3): ~$5.75
- Backup storage: ~$5
- Enhanced monitoring: ~$3
- **Total: ~$50-70/month**

### Production Environment (~$100-150/month)
- RDS db.t3.medium Multi-AZ: ~$120
- Storage (100GB gp3): ~$11.50
- Backup storage (30 days): ~$15
- Enhanced monitoring: ~$3
- Performance Insights: Included
- **Total: ~$100-150/month**

### Cost Optimization Tips

1. Use smallest instance for development
2. Destroy dev resources when not needed
3. Adjust backup retention periods
4. Use Reserved Instances for production
5. Monitor unused resources
6. Set up AWS billing alerts

---

## Maintenance

### Update Database Password

```bash
# Update GitHub secret, then:
terraform apply \
  -var-file="environments/prod.tfvars" \
  -var="db_password=NewPassword123!"
```

### Upgrade PostgreSQL Version

Edit `environments/<env>.tfvars`:
```hcl
engine_version = "15.5"  # New version
```

Then apply:
```bash
terraform plan -var-file="environments/prod.tfvars"
terraform apply -var-file="environments/prod.tfvars"
```

### Scale Instance Size

Edit environment tfvars:
```hcl
instance_class = "db.t3.large"
```

### Backup and Restore

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier postgres-prod-postgres \
  --db-snapshot-identifier manual-snapshot-$(date +%Y%m%d)

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier postgres-prod-restored \
  --db-snapshot-identifier <snapshot-id>
```

### Regular Maintenance Tasks

- [ ] Review CloudWatch alarms monthly
- [ ] Test backup restoration quarterly
- [ ] Rotate AWS credentials every 90 days
- [ ] Update Terraform version annually
- [ ] Review and optimize costs monthly
- [ ] Update PostgreSQL version as needed
- [ ] Review security group rules quarterly

---

## Support

### Documentation
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Getting Help

1. Check AWS CloudWatch logs
2. Review Terraform state: `terraform show`
3. Check GitHub Actions logs
4. Review AWS RDS console
5. Open issue in repository

### Emergency Procedures

**Database Down:**
1. Check RDS status in AWS Console
2. Review CloudWatch metrics
3. Restore from latest snapshot if needed

**Terraform State Corrupted:**
```bash
# List S3 object versions
aws s3api list-object-versions \
  --bucket terraform-state-906266478329

# Restore specific version
aws s3api get-object \
  --bucket terraform-state-906266478329 \
  --key terraform.tfstate \
  --version-id <version-id> \
  terraform.tfstate.restored
```

---

## License

MIT License

## Contributors

- [@ambrosea9](https://github.com/ambrosea9)

---

**AWS Account:** 906266478329
**Repository:** [github.com/ambrosea9/aws](https://github.com/ambrosea9/aws)
