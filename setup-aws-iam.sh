#!/bin/bash

# AWS IAM Setup Script for Terraform Deployment
# This script creates the necessary IAM resources for GitHub Actions/Jenkins to deploy infrastructure

set -e  # Exit on error

# Check if AWS CLI is installed early
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured early
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials are not configured. Run 'aws configure' first."
    exit 1
fi

# Configuration - Fetch AWS Account ID dynamically
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
IAM_USER_NAME="github-actions-terraform"
POLICY_NAME="TerraformDeploymentPolicy"
S3_BUCKET_NAME="terraform-state-${AWS_ACCOUNT_ID}"
DYNAMODB_TABLE_NAME="terraform-state-lock"
AWS_REGION="us-east-1"

echo "=========================================="
echo "AWS IAM Setup for Terraform Deployment"
echo "=========================================="
echo ""
echo "AWS Account ID: ${AWS_ACCOUNT_ID}"
echo ""
echo "This script will create:"
echo "  1. IAM User: ${IAM_USER_NAME}"
echo "  2. IAM Policy: ${POLICY_NAME}"
echo "  3. S3 Bucket: ${S3_BUCKET_NAME}"
echo "  4. DynamoDB Table: ${DYNAMODB_TABLE_NAME}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Creating IAM Policy..."
echo "----------------------------------------"

# Create IAM policy with least privilege
POLICY_DOCUMENT='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EC2NetworkingPermissions",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeRouteTables",
        "ec2:DescribeInternetGateways",
        "ec2:DescribeNatGateways",
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeVpcAttribute",
        "ec2:DescribeNetworkAcls",
        "ec2:DescribeAddresses",
        "ec2:CreateVpc",
        "ec2:DeleteVpc",
        "ec2:ModifyVpcAttribute",
        "ec2:CreateSubnet",
        "ec2:DeleteSubnet",
        "ec2:ModifySubnetAttribute",
        "ec2:CreateSecurityGroup",
        "ec2:DeleteSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupEgress",
        "ec2:CreateInternetGateway",
        "ec2:AttachInternetGateway",
        "ec2:DetachInternetGateway",
        "ec2:DeleteInternetGateway",
        "ec2:CreateRouteTable",
        "ec2:DeleteRouteTable",
        "ec2:CreateRoute",
        "ec2:DeleteRoute",
        "ec2:AssociateRouteTable",
        "ec2:DisassociateRouteTable",
        "ec2:AllocateAddress",
        "ec2:ReleaseAddress",
        "ec2:CreateNatGateway",
        "ec2:DeleteNatGateway",
        "ec2:CreateTags",
        "ec2:DeleteTags"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RDSPermissions",
      "Effect": "Allow",
      "Action": [
        "rds:CreateDBInstance",
        "rds:DeleteDBInstance",
        "rds:ModifyDBInstance",
        "rds:DescribeDBInstances",
        "rds:CreateDBSubnetGroup",
        "rds:DeleteDBSubnetGroup",
        "rds:DescribeDBSubnetGroups",
        "rds:CreateDBParameterGroup",
        "rds:DeleteDBParameterGroup",
        "rds:ModifyDBParameterGroup",
        "rds:DescribeDBParameterGroups",
        "rds:DescribeDBParameters",
        "rds:AddTagsToResource",
        "rds:RemoveTagsFromResource",
        "rds:ListTagsForResource",
        "rds:DescribeDBSnapshots",
        "rds:CreateDBSnapshot",
        "rds:DeleteDBSnapshot"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchPermissions",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DeleteAlarms",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:ListTagsForResource",
        "cloudwatch:TagResource",
        "cloudwatch:UntagResource"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogsPermissions",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:ListTagsLogGroup",
        "logs:TagLogGroup",
        "logs:UntagLogGroup",
        "logs:PutRetentionPolicy",
        "logs:DeleteRetentionPolicy"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMPermissionsForRDSMonitoring",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:ListAttachedRolePolicies",
        "iam:ListInstanceProfilesForRole",
        "iam:ListRolePolicies",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "arn:aws:iam::'"${AWS_ACCOUNT_ID}"':role/*-rds-monitoring-role"
    },
    {
      "Sid": "SecretsManagerPermissions",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:CreateSecret",
        "secretsmanager:DeleteSecret",
        "secretsmanager:DescribeSecret",
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:UpdateSecret",
        "secretsmanager:TagResource",
        "secretsmanager:UntagResource",
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*"
    },
    {
      "Sid": "KMSPermissions",
      "Effect": "Allow",
      "Action": [
        "kms:CreateKey",
        "kms:DescribeKey",
        "kms:GetKeyPolicy",
        "kms:GetKeyRotationStatus",
        "kms:ListResourceTags",
        "kms:PutKeyPolicy",
        "kms:EnableKeyRotation",
        "kms:DisableKey",
        "kms:ScheduleKeyDeletion",
        "kms:TagResource",
        "kms:UntagResource",
        "kms:CreateAlias",
        "kms:DeleteAlias",
        "kms:UpdateAlias",
        "kms:ListAliases"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::'"${S3_BUCKET_NAME}"'",
        "arn:aws:s3:::'"${S3_BUCKET_NAME}"'/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:'"${AWS_ACCOUNT_ID}"':table/'"${DYNAMODB_TABLE_NAME}"'"
    }
  ]
}'

# Check if policy exists
POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" --output text 2>/dev/null || echo "")

if [ -z "$POLICY_ARN" ]; then
    POLICY_ARN=$(aws iam create-policy \
        --policy-name "${POLICY_NAME}" \
        --policy-document "${POLICY_DOCUMENT}" \
        --description "Policy for Terraform to deploy AWS infrastructure" \
        --query 'Policy.Arn' \
        --output text)
    echo "✅ Created IAM Policy: ${POLICY_ARN}"
else
    echo "ℹ️  IAM Policy already exists: ${POLICY_ARN}"
fi

echo ""
echo "Step 2: Creating IAM User..."
echo "----------------------------------------"

# Check if user exists
if aws iam get-user --user-name "${IAM_USER_NAME}" &> /dev/null; then
    echo "ℹ️  IAM User '${IAM_USER_NAME}' already exists"
else
    aws iam create-user --user-name "${IAM_USER_NAME}"
    echo "✅ Created IAM User: ${IAM_USER_NAME}"
fi

echo ""
echo "Step 3: Attaching Policy to User..."
echo "----------------------------------------"

aws iam attach-user-policy \
    --user-name "${IAM_USER_NAME}" \
    --policy-arn "${POLICY_ARN}" 2>/dev/null || echo "ℹ️  Policy already attached"

echo "✅ Attached policy to user"

echo ""
echo "Step 4: Creating Access Keys..."
echo "----------------------------------------"

# Create access key
ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "${IAM_USER_NAME}" 2>&1)

if echo "$ACCESS_KEY_OUTPUT" | grep -q "LimitExceeded"; then
    echo "⚠️  Access key limit reached. Please delete an existing access key first:"
    echo "   aws iam list-access-keys --user-name ${IAM_USER_NAME}"
    echo "   aws iam delete-access-key --user-name ${IAM_USER_NAME} --access-key-id <KEY_ID>"
    echo ""
    echo "Then run this script again."
else
    ACCESS_KEY_ID=$(echo "$ACCESS_KEY_OUTPUT" | grep -o '"AccessKeyId": "[^"]*' | cut -d'"' -f4)
    SECRET_ACCESS_KEY=$(echo "$ACCESS_KEY_OUTPUT" | grep -o '"SecretAccessKey": "[^"]*' | cut -d'"' -f4)
    
    echo "✅ Created Access Keys"
    echo ""
    echo "⚠️  IMPORTANT: Save these credentials NOW. You won't see them again!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "AWS_ACCESS_KEY_ID:     ${ACCESS_KEY_ID}"
    echo "AWS_SECRET_ACCESS_KEY: ${SECRET_ACCESS_KEY}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Save to file
    CREDS_FILE="aws-credentials-$(date +%Y%m%d-%H%M%S).txt"
    cat > "${CREDS_FILE}" <<EOF
AWS Credentials for ${IAM_USER_NAME}
Generated: $(date)

AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}

Add these to your GitHub repository secrets:
1. Go to https://github.com/ambrosea9/aws/settings/secrets/actions
2. Create new secrets:
   - Name: AWS_ACCESS_KEY_ID
     Value: ${ACCESS_KEY_ID}
   
   - Name: AWS_SECRET_ACCESS_KEY
     Value: ${SECRET_ACCESS_KEY}
   
   - Name: TF_VAR_db_password
     Value: <Your secure database password>

For Jenkins:
1. Go to Jenkins → Manage Jenkins → Manage Credentials
2. Add AWS Credentials with ID: aws-credentials
3. Use the keys above
EOF
    
    echo "Credentials saved to: ${CREDS_FILE}"
    echo "⚠️  Keep this file secure and delete it after adding to GitHub/Jenkins!"
fi

echo ""
echo "Step 5: Creating S3 Bucket for Terraform State..."
echo "----------------------------------------"

# Check if bucket exists
if aws s3 ls "s3://${S3_BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    aws s3 mb "s3://${S3_BUCKET_NAME}" --region "${AWS_REGION}"
    echo "✅ Created S3 bucket: ${S3_BUCKET_NAME}"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "${S3_BUCKET_NAME}" \
        --versioning-configuration Status=Enabled
    echo "✅ Enabled versioning on S3 bucket"
    
    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket "${S3_BUCKET_NAME}" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                }
            }]
        }'
    echo "✅ Enabled encryption on S3 bucket"
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "${S3_BUCKET_NAME}" \
        --public-access-block-configuration \
            "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
    echo "✅ Blocked public access to S3 bucket"
else
    echo "ℹ️  S3 bucket already exists: ${S3_BUCKET_NAME}"
fi

echo ""
echo "Step 6: Creating DynamoDB Table for State Locking..."
echo "----------------------------------------"

# Check if table exists
if aws dynamodb describe-table --table-name "${DYNAMODB_TABLE_NAME}" --region "${AWS_REGION}" &> /dev/null; then
    echo "ℹ️  DynamoDB table already exists: ${DYNAMODB_TABLE_NAME}"
else
    aws dynamodb create-table \
        --table-name "${DYNAMODB_TABLE_NAME}" \
        --attribute-definitions AttributeName=LockID,AttributeType=S \
        --key-schema AttributeName=LockID,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "${AWS_REGION}"
    
    echo "✅ Created DynamoDB table: ${DYNAMODB_TABLE_NAME}"
    echo "⏳ Waiting for table to become active..."
    
    aws dynamodb wait table-exists \
        --table-name "${DYNAMODB_TABLE_NAME}" \
        --region "${AWS_REGION}"
    
    echo "✅ DynamoDB table is active"
fi

echo ""
echo "=========================================="
echo "✅ AWS IAM Setup Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Add the credentials to GitHub Secrets (see ${CREDS_FILE})"
echo "2. Clone your repository and add the Terraform files"
echo "3. Test Terraform locally with 'terraform init' and 'terraform plan'"
echo "4. Push changes to trigger GitHub Actions"
echo ""
echo "Resources Created:"
echo "  - IAM User: ${IAM_USER_NAME}"
echo "  - IAM Policy: ${POLICY_NAME}"
echo "  - S3 Bucket: ${S3_BUCKET_NAME}"
echo "  - DynamoDB Table: ${DYNAMODB_TABLE_NAME}"
echo ""
