#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SonarQubeStack } from '../lib/sonarqube-stack';

const app = new cdk.App();

// Deploy SonarQube server in us-east-2 (same region as primary infrastructure)
new SonarQubeStack(app, 'SonarQubeStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2',
  },
  description: 'SonarQube code quality server for CDK infrastructure',

  // Configuration - can be overridden via CDK context
  vpcCidr: process.env.SONARQUBE_VPC_CIDR,
  instanceType: process.env.SONARQUBE_INSTANCE_TYPE,
  dbInstanceType: process.env.SONARQUBE_DB_INSTANCE_TYPE,

  // Security: Specify allowed IP addresses for SonarQube access
  // Example: allowedIps: ['1.2.3.4/32', '5.6.7.8/32']
  allowedIps: process.env.SONARQUBE_ALLOWED_IPS?.split(',') || [],

  tags: {
    Project: 'CDK-Infrastructure',
    Component: 'SonarQube',
    Environment: process.env.ENVIRONMENT || 'Production',
    ManagedBy: 'CDK',
  },
});

app.synth();
