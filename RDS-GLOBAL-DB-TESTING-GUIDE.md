# RDS Global Database Testing Guide

Complete guide for testing Aurora Global Databases with Blue-Green deployments for version upgrades.

## Overview

This repository contains CloudFormation automation to test the following scenarios:

1. **Deploy MySQL 5.7 Global Database** (Primary: us-east-2, Secondary: us-west-2)
2. **Deploy PostgreSQL 14 Global Database** (Primary: us-east-2, Secondary: us-west-2)
3. **Blue-Green Upgrade MySQL 5.7 → 8.0**
4. **Blue-Green Upgrade PostgreSQL 14 → 16 (latest)**

All deployments are automated via GitHub Actions and CloudFormation.

## Repository Structure

```
.
├── rds-global-databases/           # Initial database deployment
│   ├── mysql-57-global-db.yaml    # MySQL primary cluster
│   ├── mysql-57-secondary-db.yaml # MySQL secondary cluster
│   ├── postgres-14-global-db.yaml # PostgreSQL primary cluster
│   ├── postgres-14-secondary-db.yaml # PostgreSQL secondary cluster
│   └── README.md                   # Detailed deployment guide
│
├── rds-blue-green-upgrade/         # Database upgrade automation
│   ├── mysql-bluegreen-upgrade.yaml    # MySQL upgrade automation
│   ├── postgres-bluegreen-upgrade.yaml # PostgreSQL upgrade automation
│   └── README.md                   # Detailed upgrade guide
│
└── .github/workflows/
    ├── deploy-global-databases.yml # Deploy initial databases
    └── bluegreen-upgrade.yml       # Perform upgrades
```

## Quick Start - Testing All Scenarios

### Prerequisites

1. AWS Account with appropriate permissions
2. GitHub repository with OIDC configured for AWS
3. IAM Role: `arn:aws:iam::390844768648:role/GitHubActionsOIDCRole`

### Scenario 1: Deploy MySQL 5.7 Global Database

**Via GitHub Actions:**

1. Navigate to **Actions** → **Deploy RDS Global Databases**
2. Click **Run workflow**
3. Parameters:
   - Environment: `dev`
   - Database Type: `mysql-57`
   - DB Password: `YourSecurePassword123`
4. Click **Run workflow**

**Result:** MySQL 5.7 Global DB with clusters in us-east-2 (primary) and us-west-2 (secondary)

**Verification:**
```bash
# Check primary cluster
aws rds describe-db-clusters \
  --db-cluster-identifier dev-mysql57-primary-cluster \
  --region us-east-2

# Check secondary cluster
aws rds describe-db-clusters \
  --db-cluster-identifier dev-mysql57-secondary-cluster \
  --region us-west-2

# Test connectivity
ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name dev-mysql57-primary \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PrimaryClusterEndpoint`].OutputValue' \
  --output text)

mysql -h $ENDPOINT -u admin -p mydb
```

### Scenario 2: Deploy PostgreSQL 14 Global Database

**Via GitHub Actions:**

1. Navigate to **Actions** → **Deploy RDS Global Databases**
2. Click **Run workflow**
3. Parameters:
   - Environment: `dev`
   - Database Type: `postgres-14`
   - DB Password: `YourSecurePassword123`
4. Click **Run workflow**

**Result:** PostgreSQL 14 Global DB with clusters in us-east-2 (primary) and us-west-2 (secondary)

**Verification:**
```bash
# Check replication status
aws rds describe-global-clusters \
  --global-cluster-identifier dev-postgres14-global \
  --region us-east-2

# Test connectivity
ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name dev-postgres14-primary \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PrimaryClusterEndpoint`].OutputValue' \
  --output text)

psql -h $ENDPOINT -U postgres -d mydb
```

### Scenario 3: Blue-Green Upgrade MySQL 5.7 → 8.0

**Step 1: Deploy Blue-Green Automation**

1. Navigate to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Parameters:
   - Action: `deploy-automation`
   - Environment: `dev`
   - Database Type: `mysql`
   - Region: `us-east-2`
4. Click **Run workflow**

**Step 2: Start the Upgrade**

1. Navigate to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Parameters:
   - Action: `start-upgrade`
   - Environment: `dev`
   - Database Type: `mysql`
   - Region: `us-east-2`
   - Source Cluster ID: `dev-mysql57-primary-cluster`
4. Click **Run workflow**

**Step 3: Monitor Progress**

- Subscribe to SNS notifications
- Check Step Functions console for execution status
- Wait for notification that green environment is ready (~30-45 minutes)

**Step 4: Test Green Environment**

```bash
# Get green cluster details
aws rds describe-blue-green-deployments \
  --region us-east-2

# Connect to green environment
mysql -h <green-endpoint> -u admin -p mydb

# Verify MySQL version
SELECT VERSION();
# Should show 8.0.x

# Run your application tests
```

**Step 5: Perform Switchover**

1. Navigate to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Parameters:
   - Action: `perform-switchover`
   - Environment: `dev`
   - Database Type: `mysql`
   - Region: `us-east-2`
   - Deployment ID: `<from step 2>`
4. Click **Run workflow**

**Step 6: Cleanup**

After verifying production is working:

1. Navigate to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Parameters:
   - Action: `cleanup`
   - Deployment ID: `<from step 2>`
4. Click **Run workflow**

### Scenario 4: Blue-Green Upgrade PostgreSQL 14 → 16

Follow the same process as MySQL, but:
- Use Database Type: `postgres`
- Source Cluster ID: `dev-postgres14-primary-cluster`
- Target version: PostgreSQL 16.1

## Testing Timeline

### Day 1: Initial Deployment (2-3 hours)
- 09:00 - Deploy MySQL 5.7 Global Database
- 10:30 - Verify MySQL replication
- 11:00 - Deploy PostgreSQL 14 Global Database
- 12:30 - Verify PostgreSQL replication
- 13:00 - Test connectivity and replication lag

### Day 2: Blue-Green Upgrades (4-6 hours)
- 09:00 - Deploy MySQL blue-green automation
- 09:15 - Start MySQL upgrade
- 10:00 - Test green MySQL environment
- 10:30 - Switchover MySQL
- 11:00 - Verify MySQL production
- 11:30 - Deploy PostgreSQL blue-green automation
- 11:45 - Start PostgreSQL upgrade
- 12:30 - Test green PostgreSQL environment
- 13:00 - Switchover PostgreSQL
- 13:30 - Verify PostgreSQL production
- 14:00 - Cleanup both blue environments

## Monitoring and Validation

### Verify Global Database Replication

```bash
# MySQL
aws rds describe-global-clusters \
  --global-cluster-identifier dev-mysql57-global \
  --region us-east-2 \
  --query 'GlobalClusters[0].GlobalClusterMembers'

# PostgreSQL
aws rds describe-global-clusters \
  --global-cluster-identifier dev-postgres14-global \
  --region us-east-2 \
  --query 'GlobalClusters[0].GlobalClusterMembers'
```

### Test Cross-Region Replication

```bash
# Write to primary (us-east-2)
mysql -h <primary-endpoint> -u admin -p mydb -e \
  "CREATE TABLE test_table (id INT, data VARCHAR(100)); \
   INSERT INTO test_table VALUES (1, 'test from primary');"

# Read from secondary (us-west-2) - wait a few seconds
mysql -h <secondary-endpoint> -u admin -p mydb -e \
  "SELECT * FROM test_table;"
```

### Monitor Blue-Green Deployment

```bash
# List all deployments
aws rds describe-blue-green-deployments --region us-east-2

# Get detailed status
aws rds describe-blue-green-deployments \
  --blue-green-deployment-identifier <deployment-id> \
  --region us-east-2 \
  --query 'BlueGreenDeployments[0].[Status,Source,Target]'
```

## Cost Estimation

### Initial Global Databases
- **MySQL**: 4 x db.r5.large (2 per region) = ~$1.16/hour
- **PostgreSQL**: 4 x db.r5.large (2 per region) = ~$1.16/hour
- **Total**: ~$2.32/hour or ~$55/day

### During Blue-Green Deployment
- **Additional cost**: 2x (both blue and green running)
- **Typical duration**: 2-4 hours per upgrade
- **Additional cost per upgrade**: ~$5-$10

### Total Testing Cost (2-day test)
- Day 1: ~$55
- Day 2: ~$55 + ~$20 (upgrades)
- **Total**: ~$130 for complete testing

## Cleanup

### Remove All Resources

```bash
# Delete secondary clusters first
aws cloudformation delete-stack \
  --stack-name dev-mysql57-secondary \
  --region us-west-2

aws cloudformation delete-stack \
  --stack-name dev-postgres14-secondary \
  --region us-west-2

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete \
  --stack-name dev-mysql57-secondary \
  --region us-west-2

aws cloudformation wait stack-delete-complete \
  --stack-name dev-postgres14-secondary \
  --region us-west-2

# Delete primary clusters
aws cloudformation delete-stack \
  --stack-name dev-mysql57-primary \
  --region us-east-2

aws cloudformation delete-stack \
  --stack-name dev-postgres14-primary \
  --region us-east-2

# Delete blue-green automation
aws cloudformation delete-stack \
  --stack-name dev-mysql-bluegreen \
  --region us-east-2

aws cloudformation delete-stack \
  --stack-name dev-postgres-bluegreen \
  --region us-east-2
```

## Troubleshooting

### Common Issues

**Issue**: Stack creation fails with "DB subnet group doesn't meet availability zone coverage requirement"
**Solution**: Ensure you're deploying in a region with at least 3 AZs (us-east-2 and us-west-2 both have 3+)

**Issue**: Cannot connect to database
**Solution**: Update security group to allow your IP:
```bash
aws ec2 authorize-security-group-ingress \
  --group-id <sg-id> \
  --protocol tcp \
  --port 3306 \
  --cidr <your-ip>/32
```

**Issue**: High replication lag
**Solution**: Check network connectivity between regions, verify sufficient IOPS

**Issue**: Blue-green deployment stuck
**Solution**: Check CloudWatch logs for Lambda functions, verify source cluster is available

### Getting Help

1. Check CloudFormation stack events
2. Review CloudWatch Logs for Lambda functions
3. Check RDS Events in the console
4. Review Step Functions execution history

## Success Criteria

- [ ] MySQL 5.7 Global Database deployed successfully
- [ ] PostgreSQL 14 Global Database deployed successfully
- [ ] Cross-region replication working (lag < 1 second)
- [ ] MySQL upgraded to 8.0 via blue-green deployment
- [ ] PostgreSQL upgraded to 16 via blue-green deployment
- [ ] Applications connect successfully after upgrades
- [ ] Zero data loss during switchover
- [ ] Switchover completed in < 5 minutes

## Additional Resources

- [AWS RDS Global Databases](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html)
- [AWS RDS Blue-Green Deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments.html)
- [Aurora MySQL 8.0 Upgrade Guide](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.MySQL80.html)
- [Aurora PostgreSQL Version Policy](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/)

## Next Steps

After successful testing:

1. **Document Findings**: Record performance metrics, upgrade duration, issues encountered
2. **Update Runbooks**: Create operational procedures based on test results
3. **Plan Production Rollout**: Schedule production upgrades during maintenance windows
4. **Implement Monitoring**: Set up CloudWatch alarms and dashboards
5. **Configure Backups**: Ensure backup retention policies meet requirements
6. **Security Hardening**: Update security groups, enable encryption, configure Secrets Manager
