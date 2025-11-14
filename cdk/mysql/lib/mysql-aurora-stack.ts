import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export class MysqlAuroraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get configuration from context or use defaults
    const dbInstanceType = this.node.tryGetContext('dbInstanceType') || 't3.medium';
    const maxAzs = this.node.tryGetContext('maxAzs') || 2;
    const backupRetentionDays = this.node.tryGetContext('backupRetentionDays') || 7;
    const databaseName = this.node.tryGetContext('databaseName') || 'mydb';
    const enableDeletionProtection = this.node.tryGetContext('enableDeletionProtection') !== false; // default true

    // Add cost allocation tags
    cdk.Tags.of(this).add('Project', this.node.tryGetContext('project') || 'CDK-Infrastructure');
    cdk.Tags.of(this).add('Environment', this.node.tryGetContext('environment') || 'Development');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('CostCenter', this.node.tryGetContext('costCenter') || 'Engineering');
    cdk.Tags.of(this).add('Database', 'MySQL-Aurora');

    // Create VPC for the database
    const vpc = new ec2.Vpc(this, 'MysqlVPC', {
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
        {
          cidrMask: 28,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Create database credentials secret
    const dbCredentials = new secretsmanager.Secret(this, 'MysqlCredentials', {
      secretName: 'mysql-aurora-credentials',
      description: 'MySQL Aurora database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Create security group for the database
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'MysqlSecurityGroup', {
      vpc,
      description: 'Security group for MySQL Aurora cluster',
      allowAllOutbound: true,
    });

    // Allow MySQL port from VPC CIDR
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(3306),
      'Allow MySQL access from VPC'
    );

    // Create parameter group for MySQL 8.0
    const parameterGroup = new rds.ParameterGroup(this, 'MysqlParameterGroup', {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_04_0, // MySQL 8.0 compatible
      }),
      description: 'Custom parameter group for MySQL Aurora',
      parameters: {
        character_set_server: 'utf8mb4',
        collation_server: 'utf8mb4_unicode_ci',
        max_connections: '1000',
        slow_query_log: '1',
        long_query_time: '2',
      },
    });

    // Parse instance type (e.g., "t3.medium" -> T3.MEDIUM)
    const [instanceClass, instanceSize] = dbInstanceType.split('.');
    const parsedInstanceType = ec2.InstanceType.of(
      ec2.InstanceClass[instanceClass.toUpperCase() as keyof typeof ec2.InstanceClass],
      ec2.InstanceSize[instanceSize.toUpperCase() as keyof typeof ec2.InstanceSize]
    );

    // Create Aurora MySQL Global Database
    const globalCluster = new rds.GlobalCluster(this, 'MysqlGlobalCluster', {
      globalClusterIdentifier: 'mysql-global-cluster',
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_04_0,
      }),
      defaultDatabaseName: databaseName,
      // Removal policy for production should be RETAIN
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // Primary cluster (us-east-1 or your primary region)
    const primaryCluster = new rds.DatabaseCluster(this, 'MysqlPrimaryCluster', {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_04_0,
      }),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      writer: rds.ClusterInstance.provisioned('Writer', {
        instanceType: parsedInstanceType,
        publiclyAccessible: false,
      }),
      readers: [
        rds.ClusterInstance.provisioned('Reader1', {
          instanceType: parsedInstanceType,
          publiclyAccessible: false,
        }),
      ],
      parameterGroup,
      backup: {
        retention: cdk.Duration.days(backupRetentionDays),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      cloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit'],
      cloudwatchLogsRetention: 30,
      storageEncrypted: true,
      deletionProtection: enableDeletionProtection,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // CloudWatch Alarms for MySQL Aurora
    new cloudwatch.Alarm(this, 'MysqlHighCPU', {
      metric: primaryCluster.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when MySQL cluster CPU exceeds 80%',
      alarmName: `${this.stackName}-MySQL-HighCPU`,
    });

    new cloudwatch.Alarm(this, 'MysqlHighConnections', {
      metric: primaryCluster.metricDatabaseConnections(),
      threshold: 900, // 90% of max_connections (1000)
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when MySQL connections exceed 900',
      alarmName: `${this.stackName}-MySQL-HighConnections`,
    });

    new cloudwatch.Alarm(this, 'MysqlLowFreeableMemory', {
      metric: primaryCluster.metric('FreeableMemory', {
        statistic: 'Average',
      }),
      threshold: 512 * 1024 * 1024, // 512 MB in bytes
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'Alert when MySQL freeable memory is below 512 MB',
      alarmName: `${this.stackName}-MySQL-LowMemory`,
    });

    new cloudwatch.Alarm(this, 'MysqlHighReplicationLag', {
      metric: primaryCluster.metric('AuroraReplicaLag', {
        statistic: 'Average',
      }),
      threshold: 1000, // 1 second in milliseconds
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when MySQL replica lag exceeds 1 second',
      alarmName: `${this.stackName}-MySQL-HighReplicationLag`,
    });

    // Associate primary cluster with global cluster
    const cfnDbCluster = primaryCluster.node.defaultChild as rds.CfnDBCluster;
    cfnDbCluster.globalClusterIdentifier = globalCluster.globalClusterIdentifier;

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
      description: 'VPC ID for MySQL Aurora',
      exportName: `${this.stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'GlobalClusterIdentifier', {
      value: globalCluster.globalClusterIdentifier!,
      description: 'Global Cluster Identifier',
      exportName: `${this.stackName}-GlobalClusterId`,
    });

    new cdk.CfnOutput(this, 'ClusterId', {
      value: primaryCluster.clusterIdentifier,
      description: 'Primary cluster identifier',
      exportName: `${this.stackName}-ClusterId`,
    });

    new cdk.CfnOutput(this, 'ClusterEndpoint', {
      value: primaryCluster.clusterEndpoint.hostname,
      description: 'Primary cluster writer endpoint hostname',
      exportName: `${this.stackName}-ClusterEndpoint`,
    });

    new cdk.CfnOutput(this, 'ClusterPort', {
      value: primaryCluster.clusterEndpoint.port.toString(),
      description: 'Primary cluster port',
    });

    new cdk.CfnOutput(this, 'ClusterReadEndpoint', {
      value: primaryCluster.clusterReadEndpoint.hostname,
      description: 'Primary cluster reader endpoint hostname',
      exportName: `${this.stackName}-ClusterReadEndpoint`,
    });

    new cdk.CfnOutput(this, 'ConnectionString', {
      value: `mysql -h ${primaryCluster.clusterEndpoint.hostname} -P ${primaryCluster.clusterEndpoint.port} -u admin -p ${databaseName}`,
      description: 'MySQL connection command (retrieve password from Secrets Manager)',
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: dbCredentials.secretArn,
      description: 'ARN of the database credentials secret',
      exportName: `${this.stackName}-SecretArn`,
    });

    new cdk.CfnOutput(this, 'SecretName', {
      value: dbCredentials.secretName,
      description: 'Name of the database credentials secret',
    });

    new cdk.CfnOutput(this, 'GetPasswordCommand', {
      value: `aws secretsmanager get-secret-value --secret-id ${dbCredentials.secretName} --query SecretString --output text | jq -r .password`,
      description: 'Command to retrieve database password',
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      value: dbSecurityGroup.securityGroupId,
      description: 'Security Group ID for database access',
      exportName: `${this.stackName}-SecurityGroupId`,
    });

    // Note: To connect to the database, you need to be in the VPC (use bastion host or VPN)
    // Retrieve the password using: aws secretsmanager get-secret-value --secret-id mysql-aurora-credentials
  }
}
