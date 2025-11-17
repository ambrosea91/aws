# RDS Global Databases - Initial Deployment

This folder contains CloudFormation templates for deploying Aurora MySQL 5.7 and PostgreSQL 14 Global Databases with primary and secondary regions.

## Architecture

### MySQL 5.7 Global Database
- **Primary Region**: us-east-2 (Ohio)
- **Secondary Region**: us-west-2 (Oregon)
- **Engine**: Aurora MySQL 5.7 (compatible with MySQL 5.7)
- **Configuration**: 2 instances per region for high availability

### PostgreSQL 14 Global Database
- **Primary Region**: us-east-2 (Ohio)
- **Secondary Region**: us-west-2 (Oregon)
- **Engine**: Aurora PostgreSQL 14
- **Configuration**: 2 instances per region for high availability

## Files

### MySQL Templates
- `mysql-57-global-db.yaml` - Primary cluster template (us-east-2)
- `mysql-57-secondary-db.yaml` - Secondary cluster template (us-west-2)

### PostgreSQL Templates
- `postgres-14-global-db.yaml` - Primary cluster template (us-east-2)
- `postgres-14-secondary-db.yaml` - Secondary cluster template (us-west-2)

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

1. Navigate to **Actions** tab in your GitHub repository
2. Select **Deploy RDS Global Databases** workflow
3. Click **Run workflow**
4. Fill in the parameters:
   - **Environment**: dev/test/prod
   - **Database Type**: mysql-57, postgres-14, or both
   - **DB Password**: Master password (minimum 8 characters)
5. Click **Run workflow**

The workflow will:
- Deploy the primary cluster in us-east-2
- Wait for primary to be ready
- Deploy the secondary cluster in us-west-2
- Configure global replication
- Output connection endpoints

### Method 2: AWS CLI

#### Deploy MySQL 5.7 Global Database

```bash
# Step 1: Deploy Primary Cluster (us-east-2)
aws cloudformation deploy \
  --template-file mysql-57-global-db.yaml \
  --stack-name dev-mysql57-primary \
  --parameter-overrides \
    Environment=dev \
    DBMasterPassword=YourSecurePassword123 \
  --capabilities CAPABILITY_IAM \
  --region us-east-2

# Step 2: Get Global Cluster ID
GLOBAL_CLUSTER_ID=$(aws cloudformation describe-stacks \
  --stack-name dev-mysql57-primary \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`GlobalClusterIdentifier`].OutputValue' \
  --output text)

echo "Global Cluster ID: $GLOBAL_CLUSTER_ID"

# Step 3: Deploy Secondary Cluster (us-west-2)
aws cloudformation deploy \
  --template-file mysql-57-secondary-db.yaml \
  --stack-name dev-mysql57-secondary \
  --parameter-overrides \
    Environment=dev \
    GlobalClusterIdentifier=$GLOBAL_CLUSTER_ID \
  --capabilities CAPABILITY_IAM \
  --region us-west-2
```

#### Deploy PostgreSQL 14 Global Database

```bash
# Step 1: Deploy Primary Cluster (us-east-2)
aws cloudformation deploy \
  --template-file postgres-14-global-db.yaml \
  --stack-name dev-postgres14-primary \
  --parameter-overrides \
    Environment=dev \
    DBMasterPassword=YourSecurePassword123 \
  --capabilities CAPABILITY_IAM \
  --region us-east-2

# Step 2: Get Global Cluster ID
GLOBAL_CLUSTER_ID=$(aws cloudformation describe-stacks \
  --stack-name dev-postgres14-primary \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`GlobalClusterIdentifier`].OutputValue' \
  --output text)

echo "Global Cluster ID: $GLOBAL_CLUSTER_ID"

# Step 3: Deploy Secondary Cluster (us-west-2)
aws cloudformation deploy \
  --template-file postgres-14-secondary-db.yaml \
  --stack-name dev-postgres14-secondary \
  --parameter-overrides \
    Environment=dev \
    GlobalClusterIdentifier=$GLOBAL_CLUSTER_ID \
  --capabilities CAPABILITY_IAM \
  --region us-west-2
```

## Parameters

### Common Parameters
- **Environment**: Environment name (dev/test/prod)
- **DBInstanceClass**: Instance class (default: db.r5.large)
- **DBMasterUsername**: Master username
  - MySQL: admin (default)
  - PostgreSQL: postgres (default)
- **DBMasterPassword**: Master password (required, min 8 chars)

### Version-Specific Parameters
- **MySQL EngineVersion**: Aurora MySQL 5.7 version (default: 5.7.mysql_aurora.2.11.3)
- **PostgreSQL EngineVersion**: Aurora PostgreSQL 14 version (default: 14.9)

## Accessing the Databases

### Get Connection Endpoints

```bash
# MySQL Primary Endpoint
aws cloudformation describe-stacks \
  --stack-name dev-mysql57-primary \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PrimaryClusterEndpoint`].OutputValue' \
  --output text

# PostgreSQL Primary Endpoint
aws cloudformation describe-stacks \
  --stack-name dev-postgres14-primary \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`PrimaryClusterEndpoint`].OutputValue' \
  --output text
```

### Connect to MySQL

```bash
mysql -h <endpoint> -u admin -p mydb
```

### Connect to PostgreSQL

```bash
psql -h <endpoint> -U postgres -d mydb
```

## Monitoring Replication

### Check Global Database Status

```bash
# MySQL
aws rds describe-global-clusters \
  --global-cluster-identifier dev-mysql57-global \
  --region us-east-2

# PostgreSQL
aws rds describe-global-clusters \
  --global-cluster-identifier dev-postgres14-global \
  --region us-east-2
```

### Monitor Replication Lag

```bash
# MySQL - Check replica lag
mysql -h <secondary-endpoint> -u admin -p -e "SHOW SLAVE STATUS\G" | grep Seconds_Behind_Master

# PostgreSQL - Check replica lag
psql -h <secondary-endpoint> -U postgres -d mydb -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;"
```

## Cost Optimization

- **Instance Class**: Start with db.r5.large, adjust based on workload
- **Number of Instances**: 2 per region provides HA, can reduce to 1 for dev
- **Backup Retention**: 7 days default, adjust based on requirements
- **Storage**: Aurora auto-scales, monitor actual usage

## Security Considerations

1. **VPC Isolation**: Each region has its own VPC
2. **Security Groups**: Restrict access to VPC CIDR only
3. **Encryption**: Storage encryption enabled by default
4. **Password Management**: Use AWS Secrets Manager in production
5. **Network Access**: Update security groups to allow your application access

## Troubleshooting

### Stack Creation Fails

```bash
# Check stack events
aws cloudformation describe-stack-events \
  --stack-name dev-mysql57-primary \
  --region us-east-2 \
  --max-items 20
```

### Replication Issues

```bash
# Check cluster status
aws rds describe-db-clusters \
  --db-cluster-identifier dev-mysql57-primary-cluster \
  --region us-east-2
```

### Delete Stacks

```bash
# Delete in reverse order (secondary first, then primary)
aws cloudformation delete-stack \
  --stack-name dev-mysql57-secondary \
  --region us-west-2

aws cloudformation delete-stack \
  --stack-name dev-mysql57-primary \
  --region us-east-2
```

## Next Steps

After deploying the databases:

1. **Test Connectivity**: Verify you can connect to both primary and secondary
2. **Test Replication**: Write data to primary, verify it appears in secondary
3. **Update Security Groups**: Allow access from your application subnets
4. **Configure Monitoring**: Set up CloudWatch alarms for key metrics
5. **Blue-Green Upgrade**: Use `../rds-blue-green-upgrade/` for version upgrades

## Support

For issues or questions:
- Check AWS CloudFormation console for detailed error messages
- Review CloudWatch Logs for Lambda and RDS events
- Consult AWS RDS documentation for Aurora Global Databases
