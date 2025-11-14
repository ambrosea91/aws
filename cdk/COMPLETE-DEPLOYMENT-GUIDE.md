# Complete Deployment Guide - CDK Infrastructure with CI/CD

This guide walks you through deploying the entire CDK infrastructure with Jenkins and SonarQube servers for automated CI/CD pipeline.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Order](#deployment-order)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [Testing the Pipeline](#testing-the-pipeline)
7. [Cost Summary](#cost-summary)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What Gets Deployed

This CDK project deploys a complete infrastructure with CI/CD pipeline:

**Infrastructure Stacks** (Primary Region: us-east-2):
1. **MySQL Aurora** - Global database with replication to us-west-2
2. **PostgreSQL Aurora** - Global database with replication to us-west-2
3. **EC2 Instances** - 2 instances with MySQL 5.7 and PostgreSQL clients

**CI/CD Stacks** (us-east-2):
4. **Jenkins Server** - CI/CD automation server
5. **SonarQube Server** - Code quality and security analysis

**Total deployment time**: ~90-100 minutes

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         GitHub Repo                          │
│                    (cdk-infrastructure)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Manual PR creation
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Jenkins Server                          │
│  • Automated build & test                                   │
│  • Security audit (npm audit)                               │
│  • SonarQube code analysis                                  │
│  • CDK synth & deploy                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ├──────────────────┐
                        │                  │
                        ▼                  ▼
        ┌───────────────────────┐  ┌─────────────────┐
        │  SonarQube Server     │  │  AWS Account    │
        │  • Code Quality       │  │  • Aurora DBs   │
        │  • Security Scan      │  │  • EC2          │
        │  • Quality Gates      │  │  • VPCs         │
        └───────────────────────┘  └─────────────────┘
```

---

## Prerequisites

### 1. Required Software (Local Machine)

```bash
# Check versions
node --version   # Should be 20.x
aws --version    # AWS CLI v2
cdk --version    # AWS CDK CLI
git --version
```

If not installed:
```bash
# Node.js 20.x
# Download from: https://nodejs.org/

# AWS CLI
# Download from: https://aws.amazon.com/cli/

# AWS CDK
npm install -g aws-cdk

# Git
# Download from: https://git-scm.com/
```

### 2. AWS Account Setup

```bash
# Configure AWS credentials
aws configure
# Enter:
#   AWS Access Key ID: YOUR_ACCESS_KEY
#   AWS Secret Access Key: YOUR_SECRET_KEY
#   Default region: us-east-2
#   Default output format: json

# Verify credentials
aws sts get-caller-identity

# Bootstrap CDK in primary region (us-east-2)
cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-2

# Bootstrap CDK in secondary region (us-west-2) for global databases
cdk bootstrap aws://YOUR-ACCOUNT-ID/us-west-2
```

### 3. Create EC2 Key Pair

```bash
# Create key pair for EC2 instances
aws ec2 create-key-pair \
  --key-name cdk-keypair \
  --region us-east-2 \
  --query 'KeyMaterial' \
  --output text > cdk-keypair.pem

# Set permissions (Linux/Mac)
chmod 400 cdk-keypair.pem

# For Windows, set permissions via Properties > Security
```

### 4. Clone Repository

```bash
# Clone your repository
git clone https://github.com/your-org/cdk-infrastructure.git
cd cdk-infrastructure

# Create .env file from template
cp .env.example .env

# Edit .env with your actual values
# IMPORTANT: Set your IP addresses for Jenkins and SonarQube access
```

### 5. Configure Environment Variables

Edit `.env` file:

```bash
# AWS Configuration
AWS_ACCOUNT_ID=123456789012          # Your actual AWS account ID
AWS_DEFAULT_REGION=us-east-2
AWS_ACCESS_KEY_ID=YOUR_ACTUAL_KEY
AWS_SECRET_ACCESS_KEY=YOUR_ACTUAL_SECRET

# EC2 Configuration
EC2_KEY_PAIR_NAME=cdk-keypair

# GitHub Configuration
GITHUB_REPO=your-org/cdk-infrastructure
GITHUB_TOKEN=ghp_xxxxx                # Generate at https://github.com/settings/tokens

# Jenkins Configuration
JENKINS_INSTANCE_TYPE=t3.medium
JENKINS_ALLOWED_IPS=$(curl -s ifconfig.me)/32   # Your current IP

# SonarQube Configuration
SONARQUBE_INSTANCE_TYPE=t3.large
SONARQUBE_ALLOWED_IPS=$(curl -s ifconfig.me)/32  # Your current IP
```

Load environment variables:
```bash
export $(cat .env | xargs)
```

---

## Deployment Order

**IMPORTANT**: Deploy in this exact order to ensure proper integration.

### Deployment Sequence

1. **Jenkins Server** (15 min) - Deploy first for CI/CD capability
2. **SonarQube Server** (20 min) - Deploy second for code quality scanning
3. **Configure Jenkins & SonarQube** (15 min) - Set up integration
4. **MySQL Aurora Primary** (25 min) - Deploy database stack
5. **PostgreSQL Aurora Primary** (25 min) - Deploy database stack
6. **EC2 Instances** (10 min) - Deploy compute stack
7. **(Optional) Global Database Secondary Regions** (50 min)

**Total time for primary region**: ~90-100 minutes
**Total time with secondary regions**: ~140-150 minutes

---

## Step-by-Step Deployment

### Step 1: Deploy Jenkins Server (~15 minutes)

```bash
# Navigate to jenkins-server directory
cd jenkins-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Review what will be deployed
npm run synth

# Deploy Jenkins server
npm run deploy

# Wait for deployment to complete...
# ⏱️  Expected time: 10-15 minutes
```

**Get Jenkins URL and Initial Password:**

```bash
# Get Jenkins URL
JENKINS_URL=$(aws cloudformation describe-stacks \
  --stack-name JenkinsStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`JenkinsURL`].OutputValue' \
  --output text)

echo "Jenkins URL: $JENKINS_URL"

# Get initial admin password
JENKINS_PASSWORD=$(aws ssm get-parameter \
  --name "/jenkins/initial-admin-password" \
  --region us-east-2 \
  --with-decryption \
  --query Parameter.Value \
  --output text)

echo "Initial Password: $JENKINS_PASSWORD"
```

**Save these values - you'll need them shortly!**

---

### Step 2: Deploy SonarQube Server (~20 minutes)

```bash
# Navigate to sonarqube-server directory
cd ../sonarqube-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Review what will be deployed
npm run synth

# Deploy SonarQube server
npm run deploy

# Wait for deployment to complete...
# ⏱️  Expected time: 15-20 minutes
```

**Get SonarQube URL:**

```bash
# Get SonarQube URL
SONARQUBE_URL=$(aws cloudformation describe-stacks \
  --stack-name SonarQubeStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`SonarQubeURL`].OutputValue' \
  --output text)

echo "SonarQube URL: $SONARQUBE_URL"
echo "Default credentials: admin / admin"
```

**Save this URL - you'll need it for Jenkins configuration!**

---

### Step 3: Configure Jenkins (~10 minutes)

#### 3.1 Initial Jenkins Setup

1. Open Jenkins URL in your browser: `$JENKINS_URL`
2. Enter the initial admin password
3. Click **"Install suggested plugins"**
4. Create first admin user:
   - Username: `admin` (or your preference)
   - Password: (strong password)
   - Full name: Your name
   - Email: your.email@company.com
5. Confirm Jenkins URL
6. Click **"Start using Jenkins"**

#### 3.2 Install Additional Plugins

**Manage Jenkins** > **Manage Plugins** > **Available**

Install these plugins:
- [x] **AWS Credentials Plugin**
- [x] **SonarQube Scanner**
- [x] **NodeJS Plugin**
- [x] **Email Extension Plugin**

Click **"Install without restart"**

#### 3.3 Configure NodeJS

**Manage Jenkins** > **Global Tool Configuration** > **NodeJS**

- Click **"Add NodeJS"**
- Name: `NodeJS-20`
- Version: Select **NodeJS 20.x.x**
- Click **"Save"**

#### 3.4 Add AWS Credentials

**Manage Jenkins** > **Manage Credentials** > **Global** > **Add Credentials**

Add these credentials (one by one):

1. **aws-account-id**
   - Kind: Secret text
   - Secret: `123456789012` (your actual AWS account ID)
   - ID: `aws-account-id`

2. **aws-access-key-id**
   - Kind: Secret text
   - Secret: Your AWS access key
   - ID: `aws-access-key-id`

3. **aws-secret-access-key**
   - Kind: Secret text
   - Secret: Your AWS secret access key
   - ID: `aws-secret-access-key`

4. **github-token**
   - Kind: Secret text
   - Secret: Your GitHub personal access token
   - ID: `github-token`

5. **ec2-key-pair-name**
   - Kind: Secret text
   - Secret: `cdk-keypair`
   - ID: `ec2-key-pair-name`

6. **sonarqube-url**
   - Kind: Secret text
   - Secret: `$SONARQUBE_URL` (from Step 2)
   - ID: `sonarqube-url`

#### 3.5 Configure SonarQube Integration

**Manage Jenkins** > **Configure System** > **SonarQube servers**

- Click **"Add SonarQube"**
- Name: `SonarQube`
- Server URL: `$SONARQUBE_URL` (from Step 2)
- Server authentication token: (We'll add this after configuring SonarQube)
- Click **"Save"**

---

### Step 4: Configure SonarQube (~10 minutes)

#### 4.1 Initial SonarQube Setup

1. Open SonarQube URL in your browser: `$SONARQUBE_URL`
2. Login with default credentials: `admin` / `admin`
3. You'll be prompted to change the password
4. Set a strong new password and save it

#### 4.2 Create Projects

Create three projects for the CDK infrastructure:

**Click "Create Project" > "Manually"**

**Project 1: MySQL Stack**
- Project key: `cdk-infrastructure-mysql`
- Display name: `CDK Infrastructure - MySQL`
- Click **"Set Up"**
- Choose: **"With Jenkins"**
- Select: **"Other"** (for build technology)

**Project 2: PostgreSQL Stack**
- Project key: `cdk-infrastructure-postgres`
- Display name: `CDK Infrastructure - PostgreSQL`
- Click **"Set Up"**
- Choose: **"With Jenkins"**
- Select: **"Other"**

**Project 3: EC2 Instances Stack**
- Project key: `cdk-infrastructure-ec2-instances`
- Display name: `CDK Infrastructure - EC2 Instances`
- Click **"Set Up"**
- Choose: **"With Jenkins"**
- Select: **"Other"**

#### 4.3 Generate Authentication Token

1. Click your avatar (top right) > **"My Account"**
2. Go to **"Security"** tab
3. Under **"Generate Tokens"**:
   - Name: `Jenkins`
   - Type: **Global Analysis Token**
   - Expires in: **No expiration** (or set appropriate expiration)
4. Click **"Generate"**
5. **IMPORTANT**: Copy the token immediately (you won't see it again!)

Example token: `squ_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0`

#### 4.4 Add SonarQube Token to Jenkins

Go back to Jenkins:

**Manage Jenkins** > **Manage Credentials** > **Global** > **Add Credentials**

7. **sonar-token**
   - Kind: Secret text
   - Secret: (paste the SonarQube token you just generated)
   - ID: `sonar-token`
   - Click **"OK"**

#### 4.5 Complete SonarQube Configuration in Jenkins

**Manage Jenkins** > **Configure System** > **SonarQube servers**

- Find the SonarQube server you added earlier
- Server authentication token: Select `sonar-token` from dropdown
- Click **"Save"**

---

### Step 5: Create Jenkins Pipeline

#### 5.1 Create New Pipeline Job

1. Jenkins Dashboard > **"New Item"**
2. Enter name: `cdk-infrastructure`
3. Select: **"Pipeline"**
4. Click **"OK"**

#### 5.2 Configure Pipeline

**General:**
- Description: `CDK Infrastructure deployment pipeline with SonarQube analysis`
- [x] Discard old builds: Keep last 10 builds

**Build Triggers:**
- [ ] ~~GitHub hook trigger for GITScm polling~~ (Will configure this later if needed)

**Pipeline:**
- Definition: **"Pipeline script from SCM"**
- SCM: **"Git"**
- Repository URL: `https://github.com/your-org/cdk-infrastructure.git`
- Credentials: Select your `github-token`
- Branches to build: `*/master` and `*/PR-*`
- Script Path: `Jenkinsfile`

Click **"Save"**

---

### Step 6: Deploy MySQL Aurora Stack (~25 minutes)

```bash
# Navigate to mysql directory
cd ../mysql

# Install dependencies
npm install

# Build TypeScript
npm run build

# Review what will be deployed
npm run synth

# Deploy MySQL Aurora (Primary region: us-east-2)
export AWS_DEFAULT_REGION=us-east-2
export PRIMARY_REGION=us-east-2
npm run deploy

# Wait for deployment to complete...
# ⏱️  Expected time: 20-25 minutes

# Verify deployment
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'
# Output should be: CREATE_COMPLETE
```

---

### Step 7: Deploy PostgreSQL Aurora Stack (~25 minutes)

```bash
# Navigate to postgres directory
cd ../postgres

# Install dependencies
npm install

# Build TypeScript
npm run build

# Review what will be deployed
npm run synth

# Deploy PostgreSQL Aurora (Primary region: us-east-2)
export AWS_DEFAULT_REGION=us-east-2
export PRIMARY_REGION=us-east-2
npm run deploy

# Wait for deployment to complete...
# ⏱️  Expected time: 20-25 minutes

# Verify deployment
aws cloudformation describe-stacks \
  --stack-name PostgresAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'
# Output should be: CREATE_COMPLETE
```

---

### Step 8: Deploy EC2 Instances Stack (~10 minutes)

```bash
# Navigate to ec2-instances directory
cd ../ec2-instances

# Install dependencies
npm install

# Build TypeScript
npm run build

# Review what will be deployed
npm run synth

# Deploy EC2 instances
export AWS_DEFAULT_REGION=us-east-2
export EC2_KEY_PAIR_NAME=cdk-keypair
npm run deploy

# Wait for deployment to complete...
# ⏱️  Expected time: 5-10 minutes

# Verify deployment
aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'
# Output should be: CREATE_COMPLETE
```

---

### Step 9: (Optional) Deploy Secondary Regions (~50 minutes)

If you want global database replication for disaster recovery:

See **GLOBAL-DATABASE-DEPLOYMENT.md** for detailed instructions.

Summary:
1. Deploy MySQL Aurora Secondary (us-west-2) - 25 min
2. Deploy PostgreSQL Aurora Secondary (us-west-2) - 25 min
3. Verify replication is working

---

## Post-Deployment Configuration

### 1. Verify All Stacks

```bash
# List all deployed stacks
aws cloudformation list-stacks \
  --stack-status-filter CREATE_COMPLETE \
  --region us-east-2 \
  --query 'StackSummaries[?contains(StackName, `Jenkins`) || contains(StackName, `SonarQube`) || contains(StackName, `Mysql`) || contains(StackName, `Postgres`) || contains(StackName, `Ec2`)].{Name:StackName, Status:StackStatus, Created:CreationTime}' \
  --output table
```

Expected output:
```
---------------------------------------------------------------------
|                         ListStacks                                |
+--------------------------------+-------------------+--------------+
|            Name                |      Status       |   Created    |
+--------------------------------+-------------------+--------------+
|  JenkinsStack                  |  CREATE_COMPLETE  |  2024-11-13  |
|  SonarQubeStack                |  CREATE_COMPLETE  |  2024-11-13  |
|  MysqlAuroraPrimaryStack       |  CREATE_COMPLETE  |  2024-11-13  |
|  PostgresAuroraPrimaryStack    |  CREATE_COMPLETE  |  2024-11-13  |
|  Ec2Stack                      |  CREATE_COMPLETE  |  2024-11-13  |
+--------------------------------+-------------------+--------------+
```

### 2. Get All Stack Outputs

```bash
# Jenkins outputs
aws cloudformation describe-stacks --stack-name JenkinsStack --region us-east-2 --query 'Stacks[0].Outputs'

# SonarQube outputs
aws cloudformation describe-stacks --stack-name SonarQubeStack --region us-east-2 --query 'Stacks[0].Outputs'

# MySQL outputs
aws cloudformation describe-stacks --stack-name MysqlAuroraPrimaryStack --region us-east-2 --query 'Stacks[0].Outputs'

# PostgreSQL outputs
aws cloudformation describe-stacks --stack-name PostgresAuroraPrimaryStack --region us-east-2 --query 'Stacks[0].Outputs'

# EC2 outputs
aws cloudformation describe-stacks --stack-name Ec2Stack --region us-east-2 --query 'Stacks[0].Outputs'
```

### 3. Test Database Connectivity

```bash
# Get EC2 instance ID
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`Instance1Id`].OutputValue' \
  --output text)

# Connect to EC2 via SSM
aws ssm start-session --target $INSTANCE_ID --region us-east-2

# Inside the EC2 instance:
# Test MySQL client
mysql --version

# Test PostgreSQL client
psql --version

# Get database endpoints from CloudFormation outputs and test connections
```

---

## Testing the Pipeline

### 1. Make a Test Change

```bash
# Create a new branch
cd ~/cdk-infrastructure
git checkout -b test/pipeline-verification

# Make a small change (e.g., add a comment to a file)
echo "# Pipeline test" >> mysql/lib/mysql-aurora-stack.ts

# Commit the change
git add .
git commit -m "test: verify Jenkins pipeline integration"

# Push to GitHub
git push origin test/pipeline-verification
```

### 2. Create Pull Request MANUALLY

1. Go to GitHub: `https://github.com/your-org/cdk-infrastructure`
2. Click **"Pull requests"** > **"New pull request"**
3. Base: `master` ← Compare: `test/pipeline-verification`
4. Click **"Create pull request"**
5. Add description
6. Click **"Create pull request"**

### 3. Jenkins Runs Automatically

Jenkins will automatically:
1. ✅ Checkout code
2. ✅ Install dependencies (all 3 stacks)
3. ✅ Build TypeScript
4. ✅ Run security audit (npm audit)
5. ✅ Run SonarQube analysis
6. ✅ Check quality gates
7. ✅ Synthesize CloudFormation templates

**Check Jenkins**: `$JENKINS_URL/job/cdk-infrastructure/`

### 4. Review SonarQube Report

**Check SonarQube**: `$SONARQUBE_URL/projects`

Verify:
- All 3 projects show up
- Quality gate status (should be PASSED)
- Code coverage, bugs, vulnerabilities

### 5. Merge Pull Request

If all checks pass:
1. Get code review from team member
2. Merge PR to master
3. Jenkins will run again
4. **Manual approval required** for deployment
5. Jenkins deploys all stacks to AWS

---

## Cost Summary

### Monthly Costs (All Stacks Running 24/7)

| Stack | Resources | Monthly Cost |
|-------|-----------|--------------|
| **Jenkins** | EC2 t3.medium + NAT Gateway + 50GB EBS | ~$67 |
| **SonarQube** | EC2 t3.large + RDS db.t3.small + NAT Gateway | ~$124 |
| **MySQL Aurora** | 2× db.t3.medium (primary) | ~$120 |
| **PostgreSQL Aurora** | 2× db.t3.medium (primary) | ~$120 |
| **EC2 Instances** | 2× t3.micro | ~$12 |
| **NAT Gateways** | 3× (for databases) | ~$96 |
| **Other** | Data transfer, CloudWatch, Secrets | ~$15 |
| **TOTAL (Primary Region)** | | **~$554/month** |

### Cost Optimization Tips

1. **Stop non-production resources**:
   - Stop Jenkins and SonarQube when not in use: Save ~$170/month
   - Storage-only cost: ~$10/month

2. **Right-size instances**:
   - Use t3.small for Jenkins if light usage: Save $15/month
   - Use Aurora Serverless v2: Variable cost based on usage

3. **Remove NAT gateways**:
   - If not needed for database stacks: Save $96/month
   - Use VPC endpoints instead

4. **Reserved Instances**:
   - 1-year commitment: Save ~40%
   - 3-year commitment: Save ~60%

5. **Development environment**:
   - Use separate AWS account
   - Stop resources outside business hours
   - Use Savings Plans

**Estimated cost for development (stop after hours)**: ~$180/month

---

## Troubleshooting

### Jenkins Issues

**Problem**: Jenkins not accessible
**Solution**:
```bash
# Check security group
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=JenkinsStack/JenkinsSecurityGroup" \
  --region us-east-2

# Add your IP if needed
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 8080 \
  --cidr $(curl -s ifconfig.me)/32 \
  --region us-east-2
```

**Problem**: Jenkins build fails
**Solution**: Check Jenkins console output for detailed errors

### SonarQube Issues

**Problem**: SonarQube not accessible
**Solution**: Check security group (same as Jenkins above, port 9000)

**Problem**: Quality gate fails
**Solution**: Review SonarQube project details for specific issues

### Database Issues

**Problem**: Can't connect to database
**Solution**: Databases are in isolated subnets - use EC2 as bastion or SSM port forwarding

**Problem**: Replication lag
**Solution**: Check CloudWatch metrics for replication lag and CPU utilization

### Deployment Failures

```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name <stack-name> \
  --region us-east-2 \
  --max-items 20

# Get detailed error
aws cloudformation describe-stack-resources \
  --stack-name <stack-name> \
  --region us-east-2
```

---

## Next Steps

1. ✅ Configure CloudWatch dashboards for monitoring
2. ✅ Set up SNS topics for alerts
3. ✅ Configure backup testing procedures
4. ✅ Document runbooks for common operations
5. ✅ Train team on the CI/CD workflow
6. ✅ Set up cost monitoring and budgets
7. ✅ Plan disaster recovery drills

---

## Support

For detailed information on specific components:

- **Jenkins**: See `jenkins-server/README.md`
- **SonarQube**: See `sonarqube-server/README.md`
- **MySQL Aurora**: See `mysql/README.md`
- **PostgreSQL Aurora**: See `postgres/README.md`
- **EC2 Instances**: See `ec2-instances/README.md`
- **Global Databases**: See `GLOBAL-DATABASE-DEPLOYMENT.md`
- **Daily Workflow**: See `QUICK-START.md`

---

**Deployment Date**: 2025-11-14
**Version**: 1.0
**Last Updated**: 2025-11-14
