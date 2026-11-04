variable "region" {
  default = "ap-southeast-2"
}
variable "aws_profile" {
  default = "notes-admin"
}
variable "azs" {
  default = ["ap-southeast-2a", "ap-southeast-2b"]
}
variable "vpc_cidr" {
  default = "10.0.0.0/16"
}
variable "app_instance_type" {
  default = "t3.micro"
}
variable "db_instance_type" {
  default = "t3.small"
}
variable "db_private_ip" {
  default = "10.0.21.10"
}
