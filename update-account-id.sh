#!/bin/bash
# Script to update AWS Account ID in GitHub Actions workflows

set -e

echo "=========================================="
echo "Update AWS Account ID in Workflows"
echo "=========================================="
echo ""

# Get current AWS Account ID
echo "Fetching your AWS Account ID..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)

if [ -z "$ACCOUNT_ID" ]; then
    echo "❌ Error: Could not fetch AWS Account ID"
    echo "   Make sure AWS CLI is configured with valid credentials"
    echo ""
    echo "Run: aws configure"
    exit 1
fi

echo "✅ Found AWS Account ID: $ACCOUNT_ID"
echo ""

# Old account ID (hardcoded in templates)
OLD_ACCOUNT_ID="390844768648"

# Files to update
FILES=(
    ".github/workflows/deploy-global-databases.yml"
    ".github/workflows/bluegreen-upgrade.yml"
)

echo "Updating workflow files..."
echo ""

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        # Check if file contains old account ID
        if grep -q "$OLD_ACCOUNT_ID" "$file"; then
            # Create backup
            cp "$file" "$file.backup"

            # Replace old account ID with new one
            sed -i "s/$OLD_ACCOUNT_ID/$ACCOUNT_ID/g" "$file"

            echo "✅ Updated: $file"
            echo "   Backup created: $file.backup"
        else
            echo "ℹ️  Skipped: $file (already updated or no changes needed)"
        fi
    else
        echo "⚠️  Warning: $file not found"
    fi
done

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "Old Account ID: $OLD_ACCOUNT_ID"
echo "New Account ID: $ACCOUNT_ID"
echo ""
echo "Updated files:"
for file in "${FILES[@]}"; do
    if [ -f "$file" ] && grep -q "$ACCOUNT_ID" "$file"; then
        echo "  ✅ $file"
    fi
done
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff"
echo "2. Commit the changes: git add . && git commit -m 'Update AWS Account ID in workflows'"
echo "3. Push to GitHub: git push"
echo ""
echo "Done! 🚀"
