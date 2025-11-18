# AWS RDS Global Database Deployment

Complete Infrastructure-as-Code solution for deploying and managing AWS RDS Aurora Global Databases with automated blue-green upgrade capabilities.

## 📦 What's Included

### RDS Global Database Deployments
- **MySQL 5.7** - Aurora MySQL global database (Primary: us-east-2, Secondary: us-west-2)
- **PostgreSQL 14** - Aurora PostgreSQL global database (Primary: us-east-2, Secondary: us-west-2)

### Blue-Green Upgrade Automation
- **MySQL 5.7 → 8.0** - Automated upgrade with Lambda & Step Functions
- **PostgreSQL 14 → 16** - Automated upgrade with Lambda & Step Functions

### GitHub Actions Workflows
- **Deploy Global Databases** - One-click deployment of RDS global databases
- **Blue-Green Upgrades** - Automated database version upgrades with zero downtime

## 🏗️ Repository Structure

```
.
├── .github/workflows/
│   ├── deploy-global-databases.yml    # Deploy RDS global databases
│   └── bluegreen-upgrade.yml          # Manage blue-green upgrades
├── rds-global-databases/
│   ├── mysql-57-deploy.yaml           # MySQL 5.7 (primary + secondary)
│   └── postgres-14-deploy.yaml        # PostgreSQL 14 (primary + secondary)
└── rds-blue-green-upgrade/
    ├── mysql-bluegreen-upgrade.yaml   # MySQL upgrade automation
    └── postgres-bluegreen-upgrade.yaml # PostgreSQL upgrade automation
```

## 🚀 Quick Start

### Prerequisites

1. **AWS Account** with appropriate permissions (Account ID: 906266478329)
2. **GitHub Repository** with OIDC configured for AWS
3. **IAM Role**: `arn:aws:iam::906266478329:role/GitHubActionsOIDCRole`
4. **Regions**: us-east-2 (primary), us-west-2 (secondary)

---

## 🔐 OIDC Setup Guide for AWS Account 906266478329

**⚠️ First-Time Setup Required:** Before you can deploy using GitHub Actions, you must configure OIDC authentication between GitHub and AWS. Follow this guide once to set up the connection.

### PART 1: Create OIDC Identity Provider (5 minutes)

#### Step 1.1: Navigate to IAM
1. Open your browser and go to: https://console.aws.amazon.com/iam/
2. Sign in to AWS account **906266478329**
3. You should see the IAM Dashboard

#### Step 1.2: Go to Identity Providers
1. Look at the left sidebar
2. Click on **"Identity providers"** (under "Access management")
3. You'll see a page listing identity providers (probably empty)

#### Step 1.3: Add New Provider
1. Click the orange **"Add provider"** button (top right)
2. A form will appear

#### Step 1.4: Configure OpenID Connect Provider
Fill in these fields:

**Provider type:**
- Select **"OpenID Connect"** (should be selected by default)

**Provider URL:**
- Enter exactly: `https://token.actions.githubusercontent.com`
- Press Tab or click outside the field (AWS will validate automatically)

**Thumbprints:**
- If empty, manually add: `6938fd4d98bab03faadb97b34396831e3780aea1`
- (AWS may auto-populate this)

**Audience:**
- Click **"Add audience"**
- Enter exactly: `sts.amazonaws.com`

#### Step 1.5: Add Tags (Optional)
- You can skip this or add:
  - Key: `Name`, Value: `GitHubActions`
  - Key: `Purpose`, Value: `OIDC`

#### Step 1.6: Create Provider
1. Click the **"Add provider"** button at the bottom
2. You should see a success message
3. You'll see your new provider listed as `token.actions.githubusercontent.com`

✅ **PART 1 COMPLETE!** The OIDC provider is now created.

---

### PART 2: Create IAM Role (10 minutes)

#### Step 2.1: Navigate to Roles
1. In the left sidebar of IAM, click **"Roles"**
2. You'll see a list of existing roles

#### Step 2.2: Start Creating Role
1. Click the orange **"Create role"** button (top right)
2. You'll see "Select trusted entity" page

#### Step 2.3: Select Trusted Entity Type
1. Select **"Web identity"**
2. You'll see a form appear below

#### Step 2.4: Configure Web Identity
Fill in these fields:

**Identity provider:**
- From dropdown, select: `token.actions.githubusercontent.com`

**Audience:**
- From dropdown, select: `sts.amazonaws.com`

**GitHub organization:**
- Enter: `ambrosea9`

**GitHub repository:** (if this field appears)
- Enter: `aws`

#### Step 2.5: Click Next
- Click the **"Next"** button at the bottom

#### Step 2.6: Add Permissions Policies
Now you need to attach AWS managed policies. In the search box, search for and **select** (check the box) for each of these:

1. Search: `AWSCloudFormationFullAccess` → Check the box ✓
2. Search: `AmazonRDSFullAccess` → Check the box ✓
3. Search: `AmazonVPCFullAccess` → Check the box ✓
4. Search: `AWSLambda_FullAccess` → Check the box ✓
5. Search: `AWSStepFunctionsFullAccess` → Check the box ✓
6. Search: `AmazonSNSFullAccess` → Check the box ✓
7. Search: `CloudWatchLogsFullAccess` → Check the box ✓
8. Search: `IAMFullAccess` → Check the box ✓

You should have **8 policies selected** (you'll see them listed at the top)

#### Step 2.7: Click Next
- Click **"Next"** at the bottom

#### Step 2.8: Name and Review
Fill in these fields:

**Role name:**
- Enter exactly: `GitHubActionsOIDCRole`

**Description:**
- Enter: `IAM role for GitHub Actions to deploy AWS resources via OIDC`

**Max session duration:**
- Leave as default (1 hour)

#### Step 2.9: Create Role
1. Scroll down and click **"Create role"** button
2. You should see a success message
3. You'll be back at the Roles list

✅ **PART 2 COMPLETE!** The role is created, but we need to edit the trust policy.

---

### PART 3: Edit Trust Policy (CRITICAL STEP - 5 minutes)

#### Step 3.1: Find Your Role
1. In the Roles search box, type: `GitHubActionsOIDCRole`
2. Click on the role name **"GitHubActionsOIDCRole"** in the list
3. You'll see the role summary page

#### Step 3.2: Go to Trust Relationships
1. Click the **"Trust relationships"** tab (near the top)
2. You'll see the current trust policy in JSON format

#### Step 3.3: Edit Trust Policy
1. Click the **"Edit trust policy"** button
2. You'll see a JSON editor

#### Step 3.4: Replace the Trust Policy
1. **DELETE** all the existing JSON in the editor
2. **COPY** this entire JSON policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::906266478329:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:ambrosea9/aws:*"
        }
      }
    }
  ]
}
```

3. **PASTE** it into the editor (replacing everything)

#### Step 3.5: Update Policy
1. Click **"Update policy"** button at the bottom
2. You should see a success message
3. The trust policy is now configured correctly

✅ **PART 3 COMPLETE!** Your role now trusts only your GitHub repository.

---

### PART 4: Verify Setup (2 minutes)

#### Step 4.1: Check Role ARN
1. You should still be on the `GitHubActionsOIDCRole` page
2. Near the top, you'll see **"ARN"**
3. Copy the ARN - it should be: `arn:aws:iam::906266478329:role/GitHubActionsOIDCRole`

#### Step 4.2: Verify OIDC Provider
1. Go back to **Identity providers** in the left sidebar
2. You should see `token.actions.githubusercontent.com` listed
3. Click on it
4. Verify the ARN is: `arn:aws:iam::906266478329:oidc-provider/token.actions.githubusercontent.com`

✅ **ALL DONE!** Your GitHub Actions should now be able to authenticate to AWS.

---

### PART 5: Test the Setup

#### Step 5.1: Try Your Deployment
1. Go to your GitHub repository: https://github.com/ambrosea9/aws
2. Click on **Actions** tab
3. Select **"Deploy RDS Global Databases"** workflow
4. Click **"Run workflow"**
5. Fill in the parameters and run it

#### Step 5.2: Monitor
- Watch the workflow run
- The "Configure AWS credentials" step should now succeed
- You should no longer see the OIDC error

---

## 🚀 Deployment Instructions

### Option 1: Deploy Using GitHub Actions (Recommended)

#### Step 1: Deploy RDS Global Database

1. Go to your GitHub repository
2. Navigate to **Actions** → **Deploy RDS Global Databases**
3. Click **Run workflow**
4. Configure parameters:
   - **Environment**: `dev` (for testing)
   - **Database Type**:
     - `mysql-57` - Deploy MySQL only
     - `postgres-14` - Deploy PostgreSQL only
     - `both` - Deploy both databases
   - **DB Password**: Strong password (min 8 characters)
5. Click **Run workflow**
6. Monitor progress in the Actions tab

**Deployment Time**: ~20-30 minutes

#### Step 2: Verify Deployment

After deployment completes:

1. Go to **AWS Console** → **CloudFormation**
2. Find your stack:
   - MySQL: `dev-mysql57-global`
   - PostgreSQL: `dev-postgres14-global`
3. Check the **Outputs** tab for:
   - Global Cluster ID
   - Primary endpoints (us-east-2)
   - Secondary endpoints (us-west-2)
   - Read endpoints

### Option 2: Deploy Using AWS CLI

#### Deploy MySQL 5.7 Global Database

```bash
aws cloudformation deploy \
  --template-file rds-global-databases/mysql-57-deploy.yaml \
  --stack-name dev-mysql57-global \
  --parameter-overrides \
    Environment=dev \
    DBMasterUsername=admin \
    DBMasterPassword=YOUR_SECURE_PASSWORD_HERE \
    DBInstanceClass=db.r5.large \
  --capabilities CAPABILITY_IAM \
  --region us-east-2
```

#### Deploy PostgreSQL 14 Global Database

```bash
aws cloudformation deploy \
  --template-file rds-global-databases/postgres-14-deploy.yaml \
  --stack-name dev-postgres14-global \
  --parameter-overrides \
    Environment=dev \
    DBMasterUsername=postgres \
    DBMasterPassword=YOUR_SECURE_PASSWORD_HERE \
    DBInstanceClass=db.r5.large \
  --capabilities CAPABILITY_IAM \
  --region us-east-2
```

## 🔄 Blue-Green Database Upgrades

Blue-green deployments allow you to upgrade your database with minimal downtime.

### How It Works

1. **Deploy Automation** - Sets up Lambda functions and Step Functions
2. **Create Green Environment** - Clones your database with the new version
3. **Test Green Environment** - Verify the upgrade worked correctly
4. **Switchover** - Swap blue and green environments (minimal downtime)
5. **Cleanup** - Remove the old environment

### Using GitHub Actions

#### Phase 1: Deploy Automation Infrastructure

1. Go to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Select:
   - **Action**: `deploy-automation`
   - **Environment**: `dev`
   - **Database Type**: `mysql` or `postgres`
   - **Region**: `us-east-2`
4. Run the workflow

#### Phase 2: Start Upgrade Process

1. Go to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Select:
   - **Action**: `start-upgrade`
   - **Database Type**: `mysql` or `postgres`
   - **Source Cluster ID**: Your cluster identifier (e.g., `dev-mysql57-primary-cluster`)
   - **Region**: `us-east-2`
4. Run the workflow

This will:
- Create a green environment with the new version
- Send SNS notification when ready for testing
- Wait for manual approval (1 hour default)

#### Phase 3: Test Green Environment

1. Connect to the green environment endpoint
2. Run your application tests
3. Verify the upgrade was successful

#### Phase 4: Perform Switchover

When satisfied with testing:

1. Go to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Select:
   - **Action**: `perform-switchover`
   - **Deployment ID**: From the SNS notification or Step Functions console
   - **Region**: `us-east-2`
4. Run the workflow

**Downtime**: ~30 seconds to 5 minutes

#### Phase 5: Cleanup (Optional)

After verifying the switchover:

1. Go to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Select:
   - **Action**: `cleanup`
   - **Deployment ID**: Same as switchover
   - **Region**: `us-east-2`
4. Run the workflow

This removes the old (blue) environment.

## 📊 Database Specifications

### MySQL 5.7 Global Database

- **Engine**: aurora-mysql 5.7.mysql_aurora.2.11.3
- **Primary Region**: us-east-2 (Ohio)
- **Secondary Region**: us-west-2 (Oregon)
- **Default Instance Class**: db.r5.large
- **Instances per Region**: 2
- **Backup Retention**: 7 days
- **Encryption**: Enabled
- **CloudWatch Logs**: error, general, slowquery

### PostgreSQL 14 Global Database

- **Engine**: aurora-postgresql 14.9
- **Primary Region**: us-east-2 (Ohio)
- **Secondary Region**: us-west-2 (Oregon)
- **Default Instance Class**: db.r5.large
- **Instances per Region**: 2
- **Backup Retention**: 7 days
- **Encryption**: Enabled
- **CloudWatch Logs**: postgresql

## 🔧 Configuration Options

### Available Parameters

All CloudFormation templates support these parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| Environment | dev | Environment name (dev, test, prod) |
| DBMasterUsername | admin/postgres | Master username |
| DBMasterPassword | (required) | Master password (min 8 chars) |
| DBInstanceClass | db.r5.large | Instance class |
| EngineVersion | Latest | Database engine version |

### Supported Instance Classes

- db.r5.large
- db.r5.xlarge
- db.r5.2xlarge
- db.r6g.large
- db.r6g.xlarge

## 🌐 Network Configuration

### VPC CIDR Blocks

- **MySQL Primary**: 10.0.0.0/16 (us-east-2)
- **MySQL Secondary**: 10.1.0.0/16 (us-west-2)
- **PostgreSQL Primary**: 10.2.0.0/16 (us-east-2)
- **PostgreSQL Secondary**: 10.3.0.0/16 (us-west-2)

### Subnet Configuration

Each region has 3 subnets across 3 availability zones:
- Subnet 1: x.x.1.0/24 (AZ a)
- Subnet 2: x.x.2.0/24 (AZ b)
- Subnet 3: x.x.3.0/24 (AZ c)

## 🔐 Security

### Security Groups

- **MySQL**: Port 3306 open to VPC CIDR
- **PostgreSQL**: Port 5432 open to VPC CIDR

### Encryption

- Storage encryption enabled by default
- Uses AWS managed keys

### Credentials

- Store DB passwords in AWS Secrets Manager or GitHub Secrets
- Never commit passwords to git

## 📈 Monitoring

### CloudWatch Logs

All databases export logs to CloudWatch:
- Error logs
- General/Query logs (MySQL)
- Slow query logs (MySQL)
- PostgreSQL logs

### CloudWatch Alarms

Consider setting up alarms for:
- CPU utilization
- Database connections
- Replication lag
- Storage space

## 🐛 Troubleshooting

### Common Issues

#### Issue: Stack deployment fails

**Solution**: Check CloudFormation events in AWS Console for specific error messages.

#### Issue: Cannot connect to database

**Solution**:
- Verify security group rules
- Check VPC/subnet configuration
- Ensure database is in "Available" status

#### Issue: Replication lag is high

**Solution**:
- Check network connectivity between regions
- Monitor instance CPU/memory usage
- Consider increasing instance size

#### Issue: Blue-green deployment stuck

**Solution**:
- Check Step Functions execution in AWS Console
- Review Lambda function logs in CloudWatch
- Verify source cluster is in "Available" status

### Getting Help

1. Check CloudFormation stack events
2. Review CloudWatch Logs
3. Check Step Functions execution history (for blue-green)
4. Review GitHub Actions workflow logs

## 💡 Best Practices

### For Development

1. Start with `dev` environment
2. Use smaller instance classes (db.r5.large)
3. Test blue-green upgrades before production

### For Production

1. Use strong passwords (16+ characters)
2. Store credentials in AWS Secrets Manager
3. Set up CloudWatch alarms
4. Enable enhanced monitoring
5. Configure automated backups
6. Test disaster recovery procedures
7. Document your RTO/RPO requirements

### Cost Optimization

1. Use appropriate instance sizes
2. Consider Aurora Serverless for dev/test
3. Delete old blue-green deployments promptly
4. Use reserved instances for production

## 📚 Additional Resources

- [Aurora MySQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraMySQL.html)
- [Aurora PostgreSQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraPostgreSQL.html)
- [RDS Blue-Green Deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments.html)
- [Aurora Global Databases](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html)

## 🤝 Contributing

Feel free to open issues or submit pull requests for improvements.

## 📄 License

This project is provided as-is for AWS infrastructure management.

---

**Need Help?** Open an issue in this repository or consult the AWS documentation links above.
