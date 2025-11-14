import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface JenkinsStackProps extends cdk.StackProps {
  /**
   * VPC CIDR block for the Jenkins server
   * @default '10.2.0.0/16'
   */
  vpcCidr?: string;

  /**
   * EC2 instance type for Jenkins server
   * @default 't3.medium' - Jenkins requires more resources
   */
  instanceType?: string;

  /**
   * GitHub repository for CDK infrastructure
   * @default '' - Must be set for Jenkins integration
   */
  githubRepo?: string;

  /**
   * Allowed IP addresses for Jenkins access (CIDR notation)
   * @default [] - Must be configured for security
   */
  allowedIps?: string[];
}

export class JenkinsStack extends cdk.Stack {
  public readonly jenkinsUrl: string;
  public readonly jenkinsInstanceId: string;

  constructor(scope: Construct, id: string, props?: JenkinsStackProps) {
    super(scope, id, props);

    // Get configuration from props or CDK context
    const vpcCidr = props?.vpcCidr || this.node.tryGetContext('jenkinsVpcCidr') || '10.2.0.0/16';
    const instanceType = props?.instanceType || this.node.tryGetContext('jenkinsInstanceType') || 't3.medium';
    const githubRepo = props?.githubRepo || this.node.tryGetContext('githubRepo') || process.env.GITHUB_REPO || '';
    const allowedIps = props?.allowedIps || this.node.tryGetContext('jenkinsAllowedIps') || [];

    // Validation
    if (allowedIps.length === 0) {
      cdk.Annotations.of(this).addWarning(
        'No IP addresses configured for Jenkins access. Please set allowedIps in CDK context or props for security.'
      );
    }

    // Create VPC for Jenkins server
    const vpc = new ec2.Vpc(this, 'JenkinsVpc', {
      ipAddresses: ec2.IpAddresses.cidr(vpcCidr),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // Security Group for Jenkins
    const jenkinsSg = new ec2.SecurityGroup(this, 'JenkinsSecurityGroup', {
      vpc,
      description: 'Security group for Jenkins CI/CD server',
      allowAllOutbound: true,
    });

    // Allow Jenkins web access (port 8080) from specified IPs only
    if (allowedIps.length > 0) {
      allowedIps.forEach((ip, index) => {
        jenkinsSg.addIngressRule(
          ec2.Peer.ipv4(ip),
          ec2.Port.tcp(8080),
          `Allow Jenkins web access from ${ip}`
        );
      });
    } else {
      // Warning: Temporary allow all for initial setup (should be restricted)
      jenkinsSg.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(8080),
        'TEMPORARY: Allow Jenkins web access from anywhere - RESTRICT THIS IN PRODUCTION'
      );
    }

    // Allow SSH from specified IPs only (for troubleshooting)
    if (allowedIps.length > 0) {
      allowedIps.forEach((ip, index) => {
        jenkinsSg.addIngressRule(
          ec2.Peer.ipv4(ip),
          ec2.Port.tcp(22),
          `Allow SSH from ${ip}`
        );
      });
    }

    // IAM Role for Jenkins with necessary permissions
    const jenkinsRole = new iam.Role(this, 'JenkinsRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for Jenkins server',
      managedPolicies: [
        // Allow SSM Session Manager access
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // Allow CloudWatch logs
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Add permissions for CDK deployment
    jenkinsRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudformation:*',
        'ec2:*',
        'rds:*',
        'secretsmanager:*',
        'iam:*',
        's3:*',
        'logs:*',
        'sns:*',
        'cloudwatch:*',
        'ssm:GetParameter',
        'ssm:GetParameters',
      ],
      resources: ['*'],
    }));

    // Create secret for Jenkins admin password
    const jenkinsAdminPassword = new secretsmanager.Secret(this, 'JenkinsAdminPassword', {
      secretName: 'jenkins-admin-password',
      description: 'Jenkins administrator password',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 20,
      },
    });

    // Grant Jenkins role permission to read its own admin password
    jenkinsAdminPassword.grantRead(jenkinsRole);

    // AMI - Amazon Linux 2023
    const ami = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });

    // User data script to install and configure Jenkins
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      '',
      '# Log all output',
      'exec > >(tee /var/log/user-data.log)',
      'exec 2>&1',
      '',
      '# Update system',
      'dnf update -y',
      '',
      '# Install required packages',
      'dnf install -y java-17-amazon-corretto-devel wget git',
      '',
      '# Install Node.js 20.x for CDK',
      'curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -',
      'dnf install -y nodejs',
      '',
      '# Install AWS CDK',
      'npm install -g aws-cdk',
      '',
      '# Install Jenkins',
      'wget -O /etc/yum.repos.d/jenkins.repo https://pkg.jenkins.io/redhat-stable/jenkins.repo',
      'rpm --import https://pkg.jenkins.io/redhat-stable/jenkins.io-2023.key',
      'dnf install -y jenkins',
      '',
      '# Install Docker for potential containerized builds',
      'dnf install -y docker',
      'systemctl start docker',
      'systemctl enable docker',
      'usermod -aG docker jenkins',
      '',
      '# Configure Jenkins',
      'systemctl start jenkins',
      'systemctl enable jenkins',
      '',
      '# Wait for Jenkins to start',
      'echo "Waiting for Jenkins to start..."',
      'sleep 60',
      '',
      '# Get initial admin password',
      'INITIAL_PASSWORD=$(cat /var/lib/jenkins/secrets/initialAdminPassword)',
      '',
      '# Store admin password in SSM Parameter Store for easy retrieval',
      'aws ssm put-parameter \\',
      '  --name "/jenkins/initial-admin-password" \\',
      '  --value "$INITIAL_PASSWORD" \\',
      `  --region ${this.region} \\`,
      '  --type "SecureString" \\',
      '  --overwrite || true',
      '',
      '# Install Jenkins plugins (CLI)',
      'wget http://localhost:8080/jnlpJars/jenkins-cli.jar',
      '',
      '# Wait for Jenkins to be fully ready',
      'until curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200\\|403"; do',
      '  echo "Waiting for Jenkins..."',
      '  sleep 10',
      'done',
      '',
      '# Install CloudWatch agent',
      'wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm',
      'rpm -U ./amazon-cloudwatch-agent.rpm',
      '',
      '# Create CloudWatch config for Jenkins logs',
      'cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << EOF',
      '{',
      '  "logs": {',
      '    "logs_collected": {',
      '      "files": {',
      '        "collect_list": [',
      '          {',
      '            "file_path": "/var/log/jenkins/jenkins.log",',
      '            "log_group_name": "/aws/ec2/jenkins",',
      '            "log_stream_name": "{instance_id}/jenkins.log"',
      '          },',
      '          {',
      '            "file_path": "/var/log/user-data.log",',
      '            "log_group_name": "/aws/ec2/jenkins",',
      '            "log_stream_name": "{instance_id}/user-data.log"',
      '          }',
      '        ]',
      '      }',
      '    }',
      '  }',
      '}',
      'EOF',
      '',
      '# Start CloudWatch agent',
      '/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \\',
      '  -a fetch-config \\',
      '  -m ec2 \\',
      '  -s \\',
      '  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json',
      '',
      '# Create info page',
      'cat > /tmp/jenkins-info.txt << EOF',
      '========================================',
      'Jenkins Server Information',
      '========================================',
      'Jenkins URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):8080',
      'Initial Admin Password: $INITIAL_PASSWORD',
      '',
      'To retrieve password from SSM:',
      `aws ssm get-parameter --name "/jenkins/initial-admin-password" --region ${this.region} --with-decryption --query Parameter.Value --output text`,
      '',
      'GitHub Repository: ${githubRepo}',
      '========================================',
      'EOF',
      '',
      'cat /tmp/jenkins-info.txt',
      '',
      'echo "Jenkins installation complete!"'
    );

    // Create EC2 instance for Jenkins
    const jenkinsInstance = new ec2.Instance(this, 'JenkinsInstance', {
      vpc,
      instanceType: new ec2.InstanceType(instanceType),
      machineImage: ami,
      securityGroup: jenkinsSg,
      role: jenkinsRole,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // Public subnet for direct access
      },
      userData,
      userDataCausesReplacement: true,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(50, { // 50 GB for Jenkins workspace
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    // Add name tag
    cdk.Tags.of(jenkinsInstance).add('Name', 'Jenkins-CI-CD-Server');
    cdk.Tags.of(jenkinsInstance).add('Project', 'CDK-Infrastructure');
    cdk.Tags.of(jenkinsInstance).add('ManagedBy', 'CDK');

    // Store instance details
    this.jenkinsInstanceId = jenkinsInstance.instanceId;
    this.jenkinsUrl = `http://${jenkinsInstance.instancePublicIp}:8080`;

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'JenkinsURL', {
      value: this.jenkinsUrl,
      description: 'Jenkins web interface URL',
      exportName: 'JenkinsURL',
    });

    new cdk.CfnOutput(this, 'JenkinsInstanceId', {
      value: jenkinsInstance.instanceId,
      description: 'Jenkins EC2 instance ID',
      exportName: 'JenkinsInstanceId',
    });

    new cdk.CfnOutput(this, 'JenkinsPublicIp', {
      value: jenkinsInstance.instancePublicIp,
      description: 'Jenkins EC2 public IP address',
      exportName: 'JenkinsPublicIp',
    });

    new cdk.CfnOutput(this, 'JenkinsAdminPasswordCommand', {
      value: `aws ssm get-parameter --name "/jenkins/initial-admin-password" --region ${this.region} --with-decryption --query Parameter.Value --output text`,
      description: 'Command to retrieve Jenkins initial admin password',
    });

    new cdk.CfnOutput(this, 'JenkinsSSMSessionCommand', {
      value: `aws ssm start-session --target ${jenkinsInstance.instanceId} --region ${this.region}`,
      description: 'Command to connect to Jenkins instance via SSM Session Manager',
    });

    new cdk.CfnOutput(this, 'JenkinsSecretArn', {
      value: jenkinsAdminPassword.secretArn,
      description: 'ARN of the Jenkins admin password secret',
      exportName: 'JenkinsAdminPasswordSecretArn',
    });
  }
}
