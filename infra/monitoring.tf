resource "aws_cloudwatch_log_group" "app" {
  for_each          = toset(["web", "api", "db"])
  name              = "/notes-app/${each.key}"
  retention_in_days = 14
}
