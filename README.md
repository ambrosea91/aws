** authentication to aws from github **

1. Create trust-policy.json file locally
Run this command to create the file:

cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::390844768648:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:ambrosea91/aws:ref:refs/heads/develop"
        }
      }
    }
  ]
}
EOF
## aws iam get-role --role-name GitHubActionsOIDCRole --query 'Role.AssumeRolePolicyDocument'
**Replace**

<YOUR_ACCOUNT_ID> with your AWS account ID

<YOUR_ORG> and <YOUR_REPO> with your GitHub organization and repo name

** Retry the role creation **
Now run:

aws iam create-role \
  --role-name GitHubActionsOIDCRole \
  --assume-role-policy-document file://trust-policy.json
** Next Steps **
After role creation:

Attach a policy (AdministratorAccess or custom) to that role.

Update your GitHub Actions workflow with:
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v2
  with:
    role-to-assume: arn:aws:iam::ambrosea91:role/GitHubActionsOIDCRole
    aws-region: us-east-1