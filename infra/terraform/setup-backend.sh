#!/bin/bash

# Setup script for Terraform S3 backend
# This script checks if the required S3 bucket and DynamoDB table exist,
# and creates them if they don't exist

set -e

# Configuration
BUCKET_NAME="fos-terraform-state"
DYNAMODB_TABLE="terraform-locks"
AWS_REGION="us-east-1"

echo "Setting up Terraform backend infrastructure..."
echo "Bucket: $BUCKET_NAME"
echo "DynamoDB Table: $DYNAMODB_TABLE"
echo "Region: $AWS_REGION"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Function to check if S3 bucket exists
bucket_exists() {
    aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null
}

# Function to check if DynamoDB table exists
table_exists() {
    aws dynamodb describe-table --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION" 2>/dev/null
}

# Create S3 bucket if it doesn't exist
if bucket_exists; then
    echo "✓ S3 bucket '$BUCKET_NAME' already exists"
else
    echo "Creating S3 bucket '$BUCKET_NAME'..."
    
    if [ "$AWS_REGION" = "us-east-1" ]; then
        # us-east-1 doesn't require location constraint
        aws s3api create-bucket --bucket "$BUCKET_NAME" --region "$AWS_REGION"
    else
        # Other regions require location constraint
        aws s3api create-bucket \
            --bucket "$BUCKET_NAME" \
            --region "$AWS_REGION" \
            --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi
    
    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$BUCKET_NAME" \
        --versioning-configuration Status=Enabled
    
    # Enable server-side encryption
    aws s3api put-bucket-encryption \
        --bucket "$BUCKET_NAME" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    },
                    "BucketKeyEnabled": true
                }
            ]
        }'
    
    # Block public access
    aws s3api put-public-access-block \
        --bucket "$BUCKET_NAME" \
        --public-access-block-configuration \
            BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    
    echo "✓ S3 bucket '$BUCKET_NAME' created and configured"
fi

# Create DynamoDB table if it doesn't exist
if table_exists; then
    echo "✓ DynamoDB table '$DYNAMODB_TABLE' already exists"
else
    echo "Creating DynamoDB table '$DYNAMODB_TABLE'..."
    
    aws dynamodb create-table \
        --table-name "$DYNAMODB_TABLE" \
        --attribute-definitions \
            AttributeName=LockID,AttributeType=S \
        --key-schema \
            AttributeName=LockID,KeyType=HASH \
        --provisioned-throughput \
            ReadCapacityUnits=1,WriteCapacityUnits=1 \
        --region "$AWS_REGION"
    
    # Wait for table to be active
    echo "Waiting for DynamoDB table to be active..."
    aws dynamodb wait table-exists --table-name "$DYNAMODB_TABLE" --region "$AWS_REGION"
    
    echo "✓ DynamoDB table '$DYNAMODB_TABLE' created"
fi

echo ""
echo "✅ Terraform backend infrastructure is ready!"
echo ""
echo "You can now initialize Terraform with:"
echo "  terraform init"
echo ""
echo "Backend configuration:"
echo "  Bucket: $BUCKET_NAME"
echo "  DynamoDB Table: $DYNAMODB_TABLE"
echo "  Region: $AWS_REGION"