#!/bin/bash

# Setup script for CDK Infrastructure Project
# This script helps initialize the project and install dependencies

set -e

echo "========================================="
echo "CDK Infrastructure Project Setup"
echo "========================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20.x or later."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed. Please install it for easier AWS configuration."
else
    echo "✅ AWS CLI version: $(aws --version)"
fi

# Check for CDK CLI
if ! command -v cdk &> /dev/null; then
    echo "⚠️  AWS CDK CLI is not installed. Installing globally..."
    npm install -g aws-cdk
else
    echo "✅ CDK CLI version: $(cdk --version)"
fi

echo ""
echo "Installing dependencies for MySQL Aurora stack..."
cd mysql
npm install
echo "✅ MySQL Aurora dependencies installed"

echo ""
echo "Installing dependencies for PostgreSQL Aurora stack..."
cd ../postgres
npm install
echo "✅ PostgreSQL Aurora dependencies installed"

echo ""
echo "Installing dependencies for EC2 stack..."
cd ../ec2-instances
npm install
echo "✅ EC2 dependencies installed"

cd ..

echo ""
echo "Building MySQL Aurora stack..."
cd mysql
npm run build
echo "✅ MySQL Aurora stack built"

echo ""
echo "Building PostgreSQL Aurora stack..."
cd ../postgres
npm run build
echo "✅ PostgreSQL Aurora stack built"

echo ""
echo "Building EC2 stack..."
cd ../ec2-instances
npm run build
echo "✅ EC2 stack built"

cd ..

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Configure AWS credentials: aws configure"
echo "2. Copy .env.example to .env and update values: cp .env.example .env"
echo "3. Bootstrap CDK (first time only):"
echo "   - Primary region: cdk bootstrap aws://ACCOUNT-ID/us-east-1"
echo "   - Secondary region: cdk bootstrap aws://ACCOUNT-ID/eu-west-1"
echo "4. Deploy stacks:"
echo "   - cd mysql && npm run deploy"
echo "   - cd postgres && npm run deploy"
echo "   - cd ec2-instances && npm run deploy"
echo ""
echo "For CI/CD setup, see README.md and SETUP-GUIDE.md"
echo ""
