# Complete GitHub + Jenkins Workflow Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup Instructions](#setup-instructions)
4. [Development Workflow](#development-workflow)
5. [CI/CD Pipeline Details](#cicd-pipeline-details)
6. [SonarQube Configuration](#sonarqube-configuration)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This project implements a complete CI/CD workflow for AWS CDK infrastructure deployment with:

- **Source Control**: GitHub
- **CI/CD**: Jenkins (primary) + GitHub Actions (alternative)
- **Code Quality**: SonarQube scanning
- **Security**: npm audit with blocking on high/critical vulnerabilities
- **Deployment**: Aurora MySQL (Global), Aurora PostgreSQL (Global), EC2 instances
- **Regions**: Primary (us-east-2), Secondary (us-west-2)

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      DEVELOPER                                │
└───────────────────┬──────────────────────────────────────────┘
                    │
          ┌─────────▼─────────┐
          │  GitHub Repo      │
          │  (Source of Truth)│
          └─────┬────────┬────┘
                │        │
      ┌─────────▼────┐   │
      │  Pull Request│   │
      └─────┬────────┘   │
            │            │
    ┌───────▼────────────▼────────┐
    │     Jenkins Pipeline        │
    │  1. Build                   │
    │  2. Security Scan           │
    │  3. SonarQube Analysis      │
    │  4. CDK Synth               │
    │  5. Create PR (auto)        │
    └────────┬────────────────────┘
             │
       PR Reviewed & Merged
             │
    ┌────────▼────────────────────┐
    │  Deploy to AWS              │
    │  - MySQL (us-east-2)        │
    │  - PostgreSQL (us-east-2)   │
    │  - EC2 (us-east-2)          │
    └─────────────────────────────┘
```

---

## 🛠️ Prerequisites

### 1. GitHub Repository Setup

```bash
# Create a new repository on GitHub
# Repository name: cdk-infrastructure (or your choice)
# Visibility: Private (recommended)

# Clone the repository
git clone https://github.com/your-org/cdk-infrastructure.git
cd cdk-infrastructure

# Copy your CDK project files
cp -r /path/to/cdk/* .

# Create .gitignore
cat > .gitignore <<EOF
# Dependencies
node_modules/
.pnp
.pnp.js

# CDK
*.js
*.js.map
*.d.ts
cdk.out/
.cdk.staging/

# Environment
.env
.env.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Test coverage
coverage/

# Build artifacts
dist/
build/
EOF

# Initial commit
git add .
git commit -m "Initial commit: CDK infrastructure with CI/CD"
git push origin master
```

### 2. GitHub Secrets Configuration

Navigate to: **Settings → Secrets and variables → Actions → New repository secret**

Add the following secrets:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AWS_ACCESS_KEY_ID` | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_ACCOUNT_ID` | AWS account ID | `123456789012` |
| `EC2_KEY_PAIR_NAME` | EC2 key pair name | `my-keypair` |
| `SONAR_TOKEN` | SonarQube authentication token | `squ_xxxxxxxxxxxx` |
| `SONAR_HOST_URL` | SonarQube server URL | `https://sonarqube.company.com` |

### 3. Jenkins Setup

#### Install Jenkins

```bash
# On Ubuntu/Debian
wget -q -O - https://pkg.jenkins.io/debian-stable/jenkins.io.key | sudo apt-key add -
sudo sh -c 'echo deb https://pkg.jenkins.io/debian-stable binary/ > /etc/apt/sources.list.d/jenkins.list'
sudo apt update
sudo apt install jenkins openjdk-11-jdk

# Start Jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins

# Get initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

#### Install Required Jenkins Plugins

Navigate to: **Manage Jenkins → Manage Plugins → Available**

Install:
- ✅ **Git plugin** - Git SCM integration
- ✅ **GitHub plugin** - GitHub integration
- ✅ **Pipeline** - Pipeline support
- ✅ **NodeJS plugin** - Node.js installations
- ✅ **AWS Steps plugin** - AWS CLI integration
- ✅ **SonarQube Scanner** - SonarQube integration
- ✅ **Blue Ocean** - Modern UI (optional)

#### Configure Jenkins Tools

**Configure Node.js:**
1. Go to: **Manage Jenkins → Global Tool Configuration**
2. Find **NodeJS** section
3. Click **Add NodeJS**
   - Name: `NodeJS-20`
   - Version: `NodeJS 20.x`
   - Install automatically: ✅

**Configure SonarQube:**
1. Go to: **Manage Jenkins → Configure System**
2. Find **SonarQube servers** section
3. Click **Add SonarQube**
   - Name: `SonarQube`
   - Server URL: `http://sonarqube:9000` (or your SonarQube URL)
   - Server authentication token: Select from credentials

#### Add Jenkins Credentials

Navigate to: **Manage Jenkins → Manage Credentials → (global) → Add Credentials**

Add the following credentials:

| ID | Type | Description |
|----|------|-------------|
| `aws-account-id` | Secret text | AWS Account ID |
| `aws-access-key-id` | Secret text | AWS Access Key |
| `aws-secret-access-key` | Secret text | AWS Secret Key |
| `github-token` | Secret text | GitHub Personal Access Token |
| `ec2-key-pair-name` | Secret text | EC2 Key Pair Name |
| `sonar-token` | Secret text | SonarQube Token |
| `sonarqube-url` | Secret text | SonarQube URL |

#### Create Jenkins Pipeline Job

1. Navigate to: **New Item**
2. Enter name: `cdk-infrastructure`
3. Select: **Multibranch Pipeline**
4. Click **OK**

**Configure Pipeline:**

- **Branch Sources:**
  - Add source: **Git** or **GitHub**
  - Repository URL: `https://github.com/your-org/cdk-infrastructure.git`
  - Credentials: Select your GitHub token
  - Behaviors: Discover branches, Discover pull requests from origin

- **Build Configuration:**
  - Mode: **by Jenkinsfile**
  - Script Path: `Jenkinsfile`

- **Scan Multibranch Pipeline Triggers:**
  - ✅ Periodically if not otherwise run
  - Interval: `1 minute` (or your preference)

- **Orphaned Item Strategy:**
  - Days to keep old items: `7`
  - Max # of old items to keep: `10`

Click **Save**

---

## 🚀 Development Workflow

### Complete Step-by-Step Process

#### Step 1: Clone Repository

```bash
# Clone from GitHub
git clone https://github.com/your-org/cdk-infrastructure.git
cd cdk-infrastructure

# Example: Work on MySQL stack
cd mysql
```

#### Step 2: Create Feature Branch

```bash
# Create and switch to feature branch
git checkout -b feature/add-database-parameter

# Naming conventions:
# - feature/description - New features
# - fix/description - Bug fixes
# - refactor/description - Code refactoring
# - docs/description - Documentation updates
```

#### Step 3: Make Changes

```bash
# Edit files (e.g., lib/mysql-aurora-stack.ts)
# Add new parameter or modify configuration

# Install dependencies
npm install

# Build to check for TypeScript errors
npm run build

# Test locally (optional)
npm run synth
```

**Example Change:** Add a new database parameter

```typescript
// lib/mysql-aurora-stack.ts
const parameterGroup = new rds.ParameterGroup(this, 'MysqlParameterGroup', {
  engine: rds.DatabaseClusterEngine.auroraMysql({
    version: rds.AuroraMysqlEngineVersion.VER_3_04_0,
  }),
  description: 'Custom parameter group for MySQL Aurora',
  parameters: {
    character_set_server: 'utf8mb4',
    collation_server: 'utf8mb4_unicode_ci',
    max_connections: '1000',
    slow_query_log: '1',
    long_query_time: '2',
    // NEW PARAMETER
    innodb_buffer_pool_size: '2147483648', // 2GB
  },
});
```

#### Step 4: Commit Changes

```bash
# Add changed files
git add lib/mysql-aurora-stack.ts

# Commit with descriptive message
git commit -m "feat: add innodb_buffer_pool_size parameter for MySQL

- Increase buffer pool to 2GB
- Improves query caching performance
- Related to ticket #123"

# Git commit message best practices:
# - Use present tense ("add" not "added")
# - First line: brief description (max 50 chars)
# - Blank line
# - Detailed description (wrap at 72 chars)
```

#### Step 5: Push to GitHub

```bash
# Push feature branch to GitHub
git push origin feature/add-database-parameter

# Output:
# Enumerating objects: 7, done.
# Counting objects: 100% (7/7), done.
# ...
# To https://github.com/your-org/cdk-infrastructure.git
#  * [new branch]      feature/add-database-parameter -> feature/add-database-parameter
```

#### Step 6: Jenkins Automatically Triggers

Once you push, Jenkins will automatically:

```
┌─────────────────────────────────────────────┐
│  Jenkins Pipeline - Automatic Execution     │
├─────────────────────────────────────────────┤
│  ✅ Checkout code from GitHub               │
│  ✅ Install dependencies (npm install)      │
│  ✅ Build TypeScript (npm run build)        │
│  ✅ Run security audit (npm audit)          │
│  ✅ SonarQube code analysis                 │
│  ✅ Check quality gate                      │
│  ✅ CDK synthesize (npm run synth)          │
│  ✅ Create Pull Request automatically       │
└─────────────────────────────────────────────┘

Total time: ~5-10 minutes
```

**Monitor Jenkins:**
1. Go to Jenkins UI: `http://your-jenkins-url`
2. Find your job: `cdk-infrastructure`
3. Click on branch: `feature/add-database-parameter`
4. View build progress and logs

#### Step 7: Auto-Generated Pull Request

Jenkins automatically creates a PR on GitHub with:

**Title:** `🚀 [feature/add-database-parameter] Infrastructure Changes`

**Body:**
```markdown
## 🔄 Automated Pull Request

**Author:** Your Name
**Branch:** `feature/add-database-parameter`
**Build:** [#42](http://jenkins/job/cdk-infrastructure/42)
**Commit:** feat: add innodb_buffer_pool_size parameter for MySQL

---

### ✅ Build Status

| Check | Status |
|-------|--------|
| TypeScript Build | ✅ Passed |
| Security Audit | ✅ Passed |
| SonarQube Analysis | ✅ Passed |
| Quality Gate | ✅ Passed |
| CDK Synth | ✅ Passed |

---

### 📦 CDK Stacks

- ✅ **MySQL Aurora Stack**: Synthesized successfully (us-east-2)
- ✅ **PostgreSQL Aurora Stack**: Synthesized successfully (us-east-2)
- ✅ **EC2 Stack**: Synthesized successfully (us-east-2)

---

### 📊 SonarQube Reports

- [MySQL Stack Analysis](http://sonarqube/dashboard?id=cdk-infrastructure-mysql)
- [PostgreSQL Stack Analysis](http://sonarqube/dashboard?id=cdk-infrastructure-postgres)
- [EC2 Stack Analysis](http://sonarqube/dashboard?id=cdk-infrastructure-ec2-instances)

---

*🤖 This PR was automatically created by Jenkins CI/CD Pipeline*
```

#### Step 8: Review Pull Request

**On GitHub:**
1. Navigate to: **Pull Requests** tab
2. Click on the auto-generated PR
3. Review:
   - ✅ Code changes (Files changed tab)
   - ✅ Build status (All checks passed)
   - ✅ SonarQube quality metrics
4. Request reviews from team members (optional)
5. Add comments or questions

**Example Review Comments:**
```
Reviewer: "Why increase buffer pool to 2GB? What's the expected performance improvement?"
You: "Based on our monitoring, we're seeing high disk I/O. 2GB buffer pool should
     cache 80% of our hot data based on current DB size of 2.5GB."
```

#### Step 9: Merge Pull Request

Once approved:

1. Click **Merge pull request**
2. Select merge method:
   - **Create a merge commit** (recommended)
   - Squash and merge
   - Rebase and merge
3. Click **Confirm merge**
4. Optionally delete the feature branch

#### Step 10: Automatic Deployment

**When merged to master, Jenkins automatically:**

```
┌──────────────────────────────────────────────────────┐
│  Jenkins Deployment Pipeline                         │
├──────────────────────────────────────────────────────┤
│  🔐 Manual Approval Required                         │
│     → Approve deployment to production               │
│                                                       │
│  📦 Deploy MySQL Stack (us-east-2)                   │
│     ⏱️  ~25 minutes                                  │
│     ✅ MysqlAuroraPrimaryStack CREATE_COMPLETE       │
│                                                       │
│  📦 Deploy PostgreSQL Stack (us-east-2)              │
│     ⏱️  ~25 minutes                                  │
│     ✅ PostgresAuroraPrimaryStack CREATE_COMPLETE    │
│                                                       │
│  📦 Deploy EC2 Stack (us-east-2)                     │
│     ⏱️  ~5 minutes                                   │
│     ✅ Ec2Stack CREATE_COMPLETE                      │
│                                                       │
│  🔍 Post-Deployment Verification                     │
│     → Check stack outputs                            │
│     → Verify resources created                       │
│                                                       │
│  ✅ DEPLOYMENT SUCCESSFUL!                           │
└──────────────────────────────────────────────────────┘

Total deployment time: ~55 minutes
```

**Deployment Approval:**
- Go to Jenkins build page
- Click **Proceed** to approve deployment
- Only users with `admin` or `devops` roles can approve

#### Step 11: Verify Deployment

```bash
# Check CloudFormation stacks
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].StackStatus'

# Output: "UPDATE_COMPLETE"

# Get updated stack outputs
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs'

# Verify parameter change
aws rds describe-db-cluster-parameters \
  --db-cluster-parameter-group-name <parameter-group-name> \
  --region us-east-2 \
  --query 'Parameters[?ParameterName==`innodb_buffer_pool_size`]'
```

---

## 🔄 CI/CD Pipeline Details

### Jenkins Pipeline Stages

```groovy
┌───────────────────────────────────────────────────────────┐
│ Stage 1: Checkout                                         │
│ - Clone repository from GitHub                            │
│ - Checkout specific branch                                │
│ Duration: ~10 seconds                                     │
└───────────────────────────────────────────────────────────┘
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 2-4: Install Dependencies (Parallel)                │
│ - MySQL: npm install                                      │
│ - PostgreSQL: npm install                                 │
│ - EC2: npm install                                        │
│ Duration: ~2 minutes                                      │
└───────────────────────────────────────────────────────────┘
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 5-7: Build (Parallel)                               │
│ - MySQL: tsc (TypeScript compile)                         │
│ - PostgreSQL: tsc                                         │
│ - EC2: tsc                                                │
│ Duration: ~30 seconds                                     │
└───────────────────────────────────────────────────────────┘
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 8-10: CDK Synth (Parallel)                          │
│ - MySQL: cdk synth → CloudFormation template             │
│ - PostgreSQL: cdk synth → CloudFormation template         │
│ - EC2: cdk synth → CloudFormation template               │
│ Duration: ~1 minute                                       │
└───────────────────────────────────────────────────────────┘
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 11: Security Scan                                   │
│ - npm audit --audit-level=high (all stacks)              │
│ - FAILS if high/critical vulnerabilities found           │
│ Duration: ~20 seconds                                     │
└───────────────────────────────────────────────────────────┘
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 12: SonarQube Analysis                              │
│ - Code quality analysis (all stacks)                      │
│ - Checks: bugs, vulnerabilities, code smells              │
│ - Coverage: code complexity, duplications                 │
│ Duration: ~1 minute                                       │
└───────────────────────────────────────────────────────────┘
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 13: SonarQube Quality Gate                          │
│ - Wait for analysis to complete                           │
│ - Check if quality standards met                          │
│ - FAILS if quality gate not passed                        │
│ Duration: ~30 seconds                                     │
└───────────────────────────────────────────────────────────┘
              ↓
         [If NOT master]
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 14: Create Pull Request                             │
│ - Auto-create PR on GitHub                                │
│ - Add build status, SonarQube links                       │
│ - Add labels: automated, infrastructure                   │
│ Duration: ~10 seconds                                     │
└───────────────────────────────────────────────────────────┘

         [If master]
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 15: Deploy to AWS                                   │
│ - Manual approval required (30 min timeout)               │
│ - Deploy MySQL to us-east-2                               │
│ - Deploy PostgreSQL to us-east-2                          │
│ - Deploy EC2 to us-east-2                                 │
│ Duration: ~55 minutes (after approval)                    │
└───────────────────────────────────────────────────────────┘
              ↓
┌───────────────────────────────────────────────────────────┐
│ Stage 16: Post-Deployment Verification                    │
│ - Get stack outputs                                       │
│ - Verify resource status                                  │
│ - Log endpoints and connection info                       │
│ Duration: ~30 seconds                                     │
└───────────────────────────────────────────────────────────┘
```

### Environment Variables

```groovy
environment {
    AWS_DEFAULT_REGION = 'us-east-2'
    PRIMARY_REGION = 'us-east-2'
    SECONDARY_REGION = 'us-west-2'
    AWS_ACCOUNT_ID = credentials('aws-account-id')
    AWS_ACCESS_KEY_ID = credentials('aws-access-key-id')
    AWS_SECRET_ACCESS_KEY = credentials('aws-secret-access-key')
    GITHUB_TOKEN = credentials('github-token')
    EC2_KEY_PAIR_NAME = credentials('ec2-key-pair-name')
    SONARQUBE_URL = credentials('sonarqube-url')
    SONAR_TOKEN = credentials('sonar-token')
    SONAR_PROJECT_KEY = 'cdk-infrastructure'
}
```

---

## 📊 SonarQube Configuration

### Install SonarQube (Docker)

```bash
# Run SonarQube in Docker
docker run -d --name sonarqube \
  -p 9000:9000 \
  -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
  sonarqube:latest

# Access SonarQube
# URL: http://localhost:9000
# Default credentials: admin/admin
# Change password on first login
```

### Create SonarQube Project

1. Login to SonarQube
2. Click **Create Project**
3. Project settings:
   - **Project key**: `cdk-infrastructure-mysql`
   - **Display name**: `CDK Infrastructure - MySQL`
4. Repeat for:
   - `cdk-infrastructure-postgres`
   - `cdk-infrastructure-ec2-instances`

### Generate SonarQube Token

1. Navigate to: **My Account → Security → Generate Tokens**
2. Token name: `jenkins-scanner`
3. Type: **User Token**
4. Expires in: **No expiration**
5. Click **Generate**
6. **Copy the token** (shown only once!)
7. Add to Jenkins credentials as `sonar-token`

### Configure Quality Gate

1. Navigate to: **Quality Gates → Create**
2. Name: `CDK Infrastructure`
3. Add conditions:
   - **Bugs**: is greater than `0` → FAIL
   - **Vulnerabilities**: is greater than `0` → FAIL
   - **Code Smells**: is greater than `10` → FAIL
   - **Coverage**: is less than `80%` → WARN
   - **Duplicated Lines (%)**: is greater than `3%` → WARN

4. Set as default quality gate

---

## 🔧 Troubleshooting

### Common Issues

#### Issue 1: Jenkins Pipeline Fails on npm install

**Error:**
```
npm ERR! code EACCES
npm ERR! syscall access
npm ERR! path /var/lib/jenkins/.npm
npm ERR! errno -13
```

**Solution:**
```bash
# Fix permissions
sudo chown -R jenkins:jenkins /var/lib/jenkins/.npm
sudo chown -R jenkins:jenkins /var/lib/jenkins/workspace
```

#### Issue 2: SonarQube Quality Gate Timeout

**Error:**
```
Timeout waiting for SonarQube analysis to complete
```

**Solution:**
- Increase timeout in Jenkinsfile: `timeout(time: 10, unit: 'MINUTES')`
- Check SonarQube server status
- Verify SonarQube webhook configuration

#### Issue 3: GitHub PR Creation Fails

**Error:**
```
gh pr create: authentication failed
```

**Solution:**
```bash
# Verify GitHub token has correct permissions:
# - repo (full control)
# - workflow

# Test token manually:
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/user
```

#### Issue 4: CDK Deploy Fails - Insufficient Permissions

**Error:**
```
User: arn:aws:iam::123456789012:user/jenkins is not authorized
to perform: cloudformation:CreateStack
```

**Solution:**
Create IAM policy for Jenkins user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "ec2:*",
        "rds:*",
        "secretsmanager:*",
        "iam:*",
        "cloudwatch:*",
        "logs:*"
      ],
      "Resource": "*"
    }
  ]
}
```

#### Issue 5: Deployment Approval Timeout

**Error:**
```
Timeout waiting for input
```

**Solution:**
- Increase approval timeout: `timeout(time: 60, unit: 'MINUTES')`
- Check Jenkins notification settings
- Ensure approvers have correct permissions

---

## 📝 Best Practices

### 1. Branch Naming

```
feature/feature-name     # New features
fix/bug-description      # Bug fixes
hotfix/critical-fix      # Production hotfixes
refactor/component-name  # Code refactoring
docs/documentation-update # Documentation
```

### 2. Commit Messages

```bash
# Format: <type>: <subject>
#
# <body>
#
# <footer>

# Types:
# - feat: New feature
# - fix: Bug fix
# - docs: Documentation
# - style: Formatting, missing semicolons
# - refactor: Code restructuring
# - test: Adding tests
# - chore: Maintenance tasks

# Example:
feat: add RDS read replica for improved performance

- Add reader endpoint configuration
- Update CloudWatch alarms for replica lag
- Document replica failover process

Closes #123
```

### 3. Pull Request Guidelines

- **Title**: Clear, descriptive, include ticket number
- **Description**: What, why, how
- **Labels**: bug, enhancement, documentation
- **Reviewers**: Assign at least 1 reviewer
- **Size**: Keep PRs small (< 500 lines changed)
- **Tests**: Include test results or validation

### 4. Code Review Checklist

- [ ] Code follows project style guide
- [ ] TypeScript compiles without errors
- [ ] No hard-coded values (use configuration)
- [ ] CloudFormation templates validated
- [ ] Security best practices followed
- [ ] Documentation updated
- [ ] SonarQube quality gate passed

---

## 🎓 Learning Resources

### AWS CDK
- [Official CDK Workshop](https://cdkworkshop.com/)
- [CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)
- [CDK Examples](https://github.com/aws-samples/aws-cdk-examples)

### Jenkins
- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)

### SonarQube
- [SonarQube Docs](https://docs.sonarqube.org/latest/)
- [Quality Gates](https://docs.sonarqube.org/latest/user-guide/quality-gates/)

---

## 📞 Support

- **GitHub Issues**: Report bugs or request features
- **Documentation**: See README.md, SETUP-GUIDE.md, HOW-IT-WORKS-GUIDE.md
- **Team Chat**: #infrastructure channel

---

**Last Updated**: 2025-11-13
**Version**: 2.0
