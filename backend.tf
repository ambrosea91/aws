# Terraform Backend Configuration
# This file configures where Terraform state is stored

terraform {
  backend "s3" {
    bucket         = "terraform-state-906266478329"
    key            = "postgres/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    
    # Uncomment these if using workspaces for multiple environments
    # workspace_key_prefix = "postgres"
  }
}
