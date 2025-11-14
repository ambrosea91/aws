#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { JenkinsStack } from '../lib/jenkins-stack';

const app = new cdk.App();

// Deploy Jenkins server in us-east-2 (same region as primary infrastructure)
new JenkinsStack(app, 'JenkinsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-2',
  },
  description: 'Jenkins CI/CD server for CDK infrastructure deployment',

  // Configuration - can be overridden via CDK context
  vpcCidr: process.env.JENKINS_VPC_CIDR,
  instanceType: process.env.JENKINS_INSTANCE_TYPE,
  githubRepo: process.env.GITHUB_REPO,

  // Security: Specify allowed IP addresses for Jenkins access
  // Example: allowedIps: ['1.2.3.4/32', '5.6.7.8/32']
  allowedIps: process.env.JENKINS_ALLOWED_IPS?.split(',') || [],

  tags: {
    Project: 'CDK-Infrastructure',
    Component: 'Jenkins',
    Environment: process.env.ENVIRONMENT || 'Production',
    ManagedBy: 'CDK',
  },
});

app.synth();
