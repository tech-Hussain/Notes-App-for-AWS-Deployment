# Requirement traceability (CEA SE-490)

Status: Done = implemented and evidenced in the repo. "Console screenshot" = still to be captured by the project owner from the AWS console (the evidence here is CLI output or a file).

| # | Brief requirement | Implemented in | Evidence in repo | Status |
| --- | --- | --- | --- | --- |
| 1 | VPC, public/private subnets, IGW, route tables, NAT | `infra/network.tf` | `docs/evidence/cli-evidence.txt` | Done (console screenshot pending) |
| 2 | Web tier container, reachable via browser | `frontend/Dockerfile`, ALB | `docs/evidence/app-via-alb-login.png` | Done |
| 3 | App tier container, Dockerfile, compose, private | `backend/Dockerfile`, `docker-compose.yml`, `deploy/` | files in repo; SG rules in cli-evidence | Done |
| 4 | Database, never public | `infra/database.tf` | cli-evidence (no public IP), `security-checks.txt` | Done |
| 5 | Images in registry | `infra/ecr.tf` | ECR image tags (CLI); pipeline run | Done (console screenshot pending) |
| 6 | CI/CD builds, tests, pushes, deploys | `.github/workflows/deploy.yml` | GitHub Actions runs; `rollback-availability.txt` | Done |
| 7 | Load balancer, target group, Auto Scaling Group | `infra/alb.tf`, `infra/compute.tf` | `scaling-timeline.txt`, cli-evidence | Done (console screenshot pending) |
| 8 | Security groups, segmentation, least privilege, secrets | `infra/security_groups.tf`, `infra/iam.tf`, SSM | `security-checks.txt` | Done |
| 9 | Enhancement: Terraform | `infra/` | repo | Done |
| 9 | Enhancement: CloudWatch | `infra/monitoring.tf` | `cloudwatch-evidence.txt` | Done (alarm email test pending SNS confirmation) |
| 9 | Enhancement: S3 backups | `infra/s3.tf`, backup timer | `backup-restore-test.txt` | Done |
| 9 | Enhancement: EBS | `infra/database.tf` | cli-evidence (encrypted, attached) | Done |
| 9 | Enhancement: cost estimate + 2 optimizations | `docs/COST-ESTIMATE.md` | file | Done (Pricing Calculator PDF pending) |
| 10 | NFR justification and limitations | `docs/Technical-Report.pdf` section 7 | file | Done |
| D1 | Architecture diagram | `docs/architecture.png` | file | Done |
| D3 | Source files and repo link | GitHub repo | README | Done |
| D4 | Technical report 4-6 pages | `docs/Technical-Report.pdf` | file (5 pages) | Done |
