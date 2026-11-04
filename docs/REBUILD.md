# Rebuild the AWS stack (about 30 minutes, about US$4 per day while it runs)

State on 2026-11-05: the whole stack was destroyed with `terraform destroy` (71 resources). Kept on purpose: the 7 secrets in SSM Parameter Store (/notes-app/prod/*, free), the code in GitHub, a database dump on the owner's laptop (`notes-final-backup/`), and the Terraform state backups.

1. Sign in: `aws sts get-caller-identity --profile notes-admin` (profile notes-admin, region ap-southeast-2). Docker Desktop must be running.
2. `cd infra && terraform init`
3. Stage 1 (free): `terraform apply -target=aws_ecr_repository.repo`
4. Build and push images (Git Bash, `export MSYS_NO_PATHCONV=1`): log in to ECR, then `docker buildx build --platform linux/amd64 --provenance=false -t <registry>/notes-app/web:<sha> --push ./frontend` and the same for `./backend` (api). Then `aws ssm put-parameter --name /notes-app/prod/IMAGE_TAG --type String --value <sha> --overwrite`.
5. Stage 2: `terraform apply` (creates network, ALB, ASG, MongoDB, monitoring, IAM). Needs `infra/terraform.tfvars` with `alert_email = "..."`.
6. Wait about 5 minutes for 2 healthy targets: `terraform output alb_dns_name`, then open `http://<dns>`.
7. Restore data (optional): upload `notes-final-backup/*.archive.gz` to the new backup bucket under `mongo/` and run the restore step from `docs/evidence/backup-restore-test.txt` logic (mongorestore, without the namespace rename) via SSM.
8. Re-enable CI/CD: the GitHub secret `AWS_DEPLOY_ROLE_ARN` stays valid (the role name is unchanged); if the workflow was disabled, enable it in the Actions tab.
9. New SNS email subscription: click the confirmation email again.
10. When finished: `terraform destroy`.

Note: the first apply creates the GitHub OIDC provider and role; this needs the AWS organization policy that normally blocks `iam:CreateOpenIDConnectProvider` to stay lifted.
