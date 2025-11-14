# Quick Start Guide - CDK Infrastructure

## 🚀 For Developers - Daily Workflow

### 5 Simple Steps

```bash
# 1. Clone and create branch
git clone https://github.com/your-org/cdk-infrastructure.git
cd cdk-infrastructure/mysql  # or postgres, or ec2-instances
git checkout -b feature/my-change

# 2. Make changes
vim lib/mysql-aurora-stack.ts
npm install
npm run build
npm run synth  # Verify changes

# 3. Commit and push
git add .
git commit -m "feat: my change description"
git push origin feature/my-change

# 4. Create Pull Request MANUALLY on GitHub
# Go to: https://github.com/your-org/cdk-infrastructure
# Click: "Pull requests" → "New pull request"
# Select: feature/my-change → master
# Click: "Create pull request"

# 5. Jenkins runs automatically
# - Build, security scan, SonarQube
# - If all checks pass, get code review
# - Merge to master
# - Jenkins deploys (after manual approval)
```

---

## 📦 What Gets Deployed

### CI/CD Infrastructure (us-east-2)
- ✅ **Jenkins Server** (t3.medium)
  - CI/CD automation with pipeline
  - Pre-configured with AWS CDK, Node.js 20, Docker
  - CloudWatch logging enabled
- ✅ **SonarQube Server** (t3.large)
  - Code quality and security analysis
  - PostgreSQL database (db.t3.small)
  - Quality gates for deployment blocking

### Primary Region (us-east-2) ⭐
- ✅ **MySQL Aurora** Global Database (db.t3.medium × 2)
  - Writer + Reader instances
  - MySQL 5.7 client installed on EC2 instances
- ✅ **PostgreSQL Aurora** Global Database (db.t3.medium × 2)
  - Writer + Reader instances
  - PostgreSQL client installed on EC2 instances
- ✅ **EC2 Instances** (t3.micro × 2)
  - MySQL 5.7 client pre-installed
  - PostgreSQL 15 client pre-installed
  - Apache web server
  - CloudWatch agent

### Secondary Region (us-west-2) - Optional
- Deploy after primary for disaster recovery
- See `GLOBAL-DATABASE-DEPLOYMENT.md`

---

## 🔧 Prerequisites

### Required Software
- **Node.js** 20.x: [Download](https://nodejs.org/)
- **AWS CLI**: [Download](https://aws.amazon.com/cli/)
- **Git**: [Download](https://git-scm.com/)
- **AWS CDK**: `npm install -g aws-cdk`

### Required Accounts
- AWS Account with admin access
- GitHub account (for code repository)
- GitHub Personal Access Token (for Jenkins integration)

**Note**: Jenkins and SonarQube servers are automatically deployed by CDK - no separate accounts needed!

---

## ⚙️ Initial Setup

### 1. Configure AWS

```bash
# Configure AWS credentials
aws configure
# AWS Access Key ID: YOUR_ACCESS_KEY
# AWS Secret Access Key: YOUR_SECRET_KEY
# Default region name: us-east-2
# Default output format: json

# Bootstrap CDK in us-east-2 (primary)
cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-2

# Bootstrap CDK in us-west-2 (secondary) - if needed
cdk bootstrap aws://YOUR-ACCOUNT-ID/us-west-2
```

### 2. Create EC2 Key Pair

```bash
# Create key pair in us-east-2
aws ec2 create-key-pair \
  --key-name cdk-keypair \
  --region us-east-2 \
  --query 'KeyMaterial' \
  --output text > cdk-keypair.pem

# Set permissions
chmod 400 cdk-keypair.pem

# Set environment variable
export EC2_KEY_PAIR_NAME=cdk-keypair
```

### 3. Clone Repository

```bash
git clone https://github.com/your-org/cdk-infrastructure.git
cd cdk-infrastructure
```

---

## 🚀 Deploy Infrastructure

### For Complete Step-by-Step Guide

**See COMPLETE-DEPLOYMENT-GUIDE.md** for detailed deployment instructions including:
- Jenkins and SonarQube server setup
- Configuration and integration steps
- Testing procedures

### Quick Deployment (Primary Region: us-east-2)

**Total time: ~90 minutes (including CI/CD servers)**

```bash
# 1. Deploy Jenkins Server
cd jenkins-server
npm install && npm run build
npm run deploy
# ⏱️  ~15 minutes

# 2. Deploy SonarQube Server
cd ../sonarqube-server
npm install && npm run build
npm run deploy
# ⏱️  ~20 minutes

# 3. Configure Jenkins & SonarQube (see COMPLETE-DEPLOYMENT-GUIDE.md)
# ⏱️  ~15 minutes

# 4. Deploy MySQL Aurora (Primary)
cd ../mysql
npm install && npm run build
export AWS_DEFAULT_REGION=us-east-2
export PRIMARY_REGION=us-east-2
npm run deploy
# ⏱️  ~25 minutes

# 5. Deploy PostgreSQL Aurora (Primary)
cd ../postgres
npm install && npm run build
export AWS_DEFAULT_REGION=us-east-2
export PRIMARY_REGION=us-east-2
npm run deploy
# ⏱️  ~25 minutes

# 6. Deploy EC2 Instances
cd ../ec2-instances
npm install && npm run build
export AWS_DEFAULT_REGION=us-east-2
export EC2_KEY_PAIR_NAME=cdk-keypair
npm run deploy
# ⏱️  ~5 minutes
```

### Deploy Secondary Region (us-west-2) - Optional

**After primary is complete:**

See `GLOBAL-DATABASE-DEPLOYMENT.md` for detailed instructions.

---

## 🔍 Jenkins Pipeline Checks

When you create a PR, Jenkins automatically runs:

| Stage | What It Does | Duration |
|-------|--------------|----------|
| **Checkout** | Clone from GitHub | 10s |
| **Install** | npm install (all stacks) | 2m |
| **Build** | TypeScript compilation | 30s |
| **Security Audit** | npm audit (blocks on high/critical) | 20s |
| **SonarQube Analysis** | Code quality scan | 1m |
| **Quality Gate** | Validate quality standards | 30s |
| **CDK Synth** | Generate CloudFormation | 1m |

**Total: ~5-6 minutes**

---

## 🎯 SonarQube Quality Standards

Your code must meet:
- 🐛 **Bugs**: 0
- 🔒 **Vulnerabilities**: 0
- 💭 **Code Smells**: < 10
- 📊 **Coverage**: > 80%
- 📋 **Duplications**: < 3%

**View reports**: `http://your-sonarqube-url:9000`

**Projects**:
- `cdk-infrastructure-mysql`
- `cdk-infrastructure-postgres`
- `cdk-infrastructure-ec2-instances`

---

## 🔐 Access Resources

### Get Database Credentials

```bash
# MySQL password
aws secretsmanager get-secret-value \
  --secret-id mysql-aurora-credentials \
  --region us-east-2 \
  --query SecretString \
  --output text | jq -r .password

# PostgreSQL password
aws secretsmanager get-secret-value \
  --secret-id postgres-aurora-credentials \
  --region us-east-2 \
  --query SecretString \
  --output text | jq -r .password
```

### Get Stack Outputs

```bash
# MySQL endpoints
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs'

# PostgreSQL endpoints
aws cloudformation describe-stacks \
  --stack-name PostgresAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs'

# EC2 instance IPs
aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs'
```

### Connect to EC2 Instances

```bash
# Option 1: SSM Session Manager (recommended - no SSH key needed)
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`Instance1Id`].OutputValue' \
  --output text)

aws ssm start-session --target $INSTANCE_ID --region us-east-2

# Option 2: SSH (if allowed in security group)
PUBLIC_IP=$(aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`Instance1PublicIp`].OutputValue' \
  --output text)

ssh -i cdk-keypair.pem ec2-user@$PUBLIC_IP
```

### Connect to Databases

**Important**: Databases are in isolated subnets (not publicly accessible).

**Option 1**: Use EC2 as bastion
```bash
# From EC2 instance (via SSM Session Manager)
mysql -h <mysql-endpoint> -P 3306 -u admin -p
psql -h <postgres-endpoint> -p 5432 -U postgres -d mydb
```

**Option 2**: SSM Port Forwarding (recommended)

See `BASTION-HOST-SETUP.md` for detailed instructions.

---

## 💡 Pro Tips

### Before Committing

```bash
# Always build and synth locally first
npm run build
npm run synth

# Check for TypeScript errors
npx tsc --noEmit

# Run security audit
npm audit

# View CloudFormation template
cat cdk.out/*.template.json | jq
```

### Good Commit Messages

```bash
# ✅ Good Examples
git commit -m "feat: increase MySQL buffer pool to 2GB for better caching"
git commit -m "fix: correct security group ingress rule for PostgreSQL"
git commit -m "docs: update deployment guide with new regions"
git commit -m "refactor: extract hard-coded values to configuration"

# ❌ Bad Examples
git commit -m "updates"
git commit -m "fixed stuff"
git commit -m "wip"
git commit -m "changes"
```

### PR Best Practices

- ✅ Keep PRs small (< 500 lines changed)
- ✅ One feature/fix per PR
- ✅ Include description of what and why
- ✅ Link to tickets/issues
- ✅ Request reviews from team members
- ✅ Don't merge your own PRs
- ✅ Wait for all checks to pass

---

## 📊 Common Commands

### Development

```bash
# View stack differences
cd mysql && npm run diff

# Synth CloudFormation template
npm run synth

# Deploy a specific stack
npm run deploy

# Deploy with specific parameters
export CDK_DEFAULT_REGION=us-east-2
npm run deploy -- --require-approval never

# List all stacks
npx cdk list
```

### Monitoring

```bash
# Check stack status
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'

# View CloudWatch logs
aws logs tail /aws/rds/cluster/mysql-primary-cluster/error \
  --follow \
  --region us-east-2

# Check database metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBClusterIdentifier,Value=mysql-primary-cluster \
  --statistics Average \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --region us-east-2
```

### Cleanup

```bash
# Destroy all resources (in reverse order)
cd ec2-instances && npm run destroy
cd ../postgres && npm run destroy
cd ../mysql && npm run destroy

# Note: Databases with deletion protection enabled
# must be modified first to disable protection
```

---

## 🆘 Troubleshooting

### Build Fails

```bash
# Clear node_modules and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build

# If TypeScript errors persist
npx tsc --noEmit  # See detailed errors
```

### Jenkins Shows Red ❌

1. Check Jenkins build logs for detailed error
2. Common issues:
   - Security vulnerabilities (run `npm audit`)
   - SonarQube quality gate (check SonarQube UI)
   - TypeScript compilation errors
   - CDK synth failures
3. Fix issue locally
4. Push new commit (Jenkins re-runs automatically)

### SonarQube Fails

1. View detailed report: `http://sonarqube:9000`
2. Common issues:
   - Code smells > 10
   - Security vulnerabilities
   - Code duplications
3. Fix code quality issues
4. Push new commit

### Deployment Fails

```bash
# Check CloudFormation stack events
aws cloudformation describe-stack-events \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --max-items 10

# View stack outputs (if partially created)
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs'

# Delete failed stack and retry
aws cloudformation delete-stack \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2

# Wait for deletion to complete
aws cloudformation wait stack-delete-complete \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2

# Then redeploy
npm run deploy
```

### Can't Connect to Database

**Issue**: Databases are in isolated subnets

**Solution**:
1. Use EC2 instance as bastion host
2. Or use SSM Port Forwarding

See `BASTION-HOST-SETUP.md` for detailed instructions.

---

## 💰 Cost Estimate

| Resource | Region | Quantity | Monthly Cost |
|----------|--------|----------|--------------|
| **Jenkins Server** | us-east-2 | EC2 t3.medium + NAT Gateway | $67 |
| **SonarQube Server** | us-east-2 | EC2 t3.large + RDS db.t3.small | $124 |
| **MySQL Aurora** | us-east-2 | 2 × db.t3.medium | $120 |
| **PostgreSQL Aurora** | us-east-2 | 2 × db.t3.medium | $120 |
| **EC2 Instances** | us-east-2 | 2 × t3.micro | $12 |
| **NAT Gateways** | us-east-2 | 3 (for databases) | $96 |
| **Data Transfer** | us-east-2 | ~10 GB | $1 |
| **CloudWatch** | us-east-2 | Logs + Alarms | $10 |
| **Secrets Manager** | us-east-2 | 4 secrets | $2 |
| **Total (Primary + CI/CD)** | | | **~$552/month** |

**Note**: Add ~$307/month if deploying secondary region (total: ~$859/month).

**Cost Optimization**:
- **Stop Jenkins & SonarQube when not in use**: Save ~$170/month (storage-only ~$10)
- Use Reserved Instances (save ~40% on databases and EC2)
- Use Aurora Serverless v2 for variable workloads
- Remove NAT gateways if not needed (use VPC endpoints)
- Right-size instances based on actual usage
- **Development environment**: Stop resources after hours: ~$180/month

---

## 📞 Getting Help

### Documentation

| File | When to Use |
|------|-------------|
| `QUICK-START.md` | ⭐ **Start here** - Daily workflow |
| `COMPLETE-DEPLOYMENT-GUIDE.md` | 🚀 **Full deployment** - Step-by-step setup |
| `jenkins-server/README.md` | Jenkins server deployment and configuration |
| `sonarqube-server/README.md` | SonarQube server deployment and configuration |
| `IMPLEMENTATION-SUMMARY.md` | Overview of all changes and features |
| `GITHUB-JENKINS-WORKFLOW.md` | Detailed PR and CI/CD process |
| `HOW-IT-WORKS-GUIDE.md` | Deep dive - how everything works |
| `GLOBAL-DATABASE-DEPLOYMENT.md` | Multi-region deployment guide |
| `BASTION-HOST-SETUP.md` | Database access methods |
| `CODE-REVIEW-IMPROVEMENTS.md` | Security and quality improvements |

### Support Channels

- **GitHub Issues**: Report bugs or request features
- **Team Chat**: #infrastructure channel
- **DevOps Team**: For urgent deployment issues
- **AWS Support**: For AWS-specific issues

---

## ✅ Checklist

### Initial Setup
- [ ] AWS CLI configured with credentials
- [ ] CDK bootstrapped in us-east-2 (and us-west-2 for global databases)
- [ ] EC2 key pair created
- [ ] Repository cloned
- [ ] .env file created and configured
- [ ] GitHub personal access token generated
- [ ] IP addresses configured for Jenkins and SonarQube access

### Before First Deployment
- [ ] Review all stack code
- [ ] Configure cost allocation tags
- [ ] Set up AWS budget alerts
- [ ] Review security groups
- [ ] Plan backup strategy

### After Deployment
- [ ] Verify all stacks deployed successfully
- [ ] Test database connectivity
- [ ] Check CloudWatch alarms
- [ ] Review SonarQube reports
- [ ] Document access procedures for team

---

## 🎯 Next Steps

1. ✅ Deploy primary region (us-east-2)
2. ✅ Verify all resources created
3. ✅ Set up monitoring dashboards
4. ✅ Configure alerting (SNS topics)
5. ✅ Deploy secondary region (optional)
6. ✅ Test disaster recovery procedures
7. ✅ Train team on workflow
8. ✅ Set up automated backups testing

---

**Remember**:
- ✅ Create PRs **manually** on GitHub
- ✅ Jenkins runs checks **automatically**
- ✅ All checks must **pass** before merge
- ✅ Deployment requires **manual approval**
- ✅ Always **test locally** first!

---

**Last Updated**: 2025-11-13
**Version**: 2.0
