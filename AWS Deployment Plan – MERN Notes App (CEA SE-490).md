# AWS Deployment Plan – MERN Notes App (CEA SE-490)

Nov 3, 2026 · @Gangster

## How to use this plan with Claude Code

Paste this whole plan into Claude Code from the root of your MERN repo (or export it as Markdown and save it as `PLAN.md`), then say: "Follow PLAN.md phase by phase. Stop at every checkpoint and show me the results." Each phase ends with a checkpoint; never start the next phase until every box in the current one is ticked.

Ground rules for Claude Code (copy these into `CLAUDE.md` too):

1. Verify, never assume. Before writing config, read the real code: folder names, ports, env variable names, Node version, React build tool (Vite or CRA), API base URL, auth method. Before using any tool, run its version command.
2. Install what is missing. If a tool is absent, detect the OS (Windows/WSL2, macOS, Linux) and install the official way, then re-verify the version.
3. Ask before spending money. Before any `terraform apply` or AWS command that creates billable resources, show the plan and wait for my "yes".
4. Never commit secrets. No passwords, URIs, JWT secrets, AWS keys or `.tfstate` files in git. Secrets live in `.env` (gitignored) locally and in AWS SSM Parameter Store / GitHub Secrets in the cloud.
5. No destructive commands (`terraform destroy`, deleting buckets, force-push) without my explicit approval.
6. Keep a log. Append what was done, commands run and outputs worth screenshotting to `docs/PROGRESS.md` after each phase.
7. When a checkpoint fails, fix the root cause and re-run the checks; don't skip.
8. Remind me which screenshot to take whenever a phase produces evidence (marked with a camera note: **\[SCREENSHOT\]**).

## Target architecture and key decisions

The app runs as two containers (Nginx web + Node/Express API) on EC2 instances in private subnets, behind a public Application Load Balancer, scaled by an Auto Scaling Group, with MongoDB on a separate private EC2 instance and everything built by Terraform and deployed by GitHub Actions.

Request path: Browser → ALB (public subnets, 2 AZs) → EC2 instance in private app subnet → Nginx container (serves React build, proxies `/api/*`) → API container on the same Docker network (no host port published) → MongoDB EC2 in private DB subnet (port 27017, app security group only).

Deploy path: `git push` → GitHub Actions (test → build → push to ECR → write image tag to SSM → SSM Run Command rolling `docker compose pull && up -d` on each instance → smoke test via ALB).

&#91;embedded content: Target architecture · 3 tiers, 2 AZs, ap-south-1\]

Traffic flows down the left column (internet → ALB → app instances → MongoDB); the right column holds the regional services that build, configure, watch and back up the stack.

| Decision | Choice | Why |
| --- | --- | --- |
| Region | `ap-south-1` (Mumbai) | Closest major region to Karachi, low latency; change in one Terraform variable if needed |
| Compute | EC2 + Auto Scaling Group, Docker Compose on each instance | Matches the brief's "same host + docker-compose" path; simpler than ECS/EKS for a student project |
| Web tier | `nginx:alpine` image with the React build baked in | Static serving + reverse proxy to API; only Nginx is reachable from the ALB |
| App tier | `node:<your version>-alpine` image, non-root user | Express API, no published port, reachable only via Nginx on the internal Docker network |
| Database | MongoDB 7 in Docker on a dedicated private EC2 + separate EBS gp3 volume | Keeps your MERN code unchanged; "properly secured self-managed database" is allowed; EBS covers enhancement option 2 |
| Registry | Amazon ECR (`notes-app/web`, `notes-app/api`) | Same account, IAM-controlled, scan on push |
| CI/CD | GitHub Actions + OIDC role (no AWS keys stored) | Free, simple, secure |
| Deploy mechanism | SSM Run Command (rolling, 1 instance at a time) | No SSH, no port 22 open anywhere |
| Secrets | SSM Parameter Store `SecureString` under `/notes-app/prod/*` | Free tier; KMS-encrypted; IAM-scoped |
| IaC | Terraform | Covers enhancement option 5; lets you `destroy` nightly to save money |
| Enhancements | Terraform, CloudWatch logs + alarms, S3 backups of MongoDB, EBS, cost estimate | Five of the six options; Kubernetes deliberately skipped |
| Admin access | SSM Session Manager | No bastion, no SSH keys |

Important: confirm the MongoDB choice with your instructor in week one. The brief says engines "may include" MySQL, PostgreSQL or MariaDB, so MongoDB should be acceptable as a secured self-managed database, but rewriting a MERN app for SQL later would cost you days. If the instructor insists on a managed service, swap Phase 7 for Amazon DocumentDB (MongoDB-compatible, managed, lives in your private subnets; needs TLS with the AWS CA bundle and `retryWrites=false` in the connection string, and it costs more).

Known limitations to state honestly in the report: one MongoDB instance (single point of failure), one NAT Gateway (one AZ), HTTP only unless you own a domain for an ACM certificate, single region.

## Requirement traceability matrix

Every item in the CEA brief maps to a phase below; tick the last column only when the screenshot or file is saved in `docs/evidence/`.

| # | Brief requirement | Implemented in | Evidence | Done |
| --- | --- | --- | --- | --- |
| 1 | VPC with CIDR | Phase 5 (`10.0.0.0/16`) | VPC console screenshot | \[ \] |
| 1 | Public subnets | Phase 5 (2 AZs) | Subnets screenshot | \[ \] |
| 1 | Private subnets | Phase 5 (app × 2, DB × 2) | Subnets screenshot | \[ \] |
| 1 | Internet Gateway | Phase 5 | IGW screenshot | \[ \] |
| 1 | Route tables | Phase 5 (public → IGW, private → NAT) | Route table screenshots | \[ \] |
| 1 | NAT Gateway | Phase 5 | NAT screenshot | \[ \] |
| 2 | Web tier container, public via browser | Phases 2, 8 | Dockerfile + browser screenshot | \[ \] |
| 3 | App tier container + Dockerfile + docker-compose | Phases 2, 8 | Files in repo | \[ \] |
| 3 | App tier private, reachable only from web | Phases 2, 6, 8 | SG rules + compose (no API port) | \[ \] |
| 4 | Database, never public | Phase 7 | DB instance + SG screenshot | \[ \] |
| 5 | Images in registry | Phase 6 | ECR repo listing screenshot | \[ \] |
| 6 | CI/CD builds, tests, pushes, deploys | Phase 9 | Successful Actions run screenshot | \[ \] |
| 7 | Load balancer | Phase 8 | ALB screenshot | \[ \] |
| 7 | Target group | Phase 8 | Target group (healthy) screenshot | \[ \] |
| 7 | Auto Scaling Group | Phases 8, 11 | ASG + activity history screenshot | \[ \] |
| 8 | Security groups per tier | Phase 6 | SG inbound rules screenshots | \[ \] |
| 8 | Network segmentation | Phase 5 | Subnet/route screenshots | \[ \] |
| 8 | Least privilege | Phases 6, 7, 9 | IAM role policy screenshots | \[ \] |
| 8 | Secrets management incl. pipeline | Phases 6, 9 | SSM params list (values hidden) + GitHub Secrets page | \[ \] |
| 9 | Enhancement: Terraform | Phases 5–8 | `infra/` folder + `terraform apply` output | \[ \] |
| 9 | Enhancement: CloudWatch | Phase 10 | Log groups, dashboard, alarms | \[ \] |
| 9 | Enhancement: S3 backups | Phase 10 | Bucket with backup objects | \[ \] |
| 9 | Enhancement: EBS | Phase 7 | Volume attached screenshot | \[ \] |
| 9 | Enhancement: cost estimate + 2 optimizations | Phase 12 | Pricing Calculator link/PDF | \[ \] |
| 10 | NFR justification (8 NFRs + limitations) | Phase 13 | Report section | \[ \] |
| D1 | Architecture diagram | Phase 13 | `docs/architecture.png` | \[ \] |
| D3 | Source files + repo link | Phases 2, 9 | GitHub repo | \[ \] |
| D4 | Technical report 4–6 pages | Phase 13 | PDF | \[ \] |

## Phase 0 – Install and verify every tool

Goal: every tool below prints a version on your machine before any project work starts.

Claude Code tasks:

1. Detect the OS (`uname -a`, or `ver` / `wsl --status` on Windows). On Windows, strongly prefer working inside WSL2 Ubuntu with Docker Desktop's WSL integration on.
2. Run each check command; install anything missing using the official method for that OS, then re-run the check.
3. Record all versions in `docs/PROGRESS.md`.

| Tool | Check command | Required |
| --- | --- | --- |
| Git | `git --version` | any recent |
| Node.js + npm | `node -v && npm -v` | the version your app's `package.json` "engines" or `.nvmrc` says; if none, current LTS (install via nvm) |
| Docker Engine / Desktop | `docker version` (both Client and Server must print) | 24+ |
| Docker Compose v2 | `docker compose version` | v2 (the `docker compose` plugin, not old `docker-compose`) |
| Docker Buildx | `docker buildx version` | any |
| AWS CLI v2 | `aws --version` | `aws-cli/2.x` (v1 is not acceptable) |
| Terraform | `terraform -version` | 1.6 or newer (install from HashiCorp's official repo/zip) |
| GitHub CLI (optional, handy) | `gh --version` | any |
| curl, jq, openssl | `curl --version; jq --version; openssl version` | any |
| Load-test tool (used in Phase 11) | `npx autocannon --version` | any |

Also check: `docker run --rm hello-world` succeeds, and `docker info` shows the daemon running without `sudo` (Linux: add user to the `docker` group, then log out/in).

### Checkpoint 0

- [ ] Every command in the table prints a version
- [ ] `docker run --rm hello-world` works
- [ ] `aws --version` shows v2
- [ ] `terraform -version` shows ≥ 1.6
- [ ] Versions logged in `docs/PROGRESS.md`

## Phase 1 – Audit and prepare the MERN app

Goal: the app reads all config from environment variables, calls the API through a relative `/api` path, and exposes a health endpoint, so the same code runs locally, in Docker and on AWS.

### 1A. Audit (read only, report back before changing anything)

Claude Code must inspect the repo and write findings to `docs/AUDIT.md`:

1. Folder layout: where the frontend and backend live (e.g. `client/`, `server/`, `frontend/`, `backend/`), or whether it is one folder.
2. Frontend: Vite or Create React App? Build command and output folder (`dist/` vs `build/`). React Router used? (affects Nginx config).
3. How the frontend calls the API: hardcoded `http://localhost:5000`, axios `baseURL`, a proxy in `vite.config`/`package.json`, or env var (`VITE_API_URL` / `REACT_APP_API_URL`).
4. Backend: entry file, port, Express version, every `process.env.*` used, how `mongoose.connect` is called.
5. Auth: JWT (stateless, good) or `express-session` with memory store (must change, breaks behind a load balancer). Where the token is stored (localStorage vs cookie). If cookies: check `sameSite`/`secure` settings.
6. CORS configuration.
7. File uploads to local disk? (would break with multiple instances; move to S3 if present).
8. Existing tests and test framework, lint scripts.
9. Hardcoded secrets anywhere (`grep -rn "mongodb+srv\|mongodb://\|secret\|password" --exclude-dir=node_modules`). Check git history too: `git log -p | grep -i "mongodb"`.
10. Node version used and `package-lock.json` present for both apps.

### 1B. Changes to make

1. Backend config only from env: `PORT` (default 5000), `MONGO_URI`, `JWT_SECRET`, `NODE_ENV`, `CORS_ORIGIN` (optional). Fail fast with a clear error if `MONGO_URI` or `JWT_SECRET` is missing.
2. Add `GET /api/health` returning `200 {"status":"ok","db":"up"}` when `mongoose.connection.readyState === 1`, else `503`. The ALB will use it.
3. Frontend API base URL becomes relative: `/api`. Keep local dev working through the Vite/CRA dev proxy to `localhost:5000`.
4. Graceful shutdown on `SIGTERM` (close server and mongoose) so rolling deploys don't drop requests.
5. Ensure the server listens on `0.0.0.0`, not `localhost`.
6. Add `.env.example` files (no real values) and confirm `.env` is in `.gitignore`.
7. If secrets were ever committed: rotate them (new MongoDB password, new JWT secret). Don't rely on deleting history.
8. If sessions are in memory: switch to JWT or a Mongo-backed session store. If uploads go to disk: plan S3 (tell me first).

### Checkpoint 1

- [ ] `docs/AUDIT.md` written and reviewed by me
- [ ] App still runs locally the old way (`npm run dev` or equivalent) and I can create, edit and delete a note
- [ ] `curl localhost:5000/api/health` returns 200
- [ ] No hardcoded URLs or secrets left (re-run the grep)
- [ ] `.env.example` committed, `.env` ignored

## Phase 2 – Containerize and run locally with Docker Compose

Goal: `docker compose up --build` starts web + api + mongo, the app works at `http://localhost:8080`, and only Nginx has a published port.

Adjust folder names (`client/`, `server/`), the Node version, the build output folder and the API entry file to what Phase 1 found. The snippets are templates, not final truth.

### 2A. Web tier – `client/Dockerfile`

```dockerfile
# Stage 1: build the React app
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# If the app reads VITE_API_URL / REACT_APP_API_URL at build time, set it to /api here
RUN npm run build

# Stage 2: serve with Nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Use /app/build instead of /app/dist for Create React App
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1/nginx-health || exit 1
```

### 2B. `client/nginx.conf`

```nginx
server {
  listen 80;
  server_name _;
  server_tokens off;
  root /usr/share/nginx/html;
  index index.html;
  client_max_body_size 5m;

  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;

  location = /nginx-health { access_log off; return 200 "ok\n"; }

  # Reverse proxy to the app tier (Docker service name "api"); keeps the /api prefix
  location /api/ {
    proxy_pass http://api:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
    proxy_read_timeout 60s;
  }

  # Long cache for hashed build assets
  location /assets/ { expires 30d; add_header Cache-Control "public, immutable"; try_files $uri =404; }

  # SPA fallback so React Router deep links work on refresh
  location / { try_files $uri $uri/ /index.html; }
}
```

If the backend routes are not under `/api` (e.g. `/notes`), either prefix them in Express or adjust the proxy; decide based on the audit.

### 2C. App tier – `server/Dockerfile`

```dockerfile
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node . .
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1
# Replace server.js with the real entry file found in Phase 1
CMD ["node", "server.js"]
```

Add `.dockerignore` in both folders: `node_modules`, `.env`, `.git`, `dist`, `build`, `coverage`, `*.log`, `Dockerfile*`.

### 2D. Root `docker-compose.yml` (local development)

```yaml
services:
  web:
    build: ./client
    ports:
      - "8080:80"          # the ONLY published port
    depends_on:
      api:
        condition: service_healthy
    networks: [frontend]

  api:
    build: ./server
    environment:
      PORT: 5000
      NODE_ENV: production
      MONGO_URI: mongodb://mongo:27017/notes
      JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET in .env}
    depends_on:
      mongo:
        condition: service_healthy
    networks: [frontend, backend]   # no ports: not reachable from the host

  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [backend]             # web cannot reach the database

networks:
  frontend:
  backend:

volumes:
  mongo-data:
```

The two networks mirror the cloud design: web → api only, api → mongo only. Local Mongo runs without auth; production Mongo (Phase 7) uses authentication.

### Checkpoint 2

- [ ] `docker compose up --build` starts all three; `docker compose ps` shows web and api `healthy`
- [ ] `http://localhost:8080` loads; sign up/log in; create, edit, delete a note
- [ ] Refreshing a deep link (e.g. `/notes/123`) still loads, no 404
- [ ] `curl http://localhost:5000/api/health` fails from the host (API not exposed)
- [ ] `curl http://localhost:8080/api/health` returns 200 (through Nginx)
- [ ] `docker compose exec web wget -qO- -T 3 http://mongo:27017` fails (segmentation works)
- [ ] `docker compose exec api whoami` prints `node` (non-root)
- [ ] `docker images` shows reasonable sizes (web under \~60 MB, api under \~250 MB)
- [ ] Data survives `docker compose down && docker compose up` (volume works)

## Phase 3 – Tests and GitHub repository

Goal: `npm test` passes in both apps against a real MongoDB, and the code is on GitHub with no secrets in history.

### 3A. Backend tests

1. If no tests exist, add Jest + Supertest as dev dependencies. Export the Express `app` separately from `app.listen(...)` so tests can import it.
2. Minimum tests: `GET /api/health` → 200; register/login returns a token; create a note → 201; list notes → contains it; update; delete; request without token → 401.
3. Tests read `MONGO_URI` from env (locally `mongodb://localhost:27017/notes_test` via `docker run -d -p 27017:27017 mongo:7`; in CI a service container). Drop the test DB after the run.
4. Script: `"test": "jest --runInBand --forceExit"`.

### 3B. Frontend checks

1. `npm run build` must pass (this is the minimum test).
2. If ESLint exists, `npm run lint` must pass. Optionally add one Vitest/React Testing Library smoke test that renders the main page.

### 3C. Repository

1. Root `.gitignore` covers: `node_modules/`, `.env`, `.env.*` (but not `.env.example`), `dist/`, `build/`, `coverage/`, `infra/.terraform/`, `*.tfstate*`, `*.tfvars` (except an example file), `docs/evidence/raw/`.
2. Scan for secrets before the first push: `git grep -nI -e "mongodb://" -e "mongodb+srv" -e "AKIA"` and review results (optionally run `gitleaks detect`).
3. Create the GitHub repo (public is fine if no secrets; private also works) and push to `main`.
4. Turn on branch protection for `main` later (Phase 9) so the pipeline must pass.

Final repo layout to aim for:

```text
notes-app/
├─ client/            Dockerfile, nginx.conf, .dockerignore, React source
├─ server/            Dockerfile, .dockerignore, Express source, tests
├─ deploy/            docker-compose.prod.yml, deploy.sh (copied to EC2 by user-data)
├─ infra/             Terraform (*.tf), templates/, terraform.tfvars.example
├─ scripts/           create-ssm-params.sh, mongo-backup.sh, load-test.sh
├─ .github/workflows/ deploy.yml
├─ docs/              PLAN.md, PROGRESS.md, AUDIT.md, architecture.png, evidence/
├─ docker-compose.yml
└─ README.md
```

### Checkpoint 3

- [ ] `cd server && npm test` passes locally against Docker Mongo
- [ ] `cd client && npm run build` passes (and lint, if present)
- [ ] Secret scan clean
- [ ] Code pushed to GitHub `main`; repo URL saved in `docs/PROGRESS.md`

## Phase 4 – AWS account baseline (do this before creating anything)

Goal: a safe, non-root CLI identity in `ap-south-1`, a budget alarm, and confirmation that the instance types you need are available.

You do these steps in the AWS Console yourself; Claude Code verifies them from the CLI.

1. Root account: enable MFA, then stop using root.
2. Create an admin identity for daily work: IAM Identity Center user (then `aws configure sso`) or an IAM user with `AdministratorAccess` + MFA and an access key (then `aws configure`). Profile name: `notes-admin`. The key stays on your laptop only; it is never put in GitHub.
3. Billing: check what free tier or credits your account has (Billing → Free Tier / Credits). Create an AWS Budget, monthly cost, with email alerts at 50%, 80% and 100% of a small amount you can afford (e.g. $15).
4. Enable Cost Explorer (needed for the cost section later).
5. Claude Code verifies the region supports the instance types: `aws ec2 describe-instance-type-offerings --location-type availability-zone --filters Name=instance-type,Values=t3.micro,t3.small --region ap-south-1 --profile notes-admin`.
6. Check quotas that bite new accounts: running On-Demand Standard instances vCPU limit (Service Quotas → EC2) must be at least 8; Elastic IPs at least 1 (for the NAT Gateway).
7. Terraform state stays local in `infra/terraform.tfstate`, gitignored. Back it up (copy to a private place) after every apply; losing it means manual cleanup.

```bash
export AWS_PROFILE=notes-admin
export AWS_REGION=ap-south-1
aws sts get-caller-identity
```

### Checkpoint 4

- [ ] Root MFA on
- [ ] `aws sts get-caller-identity` shows the admin identity, not root (ARN does not end in `:root`)
- [ ] Budget with email alerts created **\[SCREENSHOT\]** (useful for the cost section)
- [ ] `t3.micro` and `t3.small` offered in at least 2 AZs of `ap-south-1` (note the AZ names, e.g. `ap-south-1a`, `ap-south-1b`)
- [ ] vCPU quota ≥ 8 confirmed

## Phase 5 – Terraform: network layer

Goal: a VPC `10.0.0.0/16` across two AZs with 2 public, 2 private-app and 2 private-DB subnets, an Internet Gateway, one NAT Gateway, route tables, and a free S3 gateway endpoint.

| Subnet | CIDR | AZ | Route 0.0.0.0/0 → | Holds |
| --- | --- | --- | --- | --- |
| public-a | 10.0.1.0/24 | ap-south-1a | IGW | ALB, NAT Gateway |
| public-b | 10.0.2.0/24 | ap-south-1b | IGW | ALB |
| app-a | 10.0.11.0/24 | ap-south-1a | NAT | Web+API EC2 (ASG) |
| app-b | 10.0.12.0/24 | ap-south-1b | NAT | Web+API EC2 (ASG) |
| db-a | 10.0.21.0/24 | ap-south-1a | NAT | MongoDB EC2 |
| db-b | 10.0.22.0/24 | ap-south-1b | NAT | reserved for a future replica / DocumentDB |

### 5A. Files in `infra/`

`providers.tf`, `variables.tf`, `terraform.tfvars` (gitignored) + `terraform.tfvars.example`, `network.tf`, `security_groups.tf`, `ecr.tf`, `iam.tf`, `s3.tf`, `database.tf`, `alb.tf`, `compute.tf`, `monitoring.tf`, `github_oidc.tf`, `outputs.tf`, `templates/app_user_data.sh.tftpl`, `templates/db_user_data.sh.tftpl`.

```hcl
# providers.tf
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" } # verify current major on the Registry
  }
}
provider "aws" {
  region = var.region
  default_tags { tags = { Project = "notes-app", Environment = "prod", ManagedBy = "terraform" } }
}

# variables.tf (main ones)
variable "region"       { default = "ap-south-1" }
variable "azs"          { default = ["ap-south-1a", "ap-south-1b"] }
variable "vpc_cidr"     { default = "10.0.0.0/16" }
variable "github_repo"  { description = "owner/repo, e.g. ali/notes-app" }
variable "alert_email"  { description = "email for CloudWatch alarms" }
variable "app_instance_type" { default = "t3.micro" }
variable "db_instance_type"  { default = "t3.small" }
```

```hcl
# network.tf
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = { Name = "notes-vpc" }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "notes-igw" }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1)   # 10.0.1.0/24, 10.0.2.0/24
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "notes-public-${count.index}", Tier = "public" }
}

resource "aws_subnet" "app" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 11) # 10.0.11.0/24, 10.0.12.0/24
  availability_zone = var.azs[count.index]
  tags = { Name = "notes-app-${count.index}", Tier = "private-app" }
}

resource "aws_subnet" "db" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 21) # 10.0.21.0/24, 10.0.22.0/24
  availability_zone = var.azs[count.index]
  tags = { Name = "notes-db-${count.index}", Tier = "private-db" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "notes-nat-eip" }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  tags          = { Name = "notes-nat" }
  depends_on    = [aws_internet_gateway.igw]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = { Name = "notes-public-rt" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
  tags = { Name = "notes-private-rt" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
resource "aws_route_table_association" "app" {
  count          = 2
  subnet_id      = aws_subnet.app[count.index].id
  route_table_id = aws_route_table.private.id
}
resource "aws_route_table_association" "db" {
  count          = 2
  subnet_id      = aws_subnet.db[count.index].id
  route_table_id = aws_route_table.private.id
}

# Free gateway endpoint: S3 traffic (ECR image layers, backups) skips the NAT => lower cost
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id]
  tags              = { Name = "notes-s3-endpoint" }
}
```

Cost note: the NAT Gateway bills per hour from the moment it exists. Apply this phase only when you are ready to continue through Phase 8 in the same sitting, or destroy at the end of the day (Phase 14).

### Checkpoint 5

- [ ] `terraform fmt -check && terraform validate` pass
- [ ] `terraform plan` reviewed by me (expect \~20 resources), then `terraform apply`
- [ ] `aws ec2 describe-subnets --filters Name=vpc-id,Values=<vpc-id> --query "Subnets[].[Tags[?Key=='Name']|[0].Value,CidrBlock,AvailabilityZone,MapPublicIpOnLaunch]" --output table` shows 6 subnets, only public ones auto-assign public IPs
- [ ] Public route table has `0.0.0.0/0 → igw-…`; private has `0.0.0.0/0 → nat-…` and the S3 prefix-list route
- [ ] NAT Gateway state `available`
- [ ] **\[SCREENSHOT\]** VPC details, subnet list, both route tables (Routes tab), IGW, NAT Gateway, S3 endpoint

## Phase 6 – Security groups, ECR, secrets, IAM, S3 + first image push

Goal: every tier has its own security group chained by SG references, images are in ECR, all secrets are in SSM Parameter Store, and each EC2 role can read only the secrets it needs.

### 6A. Security groups (`security_groups.tf`)

| SG | Inbound | Outbound | Note |
| --- | --- | --- | --- |
| `notes-alb-sg` | TCP 80 from `0.0.0.0/0` (+443 if you add a domain/ACM cert) | TCP 80 to `notes-app-sg` only | Only internet-facing SG |
| `notes-app-sg` | TCP 80 from `notes-alb-sg` only | TCP 27017 to `notes-db-sg`; TCP 443 to `0.0.0.0/0` (ECR, SSM, CloudWatch, package repos via NAT) | API port 5000 is never opened; it lives only on the Docker network |
| `notes-db-sg` | TCP 27017 from `notes-app-sg` only | TCP 443 to `0.0.0.0/0` (image pull, S3, SSM) | No CIDR-based inbound at all |

No security group opens port 22. Admin access is through SSM Session Manager. Use `aws_vpc_security_group_ingress_rule` / `aws_vpc_security_group_egress_rule` resources with `referenced_security_group_id`, so the rules read as "from SG X" in the console (good for screenshots and the report).

### 6B. ECR (`ecr.tf`)

Two repositories, `notes-app/web` and `notes-app/api`, each with `image_tag_mutability = "IMMUTABLE"`, `image_scanning_configuration { scan_on_push = true }`, `force_delete = true` (so teardown works), and a lifecycle policy keeping the last 15 images. Images are tagged only with the short git SHA, never `latest`, so every deploy is traceable and rollback is just an older tag.

### 6C. Secrets in SSM Parameter Store (`scripts/create-ssm-params.sh`, not Terraform)

Secrets are created by a script so their values never enter Terraform state or git. The script must skip any parameter that already exists unless run with `--overwrite`.

```bash
#!/usr/bin/env bash
set -euo pipefail
P=/notes-app/prod
DB_IP=10.0.21.10          # fixed private IP of the MongoDB instance (Phase 7)
ROOT_PW=$(openssl rand -hex 24)   # hex = no URL-encoding problems in the URI
APP_PW=$(openssl rand -hex 24)
JWT=$(openssl rand -hex 48)
put() { aws ssm put-parameter --name "$P/$1" --type "$2" --value "$3" >/dev/null && echo "created $P/$1"; }
put MONGO_ROOT_USERNAME String notesroot
put MONGO_ROOT_PASSWORD SecureString "$ROOT_PW"
put MONGO_APP_USERNAME  String notesapp
put MONGO_APP_PASSWORD  SecureString "$APP_PW"
put MONGO_URI           SecureString "mongodb://notesapp:${APP_PW}@${DB_IP}:27017/notes?authSource=notes"
put JWT_SECRET          SecureString "$JWT"
put IMAGE_TAG           String bootstrap
```

### 6D. IAM roles (`iam.tf`) – least privilege

| Role | Attached to | Permissions |
| --- | --- | --- |
| `notes-app-ec2-role` | Web/API instances | `AmazonSSMManagedInstanceCore`; ECR pull (`ecr:GetAuthorizationToken` on `*`, `BatchGetImage`/`GetDownloadUrlForLayer`/`BatchCheckLayerAvailability` on the 2 repos); `ssm:GetParameter(s)` on only `MONGO_URI`, `JWT_SECRET`, `IMAGE_TAG`; `logs:CreateLogStream`/`PutLogEvents` on `/notes-app/*` log groups |
| `notes-db-ec2-role` | MongoDB instance | `AmazonSSMManagedInstanceCore`; `ssm:GetParameter(s)` on only the four `MONGO_ROOT_*`/`MONGO_APP_*` params; `s3:PutObject`/`GetObject` on `backups-bucket/mongo/*`, `s3:ListBucket` on the bucket; logs on `/notes-app/db` |
| `notes-github-deploy-role` | GitHub Actions via OIDC (Phase 9) | ECR push to the 2 repos; `ssm:PutParameter` on `IMAGE_TAG` only; `ssm:SendCommand` limited to `AWS-RunShellScript` and instances tagged `Role=notes-app`; read command results; `autoscaling:Describe*`, `elasticloadbalancing:Describe*` |

The app role cannot read the Mongo root password, and the DB role cannot read the JWT secret. Mention that in the report as least privilege. Parameters use the AWS-managed `aws/ssm` KMS key; if Claude Code finds decryption is denied, add `kms:Decrypt` scoped with the `kms:ViaService = ssm.ap-south-1.amazonaws.com` condition.

### 6E. S3 backup bucket (`s3.tf`)

Bucket `notes-app-backups-<account-id>`: all four Block Public Access settings on, versioning on, default encryption SSE-S3, bucket policy denying requests where `aws:SecureTransport = false`, lifecycle rule: objects under `mongo/` move to Standard-IA after 30 days and expire after 90; noncurrent versions expire after 7 days; `force_destroy = true` for teardown.

### 6F. First manual image push

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REG=$ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com
TAG=$(git rev-parse --short HEAD)
aws ecr get-login-password | docker login --username AWS --password-stdin "$REG"
# --platform matters on Apple Silicon: EC2 t3 instances are x86_64
docker buildx build --platform linux/amd64 -t "$REG/notes-app/web:$TAG" --push ./client
docker buildx build --platform linux/amd64 -t "$REG/notes-app/api:$TAG" --push ./server
aws ssm put-parameter --name /notes-app/prod/IMAGE_TAG --type String --value "$TAG" --overwrite
```

### Checkpoint 6

- [ ] `terraform plan` reviewed, then applied (SGs, ECR, IAM, S3; still no instances)
- [ ] `scripts/create-ssm-params.sh` run once; `aws ssm get-parameters-by-path --path /notes-app/prod --query "Parameters[].[Name,Type]" --output table` lists 7 params (values not printed)
- [ ] `aws ecr describe-images --repository-name notes-app/api` shows the SHA tag; scan results have no CRITICAL findings (fix base images if they do)
- [ ] SG inbound rules show SG references, not CIDRs, for app and DB
- [ ] Bucket: `aws s3api get-public-access-block` shows all four `true`
- [ ] **\[SCREENSHOT\]** each SG's inbound rules, ECR repos with image tags + scan results, SSM parameters list (values hidden), IAM role policies, S3 bucket properties

## Phase 7 – Database tier: MongoDB on a private EC2 with EBS

Goal: MongoDB 7 runs with authentication at `10.0.21.10:27017`, has no public IP, stores data on its own encrypted EBS volume, and accepts connections only from the app security group.

### 7A. Terraform (`database.tf`)

1. `aws_instance.db`: Amazon Linux 2023 AMI (look it up with an `aws_ssm_parameter` data source on `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`), `t3.small`, subnet `db[0]`, `private_ip = "10.0.21.10"`, SG `notes-db-sg`, instance profile `notes-db-ec2-role`, no public IP, `metadata_options { http_tokens = "required" }` (IMDSv2), encrypted gp3 root volume, tags `Name = notes-mongodb`, `Role = notes-db`.
2. `aws_ebs_volume.mongo_data`: 20 GiB gp3, `encrypted = true`, same AZ as the instance, tag `Name = notes-mongo-data`.
3. `aws_volume_attachment`: device `/dev/sdf`. On Nitro instances it appears as an NVMe disk, so user-data finds it by volume ID, not by name.
4. User data from `templates/db_user_data.sh.tftpl`, passing the volume ID and region.

### 7B. `templates/db_user_data.sh.tftpl` (logic Claude Code must implement)

```bash
#!/bin/bash
set -euxo pipefail
REGION=${region}
P=/notes-app/prod
dnf install -y docker
systemctl enable --now docker

# 1. Wait for the EBS data volume (attached after boot) and find it by its ID
DEV=/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${replace(volume_id, "-", "")}
for i in $(seq 1 60); do [ -e "$DEV" ] && break; sleep 5; done
[ -e "$DEV" ] || { echo "data volume not found"; exit 1; }

# 2. Format ONLY if empty (never wipe existing data), then mount persistently
blkid "$DEV" || mkfs -t xfs "$DEV"
mkdir -p /data
UUID=$(blkid -s UUID -o value "$DEV")
grep -q "$UUID" /etc/fstab || echo "UUID=$UUID /data xfs defaults,nofail 0 2" >> /etc/fstab
mount -a
mkdir -p /data/mongo /opt/mongo-init

# 3. Secrets from SSM (never written to disk)
get() { aws ssm get-parameter --region "$REGION" --with-decryption --name "$P/$1" --query Parameter.Value --output text; }
export MONGO_ROOT_USER=$(get MONGO_ROOT_USERNAME) MONGO_ROOT_PW=$(get MONGO_ROOT_PASSWORD)
export MONGO_APP_USER=$(get MONGO_APP_USERNAME)  MONGO_APP_PW=$(get MONGO_APP_PASSWORD)

# 4. Init script creates a least-privilege app user (readWrite on "notes" only); reads password from env
cat > /opt/mongo-init/01-app-user.js <<'EOF'
db.getSiblingDB('notes').createUser({
  user: process.env.MONGO_APP_USER,
  pwd: process.env.MONGO_APP_PW,
  roles: [{ role: 'readWrite', db: 'notes' }]
});
EOF

# 5. Run MongoDB (init scripts run only on an empty data dir)
docker rm -f mongo 2>/dev/null || true
docker run -d --name mongo --restart unless-stopped \
  -p 27017:27017 \
  -v /data/mongo:/data/db \
  -v /opt/mongo-init:/docker-entrypoint-initdb.d:ro \
  -e MONGO_INITDB_ROOT_USERNAME="$MONGO_ROOT_USER" \
  -e MONGO_INITDB_ROOT_PASSWORD="$MONGO_ROOT_PW" \
  -e MONGO_APP_USER -e MONGO_APP_PW \
  --log-driver awslogs --log-opt awslogs-region="$REGION" --log-opt awslogs-group=/notes-app/db \
  mongo:7 --wiredTigerCacheSizeGB 0.5
```

Notes for Claude Code: the `${...}` placeholders are Terraform `templatefile` variables, so escape any bash `${VAR}` you add as `$${VAR}`. The `/notes-app/db` log group must exist before boot (create it in `monitoring.tf` now or in this file). Pin the Mongo image to a specific `7.0.x` tag once you have checked the latest patch release.

### Checkpoint 7

- [ ] `terraform apply` done; instance has no public IP: `aws ec2 describe-instances --filters Name=tag:Name,Values=notes-mongodb --query "Reservations[].Instances[].[PrivateIpAddress,PublicIpAddress,State.Name]"` shows `10.0.21.10`, `None`, `running`
- [ ] Instance shows as Online in Systems Manager → Fleet Manager (proves SSM + NAT work)
- [ ] Session Manager shell: `sudo docker ps` shows `mongo` up; `df -h /data` shows the 20 GiB volume
- [ ] `sudo docker exec mongo mongosh --quiet --eval "db.adminCommand({listDatabases:1})"` without credentials fails with an auth error (auth is enforced)
- [ ] With root credentials it succeeds, and `db.getSiblingDB('notes').getUsers()` lists `notesapp` with `readWrite` on `notes` only
- [ ] Reboot the instance; Mongo comes back and existing data is still there
- [ ] **\[SCREENSHOT\]** DB instance details (private IP, no public IP, subnet), EBS volume attached + encrypted, `notes-db-sg` inbound rule

## Phase 8 – Compute: ALB, target group, launch template, Auto Scaling Group

Goal: opening the ALB's DNS name in a browser shows the Notes app, served by 2 instances in 2 AZs that the ASG keeps healthy and scales between 2 and 4.

### 8A. Load balancer (`alb.tf`)

1. `aws_lb` named `notes-alb`: application, internet-facing, subnets = both public, SG `notes-alb-sg`, `drop_invalid_header_fields = true`.
2. `aws_lb_target_group` named `notes-web-tg`: HTTP 80, target type `instance`, health check path `/api/health` (proves Nginx + API + DB together), matcher `200`, interval 15 s, healthy threshold 2, unhealthy 3, `deregistration_delay = 30`.
3. Listener HTTP :80 → forward to the target group. With a domain: add an ACM certificate, a :443 listener, and make :80 redirect to HTTPS.

### 8B. Launch template + ASG (`compute.tf`)

1. Launch template `notes-app-lt`: AL2023 x86\_64 AMI (same SSM data source), `t3.micro`, instance profile `notes-app-ec2-role`, SG `notes-app-sg`, no public IP, IMDSv2 required with `http_put_response_hop_limit = 1` (containers cannot reach instance credentials), encrypted gp3 root volume, tags `Name = notes-app`, `Role = notes-app` on instances, user data from `templates/app_user_data.sh.tftpl`.
2. ASG `notes-app-asg`: subnets = both app subnets, min 2 / desired 2 / max 4, attached to `notes-web-tg`, `health_check_type = "ELB"`, `health_check_grace_period = 300`, `enabled_metrics` on (for graphs), `instance_refresh` rolling with `min_healthy_percentage = 50` (replaces instances when the launch template changes).
3. Scaling policy: target tracking on `ASGAverageCPUUtilization` = 50%.

### 8C. Files deployed onto each instance

User data installs Docker (`dnf install -y docker`) and the Docker Compose v2 plugin (download a pinned release binary for x86\_64 into `/usr/local/lib/docker/cli-plugins/`, since AL2023 has no compose package; verify with `docker compose version`). It then writes the two files below into `/opt/notes-app/` (Terraform reads them from `deploy/` with `templatefile`) and runs `deploy.sh`.

`deploy/docker-compose.prod.yml`:

```yaml
services:
  web:
    image: ${REGISTRY}/notes-app/web:${IMAGE_TAG}
    ports: ["80:80"]                    # only port on the host; SG allows it from the ALB only
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped
    networks: [frontend]
    logging:
      driver: awslogs
      options: { awslogs-region: "${AWS_REGION}", awslogs-group: /notes-app/web }

  api:
    image: ${REGISTRY}/notes-app/api:${IMAGE_TAG}
    env_file: .env.runtime              # written by deploy.sh from SSM, mode 600
    restart: unless-stopped
    networks: [frontend]                # no ports: reachable only from web
    logging:
      driver: awslogs
      options: { awslogs-region: "${AWS_REGION}", awslogs-group: /notes-app/api }

networks:
  frontend:
```

`deploy/deploy.sh` (also what the pipeline triggers; optional argument = tag to deploy, for rollback):

```bash
#!/bin/bash
set -euo pipefail
cd /opt/notes-app
P=/notes-app/prod
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
export AWS_REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export REGISTRY="$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
get() { aws ssm get-parameter --with-decryption --name "$P/$1" --query Parameter.Value --output text; }
export IMAGE_TAG="${1:-$(get IMAGE_TAG)}"

umask 077
printf 'NODE_ENV=production\nPORT=5000\nMONGO_URI=%s\nJWT_SECRET=%s\n' "$(get MONGO_URI)" "$(get JWT_SECRET)" > .env.runtime

aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans

for i in $(seq 1 30); do curl -fs http://localhost/api/health && break; sleep 2; done
curl -fs http://localhost/api/health >/dev/null || { echo "HEALTH CHECK FAILED for $IMAGE_TAG"; exit 1; }
echo "$IMAGE_TAG" > CURRENT_TAG
docker image prune -af --filter "until=24h" || true
```

When these files go through `templatefile`, escape every bash `${...}` as `$${...}` (or load them with `file()` and base64 instead of templating). The `/notes-app/web` and `/notes-app/api` log groups must exist before instances boot.

### Checkpoint 8

- [ ] `terraform apply` done; `terraform output alb_dns_name` printed
- [ ] Within \~5 min, target group shows 2 healthy targets in 2 different AZs: `aws elbv2 describe-target-health --target-group-arn <arn>`
- [ ] `curl http://<alb-dns>/api/health` → 200; browser shows the app; register, log in, create/edit/delete a note
- [ ] Refresh the page several times while watching CloudWatch logs: requests hit both instances
- [ ] App instances have no public IP; `curl --max-time 5 http://<instance-private-ip>` from your laptop fails
- [ ] From a Session Manager shell on an app instance: `curl -s localhost:5000` fails (API not on the host), `docker compose -f /opt/notes-app/docker-compose.prod.yml ps` shows both healthy
- [ ] If something fails: check `/var/log/cloud-init-output.log` on the instance first
- [ ] **\[SCREENSHOT\]** ALB (listeners, DNS name), target group with healthy targets, launch template, ASG details + scaling policy, EC2 instance list, app in the browser with the ALB URL visible in the address bar

## Phase 9 – CI/CD with GitHub Actions (OIDC, no stored AWS keys)

Goal: every push to `main` runs tests, builds both images, pushes them to ECR with the commit SHA as tag, rolls them out to every instance one at a time, smoke-tests through the ALB, and rolls back automatically if anything fails. Pull requests run tests only.

### 9A. AWS side (`github_oidc.tf`)

1. `aws_iam_openid_connect_provider` for `https://token.actions.githubusercontent.com`, client ID `sts.amazonaws.com`. If the account already has this provider, reference it with a data source instead of creating a duplicate.
2. Role `notes-github-deploy-role`, trust policy: `sts:AssumeRoleWithWebIdentity` from that provider with conditions `token.actions.githubusercontent.com:aud = sts.amazonaws.com` and `token.actions.githubusercontent.com:sub = repo:<owner>/<repo>:ref:refs/heads/main` (only your repo's main branch can deploy).
3. Permissions as in Phase 6D, plus `ssm:GetParameter` on `IMAGE_TAG` (to remember the previous tag for rollback). Output the role ARN.

### 9B. Small app change for traceable deploys

`deploy.sh` adds `APP_VERSION=$IMAGE_TAG` to `.env.runtime`, and `/api/health` returns it: `{"status":"ok","db":"up","version":"a1b2c3d"}`. The pipeline's smoke test then proves the new version is the one actually serving traffic.

### 9C. GitHub side

1. Repo → Settings → Secrets and variables → Actions → secret `AWS_DEPLOY_ROLE_ARN` (the role ARN). No access keys anywhere.
2. After the first green run: branch protection on `main` requiring the `test` job.

### 9D. `.github/workflows/deploy.yml`

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: deploy-prod
  cancel-in-progress: false

env:
  AWS_REGION: ap-south-1
  PARAM: /notes-app/prod/IMAGE_TAG

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongo:
        image: mongo:7
        ports: ["27017:27017"]
        options: >-
          --health-cmd "mongosh --quiet --eval 'db.adminCommand({ping:1})'"
          --health-interval 10s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"            # match the version found in Phase 1
          cache: npm
          cache-dependency-path: |
            server/package-lock.json
            client/package-lock.json
      - name: Backend tests
        working-directory: server
        env:
          MONGO_URI: mongodb://localhost:27017/notes_test
          JWT_SECRET: ci-only-test-secret
          NODE_ENV: test
        run: npm ci && npm test
      - name: Frontend build (and lint if present)
        working-directory: client
        run: |
          npm ci
          npm run lint --if-present
          npm run build

  build-push:
    needs: test
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    outputs:
      tag: ${{ steps.vars.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
      - id: vars
        run: echo "tag=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - id: ecr
        uses: aws-actions/amazon-ecr-login@v2
      - uses: docker/setup-buildx-action@v3
      - name: Build & push web
        uses: docker/build-push-action@v6
        with:
          context: ./client
          platforms: linux/amd64
          push: true
          tags: ${{ steps.ecr.outputs.registry }}/notes-app/web:${{ steps.vars.outputs.tag }}
          cache-from: type=gha,scope=web
          cache-to: type=gha,mode=max,scope=web
      - name: Build & push api
        uses: docker/build-push-action@v6
        with:
          context: ./server
          platforms: linux/amd64
          push: true
          tags: ${{ steps.ecr.outputs.registry }}/notes-app/api:${{ steps.vars.outputs.tag }}
          cache-from: type=gha,scope=api
          cache-to: type=gha,mode=max,scope=api

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    env:
      TAG: ${{ needs.build-push.outputs.tag }}
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Point IMAGE_TAG at the new version (remember the old one)
        run: |
          PREV=$(aws ssm get-parameter --name "$PARAM" --query Parameter.Value --output text)
          echo "PREV_TAG=$PREV" >> "$GITHUB_ENV"
          aws ssm put-parameter --name "$PARAM" --type String --value "$TAG" --overwrite

      - name: Rolling deploy via SSM Run Command (one instance at a time)
        run: |
          CMD_ID=$(aws ssm send-command \
            --document-name AWS-RunShellScript \
            --targets Key=tag:Role,Values=notes-app \
            --max-concurrency 1 --max-errors 0 \
            --comment "deploy $TAG" \
            --parameters 'commands=["/opt/notes-app/deploy.sh"]' \
            --query Command.CommandId --output text)
          echo "Command: $CMD_ID"
          for i in $(seq 1 60); do
            STATUS=$(aws ssm list-commands --command-id "$CMD_ID" --query 'Commands[0].Status' --output text)
            echo "status=$STATUS"
            case "$STATUS" in
              Success) exit 0 ;;
              Failed|Cancelled|TimedOut) 
                aws ssm list-command-invocations --command-id "$CMD_ID" --details \
                  --query 'CommandInvocations[].[InstanceId,Status,CommandPlugins[0].Output]' --output text
                exit 1 ;;
            esac
            sleep 10
          done
          echo "Timed out waiting for deploy"; exit 1

      - name: Smoke test through the ALB
        run: |
          DNS=$(aws elbv2 describe-load-balancers --names notes-alb --query 'LoadBalancers[0].DNSName' --output text)
          for i in $(seq 1 20); do
            BODY=$(curl -fs "http://$DNS/api/health" || true)
            echo "$BODY"
            echo "$BODY" | grep -q "\"version\":\"$TAG\"" && exit 0
            sleep 6
          done
          echo "New version not serving"; exit 1

      - name: Roll back on failure
        if: failure()
        run: |
          echo "Rolling back to $PREV_TAG"
          aws ssm put-parameter --name "$PARAM" --type String --value "$PREV_TAG" --overwrite
          aws ssm send-command --document-name AWS-RunShellScript \
            --targets Key=tag:Role,Values=notes-app --max-concurrency 1 \
            --comment "rollback to $PREV_TAG" \
            --parameters 'commands=["/opt/notes-app/deploy.sh"]'
```

Claude Code: check the latest major versions of each `uses:` action before committing and pin them; run `actionlint` on the file if available.

### Checkpoint 9

- [ ] Push a visible change (e.g. footer text "Deployed via CI/CD") to `main`; all three jobs go green in 5–10 min
- [ ] Browser shows the change; `curl http://<alb-dns>/api/health` shows the new SHA as `version`
- [ ] ECR now has an image tagged with that SHA; SSM `IMAGE_TAG` equals it
- [ ] A PR runs only `test`; a PR with a deliberately failing test goes red and nothing deploys
- [ ] Rollback demo (optional but strong): push a commit whose `/api/health` returns 500 → deploy fails → rollback step restores the previous version; app stays up
- [ ] No AWS keys in GitHub (only `AWS_DEPLOY_ROLE_ARN`)
- [ ] **\[SCREENSHOT\]** successful workflow run (all jobs), deploy job log showing SSM Success + smoke test, ECR image list with SHA tags, GitHub secrets page (names only), OIDC role trust policy, app showing the change

## Phase 10 – Monitoring (CloudWatch) and backups (S3)

Goal: all container logs land in CloudWatch, a dashboard shows traffic and health, alarms email you, and MongoDB is dumped to S3 every night with a tested restore.

### 10A. CloudWatch (`monitoring.tf`)

1. Log groups `/notes-app/web`, `/notes-app/api`, `/notes-app/db`, retention 14 days (cost control). These must be created before instances boot, so Claude Code should check they already exist from Phases 7–8.
2. SNS topic `notes-alerts` + email subscription to `var.alert_email` (click the confirmation email).
3. Alarms → SNS:

| Alarm | Metric | Condition |
| --- | --- | --- |
| `notes-unhealthy-hosts` | ALB target group `UnHealthyHostCount` | > 0 for 2 × 1 min |
| `notes-target-5xx` | ALB `HTTPCode_Target_5XX_Count` | ≥ 5 in 5 min |
| `notes-high-latency` | ALB `TargetResponseTime` (p90) | > 1 s for 3 × 1 min |
| `notes-asg-cpu-high` | ASG `CPUUtilization` | > 80% for 10 min (scaling should prevent this) |
| `notes-db-status` | DB instance `StatusCheckFailed` | ≥ 1 for 2 min (add EC2 recover action) |
| `notes-db-cpu` | DB instance `CPUUtilization` | > 80% for 10 min |

4. Dashboard `notes-app`: ALB RequestCount, TargetResponseTime, HTTPCode\_Target\_5XX\_Count, HealthyHostCount; ASG GroupInServiceInstances and CPUUtilization; DB CPUUtilization.
5. Optional: CloudWatch agent on the DB instance for `disk_used_percent` on `/data` and memory, with an alarm at 80% disk.

### 10B. Nightly MongoDB backup to S3

Amazon Linux 2023 has no cron by default, so use a systemd timer, installed by the DB user data:

```bash
#!/bin/bash
# saved as /usr/local/bin/mongo-backup.sh (chmod 700)
set -euo pipefail
REGION=ap-south-1
BUCKET=notes-app-backups-<account-id>   # injected by Terraform
P=/notes-app/prod
get() { aws ssm get-parameter --region $REGION --with-decryption --name "$P/$1" --query Parameter.Value --output text; }
TS=$(date -u +%Y%m%dT%H%M%SZ)
docker exec -e U="$(get MONGO_ROOT_USERNAME)" -e PW="$(get MONGO_ROOT_PASSWORD)" mongo \
  sh -c 'mongodump -u "$U" -p "$PW" --authenticationDatabase admin --db notes --archive --gzip' \
  | aws s3 cp - "s3://$BUCKET/mongo/notes-$TS.archive.gz" --region $REGION
echo "backup ok: notes-$TS.archive.gz"
```

```ini
# /etc/systemd/system/mongo-backup.service
[Unit]
Description=MongoDB backup to S3
[Service]
Type=oneshot
ExecStart=/usr/local/bin/mongo-backup.sh

# /etc/systemd/system/mongo-backup.timer
[Unit]
Description=Nightly MongoDB backup
[Timer]
OnCalendar=*-*-* 21:00:00 UTC
Persistent=true
[Install]
WantedBy=timers.target
```

21:00 UTC is 02:00 in Pakistan. Enable with `systemctl enable --now mongo-backup.timer`.

Restore test (into a separate database so production data is untouched): download the latest archive and run `mongorestore --archive --gzip --nsFrom 'notes.*' --nsTo 'notes_restore.*'` inside the container with root credentials, then compare document counts between `notes` and `notes_restore`.

### Checkpoint 10

- [ ] CloudWatch Logs → `/notes-app/api` shows request logs from both instances (separate streams)
- [ ] SNS email subscription confirmed; trigger a test (e.g. stop the api container on one instance for 2 min) and receive the `notes-unhealthy-hosts` alarm email, then recover
- [ ] Dashboard shows live graphs
- [ ] `sudo systemctl start mongo-backup.service` on the DB instance creates an object under `s3://…/mongo/`; `systemctl list-timers` shows the next run
- [ ] Restore test done; counts match
- [ ] **\[SCREENSHOT\]** log groups + a log stream with real requests, dashboard, alarms list, the alarm email, S3 bucket with backup files, restore-count comparison

## Phase 11 – Prove scaling, self-healing and security

Goal: evidence that the ASG scales out under load and back in afterwards, survives an instance failure, and that the private tiers are unreachable from the internet.

### 11A. Auto scaling demo

1. For faster reactions, enable detailed monitoring (1-minute metrics) in the launch template during the demo; it costs a little extra per instance.
2. `scripts/load-test.sh`: `npx autocannon -c 200 -d 600 http://<alb-dns>/api/notes` (use an endpoint that touches the DB; add an auth header if needed) or `/api/health`. Run it from your laptop and keep it to about 10 minutes, because t3 instances in "unlimited" credit mode bill extra for sustained high CPU.
3. If CPU never passes 50% (t3.micro can be surprisingly fast), use the fallback: SSM Run Command on `Role=notes-app` instances running `stress-ng --cpu 2 --timeout 600` (install with `dnf install -y stress-ng`; if the package is unavailable, run `timeout 600 sh -c 'yes > /dev/null & yes > /dev/null & wait'`).
4. Watch: CPU alarm created by target tracking goes to ALARM → ASG desired goes 2 → 3 (or 4) → new targets turn healthy. After the load stops, wait \~15 min for scale-in back to 2.

### 11B. Availability / self-healing tests

| Test | How | Expected result |
| --- | --- | --- |
| Instance failure | Terminate one app instance in the console | App keeps working through the other; ASG launches a replacement that becomes healthy in \~5 min |
| Container crash | On one instance: `sudo docker kill <api container>` | Docker restarts it (`restart: unless-stopped`); if it stays down, the ALB stops routing to it |
| AZ-level thinking | Note which AZ each instance is in | Instances are spread across `ap-south-1a` and `ap-south-1b` |
| DB restart | Reboot the MongoDB instance; time the outage | App returns 503 on `/api/health` during reboot, then recovers on its own (record the downtime; this is the known SPOF) |

### 11C. Security verification

1. From your laptop: `curl --max-time 5 http://10.0.21.10:27017` and any app instance private IP fail (private addresses, unreachable).
2. `curl --max-time 5 http://<alb-dns>:5000` fails (only port 80 is open on the ALB).
3. `curl http://<alb-dns>/.env` returns the React `index.html`, not a file (nothing secret is served).
4. API request without a token → 401.
5. EC2 console: no instance has a public IP; no SG allows port 22.
6. Session Manager shell on an app instance: `aws ssm get-parameter --name /notes-app/prod/MONGO_ROOT_PASSWORD --with-decryption` → AccessDenied (least privilege works).

### Checkpoint 11

- [ ] ASG scaled out and back in **\[SCREENSHOT\]** ASG Activity history + CPU graph + target group showing 3–4 targets
- [ ] Instance termination test passed **\[SCREENSHOT\]** activity history showing the replacement, app still open in the browser
- [ ] DB reboot downtime measured and written in `docs/PROGRESS.md`
- [ ] All six security checks pass **\[SCREENSHOT\]** the AccessDenied output and failed curls
- [ ] Load test output (requests/sec, latency p50/p99, error count) saved for the report's performance section

## Phase 12 – Monthly cost estimate and optimizations

Goal: a saved AWS Pricing Calculator estimate for `ap-south-1` (730 hours/month, on-demand prices, ignoring free tier) plus at least two concrete optimizations with their estimated savings.

Enter these line items at calculator.aws (put the real prices it shows into the report; don't copy numbers from memory):

| Service | Configuration to enter | Note |
| --- | --- | --- |
| EC2 (app) | 2 × t3.micro Linux on-demand, 730 h (baseline; mention peak of 4) | Plus 2 × 8 GiB gp3 root volumes |
| EC2 (DB) | 1 × t3.small, 730 h | Plus 8 GiB root gp3 |
| EBS data volume | 20 GiB gp3 + snapshots if any |  |
| Application Load Balancer | 1 ALB, low LCU (e.g. 1 LCU average) | Fixed hourly + LCU |
| NAT Gateway | 1 gateway, 730 h, \~5 GB processed | Usually the biggest single item |
| Public IPv4 address | 1 (NAT EIP) + ALB's addresses | AWS bills public IPv4 hourly |
| ECR | \~2 GB stored |  |
| S3 | \~1 GB Standard + requests | Backups |
| CloudWatch | \~2 GB logs ingested, 6 alarms, 1 dashboard |  |
| Data transfer out | \~5 GB to internet |  |
| SSM Parameter Store | Standard parameters | Free |

Save the estimate and export it (share link + PDF) **\[SCREENSHOT\]**. Also screenshot Cost Explorer after a few days for actual spend.

Optimizations to propose (pick at least two and calculate each one's saving in the calculator):

1. Replace the NAT Gateway with a NAT instance (e.g. a t4g.nano running fck-nat), or add VPC interface endpoints for ECR/SSM/Logs and drop NAT where possible. Trade-off: less managed, single instance.
2. Graviton: move to t4g.micro/t4g.small (ARM, cheaper per hour). Requires building `linux/arm64` images (`platforms: linux/amd64,linux/arm64` in buildx).
3. Scheduled scaling: ASG min/desired 1 at night and weekends; stop the DB instance outside demo hours.
4. Compute Savings Plan or Reserved Instances (1-year) for the always-on baseline.
5. Spot instances for the extra (scale-out) capacity via a mixed-instances policy, keeping on-demand for the baseline of 2.
6. Short log retention (already 14 days) and S3 lifecycle to Standard-IA (already configured).

### Checkpoint 12

- [ ] Calculator estimate saved, link + PDF in `docs/evidence/`
- [ ] Monthly total and the top 3 cost drivers written down
- [ ] At least two optimizations with "before → after" monthly cost

## Phase 13 – Evidence, architecture diagram, technical report

Goal: all four deliverables complete and every row of the traceability matrix ticked.

### 13A. Evidence folder

Name screenshots by requirement so the marker finds them: `docs/evidence/01-vpc.png`, `02-subnets.png`, `03-route-tables.png`, `04-igw-nat.png`, `05-security-groups.png`, `06-ec2-instances.png`, `07-alb.png`, `08-target-group.png`, `09-asg.png`, `10-database.png`, `11-ebs.png`, `12-ecr.png`, `13-pipeline-run.png`, `14-app-browser.png`, `15-cloudwatch.png`, `16-s3-backups.png`, `17-scaling.png`, `18-cost.png`. Crop out your account ID if the repo is public.

### 13B. Architecture diagram

Draw in draw.io (diagrams.net) with the AWS 2024+ icon set; export `docs/architecture.png`. It must show: the AWS Cloud and region box; the VPC with its CIDR; both AZs as columns; public / private-app / private-DB subnets with CIDRs; IGW, NAT, S3 endpoint; ALB → target group → ASG instances (Nginx + API containers inside); MongoDB EC2 + EBS; ECR, SSM Parameter Store, CloudWatch, S3 bucket, SNS; GitHub → Actions → (OIDC) → ECR + SSM Run Command; each security group drawn as a dashed boundary with its allowed port arrows. The diagram at the top of this plan is the reference layout.

### 13C. Technical report (4–6 pages) outline

| Section | Pages | Content |
| --- | --- | --- |
| 1. Cloud provider and justification | 0.3 | AWS: maturity, free tier/credits, Mumbai region latency from Pakistan, managed ALB/ASG, OIDC with GitHub |
| 2. Architecture and design decisions | 1.0 | Diagram, request path, the decisions table, why MongoDB self-managed |
| 3. Services per tier | 0.5 | Network, web, app, DB, registry, CI/CD, monitoring, storage |
| 4. Containerization and CI/CD | 1.0 | Multi-stage Dockerfile, non-root, compose networks, immutable SHA tags, pipeline stages, rolling deploy, auto rollback |
| 5. Security | 0.7 | SG chain, segmentation, no SSH, IMDSv2 hop limit 1, least-privilege roles, SSM secrets, OIDC (no keys), encryption at rest (EBS, S3), ECR scanning |
| 6. Testing results | 0.7 | Pipeline run, smoke test, scaling test numbers, failure tests, security checks |
| 7. NFR justification + limitations | 1.0 | Table below + honest gaps |
| 8. Cost | 0.3 | Estimate + optimizations (if not in an appendix) |

NFR mapping to use in section 7:

| NFR | Supporting decisions | Limitation / improvement |
| --- | --- | --- |
| Scalability | Stateless containers + JWT, ALB distribution, ASG 2–4 | DB scales only vertically → replica set / DocumentDB |
| Availability / Reliability | 2 AZs, ELB health checks replace bad instances, Docker restart policy, nightly backups | Single MongoDB and single NAT in one AZ are SPOFs → 3-node replica set, NAT per AZ |
| Elasticity | Target-tracking CPU 50%, automatic scale-in | Scaling reaction takes minutes; DB not elastic |
| Security | SG chaining, private subnets, no SSH, IMDSv2, least-privilege IAM, SSM SecureString, OIDC, encryption | HTTP only without a domain → ACM + HTTPS; add WAF; web and API share hosts |
| Maintainability / Deployability | Dockerfiles, compose, Terraform, CI/CD with tests, rolling deploy, SHA tags, auto rollback | No staging environment → add one |
| Performance / Latency | Mumbai region, Nginx gzip + cached assets, health-checked routing; load-test p50/p99 numbers | No CDN/cache → CloudFront, Redis |
| Cost-Efficiency | t3 burstable, scale-in, S3 endpoint, log retention, S3 lifecycle | NAT Gateway cost → NAT instance/endpoints; Graviton; Savings Plans |
| Portability | OCI images run anywhere; compose; config via env vars; Mongo image not AWS-specific | Terraform, SSM and ALB are AWS-specific → Kubernetes/Helm for portability |

### Checkpoint 13

- [ ] All 18 screenshots present and named
- [ ] `docs/architecture.png` matches what was actually deployed
- [ ] Report 4–6 pages, every section above present, NFR table with limitations
- [ ] README has the repo link, ALB URL (while running), how to deploy, how to destroy
- [ ] Traceability matrix at the top of this plan fully ticked

## Phase 14 – Pause, resume and teardown

Goal: you never pay for idle infrastructure, and nothing is left running after submission.

Between work sessions (keeps data, removes the hourly cost of NAT, ALB and instances):

1. Take a fresh MongoDB backup to S3 first (`systemctl start mongo-backup.service`).
2. `terraform destroy` everything except the S3 bucket, ECR repos and SSM parameters (Claude Code can use `-target` lists or move those three into a separate small `infra/persistent/` stack, which is cleaner).
3. Next session: `terraform apply` brings it back; restore the latest dump into the new DB; the pipeline redeploys the latest image.

After grading (full cleanup, with my explicit approval):

1. `terraform destroy` in every stack.
2. Delete SSM parameters: `aws ssm delete-parameters --names $(aws ssm get-parameters-by-path --path /notes-app/prod --query 'Parameters[].Name' --output text)`.
3. Remove the `AWS_DEPLOY_ROLE_ARN` secret from GitHub, or disable the workflow.
4. Check for leftovers in each console: EC2 (instances, volumes, snapshots, Elastic IPs), VPC (NAT Gateways), Load Balancers, ECR, S3, CloudWatch log groups.
5. Check Billing the next day: daily cost should be about zero.

### Checkpoint 14

- [ ] No NAT Gateway, ALB, EC2 instance, EBS volume or Elastic IP left in `ap-south-1` (also glance at other regions)
- [ ] Next-day billing shows no new charges
- [ ] Budget alert kept on as a safety net
