# Complete Guide: How It Runs, How to Run It, and Components Involved

## 📋 **TABLE OF CONTENTS**

1. [How It Runs - The Execution Flow](#how-it-runs)
2. [How to Run It - Step-by-Step Guide](#how-to-run-it)
3. [Components Involved - Complete Breakdown](#components-involved)

---

# 🔄 **PART 1: HOW IT RUNS**

## The Complete Execution Flow

### **Step-by-Step Execution When You Run `npm run deploy`**

```bash
cd mysql
npm run deploy
```

Here's what happens under the hood:

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: npm run deploy                                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    package.json: "deploy": "cdk deploy"
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: CDK CLI reads cdk.json                                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    {
      "app": "npx ts-node bin/mysql-aurora.ts"
    }
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: ts-node executes bin/mysql-aurora.ts                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    const app = new cdk.App();  ← Creates CDK application
                            ↓
    new MysqlAuroraStack(app, 'MysqlAuroraPrimaryStack', {...});
    ↓                       ← Instantiates the stack
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Stack constructor runs (lib/mysql-aurora-stack.ts)      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    Creates resources:
    - VPC (Virtual Private Cloud)
    - Subnets (Public, Private, Isolated)
    - Security Groups (Firewalls)
    - Secrets Manager (Database password)
    - RDS Aurora Cluster (Database)
    - CloudWatch Alarms (Monitoring)
    - CfnOutputs (Results to show user)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: app.synth() generates CloudFormation template           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    TypeScript/JavaScript objects → JSON template

    Saved to: mysql/cdk.out/MysqlAuroraPrimaryStack.template.json
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: CDK compares with existing AWS resources (cdk diff)     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    Shows what will be created/updated/deleted
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Asks for confirmation                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    "Do you wish to deploy these changes (y/n)?"
                            ↓
    User types: y
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: CDK sends CloudFormation template to AWS                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    AWS CloudFormation Service receives the template
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 9: CloudFormation creates resources IN ORDER               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    [1/15] Creating VPC...                       ✓ Complete (30s)
    [2/15] Creating Public Subnet 1...           ✓ Complete (20s)
    [3/15] Creating Public Subnet 2...           ✓ Complete (20s)
    [4/15] Creating Private Subnet 1...          ✓ Complete (20s)
    [5/15] Creating Private Subnet 2...          ✓ Complete (20s)
    [6/15] Creating Isolated Subnet 1...         ✓ Complete (20s)
    [7/15] Creating Isolated Subnet 2...         ✓ Complete (20s)
    [8/15] Creating NAT Gateway...               ✓ Complete (120s)
    [9/15] Creating Security Group...            ✓ Complete (10s)
    [10/15] Creating Secrets Manager Secret...   ✓ Complete (15s)
    [11/15] Creating RDS Subnet Group...         ✓ Complete (10s)
    [12/15] Creating Aurora Cluster...           ✓ Complete (180s)
    [13/15] Creating Writer Instance...          ✓ Complete (300s)
    [14/15] Creating Reader Instance...          ✓ Complete (300s)
    [15/15] Creating CloudWatch Alarms...        ✓ Complete (10s)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 10: CloudFormation returns Outputs                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
    Outputs:
    MysqlAuroraPrimaryStack.VpcId = vpc-0a1b2c3d4e5f6g7h8
    MysqlAuroraPrimaryStack.ClusterEndpoint = mysql-cluster.xyz.us-east-1.rds.amazonaws.com
    MysqlAuroraPrimaryStack.SecretArn = arn:aws:secretsmanager:...
                            ↓
    ✅ DEPLOYMENT COMPLETE!
```

### **Behind the Scenes: The CDK App Lifecycle**

```typescript
// 1. CREATE APP
const app = new cdk.App();

// 2. DEFINE STACKS (this is where your code runs)
new MysqlAuroraStack(app, 'MysqlAuroraPrimaryStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,  // Your AWS account ID
    region: 'us-east-1',                       // AWS region
  }
});

// 3. SYNTHESIZE (convert to CloudFormation)
app.synth();
// This creates: cdk.out/MysqlAuroraPrimaryStack.template.json
```

### **What Happens in the Stack Constructor**

When `new MysqlAuroraStack(...)` is called, this code runs:

```typescript
export class MysqlAuroraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Read configuration
    const dbInstanceType = this.node.tryGetContext('dbInstanceType') || 't3.medium';

    // 2. Create VPC (network)
    const vpc = new ec2.Vpc(this, 'MysqlVPC', { ... });

    // 3. Create Security Group (firewall)
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', { ... });

    // 4. Create Secret (password)
    const dbCredentials = new secretsmanager.Secret(this, 'Credentials', { ... });

    // 5. Create Database Cluster
    const primaryCluster = new rds.DatabaseCluster(this, 'Cluster', { ... });

    // 6. Create Alarms
    new cloudwatch.Alarm(this, 'HighCPU', { ... });

    // 7. Create Outputs
    new cdk.CfnOutput(this, 'ClusterEndpoint', { ... });
  }
}
```

**Important:** The code doesn't actually create resources immediately. It builds a "plan" (CloudFormation template) that AWS CloudFormation uses to create the actual resources.

---

# 🚀 **PART 2: HOW TO RUN IT**

## Prerequisites

### **1. Install Required Software**

```bash
# Install Node.js (v20 or later)
# Download from: https://nodejs.org/

# Verify installation
node --version   # Should show v20.x.x
npm --version    # Should show v10.x.x

# Install AWS CLI
# Download from: https://aws.amazon.com/cli/

# Verify installation
aws --version    # Should show aws-cli/2.x.x
```

### **2. Configure AWS Credentials**

```bash
# Method 1: Using AWS CLI configure
aws configure

# You'll be prompted for:
AWS Access Key ID: [Enter your access key]
AWS Secret Access Key: [Enter your secret key]
Default region name: us-east-1
Default output format: json

# Method 2: Set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"

# Method 3: Use AWS SSO (recommended for organizations)
aws sso login --profile my-profile
```

### **3. Create EC2 Key Pair (for EC2 stack only)**

```bash
# Create a key pair in AWS
aws ec2 create-key-pair \
  --key-name my-cdk-keypair \
  --query 'KeyMaterial' \
  --output text > my-cdk-keypair.pem

# Set permissions (Mac/Linux)
chmod 400 my-cdk-keypair.pem

# Set environment variable
export EC2_KEY_PAIR_NAME="my-cdk-keypair"
```

---

## Running the Stacks - Complete Walkthrough

### **🎯 OPTION 1: Deploy Individual Stack (Recommended for First Time)**

Let's deploy the MySQL stack step by step:

#### **Step 1: Navigate to the stack directory**

```bash
cd C:\Users\ambro\cdk\mysql
```

#### **Step 2: Install dependencies**

```bash
npm install

# This downloads all required packages:
# - aws-cdk-lib (CDK framework)
# - constructs (building blocks)
# - typescript (compiler)
# - etc.
```

Expected output:
```
added 342 packages, and audited 343 packages in 45s
found 0 vulnerabilities
```

#### **Step 3: Build the TypeScript code**

```bash
npm run build

# This runs: tsc (TypeScript compiler)
# Converts: lib/mysql-aurora-stack.ts → lib/mysql-aurora-stack.js
```

Expected output:
```
(No output if successful - TypeScript compiles silently)
```

If there are errors:
```
lib/mysql-aurora-stack.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.
```

#### **Step 4: Synthesize CloudFormation template (optional but recommended)**

```bash
npm run synth

# This runs: cdk synth
# Creates: cdk.out/MysqlAuroraPrimaryStack.template.json
```

Expected output:
```
Resources:
  MysqlVPC4A4F9F8E:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      InstanceTenancy: default
      Tags:
        - Key: Name
          Value: MysqlAuroraPrimaryStack/MysqlVPC
  ...
  (Shows the entire CloudFormation template)
```

#### **Step 5: See what will be created (optional)**

```bash
npm run diff

# This runs: cdk diff
# Compares what exists in AWS vs. what will be created
```

Expected output (first time):
```
Stack MysqlAuroraPrimaryStack
Resources
[+] AWS::EC2::VPC MysqlVPC MysqlVPC4A4F9F8E
[+] AWS::EC2::Subnet MysqlVPC/PublicSubnet1/Subnet PublicSubnet1Subnet
[+] AWS::EC2::Subnet MysqlVPC/PrivateSubnet1/Subnet PrivateSubnet1Subnet
...
[+] AWS::RDS::DBCluster MysqlPrimaryCluster MysqlPrimaryCluster1234ABCD
[+] AWS::RDS::DBInstance MysqlPrimaryCluster/Writer Writer1234ABCD
...

Total: 47 resources to be created
```

#### **Step 6: Deploy to AWS** 🚀

```bash
npm run deploy

# This runs: cdk deploy
# Sends template to AWS CloudFormation and creates resources
```

**What you'll see:**

```bash
✨  Synthesis time: 2.5s

MysqlAuroraPrimaryStack: deploying... [1/1]
MysqlAuroraPrimaryStack: creating CloudFormation changeset...

 ✅  MysqlAuroraPrimaryStack

Do you wish to deploy these changes (y/n)? █
```

Type `y` and press Enter.

**Deployment progress:**

```
MysqlAuroraPrimaryStack | 0/47 | 09:30:45 AM | CREATE_IN_PROGRESS   | AWS::CloudFormation::Stack | MysqlAuroraPrimaryStack
MysqlAuroraPrimaryStack | 1/47 | 09:30:48 AM | CREATE_IN_PROGRESS   | AWS::EC2::VPC | MysqlVPC
MysqlAuroraPrimaryStack | 1/47 | 09:30:50 AM | CREATE_COMPLETE      | AWS::EC2::VPC | MysqlVPC
MysqlAuroraPrimaryStack | 2/47 | 09:30:52 AM | CREATE_IN_PROGRESS   | AWS::EC2::Subnet | PublicSubnet1
...
MysqlAuroraPrimaryStack | 30/47 | 09:35:15 AM | CREATE_IN_PROGRESS   | AWS::RDS::DBCluster | MysqlPrimaryCluster
...
MysqlAuroraPrimaryStack | 45/47 | 09:45:30 AM | CREATE_IN_PROGRESS   | AWS::RDS::DBInstance | Writer
MysqlAuroraPrimaryStack | 46/47 | 09:51:45 AM | CREATE_COMPLETE      | AWS::RDS::DBInstance | Writer
...
MysqlAuroraPrimaryStack | 47/47 | 09:55:20 AM | CREATE_COMPLETE      | AWS::CloudFormation::Stack | MysqlAuroraPrimaryStack

✅  MysqlAuroraPrimaryStack

Outputs:
MysqlAuroraPrimaryStack.ClusterEndpoint = mysql-primary-cluster.cluster-abc123.us-east-1.rds.amazonaws.com
MysqlAuroraPrimaryStack.ClusterPort = 3306
MysqlAuroraPrimaryStack.SecretArn = arn:aws:secretsmanager:us-east-1:123456789012:secret:mysql-aurora-credentials-AbC123
MysqlAuroraPrimaryStack.VpcId = vpc-0a1b2c3d4e5f6g7h8

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789012:stack/MysqlAuroraPrimaryStack/12345678-1234-1234-1234-123456789012

✨  Total time: 25m 35s
```

**🎉 Success!** Your MySQL Aurora cluster is now running in AWS!

---

### **🎯 OPTION 2: Deploy All Stacks at Once**

From the root directory:

```bash
cd C:\Users\ambro\cdk

# Install all dependencies
npm run install:all

# Build all stacks
npm run build:all

# Deploy all stacks
npm run deploy:all
```

This will deploy:
1. MySQL Aurora Stack (25-30 minutes)
2. PostgreSQL Aurora Stack (25-30 minutes)
3. EC2 Instances Stack (5-10 minutes)

**Total time: ~60-70 minutes**

---

### **🎯 OPTION 3: Using CI/CD Pipeline**

#### **GitHub Actions Workflow**

```bash
# 1. Push code to GitHub
git add .
git commit -m "Deploy infrastructure"
git push origin main

# 2. GitHub Actions automatically:
#    - Installs dependencies
#    - Runs security scan
#    - Builds stacks
#    - Synthesizes templates
#    - (On master branch) Deploys to AWS

# 3. Monitor progress at:
#    https://github.com/your-repo/actions
```

#### **Jenkins Pipeline**

```bash
# 1. Configure Jenkins job to point to your repo
# 2. Push code
git push origin main

# 3. Jenkins automatically:
#    - Checks out code
#    - Installs dependencies
#    - Runs security audit
#    - Creates CloudFormation templates
#    - Waits for manual approval
#    - Deploys to AWS

# 4. Monitor at: http://your-jenkins-url/job/cdk-pipeline/
```

---

## Verifying the Deployment

### **1. Check CloudFormation Stack**

```bash
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --query 'Stacks[0].StackStatus'

# Expected output: "CREATE_COMPLETE"
```

### **2. List All Outputs**

```bash
aws cloudformation describe-stacks \
  --stack-name MysqlAuroraPrimaryStack \
  --query 'Stacks[0].Outputs'
```

Output:
```json
[
  {
    "OutputKey": "ClusterEndpoint",
    "OutputValue": "mysql-cluster.abc123.us-east-1.rds.amazonaws.com",
    "Description": "Primary cluster writer endpoint hostname"
  },
  {
    "OutputKey": "SecretArn",
    "OutputValue": "arn:aws:secretsmanager:us-east-1:123456789012:secret:mysql-aurora-credentials-AbC123",
    "Description": "ARN of the database credentials secret"
  }
]
```

### **3. Get Database Password**

```bash
aws secretsmanager get-secret-value \
  --secret-id mysql-aurora-credentials \
  --query SecretString \
  --output text | jq -r .password

# Output: Xy9KpL2mN3qR4sT5vW6xY7zA8bC9dE0f
```

### **4. Connect to Database** (requires bastion host - see BASTION-HOST-SETUP.md)

```bash
mysql -h mysql-cluster.abc123.us-east-1.rds.amazonaws.com \
      -P 3306 \
      -u admin \
      -p
# Enter password when prompted
```

---

## Making Changes and Updating

### **Scenario: Change Database Instance Type**

**Step 1: Edit cdk.json**

```json
{
  "context": {
    "dbInstanceType": "t3.large"  // Changed from t3.medium
  }
}
```

**Step 2: See what will change**

```bash
cd mysql
npm run diff
```

Output:
```
Stack MysqlAuroraPrimaryStack
Resources
[~] AWS::RDS::DBInstance MysqlPrimaryCluster/Writer Writer1234ABCD
 └─ [~] DBInstanceClass
     ├─ [-] db.t3.medium
     └─ [+] db.t3.large

[~] AWS::RDS::DBInstance MysqlPrimaryCluster/Reader1 Reader1234ABCD
 └─ [~] DBInstanceClass
     ├─ [-] db.t3.medium
     └─ [+] db.t3.large
```

**Step 3: Deploy changes**

```bash
npm run deploy
```

CloudFormation will:
- Update the database instances (may cause brief downtime)
- Keep all data intact
- Apply changes in a safe, rolling manner

---

## Troubleshooting

### **Problem: "No credentials found"**

```
Error: Need to perform AWS calls for account XXX, but no credentials found
```

**Solution:**
```bash
aws configure
# Enter your AWS credentials
```

### **Problem: "Stack already exists"**

```
Error: MysqlAuroraPrimaryStack already exists
```

**Solution:**
```bash
# Either delete the existing stack:
npm run destroy

# Or deploy updates to existing stack (this is normal):
npm run deploy  # Will update the existing stack
```

### **Problem: "Rollback in progress"**

```
Error: Stack is in ROLLBACK_IN_PROGRESS state
```

**Solution:**
```bash
# Wait for rollback to complete, then:
aws cloudformation delete-stack --stack-name MysqlAuroraPrimaryStack

# Wait for deletion, then redeploy:
npm run deploy
```

### **Problem: Build fails with TypeScript errors**

```
lib/mysql-aurora-stack.ts:21:5 - error TS2322
```

**Solution:**
```bash
# Check the error message
# Fix the TypeScript code
# Rebuild
npm run build
```

---

# 🧩 **PART 3: COMPONENTS INVOLVED**

## Complete Component Breakdown

### **1. Development Components**

#### **TypeScript Files (.ts)**

```
mysql/
├── bin/
│   └── mysql-aurora.ts          ← Entry point (app initialization)
└── lib/
    └── mysql-aurora-stack.ts    ← Stack definition (infrastructure code)
```

**bin/mysql-aurora.ts:**
- Creates the CDK App
- Instantiates stacks
- Calls app.synth()

**lib/mysql-aurora-stack.ts:**
- Extends cdk.Stack
- Defines all AWS resources
- Contains the infrastructure logic

#### **Configuration Files**

**package.json:**
```json
{
  "scripts": {
    "build": "tsc",              // Compile TypeScript
    "deploy": "cdk deploy",      // Deploy to AWS
    "synth": "cdk synth",        // Generate CloudFormation
    "destroy": "cdk destroy"     // Delete stack
  },
  "dependencies": {
    "aws-cdk-lib": "^2.100.0",   // CDK framework
    "constructs": "^10.0.0"      // CDK building blocks
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",          // JavaScript version
    "module": "commonjs",        // Module system
    "strict": true,              // Type checking strictness
    "noUnusedLocals": true       // Catch unused variables
  }
}
```

**cdk.json:**
```json
{
  "app": "npx ts-node bin/mysql-aurora.ts",  // How to run the app
  "context": {
    "dbInstanceType": "t3.medium",             // Custom configuration
    "environment": "Production"
  }
}
```

---

### **2. CDK Components (AWS Constructs)**

CDK uses "constructs" - reusable cloud components. Think of them as Lego blocks.

#### **Level 1 (L1) - Low-level CFN Resources**

```typescript
// Direct mapping to CloudFormation
const cfnVpc = new ec2.CfnVPC(this, 'VPC', {
  cidrBlock: '10.0.0.0/16'
});
```

#### **Level 2 (L2) - Higher-level constructs (Most common)**

```typescript
// Easier to use, with sensible defaults
const vpc = new ec2.Vpc(this, 'VPC', {
  maxAzs: 2  // Automatically creates subnets, route tables, etc.
});
```

#### **Level 3 (L3) - Patterns (Highest level)**

```typescript
// Pre-configured common patterns
const api = new patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
  // Creates ALB, Fargate, VPC, etc. in one go
});
```

**In this project, we use mostly L2 constructs:**

```typescript
// VPC (Virtual Private Cloud)
const vpc = new ec2.Vpc(this, 'MysqlVPC', {
  maxAzs: 2,              // Use 2 availability zones
  natGateways: 1,         // 1 NAT gateway
});

// Security Group (Firewall)
const sg = new ec2.SecurityGroup(this, 'SecurityGroup', {
  vpc,
  allowAllOutbound: true
});

// Database Cluster
const cluster = new rds.DatabaseCluster(this, 'Cluster', {
  engine: rds.DatabaseClusterEngine.auroraMysql({
    version: rds.AuroraMysqlEngineVersion.VER_3_04_0
  }),
  vpc,
  writer: rds.ClusterInstance.provisioned('Writer', {
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM)
  })
});

// CloudWatch Alarm
const alarm = new cloudwatch.Alarm(this, 'HighCPU', {
  metric: cluster.metricCPUUtilization(),
  threshold: 80
});

// Output
new cdk.CfnOutput(this, 'Endpoint', {
  value: cluster.clusterEndpoint.hostname
});
```

---

### **3. AWS Services Components**

When you deploy, these AWS services are created:

#### **Networking Components**

```
VPC (Virtual Private Cloud)
├── Public Subnet 1 (us-east-1a)
│   ├── CIDR: 10.0.0.0/24
│   └── Routes: 0.0.0.0/0 → Internet Gateway
├── Public Subnet 2 (us-east-1b)
│   ├── CIDR: 10.0.1.0/24
│   └── Routes: 0.0.0.0/0 → Internet Gateway
├── Private Subnet 1 (us-east-1a)
│   ├── CIDR: 10.0.128.0/24
│   └── Routes: 0.0.0.0/0 → NAT Gateway
├── Private Subnet 2 (us-east-1b)
│   ├── CIDR: 10.0.129.0/24
│   └── Routes: 0.0.0.0/0 → NAT Gateway
├── Isolated Subnet 1 (us-east-1a)
│   ├── CIDR: 10.0.240.0/28
│   └── Routes: (no internet route)
└── Isolated Subnet 2 (us-east-1b)
    ├── CIDR: 10.0.240.16/28
    └── Routes: (no internet route)

Internet Gateway (for public subnets)
NAT Gateway (for private subnets to access internet)
Route Tables (define network routing)
```

#### **Security Components**

```
Security Group (MySQL Database)
├── Inbound Rules:
│   └── TCP 3306 from VPC CIDR (10.0.0.0/16)
└── Outbound Rules:
    └── All traffic allowed

IAM Role (for EC2 instances)
├── Trust Policy: ec2.amazonaws.com
└── Managed Policies:
    ├── AmazonSSMManagedInstanceCore
    └── CloudWatchAgentServerPolicy
```

#### **Database Components**

```
RDS Aurora Cluster
├── Cluster Identifier: mysql-primary-cluster
├── Engine: Aurora MySQL 3.04.0 (MySQL 8.0 compatible)
├── Endpoint: mysql-cluster.abc123.us-east-1.rds.amazonaws.com:3306
├── Writer Instance:
│   ├── Instance Type: db.t3.medium
│   ├── vCPUs: 2
│   ├── Memory: 4 GB
│   └── Status: available
├── Reader Instance:
│   ├── Instance Type: db.t3.medium
│   ├── vCPUs: 2
│   ├── Memory: 4 GB
│   └── Status: available
├── Backup:
│   ├── Retention: 7 days
│   ├── Window: 03:00-04:00 UTC
│   └── Snapshots: Automated
├── Storage:
│   ├── Type: Aurora Storage (auto-scaling)
│   ├── Encrypted: Yes (AES-256)
│   └── Min: 10 GB, Max: 128 TB
└── Monitoring:
    ├── CloudWatch Logs: error, general, slowquery, audit
    └── Enhanced Monitoring: 60 seconds
```

#### **Secrets Management**

```
AWS Secrets Manager
└── Secret: mysql-aurora-credentials
    ├── Username: admin
    ├── Password: [auto-generated 32-char password]
    ├── Rotation: Disabled (can be enabled)
    └── Format: JSON
        {
          "username": "admin",
          "password": "Xy9KpL2mN3qR4sT5vW6xY7zA8bC9dE0f"
        }
```

#### **Monitoring Components**

```
CloudWatch Alarms
├── MysqlAuroraPrimaryStack-MySQL-HighCPU
│   ├── Metric: CPUUtilization
│   ├── Threshold: 80%
│   ├── Evaluation Periods: 2
│   └── Actions: (none - can add SNS topic)
├── MysqlAuroraPrimaryStack-MySQL-HighConnections
│   ├── Metric: DatabaseConnections
│   ├── Threshold: 900
│   └── Evaluation Periods: 2
├── MysqlAuroraPrimaryStack-MySQL-LowMemory
│   ├── Metric: FreeableMemory
│   ├── Threshold: 512 MB
│   └── Comparison: LessThan
└── MysqlAuroraPrimaryStack-MySQL-HighReplicationLag
    ├── Metric: AuroraReplicaLag
    ├── Threshold: 1000 ms
    └── Evaluation Periods: 2

CloudWatch Logs
├── /aws/rds/cluster/mysql-primary-cluster/error
├── /aws/rds/cluster/mysql-primary-cluster/general
├── /aws/rds/cluster/mysql-primary-cluster/slowquery
└── /aws/rds/cluster/mysql-primary-cluster/audit
```

---

### **4. CI/CD Pipeline Components**

#### **GitHub Actions Components**

```yaml
.github/workflows/ci-cd.yml

Jobs:
├── build-and-test
│   ├── Checkout code
│   ├── Setup Node.js 20
│   ├── Install dependencies (npm ci)
│   ├── Build TypeScript
│   ├── Security audit (npm audit --audit-level=high)
│   ├── CDK Synth
│   └── Upload CloudFormation templates as artifacts
│
├── create-pull-request
│   ├── Triggers: on push to non-master branches
│   └── Creates automated PR to master
│
└── deploy
    ├── Triggers: on push to master
    ├── Requires: production environment approval
    ├── Deploy MySQL Stack
    ├── Deploy PostgreSQL Stack
    ├── Deploy EC2 Stack
    └── Comment deployment status on commit
```

#### **Jenkins Pipeline Components**

```groovy
Jenkinsfile

Stages:
├── Checkout
│   └── checkout scm
│
├── Install Dependencies (parallel)
│   ├── MySQL: npm install
│   ├── PostgreSQL: npm install
│   └── EC2: npm install
│
├── Build (parallel)
│   ├── MySQL: npm run build
│   ├── PostgreSQL: npm run build
│   └── EC2: npm run build
│
├── CDK Synth (parallel)
│   ├── MySQL: npm run synth
│   ├── PostgreSQL: npm run synth
│   └── EC2: npm run synth
│
├── Security Scan (parallel)
│   ├── MySQL: npm audit --audit-level=high
│   ├── PostgreSQL: npm audit --audit-level=high
│   └── EC2: npm audit --audit-level=high
│
├── Create Pull Request
│   └── Triggers: on non-master branches
│
└── Deploy to AWS
    ├── Requires: manual approval
    ├── MySQL: npm run deploy
    ├── PostgreSQL: npm run deploy
    └── EC2: npm run deploy
```

---

### **5. Generated Components (Build Artifacts)**

During build and deployment, these files are generated:

```
mysql/
├── lib/
│   ├── mysql-aurora-stack.js         ← Compiled JavaScript
│   ├── mysql-aurora-stack.js.map     ← Source map
│   └── mysql-aurora-stack.d.ts       ← TypeScript declarations
├── bin/
│   ├── mysql-aurora.js               ← Compiled entry point
│   └── mysql-aurora.js.map
├── cdk.out/
│   ├── MysqlAuroraPrimaryStack.template.json  ← CloudFormation template
│   ├── MysqlAuroraPrimaryStack.assets.json    ← Asset manifest
│   ├── manifest.json                          ← Stack manifest
│   ├── cdk.out                                ← CDK toolkit metadata
│   └── tree.json                              ← Resource tree
└── node_modules/                      ← Dependencies (342 packages)
```

**CloudFormation Template Structure:**

```json
{
  "Resources": {
    "MysqlVPC": {
      "Type": "AWS::EC2::VPC",
      "Properties": {
        "CidrBlock": "10.0.0.0/16",
        "EnableDnsHostnames": true,
        "Tags": [...]
      }
    },
    "MysqlPrimaryCluster": {
      "Type": "AWS::RDS::DBCluster",
      "Properties": {
        "Engine": "aurora-mysql",
        "EngineVersion": "8.0.mysql_aurora.3.04.0",
        "MasterUsername": "admin",
        "MasterUserPassword": {
          "Fn::Sub": "{{resolve:secretsmanager:${MysqlCredentials}:SecretString:password}}"
        },
        "DBSubnetGroupName": { "Ref": "MysqlSubnetGroup" },
        "VpcSecurityGroupIds": [{ "Fn::GetAtt": ["MysqlSecurityGroup", "GroupId"] }]
      }
    }
    // ... 47 total resources
  },
  "Outputs": {
    "ClusterEndpoint": {
      "Value": { "Fn::GetAtt": ["MysqlPrimaryCluster", "Endpoint.Address"] },
      "Export": { "Name": "MysqlAuroraPrimaryStack-ClusterEndpoint" }
    }
  }
}
```

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         DEVELOPER                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                   [Writes TypeScript Code]
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SOURCE CODE FILES                             │
│  bin/mysql-aurora.ts  +  lib/mysql-aurora-stack.ts              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                   [npm run build (tsc)]
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   COMPILED JAVASCRIPT                            │
│  bin/mysql-aurora.js  +  lib/mysql-aurora-stack.js              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                   [npm run deploy (cdk deploy)]
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                        CDK TOOLKIT                               │
│  - Reads cdk.json                                               │
│  - Executes app (ts-node bin/mysql-aurora.ts)                  │
│  - Calls app.synth()                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                 CLOUDFORMATION TEMPLATE                          │
│  cdk.out/MysqlAuroraPrimaryStack.template.json                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                   [Uploaded to AWS]
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   AWS CLOUDFORMATION                             │
│  - Receives template                                            │
│  - Creates change set                                           │
│  - Executes change set                                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
┌───────────────────┐                 ┌───────────────────┐
│   AWS EC2         │                 │   AWS RDS         │
│   - VPC           │                 │   - DB Cluster    │
│   - Subnets       │                 │   - Writer        │
│   - Security Grps │                 │   - Reader        │
└───────────────────┘                 └───────────────────┘
        ↓                                       ↓
┌───────────────────┐                 ┌───────────────────┐
│ Secrets Manager   │                 │   CloudWatch      │
│ - Password        │                 │   - Logs          │
└───────────────────┘                 │   - Alarms        │
                                      └───────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RUNNING INFRASTRUCTURE                        │
│  - Database is accessible at: mysql-cluster.abc.rds.amazonaws..│
│  - Password stored in: Secrets Manager                          │
│  - Monitoring active in: CloudWatch                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

### **How It Runs:**
1. TypeScript code defines infrastructure
2. TypeScript compiler converts to JavaScript
3. CDK synthesizes to CloudFormation
4. CloudFormation creates AWS resources
5. Resources run in AWS cloud

### **How to Run It:**
1. Install Node.js and AWS CLI
2. Configure AWS credentials
3. Run `npm install` (dependencies)
4. Run `npm run build` (compile)
5. Run `npm run deploy` (deploy)
6. Wait ~25 minutes for deployment

### **Components Involved:**
- **Code**: TypeScript files (.ts)
- **Config**: package.json, tsconfig.json, cdk.json
- **Build**: Compiled JavaScript (.js)
- **Templates**: CloudFormation JSON
- **AWS Services**: VPC, RDS, CloudWatch, Secrets Manager
- **CI/CD**: GitHub Actions or Jenkins
- **Outputs**: Database endpoints, credentials, connection commands

The entire system is designed to make infrastructure deployment as simple as `npm run deploy`!
