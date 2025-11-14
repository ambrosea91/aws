import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class Ec2Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Validate required environment variables
    const keyPairName = process.env.EC2_KEY_PAIR_NAME;
    if (!keyPairName) {
      throw new Error('EC2_KEY_PAIR_NAME environment variable is required');
    }

    // Get configuration from context or use defaults
    const instanceType = this.node.tryGetContext('instanceType') || 't3.micro';
    const maxAzs = this.node.tryGetContext('maxAzs') || 2;
    const allowedSshIp = this.node.tryGetContext('allowedSshIp'); // Optional: restrict SSH to specific IP

    // Add cost allocation tags
    cdk.Tags.of(this).add('Project', this.node.tryGetContext('project') || 'CDK-Infrastructure');
    cdk.Tags.of(this).add('Environment', this.node.tryGetContext('environment') || 'Development');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('CostCenter', this.node.tryGetContext('costCenter') || 'Engineering');

    // Create VPC for EC2 instances
    const vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: maxAzs,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create Security Group
    const securityGroup = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {
      vpc,
      description: 'Security group for EC2 instances',
      allowAllOutbound: true,
    });

    // SSH Access: Use AWS Systems Manager Session Manager for secure access (no SSH port needed)
    // If you need SSH, uncomment and set allowedSshIp in cdk.json context
    // Recommended: Use SSM Session Manager instead (already configured via IAM role)
    if (allowedSshIp) {
      securityGroup.addIngressRule(
        ec2.Peer.ipv4(allowedSshIp),
        ec2.Port.tcp(22),
        'Allow SSH access from specific IP'
      );
    }
    // Note: To connect via SSM, use: aws ssm start-session --target <instance-id>

    // Allow HTTP access
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP access'
    );

    // Allow HTTPS access
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS access'
    );

    // Create IAM role for EC2 instances
    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // User data script for instance initialization
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -e',  // Exit on error
      '',
      '# Update system',
      'yum update -y',
      '',
      '# Install CloudWatch agent for monitoring',
      'yum install -y amazon-cloudwatch-agent',
      '',
      '# Install MySQL 5.7 client',
      'sudo yum install -y https://dev.mysql.com/get/mysql57-community-release-el7-11.noarch.rpm',
      'sudo yum install -y mysql-community-client',
      '',
      '# Verify MySQL client installation',
      'mysql --version > /tmp/mysql-version.txt',
      '',
      '# Install PostgreSQL client',
      'sudo yum install -y postgresql15',
      '',
      '# Install and configure Apache',
      'yum install -y httpd',
      'systemctl start httpd',
      'systemctl enable httpd',
      '',
      '# Create info page',
      'cat > /var/www/html/index.html <<EOF',
      '<html>',
      '<head><title>EC2 Instance Info</title></head>',
      '<body>',
      '<h1>Hello from EC2 Instance: $(hostname -f)</h1>',
      '<h2>Installed Database Clients:</h2>',
      '<ul>',
      '<li>MySQL Client: $(mysql --version 2>&1 | head -n1)</li>',
      '<li>PostgreSQL Client: $(psql --version 2>&1)</li>',
      '</ul>',
      '<p>Instance ID: $(ec2-metadata --instance-id | cut -d " " -f 2)</p>',
      '<p>Availability Zone: $(ec2-metadata --availability-zone | cut -d " " -f 2)</p>',
      '</body>',
      '</html>',
      'EOF',
      '',
      '# Start CloudWatch agent',
      'systemctl enable amazon-cloudwatch-agent',
      'systemctl start amazon-cloudwatch-agent',
      '',
      '# Log completion',
      'echo "User data script completed successfully at $(date)" >> /var/log/userdata.log'
    );

    // Parse instance type (e.g., "t3.micro" -> T3.MICRO)
    const [instanceClass, instanceSize] = instanceType.split('.');
    const parsedInstanceType = ec2.InstanceType.of(
      ec2.InstanceClass[instanceClass.toUpperCase() as keyof typeof ec2.InstanceClass],
      ec2.InstanceSize[instanceSize.toUpperCase() as keyof typeof ec2.InstanceSize]
    );

    // Create EC2 Instance 1
    const instance1 = new ec2.Instance(this, 'Instance1', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: parsedInstanceType,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup,
      role,
      userData,
      keyName: keyPairName,
      requireImdsv2: true, // Enforce IMDSv2 for security
    });

    // Create EC2 Instance 2
    const instance2 = new ec2.Instance(this, 'Instance2', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: parsedInstanceType,
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup,
      role,
      userData,
      keyName: keyPairName,
      requireImdsv2: true, // Enforce IMDSv2 for security
    });

    // CloudWatch Alarms for Instance 1
    new cloudwatch.Alarm(this, 'Instance1HighCPU', {
      metric: instance1.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when Instance 1 CPU exceeds 80%',
      alarmName: `${this.stackName}-Instance1-HighCPU`,
    });

    new cloudwatch.Alarm(this, 'Instance1StatusCheckFailed', {
      metric: instance1.metricStatusCheckFailed(),
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when Instance 1 status checks fail',
      alarmName: `${this.stackName}-Instance1-StatusCheckFailed`,
    });

    // CloudWatch Alarms for Instance 2
    new cloudwatch.Alarm(this, 'Instance2HighCPU', {
      metric: instance2.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when Instance 2 CPU exceeds 80%',
      alarmName: `${this.stackName}-Instance2-HighCPU`,
    });

    new cloudwatch.Alarm(this, 'Instance2StatusCheckFailed', {
      metric: instance2.metricStatusCheckFailed(),
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when Instance 2 status checks fail',
      alarmName: `${this.stackName}-Instance2-StatusCheckFailed`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: securityGroup.securityGroupId,
      description: 'Security Group ID',
      exportName: `${this.stackName}-SecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'Instance1Id', {
      value: instance1.instanceId,
      description: 'Instance 1 ID',
      exportName: `${this.stackName}-Instance1Id`,
    });

    new cdk.CfnOutput(this, 'Instance1PublicIp', {
      value: instance1.instancePublicIp,
      description: 'Instance 1 Public IP',
    });

    new cdk.CfnOutput(this, 'Instance1WebUrl', {
      value: `http://${instance1.instancePublicIp}`,
      description: 'Instance 1 Web URL',
    });

    new cdk.CfnOutput(this, 'Instance1SSMConnect', {
      value: `aws ssm start-session --target ${instance1.instanceId}`,
      description: 'Command to connect to Instance 1 via SSM',
    });

    new cdk.CfnOutput(this, 'Instance2Id', {
      value: instance2.instanceId,
      description: 'Instance 2 ID',
      exportName: `${this.stackName}-Instance2Id`,
    });

    new cdk.CfnOutput(this, 'Instance2PublicIp', {
      value: instance2.instancePublicIp,
      description: 'Instance 2 Public IP',
    });

    new cdk.CfnOutput(this, 'Instance2WebUrl', {
      value: `http://${instance2.instancePublicIp}`,
      description: 'Instance 2 Web URL',
    });

    new cdk.CfnOutput(this, 'Instance2SSMConnect', {
      value: `aws ssm start-session --target ${instance2.instanceId}`,
      description: 'Command to connect to Instance 2 via SSM',
    });
  }
}
