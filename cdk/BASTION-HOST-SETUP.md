# Bastion Host Setup Guide for Database Access

## Overview

Since the Aurora databases are deployed in isolated subnets with no internet access, you need a secure method to connect to them for administration and development purposes. This guide provides two recommended approaches.

## Option 1: Use EC2 Instance as Bastion (Recommended for Development)

### Quick Setup

You can use one of the existing EC2 instances from the `ec2-instances` stack as a bastion host for database access.

### Steps to Connect to Databases via EC2 Bastion

#### 1. Connect to EC2 Instance via SSM

```bash
# Get the instance ID from stack outputs
aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --query 'Stacks[0].Outputs[?OutputKey==`Instance1Id`].OutputValue' \
  --output text

# Connect via SSM Session Manager (no SSH key needed)
aws ssm start-session --target <INSTANCE-ID>
```

#### 2. Install Database Clients on EC2 Instance

Once connected to the EC2 instance via SSM:

**For MySQL:**
```bash
# Install MySQL client
sudo yum install -y mysql

# Get database endpoint from CDK outputs
MYSQL_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name MysqlAuroraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text \
  --region us-east-1)

# Get password from Secrets Manager
MYSQL_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id mysql-aurora-credentials \
  --query SecretString \
  --output text \
  --region us-east-1 | jq -r .password)

# Connect to MySQL
mysql -h $MYSQL_ENDPOINT -P 3306 -u admin -p$MYSQL_PASSWORD mydb
```

**For PostgreSQL:**
```bash
# Install PostgreSQL client
sudo yum install -y postgresql15

# Get database endpoint from CDK outputs
POSTGRES_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name PostgresAuroraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text \
  --region us-east-1)

# Get password from Secrets Manager
POSTGRES_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id postgres-aurora-credentials \
  --query SecretString \
  --output text \
  --region us-east-1 | jq -r .password)

# Connect to PostgreSQL
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_ENDPOINT -p 5432 -U postgres -d mydb
```

#### 3. Update Security Groups for Database Access

The databases only allow connections from within their VPC. To enable the EC2 instance to connect:

**For MySQL:**
```bash
# Get the EC2 security group ID
EC2_SG=$(aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --query 'Stacks[0].Outputs[?OutputKey==`SecurityGroupId`].OutputValue' \
  --output text)

# Get the MySQL security group ID
MYSQL_SG=$(aws cloudformation describe-stacks \
  --stack-name MysqlAuroraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SecurityGroupId`].OutputValue' \
  --output text)

# Allow EC2 instance to access MySQL
aws ec2 authorize-security-group-ingress \
  --group-id $MYSQL_SG \
  --protocol tcp \
  --port 3306 \
  --source-group $EC2_SG
```

**For PostgreSQL:**
```bash
# Get the PostgreSQL security group ID
POSTGRES_SG=$(aws cloudformation describe-stacks \
  --stack-name PostgresAuroraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`SecurityGroupId`].OutputValue' \
  --output text)

# Allow EC2 instance to access PostgreSQL
aws ec2 authorize-security-group-ingress \
  --group-id $POSTGRES_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $EC2_SG
```

---

## Option 2: SSM Port Forwarding (Recommended for Production)

This method creates a secure tunnel from your local machine to the database without exposing any ports.

### Prerequisites

- AWS CLI installed locally
- Session Manager plugin installed: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html
- Database client installed locally (mysql or psql)

### Setup for MySQL

```bash
# 1. Get instance ID and endpoint
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --query 'Stacks[0].Outputs[?OutputKey==`Instance1Id`].OutputValue' \
  --output text)

MYSQL_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name MysqlAuroraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text)

# 2. Start port forwarding session (in a separate terminal window)
aws ssm start-session \
  --target $INSTANCE_ID \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$MYSQL_ENDPOINT\"],\"portNumber\":[\"3306\"],\"localPortNumber\":[\"3306\"]}"

# 3. Connect from your local machine (in another terminal)
# Get password
MYSQL_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id mysql-aurora-credentials \
  --query SecretString \
  --output text | jq -r .password)

# Connect
mysql -h 127.0.0.1 -P 3306 -u admin -p$MYSQL_PASSWORD mydb
```

### Setup for PostgreSQL

```bash
# 1. Get instance ID and endpoint
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name Ec2Stack \
  --query 'Stacks[0].Outputs[?OutputKey==`Instance1Id`].OutputValue' \
  --output text)

POSTGRES_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name PostgresAuroraStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ClusterEndpoint`].OutputValue' \
  --output text)

# 2. Start port forwarding session (in a separate terminal window)
aws ssm start-session \
  --target $INSTANCE_ID \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$POSTGRES_ENDPOINT\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"5432\"]}"

# 3. Connect from your local machine (in another terminal)
# Get password
POSTGRES_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id postgres-aurora-credentials \
  --query SecretString \
  --output text | jq -r .password)

# Connect
PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -p 5432 -U postgres -d mydb
```

---

## Option 3: Dedicated Bastion Host Stack (Optional)

If you need a dedicated bastion host separate from the application EC2 instances, create a bastion host in the MySQL or PostgreSQL VPC:

### Bastion Host Configuration

Add this to your MySQL or PostgreSQL stack:

```typescript
// Create bastion host security group
const bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
  vpc,
  description: 'Security group for bastion host',
  allowAllOutbound: true,
});

// Optional: Restrict SSH access to specific IP
const allowedSshIp = this.node.tryGetContext('allowedSshIp');
if (allowedSshIp) {
  bastionSecurityGroup.addIngressRule(
    ec2.Peer.ipv4(allowedSshIp),
    ec2.Port.tcp(22),
    'Allow SSH from specific IP'
  );
}

// Create bastion host
const bastionHost = new ec2.Instance(this, 'BastionHost', {
  vpc,
  vpcSubnets: {
    subnetType: ec2.SubnetType.PUBLIC,
  },
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
  machineImage: ec2.MachineImage.latestAmazonLinux2023(),
  securityGroup: bastionSecurityGroup,
  role: new iam.Role(this, 'BastionRole', {
    assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
    ],
  }),
  requireImdsv2: true,
});

// Allow bastion to access database
dbSecurityGroup.addIngressRule(
  bastionSecurityGroup,
  ec2.Port.tcp(3306), // or 5432 for PostgreSQL
  'Allow access from bastion host'
);

// Output bastion host ID
new cdk.CfnOutput(this, 'BastionHostId', {
  value: bastionHost.instanceId,
  description: 'Bastion host instance ID',
});
```

---

## Security Best Practices

1. **Use SSM Session Manager instead of SSH** - No need to manage SSH keys or expose SSH ports
2. **Rotate database credentials regularly** - Use AWS Secrets Manager rotation
3. **Use IAM database authentication** - For production, enable IAM authentication for databases
4. **Restrict bastion access** - Use IP whitelisting or VPN for bastion access
5. **Enable CloudWatch logging** - Monitor all bastion host activity
6. **Use VPC Flow Logs** - Track all network traffic for audit purposes

---

## Troubleshooting

### Cannot connect to database from EC2 instance

1. **Check security groups**: Ensure the EC2 security group is allowed in the database security group
   ```bash
   aws ec2 describe-security-groups --group-ids <DB_SG_ID>
   ```

2. **Check VPC peering**: If using different VPCs, ensure they are peered

3. **Check route tables**: Ensure proper routing between subnets

### SSM Session Manager not working

1. **Install SSM plugin**:
   - macOS: `brew install --cask session-manager-plugin`
   - Linux: Follow AWS documentation
   - Windows: Download from AWS

2. **Check IAM permissions**: Ensure your IAM user has SSM permissions

3. **Check instance connectivity**: Ensure EC2 instance can reach SSM endpoints

---

## Quick Reference

### Useful Commands

```bash
# List all stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Get all outputs from a stack
aws cloudformation describe-stacks --stack-name <STACK-NAME> --query 'Stacks[0].Outputs'

# List all running EC2 instances
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].[InstanceId,Tags[?Key==`Name`].Value|[0]]' --output table

# Get secret value
aws secretsmanager get-secret-value --secret-id <SECRET-NAME> --query SecretString --output text | jq
```

---

## Next Steps

1. Choose the access method that best fits your use case
2. Set up the necessary security group rules
3. Test the connection to ensure it works
4. Document your team's access procedure
5. Consider implementing automated credential rotation

For more information, see the main [README.md](./README.md) and [SETUP-GUIDE.md](./SETUP-GUIDE.md).
