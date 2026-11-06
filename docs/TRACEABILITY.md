# Requirement traceability (CEA SE-490)

Console screenshots (redacted) are in `docs/evidence/` and captioned in `docs/Evidence-Appendix.pdf`. Where a console view does not show a detail, the matching command-line output is in `docs/evidence/*.txt` (named in the last column).

| # | Brief requirement | Implemented in | Console evidence | Other evidence | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | VPC with CIDR | `infra/network.tf` | `01-vpc.png` | cli-evidence.txt | Done |
| 1 | Public / private subnets | `infra/network.tf` | `02-subnets.png` | cli-evidence.txt | Done |
| 1 | Internet Gateway | `infra/network.tf` | `04-internet-gateways.png` | cli-evidence.txt | Done |
| 1 | Route tables | `infra/network.tf` | `03-route-tables.png` | cli-evidence.txt (routes) | Done |
| 1 | NAT Gateway | `infra/network.tf` | (not captured) | cli-evidence.txt (state available) | Done |
| 2 | Web tier container, reachable by browser | `frontend/Dockerfile`, ALB | `14-app-via-alb.png` | `app-via-alb-login.png` | Done |
| 3 | App tier container, Dockerfile, compose, private | `backend/Dockerfile`, `docker-compose.yml`, `deploy/` | `06-ec2-instances-cloudwatch-health.png` | security-checks.txt | Done |
| 4 | Database never public | `infra/database.tf` | `06-ec2-instances-cloudwatch-health.png`, `11-ebs-volume.png` | cli-evidence.txt (no public IP) | Done |
| 5 | Images in registry | `infra/ecr.tf` | `12-ecr-repositories.png` | pipeline runs | Done |
| 6 | CI/CD builds, tests, pushes, deploys | `.github/workflows/deploy.yml` | `13-github-actions-runs.png` | rollback-availability.txt | Done |
| 7 | Load balancer | `infra/alb.tf` | `07-load-balancer.png` | cli-evidence.txt | Done |
| 7 | Target group | `infra/alb.tf` | `08-target-group-healthy.png` | cli-evidence.txt | Done |
| 7 | Auto Scaling Group | `infra/compute.tf` | `09-asg-activity.png`, `17-scaling-cpu-alarm.png` | scaling-timeline.txt | Done |
| 8 | Security groups per tier | `infra/security_groups.tf` | `05-security-groups.png` | cli-evidence.txt (rules) | Done |
| 8 | Network segmentation | `infra/network.tf` | `02-subnets.png`, `03-route-tables.png` | security-checks.txt | Done |
| 8 | Least privilege | `infra/iam.tf` | `20-iam-roles.png` | security-checks.txt (incl. the fixed gap) | Done |
| 8 | Secrets management | SSM Parameter Store | `21-ssm-parameter-store.png` | GitHub secret holds only the role ARN | Done |
| 9 | Enhancement: Terraform | `infra/` | | repo | Done |
| 9 | Enhancement: CloudWatch | `infra/monitoring.tf` | `15-cloudwatch-overview.png` | cloudwatch-evidence.txt | Done |
| 9 | Enhancement: S3 backups | `infra/s3.tf`, backup timer | `16-s3-backup-bucket.png` | backup-restore-test.txt | Done |
| 9 | Enhancement: EBS | `infra/database.tf` | `11-ebs-volume.png` | cli-evidence.txt (encrypted) | Done |
| 9 | Enhancement: cost estimate + 2 optimizations | `docs/COST-ESTIMATE.md` | (Pricing Calculator export not captured) | file | Done (calculator export optional) |
| 10 | NFR justification and limitations | `docs/Technical-Report.pdf` / `.docx` section 7 | | | Done |
| D1 | Architecture diagram | `docs/architecture.png` | | | Done |
| D3 | Source files and repo link | GitHub repo | | README | Done |
| D4 | Technical report 4-6 pages | `docs/Technical-Report.pdf` (5 pages) and `docs/Technical-Report.docx` (4 pages in Word) + `docs/Evidence-Appendix.pdf` | | | Done |

Not captured (supplemented by command-line evidence): NAT Gateway, database instance detail page, security-group rule pages, load-balancer listener, budget page, GitHub secrets page, IAM trust policy, Pricing Calculator export.
