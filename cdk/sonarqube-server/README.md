# SonarQube Code Quality Server Stack

This CDK stack deploys a complete SonarQube server on AWS with PostgreSQL database for code quality analysis of the CDK infrastructure project.

## What Gets Deployed

- **EC2 Instance**: t3.large instance (configurable) running Amazon Linux 2023
- **SonarQube**: Community Edition 10.3 with Java 17
- **PostgreSQL Database**: RDS db.t3.small instance for SonarQube metadata
- **VPC**: Dedicated VPC with public, private, and database subnets
- **Security Groups**: Configured for SonarQube web access (port 9000) and database
- **IAM Role**: With permissions for CloudWatch and Secrets Manager
- **CloudWatch**: Log monitoring for SonarQube
- **Secrets Manager**: For storing database credentials
- **Encrypted Storage**: 50 GB GP3 EBS volume for SonarQube data

## Prerequisites

1. AWS CLI configured with credentials
2. AWS CDK CLI installed (`npm install -g aws-cdk`)
3. Node.js 20.x installed
4. CDK bootstrapped in target region
5. At least 10 GB free in AWS account (for RDS database)

## Configuration

### Environment Variables

Set these before deployment (or add to `.env` file):

```bash
# Required
AWS_ACCOUNT_ID=123456789012
AWS_DEFAULT_REGION=us-east-2

# Optional
SONARQUBE_INSTANCE_TYPE=t3.large             # Default: t3.large
SONARQUBE_DB_INSTANCE_TYPE=db.t3.small       # Default: db.t3.small
SONARQUBE_VPC_CIDR=10.3.0.0/16              # Default: 10.3.0.0/16
SONARQUBE_ALLOWED_IPS=1.2.3.4/32,5.6.7.8/32 # Your IP addresses (recommended)
```

### CDK Context

Alternatively, configure via CDK context in `cdk.json`:

```json
{
  "sonarQubeInstanceType": "t3.large",
  "sonarQubeDbInstanceType": "db.t3.small",
  "sonarQubeVpcCidr": "10.3.0.0/16",
  "sonarQubeAllowedIps": ["1.2.3.4/32", "5.6.7.8/32"]
}
```

## Deployment

### Step 1: Install Dependencies

```bash
cd sonarqube-server
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
export SONARQUBE_ALLOWED_IPS="$(curl -s ifconfig.me)/32"

# Deploy the stack
npm run deploy
```

**Deployment time**: ~15-20 minutes (database creation takes longest)

## Post-Deployment Setup

### 1. Get SonarQube URL

```bash
# From CloudFormation output
aws cloudformation describe-stacks \
  --stack-name SonarQubeStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`SonarQubeURL`].OutputValue' \
  --output text
```

### 2. Initial Login

1. Open SonarQube URL in your browser
2. Default credentials: **admin** / **admin**
3. You will be prompted to change the password on first login
4. Set a strong new password and save it securely

### 3. Create Projects

Create three projects for your CDK infrastructure stacks:

#### Via SonarQube UI

1. Click **"Create Project"** > **"Manually"**
2. Create these projects:

   **Project 1: MySQL Stack**
   - Project key: `cdk-infrastructure-mysql`
   - Display name: `CDK Infrastructure - MySQL`

   **Project 2: PostgreSQL Stack**
   - Project key: `cdk-infrastructure-postgres`
   - Display name: `CDK Infrastructure - PostgreSQL`

   **Project 3: EC2 Instances Stack**
   - Project key: `cdk-infrastructure-ec2-instances`
   - Display name: `CDK Infrastructure - EC2 Instances`

3. For each project:
   - Choose **"With Jenkins"** as the analysis method
   - Select **"Other"** as the build technology
   - Generate a token or use existing token

#### Via API (Automated)

```bash
# Get SonarQube URL
SONAR_URL=$(aws cloudformation describe-stacks \
  --stack-name SonarQubeStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`SonarQubeURL`].OutputValue' \
  --output text)

# Generate authentication token
# (Login to SonarQube UI first and generate token at: My Account > Security > Generate Tokens)
SONAR_TOKEN="your-generated-token"

# Create projects
curl -u $SONAR_TOKEN: -X POST "$SONAR_URL/api/projects/create" \
  -d "name=CDK Infrastructure - MySQL" \
  -d "project=cdk-infrastructure-mysql"

curl -u $SONAR_TOKEN: -X POST "$SONAR_URL/api/projects/create" \
  -d "name=CDK Infrastructure - PostgreSQL" \
  -d "project=cdk-infrastructure-postgres"

curl -u $SONAR_TOKEN: -X POST "$SONAR_URL/api/projects/create" \
  -d "name=CDK Infrastructure - EC2 Instances" \
  -d "project=cdk-infrastructure-ec2-instances"
```

### 4. Generate Authentication Token

For Jenkins integration:

1. Login to SonarQube
2. Go to **My Account** (top right avatar)
3. Click **Security** tab
4. Under **Tokens**, enter a name (e.g., "Jenkins")
5. Select expiration: **No expiration** (or set appropriate expiration)
6. Click **Generate**
7. **IMPORTANT**: Copy the token immediately (you won't see it again)
8. Store it securely - you'll need it for Jenkins configuration

### 5. Configure Quality Gate (Optional)

The default quality gate is suitable for most projects. To customize:

1. Go to **Quality Gates**
2. Either modify the default or create a new one
3. Set conditions (e.g., Coverage > 80%, Bugs = 0, Vulnerabilities = 0)
4. Assign it to your projects

## Integration with Jenkins

After deploying both Jenkins and SonarQube:

### 1. Add SonarQube Server to Jenkins

1. Jenkins: **Manage Jenkins** > **Configure System**
2. Scroll to **SonarQube servers**
3. Click **Add SonarQube**
4. Configuration:
   - Name: `SonarQube`
   - Server URL: `http://<sonarqube-public-ip>:9000`
   - Server authentication token: Add credential (Secret text) with your SonarQube token
5. Save

### 2. Install SonarQube Scanner in Jenkins

1. **Manage Jenkins** > **Global Tool Configuration**
2. Scroll to **SonarQube Scanner**
3. Click **Add SonarQube Scanner**
4. Name: `SonarQube Scanner`
5. Check **Install automatically**
6. Save

### 3. Add SonarQube Credentials to Jenkins

As mentioned in the Jenkins README, add these credentials:

```
sonarqube-url: http://<sonarqube-public-ip>:9000
sonar-token: <your-sonarqube-token>
```

The Jenkinsfile is already configured to use these credentials!

## Accessing SonarQube

### Via Web Browser

```bash
# Get SonarQube URL
aws cloudformation describe-stacks \
  --stack-name SonarQubeStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`SonarQubeURL`].OutputValue' \
  --output text
```

### Via SSM Session Manager (for troubleshooting)

```bash
# Get instance ID
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name SonarQubeStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`SonarQubeInstanceId`].OutputValue' \
  --output text)

# Connect
aws ssm start-session --target $INSTANCE_ID --region us-east-2

# Check SonarQube status
sudo systemctl status sonarqube

# View SonarQube logs
sudo tail -f /opt/sonarqube/logs/sonar.log
```

## Monitoring

### CloudWatch Logs

SonarQube logs are automatically sent to CloudWatch:

```bash
# View SonarQube application logs
aws logs tail /aws/ec2/sonarqube --follow --region us-east-2 --log-stream-names "i-xxxxx/sonar.log"

# View web server logs
aws logs tail /aws/ec2/sonarqube --follow --region us-east-2 --log-stream-names "i-xxxxx/web.log"

# View initialization logs
aws logs tail /aws/ec2/sonarqube --follow --region us-east-2 --log-stream-names "i-xxxxx/user-data.log"
```

### Database Monitoring

```bash
# Get database endpoint
aws cloudformation describe-stacks \
  --stack-name SonarQubeStack \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`SonarQubeDbEndpoint`].OutputValue' \
  --output text

# Check database metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=<db-instance-id> \
  --statistics Average \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --region us-east-2
```

## Security Considerations

### IP Address Restrictions

**IMPORTANT**: Always restrict SonarQube access to known IP addresses:

```bash
# Update security group to allow only your IP
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=tag:Name,Values=SonarQubeStack/SonarQubeSecurityGroup" \
  --region us-east-2 \
  --query 'SecurityGroups[0].GroupId' \
  --output text)

MY_IP=$(curl -s ifconfig.me)

aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 9000 \
  --cidr ${MY_IP}/32 \
  --region us-east-2
```

### Enable HTTPS (Recommended for Production)

1. Obtain SSL certificate (AWS Certificate Manager or Let's Encrypt)
2. Set up Application Load Balancer in front of SonarQube
3. Configure ALB to terminate SSL
4. Update security groups to allow only ALB → SonarQube traffic

### SonarQube Security Best Practices

1. **Change default admin password immediately**
2. **Create separate users** for each team member (don't share admin)
3. **Use strong passwords** and enable forced authentication
4. **Generate project-specific tokens** instead of using admin token
5. **Enable audit logging**: Administration > System > Audit Logs
6. **Regularly update SonarQube** for security patches
7. **Review user permissions** regularly
8. **Enable webhook signature verification** for Jenkins integration

### Database Security

- Database is in isolated subnet (not publicly accessible)
- Credentials stored in AWS Secrets Manager
- Encrypted storage (EBS and RDS)
- Automatic backups enabled (7-day retention)

## Troubleshooting

### SonarQube not accessible

1. Check security group allows your IP
2. Check SonarQube service status via SSM
3. Review CloudWatch logs for errors

```bash
# Connect via SSM
aws ssm start-session --target $INSTANCE_ID --region us-east-2

# Check service status
sudo systemctl status sonarqube

# Check logs
sudo tail -n 100 /opt/sonarqube/logs/sonar.log
```

### SonarQube won't start

Common issues:

1. **Insufficient memory**: SonarQube requires at least 2 GB RAM
2. **Database connection**: Check database endpoint and credentials
3. **System limits**: Check `vm.max_map_count` and `fs.file-max`

```bash
# Check system limits
sysctl vm.max_map_count  # Should be 524288
sysctl fs.file-max       # Should be 131072

# Check database connectivity
psql -h <db-endpoint> -U sonarqube -d sonarqube
```

### Analysis fails in Jenkins

1. Verify SonarQube server URL in Jenkins configuration
2. Check authentication token is valid
3. Verify project key matches in SonarQube
4. Check scanner version compatibility

### Database connection issues

```bash
# Get database credentials
aws secretsmanager get-secret-value \
  --secret-id sonarqube-db-credentials \
  --region us-east-2 \
  --query SecretString \
  --output text | jq

# Test connection from SonarQube instance
aws ssm start-session --target $INSTANCE_ID --region us-east-2
psql -h <db-endpoint> -U sonarqube -d sonarqube
```

## Cost Estimate

| Resource | Cost (Monthly) |
|----------|----------------|
| EC2 t3.large (24/7) | ~$60 |
| RDS db.t3.small (24/7) | ~$25 |
| EBS 50 GB GP3 (EC2) | ~$4 |
| RDS Storage 20 GB GP3 | ~$2 |
| NAT Gateway | ~$32 |
| Data Transfer | ~$1 |
| **Total** | **~$124/month** |

**Cost Optimization**:
- Stop both EC2 and RDS when not in use: ~$6/month (storage only)
- Use t3.medium for EC2 if analysis is light: Save $30/month
- Use Aurora Serverless v2 for database: Variable cost based on usage
- Remove NAT gateway if not needed: Save $32/month

## Maintenance

### Update SonarQube

```bash
# Connect via SSM
aws ssm start-session --target $INSTANCE_ID --region us-east-2

# Stop SonarQube
sudo systemctl stop sonarqube

# Backup current installation
sudo cp -r /opt/sonarqube /opt/sonarqube.backup

# Download new version
cd /opt
sudo wget https://binaries.sonarsource.com/Distribution/sonarqube/sonarqube-<new-version>.zip
sudo unzip sonarqube-<new-version>.zip

# Copy configuration
sudo cp /opt/sonarqube/conf/sonar.properties /opt/sonarqube-<new-version>/conf/

# Update symlink or move directory
sudo mv /opt/sonarqube /opt/sonarqube-old
sudo mv /opt/sonarqube-<new-version> /opt/sonarqube
sudo chown -R sonarqube:sonarqube /opt/sonarqube

# Start SonarQube
sudo systemctl start sonarqube
```

### Backup Database

```bash
# Automated backups are enabled (7-day retention)
# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier <db-instance-id> \
  --db-snapshot-identifier sonarqube-manual-snapshot-$(date +%Y%m%d) \
  --region us-east-2
```

## Cleanup

To delete the SonarQube stack:

```bash
# Destroy the stack
npm run destroy

# Or via AWS CLI
aws cloudformation delete-stack --stack-name SonarQubeStack --region us-east-2

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name SonarQubeStack --region us-east-2
```

**Note**: RDS database will create a final snapshot before deletion (can be deleted separately if not needed).

## Stack Outputs

The stack provides these outputs:

- **SonarQubeURL**: Web interface URL
- **SonarQubeInstanceId**: EC2 instance ID
- **SonarQubePublicIp**: Public IP address
- **SonarQubeDefaultCredentials**: Default login credentials
- **SonarQubeSSMSessionCommand**: Command to connect via SSM
- **SonarQubeDbEndpoint**: PostgreSQL database endpoint
- **SonarQubeDbSecretArn**: ARN of database credentials secret

## Integration with CDK Infrastructure

This SonarQube server is configured to analyze:
1. MySQL Aurora CDK stack (`cdk-infrastructure-mysql`)
2. PostgreSQL Aurora CDK stack (`cdk-infrastructure-postgres`)
3. EC2 Instances CDK stack (`cdk-infrastructure-ec2-instances`)

Quality gates will block deployment if code quality standards are not met.

## Support

For issues or questions:
- Check SonarQube system log in UI (Administration > System > System Info)
- Review CloudWatch logs
- Check `/opt/sonarqube/logs/` on the instance
- Review security group and database connectivity
- Check [SonarQube documentation](https://docs.sonarqube.org/)
