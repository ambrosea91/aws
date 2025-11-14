# Global Database Deployment Guide

## 📋 Overview

This guide explains how to deploy Aurora MySQL and PostgreSQL Global Databases across multiple AWS regions for disaster recovery and low-latency global access.

**Architecture:**
- **Primary Region**: us-east-2 (Ohio) - Read/Write
- **Secondary Region**: us-west-2 (Oregon) - Read-only (with failover capability)

---

## 🌐 What is Aurora Global Database?

Aurora Global Database is designed for globally distributed applications, allowing:
- **Cross-region disaster recovery** with RPO of 1 second and RTO of less than 1 minute
- **Low-latency global reads** with typically < 1 second replication lag
- **Fast regional failover** for disaster recovery
- **Up to 5 secondary regions** (we're using 1)

```
┌──────────────────────────────────────────────────────────────┐
│                    GLOBAL DATABASE                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   ┌────────────────────────┐     ┌────────────────────────┐ │
│   │   us-east-2 (Primary)  │────▶│  us-west-2 (Secondary) │ │
│   │                        │     │                        │ │
│   │  ┌──────┐  ┌────────┐ │     │  ┌──────┐  ┌────────┐ │ │
│   │  │Writer│  │Reader 1│ │     │  │Reader│  │Reader 1│ │ │
│   │  └──────┘  └────────┘ │     │  └──────┘  └────────┘ │ │
│   │                        │     │                        │ │
│   │  READ/WRITE            │     │  READ-ONLY             │ │
│   └────────────────────────┘     └────────────────────────┘ │
│          ▲                              ▲                    │
│          │                              │                    │
│    Applications in                Applications in            │
│    North America                   Asia/Europe               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Process

### Phase 1: Deploy Primary Region (us-east-2)

This is already configured in the default setup.

#### Step 1: Deploy MySQL Primary

```bash
cd mysql

# Set environment variables
export AWS_DEFAULT_REGION=us-east-2
export PRIMARY_REGION=us-east-2
export CDK_DEFAULT_ACCOUNT=your-aws-account-id

# Deploy
npm run deploy

# Expected output:
# ✅  MysqlAuroraPrimaryStack
#
# Outputs:
# MysqlAuroraPrimaryStack.ClusterEndpoint = mysql-cluster.xyz.us-east-2.rds.amazonaws.com
# MysqlAuroraPrimaryStack.GlobalClusterIdentifier = mysql-global-cluster
#
# Stack ARN: arn:aws:cloudformation:us-east-2:...
```

**Deployment time:** ~25-30 minutes

#### Step 2: Deploy PostgreSQL Primary

```bash
cd ../postgres

# Set environment variables
export AWS_DEFAULT_REGION=us-east-2
export PRIMARY_REGION=us-east-2

# Deploy
npm run deploy

# Expected output:
# ✅  PostgresAuroraPrimaryStack
#
# Outputs:
# PostgresAuroraPrimaryStack.ClusterEndpoint = postgres-cluster.xyz.us-east-2.rds.amazonaws.com
# PostgresAuroraPrimaryStack.GlobalClusterIdentifier = postgres-global-cluster
```

**Deployment time:** ~25-30 minutes

#### Step 3: Verify Primary Deployment

```bash
# Check MySQL stack
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'

# Check PostgreSQL stack
aws cloudformation describe-stacks \
  --stack-name PostgresAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'

# Both should return: "CREATE_COMPLETE"
```

---

### Phase 2: Deploy Secondary Region (us-west-2)

**⚠️ IMPORTANT:** Secondary must be deployed AFTER primary is complete!

#### Step 1: Enable Secondary Stack Code

**For MySQL:**

Edit `mysql/bin/mysql-aurora.ts` and uncomment the secondary stack:

```typescript
// Uncomment this section:
new MysqlAuroraStack(app, 'MysqlAuroraSecondaryStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.SECONDARY_REGION || 'us-west-2',
  },
  description: 'MySQL Aurora Global Database - Secondary Region (us-west-2)',
});
```

**For PostgreSQL:**

Edit `postgres/bin/postgres-aurora.ts` and uncomment the secondary stack:

```typescript
// Uncomment this section:
new PostgresAuroraStack(app, 'PostgresAuroraSecondaryStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.SECONDARY_REGION || 'us-west-2',
  },
  description: 'PostgreSQL Aurora Global Database - Secondary Region (us-west-2)',
});
```

#### Step 2: Deploy MySQL Secondary

```bash
cd mysql

# Build
npm run build

# Synthesize to verify
npm run synth

# You should now see TWO stacks in the output:
# - MysqlAuroraPrimaryStack (us-east-2)
# - MysqlAuroraSecondaryStack (us-west-2)

# Deploy ONLY the secondary stack
export AWS_DEFAULT_REGION=us-west-2
export SECONDARY_REGION=us-west-2

npx cdk deploy MysqlAuroraSecondaryStack --require-approval never
```

**Deployment time:** ~25-30 minutes

**Expected output:**
```
✅  MysqlAuroraSecondaryStack

Outputs:
MysqlAuroraSecondaryStack.ClusterEndpoint = mysql-cluster.xyz.us-west-2.rds.amazonaws.com
MysqlAuroraSecondaryStack.ClusterReadEndpoint = mysql-cluster-ro.xyz.us-west-2.rds.amazonaws.com
MysqlAuroraSecondaryStack.GlobalClusterIdentifier = mysql-global-cluster
```

#### Step 3: Deploy PostgreSQL Secondary

```bash
cd ../postgres

# Build
npm run build

# Deploy secondary stack
export AWS_DEFAULT_REGION=us-west-2
export SECONDARY_REGION=us-west-2

npx cdk deploy PostgresAuroraSecondaryStack --require-approval never
```

**Deployment time:** ~25-30 minutes

#### Step 4: Verify Secondary Deployment

```bash
# Check MySQL secondary
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraSecondaryStack \
  --region us-west-2 \
  --query 'Stacks[0].StackStatus'

# Check PostgreSQL secondary
aws cloudformation describe-stacks \
  --stack-name PostgresAuroraSecondaryStack \
  --region us-west-2 \
  --query 'Stacks[0].StackStatus'

# Both should return: "CREATE_COMPLETE"
```

#### Step 5: Verify Global Database Replication

**For MySQL:**

```bash
# Get primary endpoint
PRIMARY_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text)

# Get secondary endpoint
SECONDARY_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name MysqlAuroraSecondaryStack \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text)

echo "Primary: $PRIMARY_ENDPOINT"
echo "Secondary: $SECONDARY_ENDPOINT"

# Check replication lag (should be < 1 second)
aws rds describe-db-clusters \
  --region us-west-2 \
  --query 'DBClusters[?contains(DBClusterIdentifier, `mysql`)].{Lag:GlobalWriteForwardingStatus}' \
  --output table
```

**For PostgreSQL:**

```bash
# Similar commands for PostgreSQL
PRIMARY_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name PostgresAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text)

SECONDARY_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name PostgresAuroraSecondaryStack \
  --region us-west-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text)

echo "Primary: $PRIMARY_ENDPOINT"
echo "Secondary: $SECONDARY_ENDPOINT"
```

---

## 🔄 Using the Global Database

### Connecting to the Database

#### From US-based Applications (use us-east-2):

```bash
# MySQL
mysql -h mysql-cluster.xyz.us-east-2.rds.amazonaws.com \
      -P 3306 \
      -u admin \
      -p

# PostgreSQL
psql -h postgres-cluster.xyz.us-east-2.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d mydb
```

#### From Europe/Asia-based Applications (use us-west-2):

```bash
# MySQL (read-only)
mysql -h mysql-cluster.xyz.us-west-2.rds.amazonaws.com \
      -P 3306 \
      -u admin \
      -p

# PostgreSQL (read-only)
psql -h postgres-cluster.xyz.us-west-2.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d mydb
```

### Application Connection String Examples

**Node.js with MySQL:**

```javascript
const mysql = require('mysql2/promise');

// Determine region based on application location
const region = process.env.AWS_REGION || 'us-east-2';
const isSecondary = region === 'us-west-2';

const connection = await mysql.createConnection({
  host: isSecondary
    ? 'mysql-cluster.xyz.us-west-2.rds.amazonaws.com'
    : 'mysql-cluster.xyz.us-east-2.rds.amazonaws.com',
  port: 3306,
  user: 'admin',
  password: process.env.DB_PASSWORD,
  database: 'mydb'
});

// If secondary, remind that writes will fail
if (isSecondary) {
  console.warn('Connected to secondary region - READ-ONLY');
}
```

**Python with PostgreSQL:**

```python
import psycopg2
import os

# Determine region
region = os.getenv('AWS_REGION', 'us-east-2')
is_secondary = region == 'us-west-2'

conn = psycopg2.connect(
    host='postgres-cluster.xyz.us-west-2.rds.amazonaws.com' if is_secondary
         else 'postgres-cluster.xyz.us-east-2.rds.amazonaws.com',
    port=5432,
    user='postgres',
    password=os.getenv('DB_PASSWORD'),
    database='mydb'
)

if is_secondary:
    print('⚠️  Connected to secondary region - READ-ONLY')
```

---

## 🚨 Disaster Recovery: Failover to Secondary

### Scenario: Primary Region Failure

If us-east-2 becomes unavailable, promote us-west-2 to primary.

#### Step 1: Assess the Situation

```bash
# Check primary region status
aws rds describe-db-clusters \
  --region us-east-2 \
  --query 'DBClusters[?contains(DBClusterIdentifier, `mysql`)].Status' 2>&1

# If error or timeout, primary is down
```

#### Step 2: Promote Secondary (Manual)

```bash
# Promote MySQL secondary to primary
aws rds failover-global-cluster \
  --global-cluster-identifier mysql-global-cluster \
  --target-db-cluster-identifier <secondary-cluster-id> \
  --region us-west-2

# Promote PostgreSQL secondary to primary
aws rds failover-global-cluster \
  --global-cluster-identifier postgres-global-cluster \
  --target-db-cluster-identifier <secondary-cluster-id> \
  --region us-west-2
```

**Failover time:** < 1 minute (typically 30-60 seconds)

#### Step 3: Update Application Configuration

```bash
# Update DNS or environment variables to point to us-west-2
# Option 1: Route 53 health check + failover routing
# Option 2: Update application config
export DB_ENDPOINT_MYSQL=mysql-cluster.xyz.us-west-2.rds.amazonaws.com
export DB_ENDPOINT_POSTGRES=postgres-cluster.xyz.us-west-2.rds.amazonaws.com

# Restart applications to pick up new config
```

#### Step 4: Verify Failover

```bash
# Verify new primary is writable
mysql -h mysql-cluster.xyz.us-west-2.rds.amazonaws.com \
      -u admin -p -e "CREATE DATABASE test_failover; DROP DATABASE test_failover;"

# If successful, failover is complete
```

#### Step 5: Recover Original Primary (when available)

```bash
# Once us-east-2 is recovered, demote it to secondary
# Then fail back if desired

# This requires manual intervention and is not covered by CDK
# Contact AWS Support for assistance
```

---

## 📊 Monitoring Global Replication

### CloudWatch Metrics to Monitor

```bash
# MySQL Replication Lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name AuroraGlobalDBReplicationLag \
  --dimensions Name=DBClusterIdentifier,Value=<cluster-id> \
  --statistics Average \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --region us-west-2

# PostgreSQL Replication Lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name AuroraGlobalDBReplicationLag \
  --dimensions Name=DBClusterIdentifier,Value=<postgres-cluster-id> \
  --statistics Average \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --region us-west-2
```

### Set Up CloudWatch Alarms

Add to your stack code:

```typescript
// Monitor replication lag
new cloudwatch.Alarm(this, 'GlobalReplicationLag', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/RDS',
    metricName: 'AuroraGlobalDBReplicationLag',
    dimensionsMap: {
      DBClusterIdentifier: secondaryCluster.clusterIdentifier,
    },
    statistic: 'Average',
  }),
  threshold: 5000, // 5 seconds
  evaluationPeriods: 2,
  alarmDescription: 'Global replication lag exceeds 5 seconds',
});
```

---

## 💰 Cost Implications

### Primary Region Cost (us-east-2)

| Resource | Quantity | Monthly Cost |
|----------|----------|--------------|
| Aurora MySQL - Writer | 1 × db.t3.medium | ~$60 |
| Aurora MySQL - Reader | 1 × db.t3.medium | ~$60 |
| Aurora PostgreSQL - Writer | 1 × db.t3.medium | ~$60 |
| Aurora PostgreSQL - Reader | 1 × db.t3.medium | ~$60 |
| NAT Gateway | 2 × NAT | ~$64 |
| **Total Primary** | | **~$304/month** |

### Secondary Region Cost (us-west-2)

| Resource | Quantity | Monthly Cost |
|----------|----------|--------------|
| Aurora MySQL - Reader | 2 × db.t3.medium | ~$120 |
| Aurora PostgreSQL - Reader | 2 × db.t3.medium | ~$120 |
| NAT Gateway | 2 × NAT | ~$64 |
| Data Transfer (replication) | ~1 GB/day | ~$3 |
| **Total Secondary** | | **~$307/month** |

### Total Global Database Cost

**~$611/month** for full multi-region setup

**Cost Optimization Tips:**
1. Use Reserved Instances (save ~40%)
2. Use Aurora Serverless v2 for variable workloads
3. Remove NAT gateways if not needed (use VPC endpoints)
4. Adjust instance sizes based on actual usage

---

## 🔒 Security Considerations

### 1. Cross-Region Encryption

- ✅ Data in transit encrypted (TLS)
- ✅ Data at rest encrypted (AES-256)
- ✅ Encryption keys managed by AWS KMS

### 2. Network Security

- ✅ Databases in isolated subnets
- ✅ No public internet access
- ✅ Security groups restrict access to VPC only

### 3. Access Control

```bash
# Use IAM database authentication
aws rds add-role-to-db-cluster \
  --db-cluster-identifier <cluster-id> \
  --role-arn arn:aws:iam::123456789012:role/rds-access \
  --region us-east-2
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Primary cluster status: `available`
- [ ] Secondary cluster status: `available`
- [ ] Global cluster shows both regions
- [ ] Replication lag < 1 second
- [ ] Can read from secondary
- [ ] Cannot write to secondary
- [ ] CloudWatch alarms configured
- [ ] Monitoring dashboards created
- [ ] Failover procedure documented
- [ ] Team trained on failover process

---

## 📚 Additional Resources

- [Aurora Global Database Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html)
- [Disaster Recovery Strategies](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html)
- [Multi-Region Architecture Best Practices](https://aws.amazon.com/blogs/architecture/disaster-recovery-dr-architecture-on-aws-part-iv-multi-site-active-active/)

---

**Last Updated**: 2025-11-13
**Version**: 1.0
