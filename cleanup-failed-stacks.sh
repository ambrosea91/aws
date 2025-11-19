#!/bin/bash
# Clean up failed CloudFormation stacks

echo "=========================================="
echo "CloudFormation Stack Cleanup"
echo "=========================================="
echo ""

ENVIRONMENT="dev"
REGION_PRIMARY="us-east-2"
REGION_SECONDARY="us-west-2"

echo "Checking for failed stacks to clean up..."
echo ""

# Function to delete stack if it exists
delete_stack_if_exists() {
    local stack_name=$1
    local region=$2

    echo "Checking stack: $stack_name in $region..."

    # Check if stack exists
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null)

    if [ $? -eq 0 ]; then
        echo "  Status: $STACK_STATUS"

        if [ "$STACK_STATUS" == "ROLLBACK_COMPLETE" ] || [ "$STACK_STATUS" == "CREATE_FAILED" ] || [ "$STACK_STATUS" == "DELETE_FAILED" ]; then
            echo "  ⚠️  Stack is in failed state, deleting..."
            aws cloudformation delete-stack \
                --stack-name "$stack_name" \
                --region "$region"

            if [ $? -eq 0 ]; then
                echo "  ✅ Delete initiated for $stack_name"
                echo "     Waiting for deletion to complete..."
                aws cloudformation wait stack-delete-complete \
                    --stack-name "$stack_name" \
                    --region "$region" 2>/dev/null

                if [ $? -eq 0 ]; then
                    echo "  ✅ Stack deleted successfully"
                else
                    echo "  ⚠️  Stack deletion in progress (may take a few minutes)"
                fi
            else
                echo "  ❌ Failed to delete stack"
            fi
        else
            echo "  ℹ️  Stack is in $STACK_STATUS state (no action needed)"
        fi
    else
        echo "  ℹ️  Stack does not exist (nothing to clean up)"
    fi
    echo ""
}

# Delete MySQL stacks if they exist
echo "=== MySQL Stacks ==="
delete_stack_if_exists "${ENVIRONMENT}-mysql57-primary" "$REGION_PRIMARY"
delete_stack_if_exists "${ENVIRONMENT}-mysql57-secondary" "$REGION_SECONDARY"

# Delete PostgreSQL stacks if they exist
echo "=== PostgreSQL Stacks ==="
delete_stack_if_exists "${ENVIRONMENT}-postgres14-primary" "$REGION_PRIMARY"
delete_stack_if_exists "${ENVIRONMENT}-postgres14-secondary" "$REGION_SECONDARY"

echo "=========================================="
echo "Cleanup Complete!"
echo "=========================================="
echo ""
echo "You can now retry your deployment in GitHub Actions."
echo ""
