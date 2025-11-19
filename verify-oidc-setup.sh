#!/bin/bash
# OIDC Verification Script for AWS Account 906266478329

echo "=========================================="
echo "AWS OIDC Setup Verification"
echo "=========================================="
echo ""

# Step 1: Check current AWS account
echo "Step 1: Checking AWS Account..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ ERROR: AWS CLI not configured or credentials invalid"
    echo "   Run: aws configure"
    exit 1
fi

echo "✅ Connected to AWS Account: $ACCOUNT_ID"

if [ "$ACCOUNT_ID" != "906266478329" ]; then
    echo "⚠️  WARNING: You're connected to account $ACCOUNT_ID"
    echo "   Expected account: 906266478329"
    echo "   Make sure you're using the correct AWS credentials"
    echo ""
fi

echo ""

# Step 2: Check OIDC Provider
echo "Step 2: Checking OIDC Provider..."
OIDC_PROVIDER=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn" --output text 2>/dev/null)

if [ -z "$OIDC_PROVIDER" ]; then
    echo "❌ OIDC Provider NOT FOUND"
    echo "   The OIDC provider 'token.actions.githubusercontent.com' does not exist"
    echo "   You need to create it manually using the README guide"
    echo ""
    echo "   Quick fix: Follow the OIDC Setup Guide in README.md (PART 1)"
    OIDC_EXISTS=false
else
    echo "✅ OIDC Provider found: $OIDC_PROVIDER"
    OIDC_EXISTS=true
fi

echo ""

# Step 3: Check IAM Role
echo "Step 3: Checking IAM Role..."
ROLE_ARN=$(aws iam get-role --role-name GitHubActionsOIDCRole --query "Role.Arn" --output text 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ IAM Role NOT FOUND"
    echo "   Role 'GitHubActionsOIDCRole' does not exist"
    echo "   You need to create it manually using the README guide"
    echo ""
    echo "   Quick fix: Follow the OIDC Setup Guide in README.md (PART 2 & 3)"
    ROLE_EXISTS=false
else
    echo "✅ IAM Role found: $ROLE_ARN"
    ROLE_EXISTS=true
fi

echo ""

# Step 4: Check Role Trust Policy (if role exists)
if [ "$ROLE_EXISTS" = true ]; then
    echo "Step 4: Checking Role Trust Policy..."
    TRUST_POLICY=$(aws iam get-role --role-name GitHubActionsOIDCRole --query "Role.AssumeRolePolicyDocument" --output json 2>/dev/null)

    if echo "$TRUST_POLICY" | grep -q "token.actions.githubusercontent.com"; then
        echo "✅ Trust policy includes OIDC provider"

        if echo "$TRUST_POLICY" | grep -q "ambrosea9/aws"; then
            echo "✅ Trust policy allows repository: ambrosea9/aws"
        else
            echo "⚠️  WARNING: Trust policy may not include repository 'ambrosea9/aws'"
        fi
    else
        echo "❌ Trust policy does NOT include OIDC provider"
        echo "   The role trust policy needs to be updated"
    fi
    echo ""
fi

# Step 5: Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

if [ "$OIDC_EXISTS" = true ] && [ "$ROLE_EXISTS" = true ]; then
    echo "✅ OIDC Setup Complete!"
    echo ""
    echo "Your GitHub Actions should work now."
    echo ""
    echo "Next steps:"
    echo "1. Go to: https://github.com/ambrosea9/aws"
    echo "2. Click 'Actions' tab"
    echo "3. Select 'Deploy RDS Global Databases'"
    echo "4. Click 'Run workflow'"
    echo "5. Select branch: 'development'"
    echo "6. Configure and run"
    echo ""
    exit 0
else
    echo "❌ OIDC Setup Incomplete"
    echo ""

    if [ "$OIDC_EXISTS" = false ]; then
        echo "Missing: OIDC Provider"
        echo "Action: Follow README.md OIDC Setup Guide - PART 1"
        echo ""
    fi

    if [ "$ROLE_EXISTS" = false ]; then
        echo "Missing: IAM Role"
        echo "Action: Follow README.md OIDC Setup Guide - PART 2 & 3"
        echo ""
    fi

    echo "After fixing, run this script again to verify."
    exit 1
fi
