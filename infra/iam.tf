data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

# ---------- App (web/api) instances ----------
resource "aws_iam_role" "app" {
  name               = "notes-app-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}
resource "aws_iam_role_policy_attachment" "app_ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_role_policy" "app" {
  name = "notes-app-inline"
  role = aws_iam_role.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      {
        Effect   = "Allow"
        Action   = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
        Resource = [for r in aws_ecr_repository.repo : r.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = ["${local.ssm_prefix}/MONGO_URI", "${local.ssm_prefix}/JWT_SECRET", "${local.ssm_prefix}/IMAGE_TAG"]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = ["arn:aws:logs:${var.region}:${local.account_id}:log-group:/notes-app/*:*"]
      }
    ]
  })
}
resource "aws_iam_instance_profile" "app" {
  name = "notes-app-ec2-role"
  role = aws_iam_role.app.name
}

# ---------- MongoDB instance ----------
resource "aws_iam_role" "db" {
  name               = "notes-db-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}
resource "aws_iam_role_policy_attachment" "db_ssm" {
  role       = aws_iam_role.db.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
resource "aws_iam_role_policy" "db" {
  name = "notes-db-inline"
  role = aws_iam_role.db.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters"]
        Resource = [
          "${local.ssm_prefix}/MONGO_ROOT_USERNAME", "${local.ssm_prefix}/MONGO_ROOT_PASSWORD",
          "${local.ssm_prefix}/MONGO_APP_USERNAME", "${local.ssm_prefix}/MONGO_APP_PASSWORD"
        ]
      },
      { Effect = "Allow", Action = ["s3:PutObject", "s3:GetObject"], Resource = "${aws_s3_bucket.backups.arn}/mongo/*" },
      { Effect = "Allow", Action = ["s3:ListBucket"], Resource = aws_s3_bucket.backups.arn },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = ["arn:aws:logs:${var.region}:${local.account_id}:log-group:/notes-app/db:*"]
      }
    ]
  })
}
resource "aws_iam_instance_profile" "db" {
  name = "notes-db-ec2-role"
  role = aws_iam_role.db.name
}
