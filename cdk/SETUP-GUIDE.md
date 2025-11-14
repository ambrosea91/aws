# Comprehensive Setup Guide

This guide will help you get the CDK Infrastructure Project up and running quickly.

## Prerequisites Checklist

- [ ] Node.js 20.x or later installed
- [ ] AWS account with access credentials
- [ ] Git installed
- [ ] GitHub account (for CI/CD)
- [ ] Jenkins server (optional, if using Jenkins instead of GitHub Actions)

## Step-by-Step Setup

### 1. Initial Project Setup

```bash
# Clone or navigate to the project directory
cd cdk

# Run the setup script (Linux/Mac)
chmod +x setup.sh
./setup.sh

# Or manually install dependencies (Windows/Linux/Mac)
cd mysql && npm install && cd ..
cd postgres && npm install && cd ..
cd ec2-instances && npm install && cd ..
```

### 2. Configure AWS Credentials

**Option A: Using AWS CLI**
```bash
aws configure
```

**Option B: Environment Variables**
```bash
# Copy example file
cp .env.example .env

# Edit .env and add your credentials
# AWS_ACCESS_KEY_ID=your-key
# AWS_SECRET_ACCESS_KEY=your-secret
# AWS_ACCOUNT_ID=123456789012
# EC2_KEY_PAIR_NAME=your-key-pair
```

### 3. Bootstrap CDK (First Time Only)

```bash
# Replace with your account ID and regions
# Primary region
cdk bootstrap aws://123456789012/us-east-1

# Secondary region (for global databases)
cdk bootstrap aws://123456789012/eu-west-1
```

### 4. Create EC2 Key Pair (Required for EC2 Stack)

```bash
# Using AWS CLI
aws ec2 create-key-pair \
  --key-name my-cdk-key \
  --query 'KeyMaterial' \
  --output text > my-cdk-key.pem

# Set permissions (Linux/Mac)
chmod 400 my-cdk-key.pem

# Update environment variable
export EC2_KEY_PAIR_NAME=my-cdk-key
```

Or create via AWS Console:
1. Go to EC2 → Key Pairs
2. Click "Create key pair"
3. Save the .pem file securely
4. Note the key pair name

### 5. Test Deployment (Optional)

```bash
# Synth CloudFormation templates to verify everything works
cd mysql && npm run synth
cd ../postgres && npm run synth
cd ../ec2-instances && npm run synth
```

## GitHub Repository Setup

### 1. Initialize Git Repository

```bash
cd cdk
git init
git add .
git commit -m "Initial commit: CDK infrastructure with CI/CD"
```

### 2. Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `cdk`)
3. **Do not** initialize with README, .gitignore, or license
4. Click "Create repository"

### 3. Push to GitHub

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/cdk.git

# Push code
git branch -M master
git push -u origin master
```

### 4. Configure GitHub Secrets (for GitHub Actions)

1. Go to your repository → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add the following secrets:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | Your AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_ACCOUNT_ID` | Your AWS account ID | `123456789012` |
| `EC2_KEY_PAIR_NAME` | EC2 key pair name | `my-cdk-key` |

### 5. Enable GitHub Actions

GitHub Actions will automatically run when you push code. The workflow file is already configured in `.github/workflows/ci-cd.yml`.

## Jenkins Setup (Alternative to GitHub Actions)

### 1. Install Jenkins Plugins

Go to Manage Jenkins → Manage Plugins → Available and install:
- Pipeline
- Git plugin
- GitHub plugin
- NodeJS plugin
- AWS Steps
- Email Extension

### 2. Configure Global Tools

Manage Jenkins → Global Tool Configuration:

**NodeJS:**
- Name: `NodeJS-20`
- Install automatically: Yes
- Version: NodeJS 20.x

### 3. Add Jenkins Credentials

Manage Jenkins → Manage Credentials → Global → Add Credentials:

| ID | Type | Description |
|----|------|-------------|
| `aws-access-key-id` | Secret text | AWS Access Key ID |
| `aws-secret-access-key` | Secret text | AWS Secret Access Key |
| `aws-account-id` | Secret text | AWS Account ID |
| `github-token` | Secret text | GitHub Personal Access Token |
| `ec2-key-pair-name` | Secret text | EC2 Key Pair Name |

### 4. Create Jenkins Pipeline Job

1. New Item → Enter name → Pipeline → OK
2. Configure:
   - **GitHub project**: Enter repository URL
   - **Build Triggers**: Check "GitHub hook trigger for GITScm polling"
   - **Pipeline**:
     - Definition: Pipeline script from SCM
     - SCM: Git
     - Repository URL: Your GitHub repo URL
     - Credentials: Add GitHub credentials
     - Branch: `*/master` (or `*/*` for all branches)
     - Script Path: `Jenkinsfile`
3. Save

### 5. Configure GitHub Webhook

1. Go to GitHub repository → Settings → Webhooks
2. Add webhook:
   - Payload URL: `http://your-jenkins-server:8080/github-webhook/`
   - Content type: `application/json`
   - Events: "Just the push event"
   - Active: Yes
3. Save

## Deploying the Infrastructure

### Deploy All Stacks (Manual)

```bash
# MySQL Aurora
cd mysql
npm run deploy:primary

# PostgreSQL Aurora
cd ../postgres
npm run deploy:primary

# EC2 Instances
cd ../ec2-instances
export EC2_KEY_PAIR_NAME=my-cdk-key
npm run deploy
```

### Deploy Secondary Regions (Global Databases)

1. **Edit the bin files to uncomment secondary stacks:**

   In `mysql/bin/mysql-aurora.ts` and `postgres/bin/postgres-aurora.ts`, uncomment the secondary stack code.

2. **Deploy secondary regions:**

```bash
export SECONDARY_REGION=eu-west-1

cd mysql
npm run deploy:secondary

cd ../postgres
npm run deploy:secondary
```

## Testing the CI/CD Pipeline

### Test with a Feature Branch

```bash
# Create a feature branch
git checkout -b feature/test-pipeline

# Make a small change
echo "# Testing CI/CD" >> README.md

# Commit and push
git add .
git commit -m "Test: Verify CI/CD pipeline"
git push origin feature/test-pipeline
```

**Expected Behavior:**
- Jenkins/GitHub Actions will automatically build and test
- A pull request will be created automatically
- Review the PR and merge to master
- After merge, deployment to AWS will trigger

### Monitor the Pipeline

**GitHub Actions:**
1. Go to repository → Actions tab
2. Click on the latest workflow run
3. View logs and status

**Jenkins:**
1. Go to Jenkins dashboard
2. Click on your pipeline job
3. View latest build and console output

## Accessing Deployed Resources

### EC2 Instances

```bash
# Get EC2 public IPs
aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --query 'Stacks[0].Outputs'

# SSH to instance (Linux/Mac)
ssh -i my-cdk-key.pem ec2-user@<INSTANCE_PUBLIC_IP>

# View web server in browser
http://<INSTANCE_PUBLIC_IP>
```

### Aurora Databases

```bash
# Get MySQL credentials
aws secretsmanager get-secret-value \
  --secret-id mysql-aurora-credentials \
  --query SecretString --output text | jq -r .password

# Get PostgreSQL credentials
aws secretsmanager get-secret-value \
  --secret-id postgres-aurora-credentials \
  --query SecretString --output text | jq -r .password

# Get endpoint from stack outputs
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --query 'Stacks[0].Outputs'
```

**Note:** Databases are in isolated subnets and not publicly accessible. You'll need:
- A bastion host in the public subnet
- VPN connection to the VPC
- VPC peering from another VPC

### Example: Connect via Bastion Host

```bash
# SSH tunnel through bastion to database
ssh -i my-key.pem -L 3306:mysql-endpoint:3306 ec2-user@bastion-ip

# In another terminal, connect to MySQL
mysql -h 127.0.0.1 -P 3306 -u admin -p
```

## Monitoring

### CloudWatch Dashboards

Access CloudWatch in the AWS Console to view:
- Database metrics (CPU, connections, IOPS)
- EC2 metrics (CPU, network, disk)
- Logs from Aurora and EC2 instances

### CloudWatch Logs

```bash
# View MySQL logs
aws logs tail /aws/rds/cluster/mysql-primary-cluster/error --follow

# View PostgreSQL logs
aws logs tail /aws/rds/cluster/postgres-primary-cluster/postgresql --follow

# View EC2 logs (if CloudWatch agent is configured)
aws logs tail /aws/ec2/instance-id --follow
```

## Cost Management

### Monitor Costs

```bash
# Get current month's costs
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Set up billing alerts
aws cloudwatch put-metric-alarm \
  --alarm-name MonthlyBillingAlert \
  --alarm-description "Alert when monthly bill exceeds $500" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 21600 \
  --evaluation-periods 1 \
  --threshold 500 \
  --comparison-operator GreaterThanThreshold
```

## Cleanup

### Destroy All Resources

```bash
# Destroy in reverse order
cd ec2-instances
npm run destroy

cd ../postgres
npm run destroy

cd ../mysql
npm run destroy
```

**Important:** Aurora databases have deletion protection enabled. You'll need to:
1. Go to AWS RDS Console
2. Modify the cluster
3. Disable deletion protection
4. Then run destroy again

## Troubleshooting

### Issue: CDK Bootstrap Error

```
Error: This stack uses assets, so the toolkit stack must be deployed
```

**Solution:**
```bash
cdk bootstrap aws://YOUR_ACCOUNT_ID/YOUR_REGION
```

### Issue: GitHub Actions Permission Denied

```
Error: The deployment failed because no identity-based policy allows the sts:AssumeRole action
```

**Solution:**
Ensure your AWS IAM user has permissions for:
- CloudFormation (full)
- EC2 (full)
- RDS (full)
- IAM (role management)
- VPC (full)
- Secrets Manager (full)
- CloudWatch Logs (full)

### Issue: Database Connection Timeout

**Solution:**
Databases are in isolated subnets. You need:
- Bastion host in public subnet
- Update security group to allow your IP
- Use SSH tunnel or VPN

### Issue: Jenkins Webhook Not Triggering

**Solution:**
1. Check Jenkins is accessible from internet
2. Verify webhook URL is correct
3. Check GitHub webhook delivery logs
4. Ensure Jenkins GitHub plugin is installed

### Issue: Secondary Region Deployment Fails

**Solution:**
1. Ensure primary region is fully deployed first
2. Wait 5-10 minutes after primary deployment
3. Verify global cluster identifier matches
4. Check both regions are bootstrapped

## Best Practices

1. **Security:**
   - Never commit credentials to Git
   - Use AWS Secrets Manager for sensitive data
   - Implement least privilege IAM policies
   - Enable MFA for AWS accounts

2. **Monitoring:**
   - Set up CloudWatch alarms for critical metrics
   - Enable Enhanced Monitoring for Aurora
   - Configure SNS notifications for alerts

3. **Backup & Recovery:**
   - Aurora automated backups are enabled (7 days)
   - Test restore procedures regularly
   - Consider cross-region backup replication

4. **Cost Optimization:**
   - Use t3.micro for dev/test environments
   - Consider Aurora Serverless v2 for variable workloads
   - Enable automatic pause for dev databases
   - Use Reserved Instances for production

5. **Development Workflow:**
   - Always work in feature branches
   - Let CI/CD create PRs automatically
   - Review infrastructure changes before merge
   - Test in dev environment first

## Next Steps

1. Customize instance types and sizes
2. Add CloudWatch alarms and SNS topics
3. Implement backup strategies
4. Add Lambda functions for automation
5. Set up Route53 for DNS
6. Configure Application Load Balancer
7. Add WAF for web application firewall
8. Implement S3 for static assets

## Support

For issues or questions:
- AWS CDK Documentation: https://docs.aws.amazon.com/cdk/
- AWS RDS Aurora: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/
- Jenkins Documentation: https://www.jenkins.io/doc/
- GitHub Actions: https://docs.github.com/en/actions
