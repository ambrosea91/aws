#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MysqlAuroraStack } from '../lib/mysql-aurora-stack';

const app = new cdk.App();

// Primary region stack (us-east-2)
new MysqlAuroraStack(app, 'MysqlAuroraPrimaryStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.PRIMARY_REGION || 'us-east-2',
  },
  description: 'MySQL Aurora Global Database - Primary Region (us-east-2)',
});

// Secondary region stack (us-west-2)
// Deploy this AFTER the primary stack is successfully deployed
// Uncomment the following after primary deployment:
/*
new MysqlAuroraStack(app, 'MysqlAuroraSecondaryStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.SECONDARY_REGION || 'us-west-2',
  },
  description: 'MySQL Aurora Global Database - Secondary Region (us-west-2)',
});
*/

app.synth();
