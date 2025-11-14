# Jenkins CI/CD Server Stack

This CDK stack deploys a complete Jenkins CI/CD server on AWS EC2 with all necessary configurations for the CDK infrastructure project.

## What Gets Deployed

- **EC2 Instance**: t3.medium instance (configurable) running Amazon Linux 2023
- **Jenkins**: Latest stable version with Java 17
- **Node.js 20.x**: For AWS CDK operations
- **AWS CDK**: Pre-installed and ready to use
- **Docker**: For containerized builds (optional)
- **VPC**: Dedicated VPC with public and private subnets
- **Security Group**: Configured for Jenkins web access (port 8080)
- **IAM Role**: With permissions for CDK deployments
- **CloudWatch**: Log monitoring for Jenkins
- **Secrets Manager**: For storing admin credentials
- **SSM Parameter Store**: For initial admin password

## Prerequisites

1. AWS CLI configured with credentials
2. AWS CDK CLI installed (`npm install -g aws-cdk`)
3. Node.js 20.x installed
4. CDK bootstrapped in target region

## Configuration

### Environment Variables

Set these before deployment (or add to `.env` file):

```bash
# Required
AWS_ACCOUNT_ID=123456789012
AWS_DEFAULT_REGION=us-east-2

# Optional
JENKINS_INSTANCE_TYPE=t3.medium              # Default: t3.medium
JENKINS_VPC_CIDR=10.2.0.0/16                # Default: 10.2.0.0/16
JENKINS_ALLOWED_IPS=1.2.3.4/32,5.6.7.8/32  # Your IP addresses (highly recommended)
GITHUB_REPO=your-org/cdk-infrastructure     # Your GitHub repository
```

### CDK Context

Alternatively, configure via CDK context in `cdk.json`:

```json
{
  "jenkinsInstanceType": "t3.medium",
  "jenkinsVpcCidr": "10.2.0.0/16",
  "jenkinsAllowedIps": ["1.2.3.4/32", "5.6.7.8/32"],
  "githubRepo": "your-org/cdk-infrastructure"
}
```

## Deployment

### Step 1: Install Dependencies

```bash
cd jenkins-server
npm install
```

### Step 2: Build TypeScript

```bash
npm run build
```

### Step 3: Synthesize CloudFormation

```bash
npm run synth
```

### Step 4: Deploy

```bash
# Set your allowed IP for security
export JENKINS_ALLOWED_IPS="$(curl -s ifconfig.me)/32"

# Deploy the stack
npm run deploy
```

**Deployment time**: ~10-15 minutes

## Post-Deployment Setup

### 1. Get Jenkins URL

```bash
# From CloudFormation output
aws cloudformation describe-stacks \
  --stack-name JenkinsStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`JenkinsURL`].OutputValue' \
  --output text
```

### 2. Get Initial Admin Password

```bash
# Option 1: From SSM Parameter Store (recommended)
aws ssm get-parameter \
  --name "/jenkins/initial-admin-password" \
  --region us-east-2 \
  --with-decryption \
  --query Parameter.Value \
  --output text

# Option 2: Connect via SSM and read file
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name JenkinsStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`JenkinsInstanceId`].OutputValue' \
  --output text)

aws ssm start-session --target $INSTANCE_ID --region us-east-2
# Then inside the session:
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

### 3. Complete Jenkins Setup

1. Open Jenkins URL in your browser
2. Enter the initial admin password
3. Click "Install suggested plugins"
4. Create first admin user (or skip to use admin/initial-password)
5. Confirm Jenkins URL
6. Start using Jenkins

### 4. Configure Jenkins for CDK Infrastructure

#### Install Required Plugins

From Jenkins UI: **Manage Jenkins** > **Manage Plugins** > **Available**

Install these plugins:
- **Git** (usually pre-installed)
- **GitHub** (for GitHub integration)
- **Pipeline** (usually pre-installed)
- **AWS Credentials Plugin**
- **NodeJS Plugin**
- **SonarQube Scanner**
- **Email Extension Plugin**

#### Add AWS Credentials

**Manage Jenkins** > **Manage Credentials** > **Global** > **Add Credentials**

Add these credentials:
1. **aws-account-id**: Secret text (your AWS account ID)
2. **aws-access-key-id**: Secret text
3. **aws-secret-access-key**: Secret text
4. **github-token**: Secret text (GitHub personal access token)
5. **ec2-key-pair-name**: Secret text (e.g., "cdk-keypair")
6. **sonarqube-url**: Secret text (SonarQube server URL)
7. **sonar-token**: Secret text (SonarQube auth token)

#### Configure NodeJS

**Manage Jenkins** > **Global Tool Configuration** > **NodeJS**

- Click "Add NodeJS"
- Name: `NodeJS-20`
- Version: Select NodeJS 20.x
- Save

#### Create Jenkins Pipeline

**New Item** > **Pipeline** > Name: `cdk-infrastructure`

Configure:
- **Build Triggers**: GitHub hook trigger for GITScm polling
- **Pipeline**:
  - Definition: Pipeline script from SCM
  - SCM: Git
  - Repository URL: Your GitHub repo
  - Credentials: Select your GitHub token
  - Branch: `*/master` and `*/PR-*` (for PRs)
  - Script Path: `Jenkinsfile`

## Accessing Jenkins

### Via Web Browser

```bash
# Get Jenkins URL
aws cloudformation describe-stacks \
  --stack-name JenkinsStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`JenkinsURL`].OutputValue' \
  --output text
```

### Via SSM Session Manager (for troubleshooting)

```bash
# Get instance ID
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name JenkinsStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`JenkinsInstanceId`].OutputValue' \
  --output text)

# Connect
aws ssm start-session --target $INSTANCE_ID --region us-east-2
```

## Monitoring

### CloudWatch Logs

Jenkins logs are automatically sent to CloudWatch:

```bash
# View Jenkins application logs
aws logs tail /aws/ec2/jenkins --follow --region us-east-2 --log-stream-names "i-xxxxx/jenkins.log"

# View user-data initialization logs
aws logs tail /aws/ec2/jenkins --follow --region us-east-2 --log-stream-names "i-xxxxx/user-data.log"
```

### Jenkins System Log

Access via Jenkins UI: **Manage Jenkins** > **System Log**

## Security Considerations

### IP Address Restrictions

**IMPORTANT**: Always restrict Jenkins access to known IP addresses:

```bash
# Update security group to allow only your IP
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=JenkinsStack/JenkinsSecurityGroup" \
  --region us-east-2 \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

MY_IP=$(curl -s ifconfig.me)

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 8080 \
  --cidr ${MY_IP}/32 \
  --region us-east-2
```

### Enable HTTPS (Recommended for Production)

1. Obtain SSL certificate (AWS Certificate Manager or Let's Encrypt)
2. Set up Application Load Balancer in front of Jenkins
3. Configure ALB to terminate SSL
4. Update security groups to allow only ALB → Jenkins traffic

### Enable Jenkins Security

- Enable CSRF protection (enabled by default)
- Use matrix-based security for user permissions
- Enable audit logging
- Regularly update Jenkins and plugins

## Troubleshooting

### Jenkins not accessible

1. Check security group allows your IP:
```bash
aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=JenkinsStack/JenkinsSecurityGroup" \
  --region us-east-2
```

2. Check Jenkins service status:
```bash
aws ssm start-session --target $INSTANCE_ID --region us-east-2
sudo systemctl status jenkins
```

### Build failures

1. Check CloudWatch logs
2. Verify AWS credentials in Jenkins
3. Ensure IAM role has necessary permissions
4. Check Node.js and CDK versions

### Out of disk space

```bash
# Connect via SSM
aws ssm start-session --target $INSTANCE_ID --region us-east-2

# Check disk usage
df -h

# Clean old builds
sudo du -sh /var/lib/jenkins/jobs/*/builds/*
```

## Cost Estimate

| Resource | Cost (Monthly) |
|----------|----------------|
| EC2 t3.medium (24/7) | ~$30 |
| EBS 50 GB GP3 | ~$4 |
| NAT Gateway | ~$32 |
| Data Transfer | ~$1 |
| **Total** | **~$67/month** |

**Cost Optimization**:
- Stop Jenkins instance when not in use: `~$4/month` (storage only)
- Use t3.small for light workloads: Save 50%
- Remove NAT gateway if not needed: Save $32/month

## Cleanup

To delete the Jenkins stack:

```bash
# Destroy the stack
npm run destroy

# Or via AWS CLI
aws cloudformation delete-stack --stack-name JenkinsStack --region us-east-2

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name JenkinsStack --region us-east-2
```

## Stack Outputs

The stack provides these outputs:

- **JenkinsURL**: Web interface URL
- **JenkinsInstanceId**: EC2 instance ID
- **JenkinsPublicIp**: Public IP address
- **JenkinsAdminPasswordCommand**: Command to retrieve initial password
- **JenkinsSSMSessionCommand**: Command to connect via SSM
- **JenkinsSecretArn**: ARN of admin password secret

## Integration with CDK Infrastructure

This Jenkins server is configured to:
1. Automatically trigger builds on GitHub pushes/PRs
2. Run security audits (`npm audit`)
3. Execute SonarQube code scans
4. Synthesize CDK stacks
5. Deploy to AWS after approval
6. Send email notifications

See the main `Jenkinsfile` in the repository root for the complete pipeline configuration.

## Support

For issues or questions:
- Check Jenkins system log
- Review CloudWatch logs
- Check `/var/log/user-data.log` for initialization errors
- Review security group and IAM role configurations
