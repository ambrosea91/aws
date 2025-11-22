#!/bin/bash

# AWS IAM Setup Script for Terraform Deployment - UPDATED
# This script creates the necessary IAM resources for GitHub Actions/Jenkins to deploy infrastructure

set -e  # Exit on error

# Configuration
AWS_ACCOUNT_ID="906266478329"
IAM_USER_NAME="github-actions-terraform"
POLICY_NAME="TerraformDeploymentPolicy"
S3_BUCKET_NAME="terraform-state-906266478329"
DYNAMODB_TABLE_NAME="terraform-state-lock"
AWS_REGION="us-east-1"

echo "=========================================="
echo "AWS IAM Setup for Terraform Deployment"
echo "=========================================="
echo ""
echo "This script will create:"
echo "  1. IAM User: ${IAM_USER_NAME}"
echo "  2. IAM Policy: ${POLICY_NAME}"
echo "  3. S3 Bucket: ${S3_BUCKET_NAME} (in ${AWS_REGION})"
echo "  4. DynamoDB Table: ${DYNAMODB_TABLE_NAME}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials are not configured. Run 'aws configure' first."
    exit 1
fi

echo ""
echo "Current AWS Identity:"
aws sts get-caller-identity
echo ""

echo ""
echo "Step 1: Creating IAM Policy..."
echo "----------------------------------------"

# Create IAM policy with FULL S3 permissions for the bucket
POLICY_DOCUMENT='{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RDSAndVPCManagement",
      "Effect": "Allow",
      "Action": [
        "rds:*",
        "ec2:Describe*",
        "ec2:CreateSecurityGroup",
        "ec2:DeleteSecurityGroup",
        "ec2:AuthorizeSecurityGroupIngress",
        "ec2:AuthorizeSecurityGroupEgress",
        "ec2:RevokeSecurityGroupIngress",
        "ec2:RevokeSecurityGroupEgress",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:CreateSubnet",
        "ec2:DeleteSubnet",
        "ec2:CreateVpc",
        "ec2:DeleteVpc",
        "ec2:ModifyVpcAttribute",
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
        "cloudwatch:*",
        "logs:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies",
        "iam:PutRolePolicy",
        "iam:GetRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": [
        "arn:aws:iam::'"${AWS_ACCOUNT_ID}"':role/postgres-*",
        "arn:aws:iam::'"${AWS_ACCOUNT_ID}"':role/*rds-monitoring*"
      ]
    },
    {
      "Sid": "S3TerraformStateFullAccess",
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketVersioning",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::'"${S3_BUCKET_NAME}"'"
    },
    {
      "Sid": "S3TerraformStateObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::'"${S3_BUCKET_NAME}"'/*"
    },
    {
      "Sid": "DynamoDBStateLocking",
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem"
      ],
      "Resource": "arn:aws:dynamodb:*:'"${AWS_ACCOUNT_ID}"':table/'"${DYNAMODB_TABLE_NAME}"'"
    }
  ]
}'

# Check if policy exists
POLICY_ARN=$(aws iam list-policies --scope Local --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" --output text 2>/dev/null || echo "")

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
    echo "   Updating policy with new version..."
    
    # Create a new policy version
    aws iam create-policy-version \
        --policy-arn "${POLICY_ARN}" \
        --policy-document "${POLICY_DOCUMENT}" \
        --set-as-default 2>/dev/null || echo "   ⚠️  Could not update policy (may have too many versions)"
    
    echo "   To manually update, delete old versions and create new one"
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
echo "Step 4: Managing Access Keys..."
echo "----------------------------------------"

# List existing access keys
EXISTING_KEYS=$(aws iam list-access-keys --user-name "${IAM_USER_NAME}" --query 'AccessKeyMetadata[*].AccessKeyId' --output text)

if [ -n "$EXISTING_KEYS" ]; then
    echo "ℹ️  Found existing access keys:"
    echo "$EXISTING_KEYS"
    echo ""
    read -p "Do you want to create a NEW access key? (This will be key #$(echo $EXISTING_KEYS | wc -w | xargs expr 1 +)) (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping access key creation. Use existing keys or delete old ones first:"
        echo "  aws iam delete-access-key --user-name ${IAM_USER_NAME} --access-key-id <KEY_ID>"
        SKIP_KEY_CREATION=true
    fi
fi

if [ "$SKIP_KEY_CREATION" != "true" ]; then
    # Create access key
    ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "${IAM_USER_NAME}" 2>&1)
    
    if echo "$ACCESS_KEY_OUTPUT" | grep -q "LimitExceeded"; then
        echo "⚠️  Access key limit reached (max 2 keys per user)."
        echo ""
        echo "List your current keys:"
        aws iam list-access-keys --user-name ${IAM_USER_NAME}
        echo ""
        echo "To delete an old key:"
        echo "  aws iam delete-access-key --user-name ${IAM_USER_NAME} --access-key-id <KEY_ID>"
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
Region: ${AWS_REGION}

AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}

GitHub Secrets Setup:
1. Go to https://github.com/ambrosea9/aws/settings/secrets/actions
2. Click "New repository secret" for each:

   Secret Name: AWS_ACCESS_KEY_ID
   Value: ${ACCESS_KEY_ID}

   Secret Name: AWS_SECRET_ACCESS_KEY
   Value: ${SECRET_ACCESS_KEY}

   Secret Name: AWS_REGION
   Value: ${AWS_REGION}

   Secret Name: TF_VAR_db_password
   Value: <Choose a secure password - min 8 characters>

For Jenkins:
1. Go to Jenkins → Manage Jenkins → Manage Credentials
2. Add AWS Credentials:
   - ID: aws-credentials
   - Access Key ID: ${ACCESS_KEY_ID}
   - Secret Access Key: ${SECRET_ACCESS_KEY}
3. Add Secret Text:
   - ID: db-password
   - Secret: <Your database password>

KEEP THIS FILE SECURE AND DELETE AFTER SETUP!
EOF
        
        echo "Credentials saved to: ${CREDS_FILE}"
        echo "⚠️  Keep this file secure and delete it after adding to GitHub/Jenkins!"
        echo ""
    fi
fi

echo ""
echo "Step 5: Creating S3 Bucket for Terraform State..."
echo "----------------------------------------"

# Check if bucket exists
if aws s3 ls "s3://${S3_BUCKET_NAME}" --region "${AWS_REGION}" 2>&1 | grep -q 'NoSuchBucket'; then
    aws s3 mb "s3://${S3_BUCKET_NAME}" --region "${AWS_REGION}"
    echo "✅ Created S3 bucket: ${S3_BUCKET_NAME}"
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "${S3_BUCKET_NAME}" \
        --versioning-configuration Status=Enabled \
        --region "${AWS_REGION}"
    echo "✅ Enabled versioning on S3 bucket"
    
    # Enable encryption
    aws s3api put-bucket-encryption \
        --bucket "${S3_BUCKET_NAME}" \
        --server-side-encryption-configuration '{
            "Rules": [{
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                },
                "BucketKeyEnabled": true
            }]
        }' \
        --region "${AWS_REGION}"
    echo "✅ Enabled encryption on S3 bucket"
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "${S3_BUCKET_NAME}" \
        --public-access-block-configuration \
            "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
        --region "${AWS_REGION}"
    echo "✅ Blocked public access to S3 bucket"
    
    # Add bucket policy
    BUCKET_POLICY='{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "DenyInsecureTransport",
          "Effect": "Deny",
          "Principal": "*",
          "Action": "s3:*",
          "Resource": [
            "arn:aws:s3:::'"${S3_BUCKET_NAME}"'",
            "arn:aws:s3:::'"${S3_BUCKET_NAME}"'/*"
          ],
          "Condition": {
            "Bool": {
              "aws:SecureTransport": "false"
            }
          }
        }
      ]
    }'
    
    aws s3api put-bucket-policy \
        --bucket "${S3_BUCKET_NAME}" \
        --policy "${BUCKET_POLICY}" \
        --region "${AWS_REGION}"
    echo "✅ Added bucket policy (enforce HTTPS)"
    
else
    echo "ℹ️  S3 bucket already exists: ${S3_BUCKET_NAME}"
    echo "   Verifying bucket is in region: ${AWS_REGION}"
    
    BUCKET_REGION=$(aws s3api get-bucket-location --bucket "${S3_BUCKET_NAME}" --output text)
    if [ "$BUCKET_REGION" = "None" ]; then
        BUCKET_REGION="us-east-1"
    fi
    
    if [ "$BUCKET_REGION" != "$AWS_REGION" ]; then
        echo "   ⚠️  WARNING: Bucket is in ${BUCKET_REGION}, but you specified ${AWS_REGION}"
        echo "   You should either:"
        echo "   1. Update backend.tf to use region: ${BUCKET_REGION}"
        echo "   2. Or delete this bucket and run script again"
    else
        echo "   ✅ Bucket is in correct region"
    fi
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
        --region "${AWS_REGION}" \
        --tags Key=ManagedBy,Value=Terraform Key=Purpose,Value=StateLocking
    
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
echo "Summary:"
echo "  ✅ IAM User: ${IAM_USER_NAME}"
echo "  ✅ IAM Policy: ${POLICY_NAME}"
echo "  ✅ S3 Bucket: ${S3_BUCKET_NAME} (region: ${AWS_REGION})"
echo "  ✅ DynamoDB Table: ${DYNAMODB_TABLE_NAME}"
echo ""
echo "Next Steps:"
echo "1. Add credentials to GitHub Secrets (see ${CREDS_FILE:-'previous output'})"
echo "2. Ensure backend.tf uses:"
echo "     bucket = \"${S3_BUCKET_NAME}\""
echo "     region = \"${AWS_REGION}\""
echo "3. Run: terraform init"
echo "4. Run: terraform plan -var-file=\"environments/dev.tfvars\""
echo ""
echo "Test IAM permissions:"
echo "  export AWS_ACCESS_KEY_ID='<your-key>'"
echo "  export AWS_SECRET_ACCESS_KEY='<your-secret>'"
echo "  aws s3 ls s3://${S3_BUCKET_NAME} --region ${AWS_REGION}"
echo ""