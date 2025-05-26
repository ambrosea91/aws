variable "region" {
  description = "AWS region"
  type        = string
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
}

variable "db_cluster_name" {
  description = "The name of the Aurora cluster"
  type        = string
}

variable "engine_version" {
  description = "The Aurora PostgreSQL engine version"
  type        = string
}

variable "master_username" {
  description = "Master DB username"
  type        = string
}

variable "master_password" {
  description = "Master DB password"
  type        = string
  sensitive   = true
}

variable "database_name" {
  description = "Initial database name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "instance_class" {
  description = "Instance class for DB instances"
  type        = string
}

variable "instances" {
  description = "Number of Aurora instances"
  type        = number
}

variable "environment" {
  description = "Environment tag (e.g. dev, staging, prod)"
  type        = string
}
