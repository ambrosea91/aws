# CDK Infrastructure with CI/CD Pipeline

This project contains AWS CDK infrastructure code with automated CI/CD pipelines using Jenkins and GitHub Actions. The infrastructure is split into three main components:

1. **MySQL** - Aurora MySQL Global Database
2. **PostgreSQL** - Aurora PostgreSQL Global Database
3. **EC2 Instances** - EC2 instances with VPC, Security Groups, and networking

## Project Structure

```
cdk-infrastructure/
├── mysql/                      # Aurora MySQL Global Database stack
│   ├── bin/
│   │   └── mysql-aurora.ts     # CDK app entry point
│   ├── lib/
│   │   └── mysql-aurora-stack.ts # MySQL Aurora stack definition
│   ├── cdk.json                # CDK configuration
│   ├── package.json            # Node.js dependencies
│   └── tsconfig.json           # TypeScript configuration
│
├── postgres/                   # Aurora PostgreSQL Global Database stack
│   ├── bin/
│   │   └── postgres-aurora.ts  # CDK app entry point
│   ├── lib/
│   │   └── postgres-aurora-stack.ts # PostgreSQL Aurora stack definition
│   ├── cdk.json                # CDK configuration
│   ├── package.json            # Node.js dependencies
│   └── tsconfig.json           # TypeScript configuration
│
├── ec2-instances/              # EC2 instances stack
│   ├── bin/
│   │   └── ec2-instances.ts    # CDK app entry point
│   ├── lib/
│   │   └── ec2-stack.ts        # EC2 stack definition
│   ├── cdk.json                # CDK configuration
│   ├── package.json            # Node.js dependencies
│   └── tsconfig.json           # TypeScript configuration
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # GitHub Actions workflow
│
├── Jenkinsfile                 # Jenkins pipeline definition
├── setup.sh                    # Setup script
├── SETUP-GUIDE.md             # Detailed setup guide
└── README.md                   # This file
```

## Prerequisites

- Node.js 20.x or later
- AWS CLI configured with appropriate credentials
- AWS CDK CLI installed (`npm install -g aws-cdk`)
- Git
- Jenkins server (for Jenkins pipeline) OR GitHub repository (for GitHub Actions)

## Infrastructure Components

### MySQL Aurora Stack

Creates an Aurora MySQL Global Database with:
- Aurora MySQL 3.04.0 (MySQL 8.0 compatible)
- Multi-region replication capability (Primary + Secondary regions)
- VPC with public, private, and isolated subnets
- T3.medium instances (1 writer, 1 reader in primary)
- Automated backups (7-day retention)
- Point-in-time recovery
- Encryption at rest
- CloudWatch Logs integration
- Deletion protection
- Secrets Manager for credentials

### PostgreSQL Aurora Stack

Creates an Aurora PostgreSQL Global Database with:
- Aurora PostgreSQL 15.4
- Multi-region replication capability (Primary + Secondary regions)
- VPC with public, private, and isolated subnets
- T3.medium instances (1 writer, 1 reader in primary)
- Automated backups (7-day retention)
- Point-in-time recovery
- Encryption at rest
- CloudWatch Logs integration
- Deletion protection
- Secrets Manager for credentials

### EC2 Stack

Creates EC2 infrastructure with:
- VPC with public and private subnets across 2 AZs
- 2 EC2 instances (t3.micro) running Amazon Linux 2023
- Security Group with HTTP, HTTPS, and SSH access
- IAM roles with SSM and CloudWatch permissions
- User data script to install and configure Apache web server
- NAT Gateway for private subnet internet access

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-github-repo-url>
cd cdk-infrastructure
```

### 2. Install Dependencies

```bash
# Use the setup script (Linux/Mac)
chmod +x setup.sh
./setup.sh

# Or install manually
cd mysql && npm install && cd ..
cd postgres && npm install && cd ..
cd ec2-instances && npm install && cd ..
```

### 3. Configure AWS Credentials

```bash
aws configure
```

Or set environment variables:
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=us-east-1
```

### 4. Bootstrap CDK (First Time Only)

```bash
# Bootstrap primary region
cdk bootstrap aws://ACCOUNT-ID/us-east-1

# Bootstrap secondary region (for global databases)
cdk bootstrap aws://ACCOUNT-ID/eu-west-1
```

### 5. Deploy Stacks Manually

```bash
# Deploy MySQL Aurora stack (primary region)
cd mysql
npm run deploy:primary

# Deploy PostgreSQL Aurora stack (primary region)
cd ../postgres
npm run deploy:primary

# Deploy EC2 stack
cd ../ec2-instances
export EC2_KEY_PAIR_NAME=your-key-pair-name
npm run deploy
```

## CI/CD Pipeline Setup

### Option 1: Jenkins Pipeline

#### Jenkins Configuration

1. **Install Required Plugins:**
   - Pipeline
   - Git
   - NodeJS
   - AWS Steps
   - GitHub Integration
   - Email Extension

2. **Configure Jenkins Credentials:**
   - `aws-account-id` - AWS Account ID
   - `aws-access-key-id` - AWS Access Key
   - `aws-secret-access-key` - AWS Secret Key
   - `github-token` - GitHub Personal Access Token
   - `ec2-key-pair-name` - EC2 Key Pair Name

3. **Configure NodeJS:**
   - Go to Manage Jenkins → Global Tool Configuration
   - Add NodeJS 20.x installation named `NodeJS-20`

4. **Create Pipeline Job:**
   - New Item → Pipeline
   - Configure GitHub repository
   - Set Pipeline script from SCM
   - Select Git and enter repository URL
   - Script Path: `Jenkinsfile`

5. **Configure Webhook (Optional):**
   - In GitHub repository settings, add webhook
   - Payload URL: `http://your-jenkins-url/github-webhook/`
   - Content type: `application/json`
   - Events: Push events, Pull requests

#### Pipeline Behavior

- **Feature Branches**: Builds, tests, and creates a pull request to master
- **Master Branch**: Builds, tests, and deploys to AWS (requires manual approval)

### Option 2: GitHub Actions

#### GitHub Configuration

1. **Add Repository Secrets:**
   - Go to Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `AWS_ACCESS_KEY_ID`
     - `AWS_SECRET_ACCESS_KEY`
     - `AWS_ACCOUNT_ID`
     - `EC2_KEY_PAIR_NAME`

2. **Enable GitHub Actions:**
   - The workflow file is already in `.github/workflows/ci-cd.yml`
   - Actions will run automatically on push and pull requests

3. **Configure Branch Protection (Recommended):**
   - Go to Settings → Branches
   - Add rule for `master` branch
   - Enable "Require status checks to pass"
   - Select the CI/CD workflow

#### Workflow Behavior

- **Feature Branches**: Builds, tests, synths CDK, and creates PR automatically
- **Pull Requests**: Runs build and test
- **Master Branch**: Builds, tests, and deploys to AWS production environment

## Usage

### Manual Deployment

```bash
# Synth CloudFormation templates
cd mysql && npm run synth
cd ../postgres && npm run synth
cd ../ec2-instances && npm run synth

# View differences
cd mysql && npm run diff

# Deploy
cd mysql && npm run deploy
cd ../postgres && npm run deploy
cd ../ec2-instances && npm run deploy
```

### Automated Deployment

1. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make Changes:**
   - Edit CDK code in `mysql/lib/`, `postgres/lib/`, or `ec2-instances/lib/`
   - Commit your changes

3. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin feature/my-new-feature
   ```

4. **Automated Actions:**
   - Jenkins/GitHub Actions will automatically build and test
   - A pull request will be created automatically
   - Review the PR and merge to master
   - Deployment to AWS will trigger on master merge

## Monitoring and Troubleshooting

### Access Database Credentials

```bash
# MySQL credentials
aws secretsmanager get-secret-value \
  --secret-id mysql-aurora-credentials \
  --query SecretString --output text

# PostgreSQL credentials
aws secretsmanager get-secret-value \
  --secret-id postgres-aurora-credentials \
  --query SecretString --output text
```

### Common Issues

**Issue: CDK bootstrap not done**
```bash
Error: This stack uses assets, so the toolkit stack must be deployed
```
**Solution:**
```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

**Issue: Missing EC2 key pair**
```bash
Error: Key pair 'xxx' does not exist
```
**Solution:**
Create an EC2 key pair in AWS console or via CLI:
```bash
aws ec2 create-key-pair --key-name my-key --query 'KeyMaterial' --output text > my-key.pem
chmod 400 my-key.pem
export EC2_KEY_PAIR_NAME=my-key
```

## Deploying Secondary Region for Global Databases

For multi-region disaster recovery:

1. Edit `mysql/bin/mysql-aurora.ts` and `postgres/bin/postgres-aurora.ts`
2. Uncomment the secondary stack code
3. Deploy:
```bash
export SECONDARY_REGION=eu-west-1
cd mysql && npm run deploy:secondary
cd ../postgres && npm run deploy:secondary
```

## Cleanup

```bash
# Destroy in reverse order
cd ec2-instances && npm run destroy
cd ../postgres && npm run destroy
cd ../mysql && npm run destroy
```

## Security Considerations

1. **Credentials:** Never commit AWS credentials to Git
2. **Database Access:** Databases are in isolated subnets - use VPN/bastion host
3. **Security Groups:** EC2 allows SSH from 0.0.0.0/0 - restrict in production
4. **Secrets:** Database credentials stored in AWS Secrets Manager
5. **Deletion Protection:** Enabled on Aurora clusters - disable before destroy

## Cost Estimation

Approximate monthly costs (us-east-1):
- MySQL Aurora (2x t3.medium): ~$110/month
- PostgreSQL Aurora (2x t3.medium): ~$110/month
- EC2 instances (2x t3.micro): ~$15/month
- NAT Gateways (2): ~$65/month
- **Total**: ~$300/month

## License

MIT License

## Support

See [SETUP-GUIDE.md](SETUP-GUIDE.md) for detailed setup instructions.
