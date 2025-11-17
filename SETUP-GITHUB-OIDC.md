# GitHub Actions OIDC Setup Guide

This guide will help you set up OpenID Connect (OIDC) authentication for GitHub Actions to deploy to AWS.

## Why OIDC?

OIDC is the recommended way to authenticate GitHub Actions with AWS because:
- ✅ No long-lived AWS credentials needed
- ✅ More secure than access keys
- ✅ Automatic credential rotation
- ✅ Fine-grained permissions per repository

## Prerequisites

1. AWS Account with administrator access
2. AWS CLI installed and configured
3. GitHub repository: `ambrosea91/aws`

## Step 1: Get Your AWS Account ID

Run this command to get your AWS Account ID:

```bash
aws sts get-caller-identity --query Account --output text
```

Save this number - you'll need it in Step 3.

## Step 2: Deploy the OIDC CloudFormation Stack

Deploy the OIDC provider and IAM role:

```bash
aws cloudformation deploy \
  --template-file github-oidc-setup.yaml \
  --stack-name github-oidc-provider \
  --parameter-overrides \
    GitHubOrg=ambrosea91 \
    RepositoryName=aws \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

**Important**: This must be deployed in `us-east-1` as IAM is a global service.

## Step 3: Update Your Workflows

After the stack is created, you need to update the workflows with your AWS Account ID.

### Get the Role ARN

```bash
aws cloudformation describe-stacks \
  --stack-name github-oidc-provider \
  --region us-east-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' \
  --output text
```

This will output something like:
```
arn:aws:iam::123456789012:role/GitHubActionsOIDCRole
```

### Update Workflow Files

Replace the hardcoded account ID `390844768648` with YOUR account ID in these files:

1. `.github/workflows/deploy-global-databases.yml`
2. `.github/workflows/bluegreen-upgrade.yml`

**Find and replace:**
```yaml
# OLD
role-to-assume: arn:aws:iam::390844768648:role/GitHubActionsOIDCRole

# NEW (replace 123456789012 with YOUR account ID)
role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsOIDCRole
```

## Step 4: Verify the Setup

### Check OIDC Provider

```bash
aws iam list-open-id-connect-providers
```

You should see:
```json
{
    "OpenIDConnectProviderList": [
        {
            "Arn": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
        }
    ]
}
```

### Check IAM Role

```bash
aws iam get-role --role-name GitHubActionsOIDCRole
```

This should return the role details without errors.

## Step 5: Test GitHub Actions

1. Commit and push your workflow changes
2. Go to GitHub → Actions
3. Run the "Deploy RDS Global Databases" workflow
4. It should now authenticate successfully!

## Troubleshooting

### Error: "No OpenIDConnect provider found"
- **Cause**: OIDC provider not created or created in wrong region
- **Solution**: Deploy the CloudFormation stack in `us-east-1`

### Error: "Not authorized to perform sts:AssumeRoleWithWebIdentity"
- **Cause**: Role trust policy doesn't match your repository
- **Solution**: Verify the `GitHubOrg` and `RepositoryName` parameters are correct

### Error: "Access Denied" when creating resources
- **Cause**: IAM role lacks necessary permissions
- **Solution**: The role has PowerUserAccess + IAM permissions, which should be sufficient. If you need more specific permissions, modify the role policies.

## What Gets Created

The CloudFormation stack creates:

1. **OIDC Provider**
   - URL: `https://token.actions.githubusercontent.com`
   - Thumbprints: GitHub's current thumbprints
   - Client: `sts.amazonaws.com`

2. **IAM Role: GitHubActionsOIDCRole**
   - Trusted by: GitHub Actions from your repository
   - Permissions: PowerUserAccess + IAM role management
   - Can be assumed by: Any workflow in your repository

## Security Considerations

### Permissions
The role has `PowerUserAccess` which is broad. For production, consider:
- Using more restrictive policies
- Separate roles for different environments
- Least privilege principle

### Repository Access
The trust policy allows ANY workflow in your repository. To restrict to specific branches:

Edit the trust policy condition:
```json
"StringLike": {
  "token.actions.githubusercontent.com:sub": "repo:ambrosea91/aws:ref:refs/heads/main"
}
```

## Cleanup

To remove the OIDC setup:

```bash
aws cloudformation delete-stack \
  --stack-name github-oidc-provider \
  --region us-east-1
```

## Alternative: Using AWS Access Keys (Not Recommended)

If you prefer to use access keys instead of OIDC:

1. Create an IAM user with programmatic access
2. Attach the necessary policies
3. Add secrets to GitHub:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
4. Update workflows to use these secrets

However, OIDC is more secure and is the recommended approach.

## Next Steps

After completing this setup:

1. ✅ OIDC provider created
2. ✅ IAM role created
3. ✅ Workflows updated with your account ID
4. ✅ Ready to deploy RDS databases!

Proceed to the main README for deployment instructions.

---

**Need help?** Check the [AWS OIDC documentation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html) or open an issue.
