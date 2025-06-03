##############################################
# variables.tf
##############################################

variable "app_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "env_suffix" {
  type = string
}

variable "initial_db_name" {
  type = string
}

variable "master_username" {
  type = string
}

variable "master_password" {
  type = string
  sensitive = true
}

variable "kms_key_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "db_subnet_group" {
  type = string
}

variable "db_port" {
  type = number
  default = 5433
}

variable "created_by" {
  type = string
  default = "ambrose"
}

variable "sns_topic_arn" {
  type = string
}

variable "s3_bucket" {
  type = string
}

variable "dynamodb_table" {
  type = string
}
