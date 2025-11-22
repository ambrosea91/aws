# RDS Blue-Green Deployment - Database Upgrades

This folder contains CloudFormation templates and automation for performing blue-green deployments to upgrade Aurora databases from one major version to another.

## What is Blue-Green Deployment?

Blue-Green deployment is an AWS RDS feature that:
- Creates a staging (green) environment that mirrors your production (blue) environment
- Applies the upgrade to the green environment
- Keeps both environments in sync via replication
- Allows testing on the green environment before switchover
- Performs a quick switchover (typically 1 minute) when ready
- Minimizes downtime and provides easy rollback

## Supported Upgrades

### MySQL
- **From**: Aurora MySQL 5.7
- **To**: Aurora MySQL 8.0
- **Template**: `mysql-bluegreen-upgrade.yaml`

### PostgreSQL
- **From**: Aurora PostgreSQL 14
- **To**: Aurora PostgreSQL 16 (latest)
- **Template**: `postgres-bluegreen-upgrade.yaml`

## Architecture

Each template creates:
- **Lambda Functions**: Manage blue-green deployment lifecycle
  - Create deployment
  - Check status
  - Perform switchover
  - Cleanup old environment
- **Step Functions State Machine**: Orchestrates the upgrade process
- **SNS Topic**: Sends notifications about deployment progress
- **IAM Roles**: Permissions for Lambda and Step Functions

## Deployment Process

### Phase 1: Deploy Automation Infrastructure

This creates the Lambda functions and Step Functions needed to manage blue-green deployments.

#### Via GitHub Actions

1. Go to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Parameters:
   - **Action**: deploy-automation
   - **Environment**: dev/test/prod
   - **Database Type**: mysql/postgres/both
   - **Region**: us-east-2 (where your primary database is)
4. Click **Run workflow**

#### Via AWS CLI

```bash
# MySQL
aws cloudformation deploy \
  --template-file mysql-bluegreen-upgrade.yaml \
  --stack-name dev-mysql-bluegreen \
  --parameter-overrides Environment=dev \
  --capabilities CAPABILITY_IAM \
  --region us-east-2

# PostgreSQL
aws cloudformation deploy \
  --template-file postgres-bluegreen-upgrade.yaml \
  --stack-name dev-postgres-bluegreen \
  --parameter-overrides Environment=dev \
  --capabilities CAPABILITY_IAM \
  --region us-east-2
```

### Phase 2: Start the Upgrade

This creates the green environment and begins replication from blue to green.

#### Via GitHub Actions

1. Go to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Parameters:
   - **Action**: start-upgrade
   - **Environment**: dev/test/prod
   - **Database Type**: mysql or postgres
   - **Region**: us-east-2
   - **Source Cluster ID**: Your current cluster ID (e.g., `dev-mysql57-primary-cluster`)
4. Click **Run workflow**

#### Via AWS CLI

```bash
# Get the State Machine ARN
STATE_MACHINE_ARN=$(aws cloudformation describe-stacks \
  --stack-name dev-mysql-bluegreen \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`StateMachineArn`].OutputValue' \
  --output text)

# Start execution
aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE_ARN \
  --name mysql-upgrade-$(date +%Y%m%d-%H%M%S) \
  --input '{
    "sourceClusterIdentifier": "dev-mysql57-primary-cluster",
    "targetEngineVersion": "8.0.mysql_aurora.3.04.1",
    "blueGreenDeploymentName": "mysql-57-to-80-upgrade"
  }' \
  --region us-east-2
```

**What Happens:**
1. Green environment is created (takes 30-45 minutes)
2. Data is replicated from blue to green
3. SNS notification sent when green environment is ready for testing
4. State machine waits for manual approval (1 hour by default)

### Phase 3: Test the Green Environment

While the state machine is waiting:

```bash
# Get green environment endpoint
aws rds describe-blue-green-deployments \
  --region us-east-2 \
  --query 'BlueGreenDeployments[0].Target'

# Connect and test (use the green cluster endpoint)
mysql -h <green-endpoint> -u admin -p mydb
# OR
psql -h <green-endpoint> -U postgres -d mydb

# Run your test suite
# Verify application compatibility
# Check performance
```

### Phase 4: Perform Switchover

Once you've validated the green environment:

#### Via GitHub Actions

1. Go to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Parameters:
   - **Action**: perform-switchover
   - **Environment**: dev/test/prod
   - **Database Type**: mysql or postgres
   - **Region**: us-east-2
   - **Deployment ID**: The blue-green deployment ID from Phase 2
4. Click **Run workflow**

#### Via AWS CLI

```bash
# Manual switchover (if you don't want to wait for Step Functions)
aws rds switchover-blue-green-deployment \
  --blue-green-deployment-identifier <deployment-id> \
  --switchover-timeout 300 \
  --region us-east-2
```

**What Happens:**
1. Applications are briefly disconnected (1 minute typical)
2. Green becomes the new production
3. Blue becomes the old environment
4. Your application reconnects to the upgraded database

### Phase 5: Cleanup

After verifying everything works on the new version:

#### Via GitHub Actions

1. Go to **Actions** → **Blue-Green Database Upgrade**
2. Click **Run workflow**
3. Parameters:
   - **Action**: cleanup
   - **Deployment ID**: The blue-green deployment ID
4. Click **Run workflow**

#### Via AWS CLI

```bash
aws rds delete-blue-green-deployment \
  --blue-green-deployment-identifier <deployment-id> \
  --delete-target true \
  --region us-east-2
```

This removes the old (blue) environment.

## Monitoring

### Step Functions Console

1. Go to AWS Step Functions console
2. Find your state machine: `dev-mysql-bluegreen-upgrade` or `dev-postgres-bluegreen-upgrade`
3. View execution details and current state

### SNS Notifications

Subscribe to the SNS topic to receive notifications:

```bash
# Get SNS Topic ARN
TOPIC_ARN=$(aws cloudformation describe-stacks \
  --stack-name dev-mysql-bluegreen \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`NotificationTopicArn`].OutputValue' \
  --output text)

# Subscribe email
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol email \
  --notification-endpoint your-email@example.com \
  --region us-east-2
```

### Blue-Green Deployment Status

```bash
# List all blue-green deployments
aws rds describe-blue-green-deployments --region us-east-2

# Get specific deployment details
aws rds describe-blue-green-deployments \
  --blue-green-deployment-identifier <deployment-id> \
  --region us-east-2
```

## Rollback Strategy

### Before Switchover
Simply delete the blue-green deployment:
```bash
aws rds delete-blue-green-deployment \
  --blue-green-deployment-identifier <deployment-id> \
  --delete-target true \
  --region us-east-2
```

### After Switchover
If you need to rollback after switchover:
1. The old environment is still available (until cleanup)
2. You can modify your application to point back to the old cluster
3. Or create a new blue-green deployment to go back to the old version

## Cost Considerations

During blue-green deployment:
- You pay for **both** blue and green environments
- Green environment is identical to blue (same instance types, count)
- Typical deployment lifecycle: 2-4 hours (testing time varies)
- Plan upgrades during low-traffic periods to minimize cost

Example cost:
- Current cluster: 2 x db.r5.large = $0.58/hour
- During upgrade: 4 x db.r5.large = $1.16/hour
- For 3-hour upgrade window: ~$3.48 additional cost

## Troubleshooting

### Deployment Fails to Create

```bash
# Check Lambda logs
aws logs tail /aws/lambda/dev-mysql-create-bluegreen --follow

# Check Step Functions execution
aws stepfunctions describe-execution \
  --execution-arn <execution-arn> \
  --region us-east-2
```

### Switchover Takes Too Long

- Default timeout: 300 seconds (5 minutes)
- Can extend to 900 seconds (15 minutes) max
- Long switchover usually indicates heavy write load
- Consider pausing application writes during switchover

### Green Environment Issues

The green environment is isolated - you can:
- Delete it without affecting production
- Restart the process with different parameters
- Extend testing time by manually updating Step Functions wait time

## Best Practices

1. **Test in Non-Production First**: Always test the upgrade process in dev/test before production
2. **Subscribe to SNS**: Set up email/Slack notifications for deployment events
3. **Plan Maintenance Window**: Schedule upgrades during low-traffic periods
4. **Verify Application Compatibility**: Test your application against the green environment thoroughly
5. **Monitor Replication Lag**: Ensure green is in sync before switchover
6. **Have Rollback Plan**: Know how to rollback if issues occur
7. **Communicate**: Notify stakeholders about the upgrade window

## Example: Complete Upgrade Flow

```bash
# 1. Deploy automation (one-time setup)
aws cloudformation deploy \
  --template-file mysql-bluegreen-upgrade.yaml \
  --stack-name prod-mysql-bluegreen \
  --parameter-overrides Environment=prod \
  --capabilities CAPABILITY_IAM \
  --region us-east-2

# 2. Start upgrade
STATE_MACHINE_ARN=$(aws cloudformation describe-stacks \
  --stack-name prod-mysql-bluegreen \
  --region us-east-2 \
  --query 'Stacks[0].Outputs[?OutputKey==`StateMachineArn`].OutputValue' \
  --output text)

aws stepfunctions start-execution \
  --state-machine-arn $STATE_MACHINE_ARN \
  --name mysql-upgrade-prod-20241117 \
  --input '{
    "sourceClusterIdentifier": "prod-mysql57-primary-cluster",
    "targetEngineVersion": "8.0.mysql_aurora.3.04.1",
    "blueGreenDeploymentName": "mysql-prod-upgrade"
  }' \
  --region us-east-2

# 3. Wait for SNS notification (30-45 minutes)
# 4. Test green environment
# 5. Perform switchover (via GitHub Actions or CLI)
# 6. Verify production
# 7. Cleanup old environment
```

## Version Compatibility

### MySQL
- 5.7 → 8.0: Supported, review MySQL 8.0 breaking changes
- Check: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraMySQL.MySQL80.html

### PostgreSQL
- 14 → 15: Supported
- 14 → 16: Supported (two major version jump)
- Check: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/

## Support

For issues:
- Check AWS CloudFormation console for stack events
- Review Lambda function logs in CloudWatch
- Check Step Functions execution history
- Review RDS blue-green deployment status in RDS console

## Related Resources

- [AWS RDS Blue-Green Deployments Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments.html)
- [Aurora MySQL Version Policy](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.VersionPolicy.html)
- [Aurora PostgreSQL Version Policy](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraPostgreSQLReleaseNotes/)
