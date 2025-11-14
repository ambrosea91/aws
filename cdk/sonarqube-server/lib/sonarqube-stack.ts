import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface SonarQubeStackProps extends cdk.StackProps {
  /**
   * VPC CIDR block for the SonarQube server
   * @default '10.3.0.0/16'
   */
  vpcCidr?: string;

  /**
   * EC2 instance type for SonarQube server
   * @default 't3.large' - SonarQube requires more resources
   */
  instanceType?: string;

  /**
   * RDS instance type for PostgreSQL database
   * @default 'db.t3.small'
   */
  dbInstanceType?: string;

  /**
   * Allowed IP addresses for SonarQube access (CIDR notation)
   * @default [] - Must be configured for security
   */
  allowedIps?: string[];
}

export class SonarQubeStack extends cdk.Stack {
  public readonly sonarQubeUrl: string;
  public readonly sonarQubeInstanceId: string;
  public readonly sonarQubeToken: string;

  constructor(scope: Construct, id: string, props?: SonarQubeStackProps) {
    super(scope, id, props);

    // Get configuration from props or CDK context
    const vpcCidr = props?.vpcCidr || this.node.tryGetContext('sonarQubeVpcCidr') || '10.3.0.0/16';
    const instanceType = props?.instanceType || this.node.tryGetContext('sonarQubeInstanceType') || 't3.large';
    const dbInstanceType = props?.dbInstanceType || this.node.tryGetContext('sonarQubeDbInstanceType') || 'db.t3.small';
    const allowedIps = props?.allowedIps || this.node.tryGetContext('sonarQubeAllowedIps') || [];

    // Validation
    if (allowedIps.length === 0) {
      cdk.Annotations.of(this).addWarning(
        'No IP addresses configured for SonarQube access. Please set allowedIps in CDK context or props for security.'
      );
    }

    // Create VPC for SonarQube server
    const vpc = new ec2.Vpc(this, 'SonarQubeVpc', {
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
        {
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // Security Group for SonarQube
    const sonarQubeSg = new ec2.SecurityGroup(this, 'SonarQubeSecurityGroup', {
      vpc,
      description: 'Security group for SonarQube server',
      allowAllOutbound: true,
    });

    // Allow SonarQube web access (port 9000) from specified IPs only
    if (allowedIps.length > 0) {
      allowedIps.forEach((ip) => {
        sonarQubeSg.addIngressRule(
          ec2.Peer.ipv4(ip),
          ec2.Port.tcp(9000),
          `Allow SonarQube web access from ${ip}`
        );
      });
    } else {
      // Warning: Temporary allow all for initial setup (should be restricted)
      sonarQubeSg.addIngressRule(
        ec2.Peer.anyIpv4(),
        ec2.Port.tcp(9000),
        'TEMPORARY: Allow SonarQube web access from anywhere - RESTRICT THIS IN PRODUCTION'
      );
    }

    // Allow SSH from specified IPs only (for troubleshooting)
    if (allowedIps.length > 0) {
      allowedIps.forEach((ip) => {
        sonarQubeSg.addIngressRule(
          ec2.Peer.ipv4(ip),
          ec2.Port.tcp(22),
          `Allow SSH from ${ip}`
        );
      });
    }

    // Security Group for PostgreSQL database
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'SonarQubeDbSecurityGroup', {
      vpc,
      description: 'Security group for SonarQube PostgreSQL database',
      allowAllOutbound: false,
    });

    // Allow SonarQube server to access PostgreSQL
    dbSecurityGroup.addIngressRule(
      sonarQubeSg,
      ec2.Port.tcp(5432),
      'Allow SonarQube server to access PostgreSQL'
    );

    // Create database credentials
    const dbCredentials = new secretsmanager.Secret(this, 'SonarQubeDbCredentials', {
      secretName: 'sonarqube-db-credentials',
      description: 'SonarQube PostgreSQL database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'sonarqube' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        passwordLength: 20,
      },
    });

    // Create PostgreSQL database for SonarQube
    const dbInstance = new rds.DatabaseInstance(this, 'SonarQubeDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: new ec2.InstanceType(dbInstanceType),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName: 'sonarqube',
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      deletionProtection: false, // Set to true in production
      publiclyAccessible: false,
      multiAz: false, // Set to true for production
    });

    // IAM Role for SonarQube server
    const sonarQubeRole = new iam.Role(this, 'SonarQubeRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'IAM role for SonarQube server',
      managedPolicies: [
        // Allow SSM Session Manager access
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // Allow CloudWatch logs
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
      ],
    });

    // Grant SonarQube permission to read database credentials
    dbCredentials.grantRead(sonarQubeRole);

    // Create SonarQube admin token (for API access)
    const sonarQubeAdminToken = new secretsmanager.Secret(this, 'SonarQubeAdminToken', {
      secretName: 'sonarqube-admin-token',
      description: 'SonarQube admin token for API access',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'token',
        excludePunctuation: true,
        passwordLength: 40,
      },
    });

    sonarQubeAdminToken.grantRead(sonarQubeRole);

    // AMI - Amazon Linux 2023
    const ami = ec2.MachineImage.latestAmazonLinux2023({
      cpuType: ec2.AmazonLinuxCpuType.X86_64,
    });

    // User data script to install and configure SonarQube
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
      'dnf install -y java-17-amazon-corretto-headless wget unzip jq postgresql15',
      '',
      '# Configure system limits for SonarQube (required by Elasticsearch)',
      'cat >> /etc/sysctl.conf << EOF',
      'vm.max_map_count=524288',
      'fs.file-max=131072',
      'EOF',
      'sysctl -p',
      '',
      'cat >> /etc/security/limits.conf << EOF',
      'sonarqube   -   nofile   131072',
      'sonarqube   -   nproc    8192',
      'EOF',
      '',
      '# Create SonarQube user',
      'useradd -m -s /bin/bash sonarqube',
      '',
      '# Download and install SonarQube Community Edition',
      'cd /opt',
      'SONARQUBE_VERSION="10.3.0.82913"',
      'wget https://binaries.sonarsource.com/Distribution/sonarqube/sonarqube-${SONARQUBE_VERSION}.zip',
      'unzip sonarqube-${SONARQUBE_VERSION}.zip',
      'mv sonarqube-${SONARQUBE_VERSION} sonarqube',
      'rm sonarqube-${SONARQUBE_VERSION}.zip',
      '',
      '# Get database credentials from Secrets Manager',
      `DB_SECRET=$(aws secretsmanager get-secret-value --secret-id ${dbCredentials.secretName} --region ${this.region} --query SecretString --output text)`,
      'DB_PASSWORD=$(echo $DB_SECRET | jq -r .password)',
      `DB_ENDPOINT="${dbInstance.instanceEndpoint.hostname}"`,
      'DB_PORT="5432"',
      'DB_NAME="sonarqube"',
      'DB_USER="sonarqube"',
      '',
      '# Configure SonarQube',
      'cat > /opt/sonarqube/conf/sonar.properties << EOF',
      '# Database Configuration',
      'sonar.jdbc.username=${DB_USER}',
      'sonar.jdbc.password=${DB_PASSWORD}',
      'sonar.jdbc.url=jdbc:postgresql://${DB_ENDPOINT}:${DB_PORT}/${DB_NAME}',
      '',
      '# Web Server Configuration',
      'sonar.web.host=0.0.0.0',
      'sonar.web.port=9000',
      'sonar.web.javaOpts=-Xmx512m -Xms128m -XX:+HeapDumpOnOutOfMemoryError',
      '',
      '# Elasticsearch Configuration',
      'sonar.search.javaOpts=-Xmx512m -Xms512m -XX:MaxDirectMemorySize=256m -XX:+HeapDumpOnOutOfMemoryError',
      '',
      '# Compute Engine Configuration',
      'sonar.ce.javaOpts=-Xmx512m -Xms128m -XX:+HeapDumpOnOutOfMemoryError',
      '',
      '# Logging',
      'sonar.log.level=INFO',
      'sonar.path.logs=logs',
      'EOF',
      '',
      '# Set ownership',
      'chown -R sonarqube:sonarqube /opt/sonarqube',
      '',
      '# Create systemd service',
      'cat > /etc/systemd/system/sonarqube.service << EOF',
      '[Unit]',
      'Description=SonarQube service',
      'After=syslog.target network.target',
      '',
      '[Service]',
      'Type=forking',
      'ExecStart=/opt/sonarqube/bin/linux-x86-64/sonar.sh start',
      'ExecStop=/opt/sonarqube/bin/linux-x86-64/sonar.sh stop',
      'User=sonarqube',
      'Group=sonarqube',
      'Restart=always',
      'LimitNOFILE=131072',
      'LimitNPROC=8192',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      '',
      '# Start SonarQube',
      'systemctl daemon-reload',
      'systemctl enable sonarqube',
      'systemctl start sonarqube',
      '',
      '# Wait for SonarQube to start',
      'echo "Waiting for SonarQube to start (this may take 2-3 minutes)..."',
      'until curl -s http://localhost:9000/api/system/status | grep -q "UP"; do',
      '  echo "Waiting for SonarQube..."',
      '  sleep 10',
      'done',
      '',
      'echo "SonarQube is UP!"',
      '',
      '# Install CloudWatch agent',
      'wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm',
      'rpm -U ./amazon-cloudwatch-agent.rpm',
      '',
      '# Create CloudWatch config for SonarQube logs',
      'cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json << EOF',
      '{',
      '  "logs": {',
      '    "logs_collected": {',
      '      "files": {',
      '        "collect_list": [',
      '          {',
      '            "file_path": "/opt/sonarqube/logs/sonar.log",',
      '            "log_group_name": "/aws/ec2/sonarqube",',
      '            "log_stream_name": "{instance_id}/sonar.log"',
      '          },',
      '          {',
      '            "file_path": "/opt/sonarqube/logs/web.log",',
      '            "log_group_name": "/aws/ec2/sonarqube",',
      '            "log_stream_name": "{instance_id}/web.log"',
      '          },',
      '          {',
      '            "file_path": "/var/log/user-data.log",',
      '            "log_group_name": "/aws/ec2/sonarqube",',
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
      'cat > /tmp/sonarqube-info.txt << EOF',
      '========================================',
      'SonarQube Server Information',
      '========================================',
      'SonarQube URL: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):9000',
      'Default credentials: admin / admin',
      '(You will be prompted to change password on first login)',
      '',
      'Database endpoint: ${DB_ENDPOINT}',
      'Database name: ${DB_NAME}',
      '',
      'Projects to create:',
      '  - cdk-infrastructure-mysql',
      '  - cdk-infrastructure-postgres',
      '  - cdk-infrastructure-ec2-instances',
      '========================================',
      'EOF',
      '',
      'cat /tmp/sonarqube-info.txt',
      '',
      'echo "SonarQube installation complete!"'
    );

    // Create EC2 instance for SonarQube
    const sonarQubeInstance = new ec2.Instance(this, 'SonarQubeInstance', {
      vpc,
      instanceType: new ec2.InstanceType(instanceType),
      machineImage: ami,
      securityGroup: sonarQubeSg,
      role: sonarQubeRole,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // Public subnet for direct access
      },
      userData,
      userDataCausesReplacement: true,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(50, { // 50 GB for SonarQube data
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    // SonarQube depends on database being ready
    sonarQubeInstance.node.addDependency(dbInstance);

    // Add name tag
    cdk.Tags.of(sonarQubeInstance).add('Name', 'SonarQube-Server');
    cdk.Tags.of(sonarQubeInstance).add('Project', 'CDK-Infrastructure');
    cdk.Tags.of(sonarQubeInstance).add('ManagedBy', 'CDK');

    // Store instance details
    this.sonarQubeInstanceId = sonarQubeInstance.instanceId;
    this.sonarQubeUrl = `http://${sonarQubeInstance.instancePublicIp}:9000`;

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'SonarQubeURL', {
      value: this.sonarQubeUrl,
      description: 'SonarQube web interface URL',
      exportName: 'SonarQubeURL',
    });

    new cdk.CfnOutput(this, 'SonarQubeInstanceId', {
      value: sonarQubeInstance.instanceId,
      description: 'SonarQube EC2 instance ID',
      exportName: 'SonarQubeInstanceId',
    });

    new cdk.CfnOutput(this, 'SonarQubePublicIp', {
      value: sonarQubeInstance.instancePublicIp,
      description: 'SonarQube EC2 public IP address',
      exportName: 'SonarQubePublicIp',
    });

    new cdk.CfnOutput(this, 'SonarQubeDefaultCredentials', {
      value: 'Username: admin, Password: admin (change on first login)',
      description: 'Default SonarQube credentials',
    });

    new cdk.CfnOutput(this, 'SonarQubeSSMSessionCommand', {
      value: `aws ssm start-session --target ${sonarQubeInstance.instanceId} --region ${this.region}`,
      description: 'Command to connect to SonarQube instance via SSM Session Manager',
    });

    new cdk.CfnOutput(this, 'SonarQubeDbEndpoint', {
      value: dbInstance.instanceEndpoint.hostname,
      description: 'PostgreSQL database endpoint',
    });

    new cdk.CfnOutput(this, 'SonarQubeDbSecretArn', {
      value: dbCredentials.secretArn,
      description: 'ARN of the database credentials secret',
      exportName: 'SonarQubeDbCredentialsSecretArn',
    });
  }
}
