import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

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

    // Allow Jenkins access (port 8080)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(8080),
      'Allow Jenkins access'
    );

    // Allow SonarQube access (port 9000)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(9000),
      'Allow SonarQube access'
    );

    // Allow MySQL access (port 3306)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(3306),
      'Allow MySQL access'
    );

    // Allow HTTP access for web dashboard (port 80)
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP access for web dashboard'
    );

    // Create S3 bucket for installation scripts
    const scriptsBucket = new s3.Bucket(this, 'ScriptsBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // Create IAM role for EC2 instances
    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Grant read access to scripts bucket
    scriptsBucket.grantRead(role);

    // Deploy scripts to S3
    const scriptsDir = path.join(__dirname, '..', 'scripts');
    new s3deploy.BucketDeployment(this, 'DeployScripts', {
      sources: [s3deploy.Source.asset(scriptsDir)],
      destinationBucket: scriptsBucket,
      destinationKeyPrefix: 'scripts/',
    });

    // Create user data to download and execute scripts from S3
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Download scripts from S3',
      `aws s3 cp s3://${scriptsBucket.bucketName}/scripts/ /tmp/ --recursive --region ${this.region}`,
      '',
      '# Make scripts executable',
      'chmod +x /tmp/*.sh',
      '',
      '# Execute main orchestrator script',
      '/tmp/userdata.sh'
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
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          InstanceId: instance1.instanceId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when Instance 1 CPU exceeds 80%',
      alarmName: `${this.stackName}-Instance1-HighCPU`,
    });

    new cloudwatch.Alarm(this, 'Instance1StatusCheckFailed', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'StatusCheckFailed',
        dimensionsMap: {
          InstanceId: instance1.instanceId,
        },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when Instance 1 status checks fail',
      alarmName: `${this.stackName}-Instance1-StatusCheckFailed`,
    });

    // CloudWatch Alarms for Instance 2
    new cloudwatch.Alarm(this, 'Instance2HighCPU', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          InstanceId: instance2.instanceId,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when Instance 2 CPU exceeds 80%',
      alarmName: `${this.stackName}-Instance2-HighCPU`,
    });

    new cloudwatch.Alarm(this, 'Instance2StatusCheckFailed', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/EC2',
        metricName: 'StatusCheckFailed',
        dimensionsMap: {
          InstanceId: instance2.instanceId,
        },
        statistic: 'Maximum',
        period: cdk.Duration.minutes(1),
      }),
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
