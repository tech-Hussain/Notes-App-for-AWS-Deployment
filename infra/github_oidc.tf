variable "github_repo" {
  description = "owner/repo allowed to deploy"
  default     = "tech-Hussain/Notes-App-for-AWS-Deployment"
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "notes-github-deploy-role"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

resource "aws_iam_role_policy" "github_deploy" {
  name = "notes-github-deploy-inline"
  role = aws_iam_role.github_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"
        ]
        Resource = [for r in aws_ecr_repository.repo : r.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:PutParameter"]
        Resource = "${local.ssm_prefix}/IMAGE_TAG"
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:SendCommand"]
        Resource = ["arn:aws:ssm:${var.region}::document/AWS-RunShellScript"]
      },
      {
        Effect    = "Allow"
        Action    = ["ssm:SendCommand"]
        Resource  = ["arn:aws:ec2:${var.region}:${local.account_id}:instance/*"]
        Condition = { StringEquals = { "ssm:resourceTag/Role" = "notes-app" } }
      },
      {
        Effect   = "Allow"
        Action   = ["ssm:ListCommands", "ssm:ListCommandInvocations", "ssm:GetCommandInvocation"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["autoscaling:Describe*", "elasticloadbalancing:Describe*"]
        Resource = "*"
      }
    ]
  })
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}
output "alb_dns_name" {
  value = aws_lb.main.dns_name
}
