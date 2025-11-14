#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Ec2Stack } from '../lib/ec2-stack';

const app = new cdk.App();

new Ec2Stack(app, 'Ec2Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-2',
  },
  description: 'Stack for EC2 instances with MySQL 5.7 and PostgreSQL clients',
});

app.synth();
