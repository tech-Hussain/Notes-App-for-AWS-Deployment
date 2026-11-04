# Progress Log

## Phase 0 – Tool install and verify (2026-11-04)
OS: Windows 11 Pro Education 10.0.26300 (WSL2 Ubuntu available; working natively in PowerShell/Git Bash with Docker Desktop).

| Tool | Version |
| --- | --- |
| Git | 2.53.0.windows.1 |
| Node / npm | v24.14.0 / 11.9.0 |
| Docker Client/Server | 29.8.2 / 29.8.2 |
| Docker Compose | v5.6.0 |
| Docker Buildx | v0.37.2 |
| AWS CLI | 2.39.3 (installed via winget) |
| Terraform | v1.16.6 (installed via winget) |
| GitHub CLI | 2.103.3 (installed via winget) |
| curl | 8.21.0 |
| jq | 1.8.2 (installed via winget) |
| openssl | 3.5.5 (Git for Windows bundle: C:\Program Files\Git\usr\bin) |
| autocannon | 8.0.0 (npx) |

`docker run --rm hello-world` succeeded (Docker Desktop had to be started manually).
Note: Node 24 locally; Dockerfile/CI will use the version decided in Phase 1.

## Phase 1 – Audit and prepare (2026-11-04)
Decisions: keep `MONGODB_URI` (plan scripts use this name, not `MONGO_URI`); Node 22 for Docker/CI; health keeps the `{success,message,data}` envelope.
Folders: `backend/` and `frontend/` (plan's `server/` -> `backend/`, `client/` -> `frontend/`; Vite output `dist/`).
Changes: `/api/health` now checks `mongoose.connection.readyState` (200 `data:{status,db,uptime,version}` or 503), version from `APP_VERSION`; server listens on `0.0.0.0`; root `.gitignore` now allows `.env.example`; `.env.example` updated; health tests updated (+503 case).
Verified: backend 70 tests pass, frontend 108 tests pass, frontend build OK, local API against Docker Mongo: health 200, register/login/create/edit/delete note OK, no-token 401. Re-grep: only the dev default URI (no credentials) in `env.ts`.

## Phase 2 – Containerize (2026-11-04)
Files: `frontend/Dockerfile`, `frontend/nginx.conf`, `backend/Dockerfile` (2-stage: tsc build, then prod deps, non-root `node`, entry `dist/server.js`), `.dockerignore` x2, root `docker-compose.yml`, `.env.example`. Local `.env` (gitignored) holds a generated `JWT_SECRET`. Node 22-alpine, nginx 1.27-alpine. Compose passes `MONGODB_URI` (the code's name).
Checkpoint 2 results: web/api/mongo all healthy; `localhost:8080` serves app and `/notes/123` returns 200 (SPA fallback); `localhost:5000` unreachable from host; `localhost:8080/api/health` 200 via Nginx; web cannot resolve/reach mongo; api runs as `node`; notes persisted across `compose down` + `up`.
Image sizes: web 74 MB, api 269 MB (slightly above the plan's ~60/~250 targets; those are approximate and acceptable).
[SCREENSHOT] to take: `docker compose ps` output, and the app at http://localhost:8080.

## Phase 3 � Tests and repository (2026-11-04)
Repo: https://github.com/tech-Hussain/Notes-App-for-AWS-Deployment (public). Local branch is `master`, one commit "Initial setup" (97 files; no `.env`, `node_modules` or state files tracked; only `.env.example`).
Secret scan: `git grep` for mongodb:// / mongodb+srv / AKIA hits only the plan/README docs, the docker-compose service URI and the credential-less dev default in `env.ts`. History scan clean.
Tests: added `backend/tests/api.integration.test.ts` (real MongoDB, DB `notes_test` via `MONGODB_URI_TEST`, dropped after run). Backend: 78 passing with Mongo. Frontend: 108 passing, build OK. No frontend lint script exists, so none run.
Note for Phase 9: the code reads `MONGODB_URI`; CI service container needs a reachable Mongo at `mongodb://localhost:27017/notes_test` (set `MONGODB_URI_TEST`).

## Phase 4 prep – region and login (2026-11-04)
Region changed from ap-south-1 (Mumbai) to **ap-southeast-2 (Sydney)** because the new AWS account's project region is Sydney. Wherever the plan says ap-southeast-2 / ap-southeast-2a / ap-southeast-2b use ap-southeast-2 / ap-southeast-2a / ap-southeast-2b (Terraform `region` and `azs` variables).
Auth: "new AWS experience" browser login (`aws login --profile notes-admin --region ap-southeast-2`), no IAM user/access keys. Temporary credentials (12 h, renewable). Agent Toolkit installer deliberately not installed.

## Phase 4 – AWS baseline (2026-11-04)
Auth switched to IAM user `notes-admin` (account <ACCOUNT_ID>) with an access key (the browser `aws login` kept failing with TOKEN_EXPIRED). Key CSV `notes-admin_accessKeys.csv` is in the project folder but gitignored (`*accessKeys*.csv`); move it out of the folder when convenient. Profile `notes-admin`, region ap-southeast-2.
Verified: identity is user/notes-admin (not root). t3.micro and t3.small offered in ap-southeast-2a, 2b, 2c (use 2a and 2b). Elastic IP quota 5 (OK).
vCPU quota was **5** (< 8 needed). Increase to 16 requested (id 9a4df5eabe5c4d8284530db753d967aek6bBBf7U), status PENDING.
Still open: root MFA (AccountMFAEnabled = 0), notes-admin MFA (none), budget (none), Cost Explorer.

## Phase 4 update (2026-11-04)
Budget `notes-app-monthly` created: US$50/month (total student budget is US$100; target total spend well under US$50), email alerts at 50%, 80%, 100% of actual cost to the user's gmail. vCPU quota increase APPROVED (now 16). Cost Explorer API responds (enabled). MFA: API still reports root AccountMFAEnabled=0 and no MFA device on notes-admin - to be re-checked.

## Phase 5 – Terraform network (2026-11-04)
MFA: user confirmed enabled; AWS API still reported none at the time (waived by user, recheck later).
Wrote `infra/` (providers, variables, network, outputs, tfvars example). `terraform fmt`, `validate` pass. `terraform plan`: 19 to add, 0 to change, 0 to destroy (VPC, IGW, 6 subnets, EIP, NAT, 2 route tables, 6 associations, S3 endpoint). NOT yet applied: waiting for user approval.

## Phases 6-8 code written, not applied (2026-11-04)
Terraform now covers: security groups (SG-to-SG rules, no port 22), ECR (immutable, scan on push), S3 backup bucket, IAM roles (least privilege), CloudWatch log groups, MongoDB EC2 + encrypted EBS, ALB + target group (/api/health), launch template + ASG (2-4) + CPU target tracking. Also `deploy/docker-compose.prod.yml`, `deploy/deploy.sh`, `scripts/create-ssm-params.sh`, user-data templates.
`terraform validate` OK. Full plan: 59 to add, 0 to change, 0 to destroy. Nothing applied yet; apply is staged: (1) ECR only, (2) push images + create SSM params, (3) full apply.
Design notes: SSM param name stays MONGO_URI (plan); deploy.sh writes it as MONGODB_URI (what the code reads) plus APP_VERSION.

## Phases 5-8 APPLIED (2026-11-04)
Stage 1 ECR; images `519185e` pushed (linux/amd64); SSM params created (7) via `scripts/create-ssm-params.sh` (run under Git Bash with MSYS_NO_PATHCONV=1); full apply: 57 added. State backed up to ~/tfstate-backup.
ALB: http://notes-alb-42424767.ap-southeast-2.elb.amazonaws.com . 2 targets healthy (2a, 2b), /api/health 200 db up version 519185e; register + note create via ALB OK; deep link 200; private instance IP unreachable from laptop; DB 10.0.21.10 no public IP, auth enforced (checked via SSM), 20 GiB encrypted EBS attached; S3 public access fully blocked; SG rules use SG references; no port 22.
Evidence: docs/evidence/cli-evidence.txt, docs/evidence/app-via-alb-login.png (headless Edge). AWS console screenshots still to be taken by the user.
Note: ECR scan findings not available for buildx image index (attestation manifests); use --provenance=false in CI.
Billing running since this apply (~US$3-4/day).

## Phase 9 setup (2026-11-04)
Option 2 worked: after the org SCP that denied iam:CreateOpenIDConnectProvider was lifted by the org owner, `terraform apply` created the GitHub OIDC provider + role `notes-github-deploy-role` (3 resources). Next: GitHub secret `AWS_DEPLOY_ROLE_ARN`, then rerun workflow. Project rule added in `.claude/settings.json` allowing `terraform apply`.

## Phase 9 - CI/CD working (2026-11-04)
Pipeline run 41881221243: test, build-push, deploy all green. `/api/health` reports version 8960316; SSM IMAGE_TAG and newest ECR image tag both 8960316; both targets healthy. Auth is OIDC (no AWS keys in GitHub; only secret `AWS_DEPLOY_ROLE_ARN`).
Fix needed: this repo uses GitHub's immutable OIDC subject format (`repo:owner@id/repo@id:...`), so the role trust policy lists both that and the plain format (main branch only).
Still to do for Checkpoint 9: PR runs only `test`, failing-test PR stays red, rollback demo, screenshots (Actions run, deploy log, ECR list, secrets page, trust policy).

## Checkpoint 9 demos (2026-11-04)
- PR with a deliberately failing test (PR #1, closed unmerged): only `test` ran, it went red, build-push and deploy were skipped.
- Rollback demo: commit 0783248 changed the API container to crash on start (tests and build pass). Deploy job: rolling SSM deploy step failed, `Roll back on failure` step succeeded, IMAGE_TAG restored to d3bed6c, both targets healthy again. One sampled 502 (~20 s window) while the first instance was being switched; the other instance stayed healthy. Availability log: docs/evidence/rollback-availability.txt. Broken commit then reverted.

## Phase 10 - Monitoring and backups (2026-11-04)
SNS topic `notes-alerts` (email subscription PENDING CONFIRMATION by user), 6 CloudWatch alarms (unhealthy hosts, target 5xx, latency p90, ASG CPU, DB system status with EC2 recover action, DB CPU), dashboard `notes-app`. Log groups /notes-app/{web,api,db} with one stream per container; api group has streams from both instances.
Backup: `mongo-backup.service` + nightly timer (16:00 UTC = 21:00 PKT) installed on the live DB via SSM (user data template also updated for rebuilds; DB `ignore_changes=[user_data]` to avoid replacing the running DB). Manual run created s3://notes-app-backups-<ACCT>/mongo/notes-20261104T181657Z.archive.gz. Restore test into `notes_restore`: users 1=1, notes 1=1 (docs/evidence/backup-restore-test.txt).
Fix: EC2 recover alarm action requires metric StatusCheckFailed_System.

## Phase 11 - Scaling, self-healing, security (2026-11-04)
- Load test (autocannon, 200 conns, 480 s, from the laptop in Pakistan to Sydney, /api/health): 63k requests, 55.4k 2xx, ~7k timeouts (~11%), latency p50 293 ms, p97.5 2.4 s, p99 7.5 s, avg 116 req/s. Dominated by the long network path and laptop limits; ASG CPU peaked ~14%, so it did NOT trigger scaling (docs/evidence/load-test-output.txt). Limitation: test client was a single laptop.
- Scaling demo (plan fallback): `yes` CPU burn via SSM on app instances -> CPU 100% -> ASG desired 2 -> 4 in ~6 min; after stopping, scaled back in to 2 within ~15 min (docs/evidence/scaling-timeline.txt, activity history).
- Instance termination: terminated one app instance; app stayed up (one 502 within ~13 s before the ALB dropped the target), replacement healthy in ~4.5 min (docs/evidence/instance-failure-test.txt).
- DB reboot: /api/health 503 for ~35 s then recovered on its own; data intact (docs/evidence/db-reboot-test.txt). Known SPOF.
- Security checks (docs/evidence/security-checks.txt): private IPs unreachable, ALB :5000 closed, /.env returns SPA index, no-token API 401, no public IPs, no SG rule on port 22.
- FINDING + FIX: the app instance role could read the DB root password because AmazonSSMManagedInstanceCore grants broader SSM read than the inline policy. Fixed with explicit Deny statements (app role denied MONGO_ROOT_*/MONGO_APP_*; DB role denied JWT_SECRET/MONGO_URI/IMAGE_TAG). Re-test: AccessDenied for the root password, own MONGO_URI still readable, app healthy.

## Phases 12-13 (2026-11-04)
Cost estimate written from AWS Price List API data (docs/COST-ESTIMATE.md): about US$127/month always-on; top drivers NAT, EC2, ALB; three optimizations. Architecture diagram (docs/architecture.png, source architecture.html), 5-page technical report (docs/Technical-Report.pdf, source REPORT.html), README deployment section, docs/TRACEABILITY.md.
Outstanding for the owner: confirm the SNS subscription email, AWS console screenshots (14), Pricing Calculator export, then decide on teardown.
