# NoteNest on AWS: the complete project guide

**Who this is for:** you, the student presenting the project. It explains what we built, why, how every piece works, how to show it to your instructor, and how to answer her questions. Read sections 1–3 first, then section 12 (the demo plan) the evening before.

**Project in one sentence:** a notes web application (React + Node.js + MongoDB) packaged in Docker containers and run on AWS across two data centres, with an automated pipeline that tests and deploys every code change, and everything built from code with Terraform.

---

## 1. The big picture in plain words

Imagine a restaurant:

| Restaurant | Our system |
| --- | --- |
| The street and the front door | The **Internet** and the **Application Load Balancer (ALB)**: the only public entrance |
| The waiters who take orders | The **Nginx** web containers: they serve the web page and pass requests on |
| The kitchen | The **API** containers (Node.js/Express): the business logic |
| The pantry / storage room | **MongoDB**: where all the notes are stored, never visible from the street |
| Two identical restaurants in different buildings | **Two Availability Zones** (2a and 2b): if one building has a problem, the other keeps serving |
| The manager who adds staff when it is busy | **Auto Scaling Group**: adds servers when load is high, removes them afterwards |
| The security guard rules | **Security groups**: who may talk to whom |
| The delivery truck that restocks | The **CI/CD pipeline**: new code is tested, packaged and delivered automatically |
| The blueprint of the whole building | **Terraform**: code that describes every AWS resource so it can be rebuilt in 30 minutes |

### The journey of one request

1. You open `http://<load-balancer-address>` in a browser.
2. The request reaches the **Application Load Balancer** (in the *public* subnets).
3. The ALB picks a healthy server and forwards the request to an **EC2 instance** in a *private* subnet (port 80).
4. On that instance the **Nginx container** answers. For the web page it returns the React files. For anything starting with `/api/` it forwards the request to the API container.
5. The **API container** (Node.js, port 5000, not reachable from outside the instance) checks the login token and talks to MongoDB.
6. **MongoDB** (on its own private EC2 instance, port 27017) reads or writes the notes and answers back.
7. The answer travels back the same way to the browser.

Nothing except the load balancer is reachable from the internet. That is the main security idea of the whole project.

### Numbers to remember

| Item | Value |
| --- | --- |
| Region | Asia Pacific (Sydney), `ap-southeast-2` |
| Availability Zones | 2 (`ap-southeast-2a` and `ap-southeast-2b`) |
| VPC range | `10.0.0.0/16` |
| Subnets | 6: 2 public, 2 private-app, 2 private-database |
| App servers | 2 to 4 × `t3.micro` (Auto Scaling) |
| Database server | 1 × `t3.small`, private IP `10.0.21.10`, 20 GiB encrypted disk |
| Terraform resources | 69 |
| Cost if left running | about US$4 per day (about US$127 per month) |

---

## 2. Architecture diagram: how to read it

The picture is in `docs/architecture.png`. Read it like this:

- The **orange box** is the AWS Cloud, the **blue box** is our private network (the VPC), the **dotted grey columns** are the two data centres (Availability Zones).
- Inside each column there are three layers: **public subnets** (top, blue), **private app subnets** (middle, purple), **private database subnets** (bottom, green).
- **Red dashed rectangles** are security group boundaries. Their labels say who may connect.
- The right-hand column lists the services that are not inside the network but support it: container registry, secrets, permissions, monitoring, backups, Terraform.
- The top right shows the **CI/CD flow**: GitHub → GitHub Actions → AWS.

---

## 3. The network layer (brief requirement 1)

### 3.1 VPC (Virtual Private Cloud)

**What it is:** your own private, isolated network inside AWS. Nothing gets in or out unless you allow it.
**What we did:** created `notes-vpc` with the address range `10.0.0.0/16` (about 65,000 addresses).
**Why:** isolation. All our servers live inside it.
**Terraform file:** `network.tf` (`aws_vpc.main`).

### 3.2 Subnets

**What they are:** slices of the VPC, each tied to one Availability Zone.

| Subnet | Address range | Zone | Contains | Reachable from internet? |
| --- | --- | --- | --- | --- |
| notes-public-0 | 10.0.1.0/24 | 2a | Load balancer, NAT gateway | Yes (via internet gateway) |
| notes-public-1 | 10.0.2.0/24 | 2b | Load balancer | Yes |
| notes-app-0 | 10.0.11.0/24 | 2a | Web + API servers | No |
| notes-app-1 | 10.0.12.0/24 | 2b | Web + API servers | No |
| notes-db-0 | 10.0.21.0/24 | 2a | MongoDB server | No |
| notes-db-1 | 10.0.22.0/24 | 2b | Reserved for a future database replica | No |

**Why "public" and "private":** a subnet is public only because its route table sends internet traffic to an Internet Gateway. Private subnets have no such route, so their servers cannot be reached from outside.

### 3.3 Internet Gateway (IGW)

The door between the VPC and the internet. Only the public subnets route to it. Resource: `notes-igw`.

### 3.4 NAT Gateway

**Problem:** private servers still need to reach the internet to download Docker images, packages and talk to AWS services, but nobody should reach *them*.
**Solution:** the NAT gateway sits in a public subnet. Private servers send outbound traffic to it; it forwards the traffic out and brings answers back. It only allows *outbound-initiated* connections.
**Cost note:** it is the most expensive single item (about US$43 per month). It is the first thing to remove when saving money.

### 3.5 Route tables

| Route table | Attached to | Rules |
| --- | --- | --- |
| `notes-public-rt` | 2 public subnets | local; `0.0.0.0/0` → Internet Gateway |
| `notes-private-rt` | 2 app + 2 DB subnets | local; `0.0.0.0/0` → NAT Gateway; S3 → S3 endpoint |

A route table is a signpost telling traffic where to go. This is what makes a subnet public or private.

### 3.6 S3 gateway endpoint

A free private shortcut from the VPC to Amazon S3. Docker image layers and backups travel through it instead of the NAT gateway, which saves money and keeps that traffic inside AWS.

---

## 4. Security groups: the firewalls (requirement 8)

A **security group** is a firewall attached to a resource. We made one per tier and chained them, so each tier only trusts the tier before it. The rules reference *other security groups* instead of IP addresses.

| Security group | Allows in | Allows out |
| --- | --- | --- |
| `notes-alb-sg` (load balancer) | Port 80 from anywhere on the internet | Port 80 to the app group only |
| `notes-app-sg` (web + API servers) | Port 80 **only from the ALB group** | Port 27017 to the database group; port 443 to the internet (via NAT) |
| `notes-db-sg` (MongoDB) | Port 27017 **only from the app group** | Port 443 to the internet (via NAT) |

Facts worth saying out loud:
- **No security group opens port 22 (SSH).** We administer servers with AWS Systems Manager instead, so there are no SSH keys to lose.
- The **API port 5000 is never opened** in any security group. It only exists on the Docker network inside each server.
- The database has **no public IP** and **no rule that accepts the internet**.

---

## 5. Compute: running the application (requirements 2, 3, 7)

### 5.1 EC2 instances and the Launch Template

**EC2** = virtual servers. Our app servers are `t3.micro` (2 vCPU, 1 GiB RAM) running Amazon Linux 2023 with Docker.
A **Launch Template** (`notes-app-lt`) is the recipe for a server: image (AMI), size, security group, IAM role, disk, and a **user data script** that runs at first boot.

The user data script (`infra/templates/app_user_data.sh.tftpl`) does this at boot:
1. Installs Docker and the Docker Compose plugin.
2. Writes two files onto the server: `docker-compose.prod.yml` and `deploy.sh` (they are embedded from the repo's `deploy/` folder).
3. Runs `deploy.sh`.

`deploy.sh` then:
1. Reads the image tag (version) from the secret store.
2. Reads the database address and JWT secret from the secret store into a private file (`.env.runtime`, readable only by root).
3. Logs in to ECR, pulls the images, starts the two containers with Docker Compose.
4. Checks `/api/health` until it answers, otherwise reports failure.

Hardening built into the launch template:
- No public IP.
- **IMDSv2 required**, hop limit 1: containers cannot steal the server's AWS credentials.
- Encrypted 12 GiB root disk.
- An IAM instance profile with minimal permissions (section 8).

### 5.2 Auto Scaling Group (ASG)

`notes-app-asg` keeps between **2 and 4** servers running across the two private app subnets (so across both Availability Zones).

| Setting | Value | Meaning |
| --- | --- | --- |
| Min / desired / max | 2 / 2 / 4 | Always 2 servers; up to 4 under load |
| Health check type | ELB | If the load balancer says a server is unhealthy, the ASG replaces it |
| Grace period | 300 s | Time given to a new server to boot before being judged |
| Scaling policy | Target tracking, average CPU 50% | Adds servers above 50% average CPU, removes them when it falls |
| Instance refresh | Rolling, 50% min healthy | When the launch template changes, replaces servers gradually |

This gives **elasticity** (automatic scale out and in), **availability** (a dead server is replaced) and **scalability** (more servers = more capacity).

### 5.3 Application Load Balancer and Target Group

- **ALB `notes-alb`:** internet-facing, spans both public subnets, listens on HTTP port 80.
- **Target group `notes-web-tg`:** the list of servers the ALB may send traffic to. It checks `GET /api/health` every 15 s; 2 passes = healthy, 3 failures = unhealthy. It only sends traffic to healthy servers.
- **Why the health check is `/api/health`:** that endpoint returns OK only if the web container, the API container **and the database connection** all work. One check proves the whole chain.

### 5.4 The containers

**Web container** (`frontend/Dockerfile`):
- Stage 1 uses Node 22 to build the React app (Vite) into static files.
- Stage 2 uses a tiny `nginx:alpine` image and copies only the built files in. The final image has no Node, no source code, and is small.
- `nginx.conf` serves the app, enables gzip, caches hashed assets for 30 days, falls back to `index.html` for React routes, and **reverse-proxies `/api/` to the API container**.

**API container** (`backend/Dockerfile`):
- Stage 1 compiles TypeScript. Stage 2 installs **production dependencies only**, copies the compiled code, and runs as the **non-root `node` user** with a container health check.

**Two compose files:**
- `docker-compose.yml` (project root): for **local** use. Three services: web, api, mongo. Two networks so the web container cannot reach MongoDB. Only Nginx publishes a port (8080).
- `deploy/docker-compose.prod.yml`: for **AWS servers**. Only web and api (MongoDB is a separate server). Only port 80 is published on the host; the API has no port at all. Logs go to CloudWatch.

---

## 6. The database tier (requirement 4)

- **Where:** a dedicated `t3.small` EC2 instance (`notes-mongodb`) at the fixed private address `10.0.21.10`, in a private database subnet.
- **Engine:** MongoDB 7, running in a Docker container with **authentication enabled**.
- **Users:** a root admin (used only for backups and maintenance) and an **application user `notesapp` with `readWrite` on the `notes` database only**: least privilege.
- **Storage:** a separate **20 GiB encrypted gp3 EBS volume** mounted at `/data`. The database files live on that volume, not on the server's root disk, so the data survives a server reboot or replacement.
- **Startup script** (`infra/templates/db_user_data.sh.tftpl`): waits for the disk, formats it only if empty (never wipes existing data), mounts it, reads the passwords from the secret store, starts MongoDB, and installs the nightly backup timer.

**Be ready to explain the choice.** The brief says engines "may include MySQL, PostgreSQL or MariaDB". We chose MongoDB because the existing application is a MERN app (MongoDB). Rewriting the app for SQL would have changed the application itself, which is outside the point of this cloud project. A "properly secured self-managed database" is explicitly allowed. A production alternative is Amazon DocumentDB (managed, MongoDB-compatible). If your instructor insists on SQL, say this is a known limitation and mention the DocumentDB/RDS option.

---

## 7. Container registry and images (requirement 5)

**Amazon ECR** stores the Docker images: `notes-app/web` and `notes-app/api`.
- **Immutable tags:** a tag (the git commit ID, such as `a74d67f`) can never be overwritten. So every deployed version is traceable, and rollback means "deploy the previous tag".
- **Scan on push:** AWS scans each image for known vulnerabilities.
- **Lifecycle policy:** keeps only the last 15 images to avoid clutter and cost.
- We never use the tag `latest`.

---

## 8. Secrets and permissions

### 8.1 Secrets: SSM Parameter Store

Seven parameters under `/notes-app/prod/`:

| Parameter | Type | Used by |
| --- | --- | --- |
| `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD` | String / SecureString | Database server (admin) |
| `MONGO_APP_USERNAME`, `MONGO_APP_PASSWORD` | String / SecureString | Database server (creates the app user) |
| `MONGO_URI` | SecureString | API servers (full connection string) |
| `JWT_SECRET` | SecureString | API servers (signs login tokens) |
| `IMAGE_TAG` | String | Deploy script (which version to run) |

`SecureString` values are encrypted by AWS. They are created by `scripts/create-ssm-params.sh` (random values generated on the spot), **not by Terraform**, so the passwords never appear in Terraform's state file or in GitHub. That is also why they survived the teardown.

### 8.2 IAM roles: least privilege

IAM controls *who may do what*. Servers use **roles** (temporary credentials), never stored keys.

| Role | Used by | May do |
| --- | --- | --- |
| `notes-app-ec2-role` | App servers | Pull from the two ECR repos; read only `MONGO_URI`, `JWT_SECRET`, `IMAGE_TAG`; write logs; be managed by Systems Manager |
| `notes-db-ec2-role` | Database server | Read only the 4 database parameters; write backups to `s3://…/mongo/*`; write database logs |
| `notes-github-deploy-role` | GitHub Actions (via OIDC) | Push images to the two ECR repos; update `IMAGE_TAG`; send the deploy command to servers tagged `Role=notes-app`; read results |

**A real finding to tell your instructor:** during security testing I discovered the app role could read the database root password. The cause: AWS's managed policy `AmazonSSMManagedInstanceCore`, attached for Systems Manager, grants broader parameter access than the custom policy intended. We fixed it by adding **explicit Deny statements** (the app role is denied the database credentials; the database role is denied the JWT secret). We re-tested: AccessDenied for the root password, while the app can still read its own secrets. This is good evidence of testing and honest engineering.

### 8.3 Administration without SSH: Systems Manager

AWS Systems Manager gives a shell (Session Manager) and remote commands (Run Command) with no open ports and no keys, all logged. The pipeline's deploy step uses Run Command.

---

## 8b. GitHub OIDC: pipeline login without stored keys

Normally a pipeline needs AWS access keys saved as GitHub secrets, which is a leak risk. We used **OIDC** instead:
1. AWS trusts GitHub as an identity provider (`aws_iam_openid_connect_provider`).
2. The role `notes-github-deploy-role` can only be assumed by a token from **our repo's `main` branch**.
3. At run time GitHub gives the pipeline a short-lived token; AWS exchanges it for temporary credentials valid only for that run.
4. The only GitHub secret is `AWS_DEPLOY_ROLE_ARN`, which is just the role's address, not a password.

Story you may tell: the first attempt failed because the AWS Organization had a policy blocking creation of the OIDC provider. The organization owner lifted it, and then it worked. A second problem was that GitHub uses a newer "immutable" identity format (`repo:owner@id/repo@id`) which we added to the role's trust rule.

---

## 9. CI/CD pipeline (requirement 6)

File: `.github/workflows/deploy.yml`. It runs **automatically on every push to `main`**, and can also be started manually (Actions → CI/CD → Run workflow). Pull requests run only the first job.

| Job | What it does |
| --- | --- |
| **test** | Starts a real MongoDB service container. Runs backend type-check and tests (78 tests including 8 integration tests against real MongoDB) and front-end tests (108) and build. If anything fails, the pipeline stops here. |
| **build-push** | Logs in to AWS via OIDC. Builds both Docker images for linux/amd64 and pushes them to ECR tagged with the short commit ID. |
| **deploy** | Writes the new tag to the `IMAGE_TAG` parameter, then runs `deploy.sh` on the servers through Systems Manager **one server at a time** (stop on the first error). Then a **smoke test** calls `/api/health` through the load balancer until it reports the new version. |
| **rollback (on failure)** | If any deploy step fails, it restores the previous tag and redeploys it automatically. |

Why this is good:
- **Rolling deploy:** one server is updated while the other keeps serving users, so there is no downtime.
- **Rollback:** demonstrated earlier with a deliberately broken release; the old version was restored.
- **The test gate:** demonstrated by a PR with a failing test (nothing deployed). It also just happened with the "Welcome Again" change: the old test expected "Welcome Back", the test job went red, and build and deploy were skipped automatically.
- **Immutable, traceable versions:** the version shown by `/api/health` is the git commit ID.

---

## 10. Terraform: what it is and every file

### 10.1 What Terraform is

**Infrastructure as Code.** Instead of clicking in the AWS console, we describe the infrastructure in text files (`.tf`). Terraform compares the files with what exists and creates, changes or deletes resources to match.

Benefits you can state:
- **Repeatable:** the whole 69-resource environment was destroyed and rebuilt in about 30 minutes (twice).
- **Reviewable:** `terraform plan` shows exactly what will change before anything happens.
- **Documented:** the code *is* the documentation of the infrastructure.
- **Cost control:** destroy when idle, rebuild when needed.

### 10.2 The commands

| Command | Meaning |
| --- | --- |
| `terraform init` | Downloads the AWS provider plugin. Run once per folder. |
| `terraform validate` / `terraform fmt` | Checks the syntax / tidies the formatting. |
| `terraform plan` | Shows what would be created, changed or destroyed. Changes nothing. |
| `terraform apply` | Does it. Asks for `yes` unless `-auto-approve` is given. |
| `terraform destroy` | Deletes everything Terraform created. |
| `terraform output` | Prints output values, for example the load balancer address. |
| `-target=...` | Applies only some resources. We used it to create the registries first. |

### 10.3 The files in `infra/`

| File | Purpose |
| --- | --- |
| `providers.tf` | Says which provider (AWS), which version, which region and profile, and default tags added to every resource. |
| `variables.tf` | Settings that can change: region, zones, VPC range, instance sizes, database IP. |
| `data.tf` | Looks up existing facts: the account ID and the latest Amazon Linux 2023 image. |
| `network.tf` | VPC, 6 subnets, Internet Gateway, NAT Gateway and its Elastic IP, route tables and associations, S3 endpoint. |
| `security_groups.tf` | The three security groups and their individual rules. |
| `ecr.tf` | The two container repositories and their lifecycle policy. |
| `iam.tf` | IAM roles, policies and instance profiles for app servers and the database (including the explicit denies). |
| `github_oidc.tf` | The GitHub OIDC provider and the deploy role for the pipeline. Also outputs the load balancer address. |
| `s3.tf` | Backup bucket: private, versioned, encrypted, TLS-only, lifecycle rules. |
| `database.tf` | MongoDB EC2 instance, the 20 GiB encrypted EBS volume, and its attachment. |
| `alb.tf` | Load balancer, target group, HTTP listener. |
| `compute.tf` | Launch template, Auto Scaling Group, CPU scaling policy. |
| `monitoring.tf` | Log groups, SNS alert topic and email subscription, 6 alarms, CloudWatch dashboard. |
| `outputs.tf` | Output values (VPC ID, NAT gateway ID). |
| `templates/app_user_data.sh.tftpl` | Boot script for app servers (a template Terraform fills in). |
| `templates/db_user_data.sh.tftpl` | Boot script for the database server, including the backup timer. |
| `terraform.tfvars` | Your own values (the alert email). Not committed to GitHub. `terraform.tfvars.example` is the safe sample. |
| `.terraform.lock.hcl` | Pins the exact provider version. Committed. |
| `terraform.tfstate` (+ `.backup`) | **The state file**: Terraform's memory of what it created. Kept locally, never committed; we copied backups to `C:\Users\syedm\tfstate-backup`. If it is lost, Terraform forgets the resources and cleanup becomes manual. |

### 10.4 Things in the code worth knowing

- **`count` and `for_each`:** create the 6 subnets, 2 repositories and 3 log groups from a few lines.
- **`cidrsubnet()`:** calculates the subnet ranges from the VPC range.
- **`templatefile()`:** fills the boot scripts with values (region, disk ID, bucket name).
- **`lifecycle { ignore_changes = [user_data] }`** on the database: so editing the boot script later does not replace the running database server.
- **`depends_on`:** makes sure the NAT gateway and route tables exist before servers boot, so they can download software.
- **The three-stage apply** (needed because servers need images that must already be in the registry):
  1. `terraform apply -target=aws_ecr_repository.repo` (registries only).
  2. Build and push images, set `IMAGE_TAG`.
  3. `terraform apply` (everything else).

---

## 11. Monitoring and backups (requirement 9)

### 11.1 CloudWatch

- **Logs:** every container ships its logs to a CloudWatch log group (`/notes-app/web`, `/notes-app/api`, `/notes-app/db`), kept 14 days. Each server writes its own stream, so you can see requests from both servers.
- **Alarms (6)** send email through SNS:

| Alarm | Trigger |
| --- | --- |
| `notes-unhealthy-hosts` | Unhealthy targets more than 0 for 2 minutes |
| `notes-target-5xx` | 5 or more server errors in 5 minutes |
| `notes-high-latency` | p90 response time above 1 s for 3 minutes |
| `notes-asg-cpu-high` | Average CPU above 80% for 10 minutes |
| `notes-db-status` | Database server system check fails (also triggers automatic EC2 recovery) |
| `notes-db-cpu` | Database CPU above 80% for 10 minutes |

- **Dashboard `notes-app`:** requests, response time, errors, healthy hosts, instance count and CPU.
- **Remember:** after every rebuild you must click **Confirm** in the SNS email (sent to `syedmhussain209@gmail.com`) or alarm emails are not delivered.

### 11.2 Backups to S3

- A **systemd timer** on the database server runs `mongodump` every night at 16:00 UTC (21:00 Pakistan time) and uploads a compressed archive to the S3 bucket under `mongo/`.
- The bucket blocks all public access, is versioned, encrypted (SSE-S3), refuses non-TLS requests, moves backups to cheaper storage after 30 days and deletes them after 90 days.
- **Restore was tested:** a dump was restored into a separate database; document counts matched.

---

## 12. How to present this to your instructor

### 12.1 Before you go in (night before and morning)

1. Open the **live URL** and check `/api/health`. If the stack is down, ask me to rebuild (about 30 minutes).
2. Click **Confirm** on the SNS email.
3. Log in to the AWS console (region **Sydney**) and open these tabs: EC2 Load Balancers, Target Groups, Auto Scaling Groups, EC2 Instances, VPC, ECR, CloudWatch dashboard, S3 bucket.
4. Open GitHub → Actions in another tab.
5. Have `docs/architecture.png`, the report and the repo open.
6. **Record a screen video** of the whole flow as a backup in case anything breaks.
7. Do not push untested code on the demo day.

### 12.2 A 10-minute demo script

| Minute | Show | Say |
| --- | --- | --- |
| 0:00 | Architecture diagram | "A three-tier app on AWS in two Availability Zones. Only the load balancer is public. Web and API run in containers on private servers; MongoDB is on its own private server. Terraform builds everything; GitHub Actions deploys it." |
| 1:30 | The live app in the browser | "Here is the running application. I'll sign up, create, edit and delete a note." |
| 2:30 | Console: VPC and subnets | "VPC 10.0.0.0/16, two public subnets, two private app subnets, two private database subnets, across two zones, with an internet gateway and a NAT gateway." |
| 3:30 | Security groups (Inbound rules) | "Each tier has its own security group. The database only accepts port 27017 from the app group. No port 22 anywhere." |
| 4:15 | Load balancer, target group (healthy), ASG | "Two healthy targets in two zones. The Auto Scaling Group keeps 2 to 4 servers and scales on 50% CPU." |
| 5:15 | EC2 instances / database instance | "No public IPs. The database has a separate encrypted EBS volume." |
| 6:00 | ECR | "Images are stored in ECR with immutable commit-ID tags." |
| 6:30 | GitHub Actions: a green run, then the red runs | "Every push runs test, build, push, rolling deploy and a smoke test. A failing test blocks the deploy, and a bad release rolls back automatically." |
| 8:00 | (Optional live) change the footer text, push, watch it deploy | "Automatic: test, build, deploy in about 4 minutes." |
| 9:00 | CloudWatch dashboard and S3 backup bucket | "Logs, alarms and nightly backups to S3, with a tested restore." |
| 9:30 | Terraform folder in the editor | "All of this is code: 69 resources. I destroyed and rebuilt it twice." |

### 12.3 If asked "can you show scaling live?"

Honest answer: the plain load test did not raise CPU enough from one laptop, so I used the plan's fallback and burned CPU on the servers through Systems Manager. CPU went to 100%, the group scaled from 2 to 4 servers, and scaled back to 2 after about 15 minutes (see the scaling timeline and CloudWatch graph in the evidence). Do not promise to repeat it live; it takes about 15 minutes.

### 12.4 Questions she may ask, and answers

| Question | Answer |
| --- | --- |
| Why AWS? | Mature managed services (ALB, Auto Scaling, ECR, Systems Manager), a budget service, and OIDC integration with GitHub, so no stored keys. |
| Why EC2 and not ECS/Kubernetes? | The brief allows web and app tiers on the same host with Docker Compose. EC2 with an Auto Scaling Group is simpler and still shows load balancing and scaling. Kubernetes was optional and skipped. |
| Why MongoDB? | The application is a MERN app, so MongoDB is its native database. The brief allows a properly secured self-managed database. A managed alternative would be DocumentDB. |
| How is the database protected? | Private subnet, no public IP, security group allowing only the app tier on 27017, authentication on, least-privilege app user, encrypted disk, secrets in Parameter Store. |
| Where are the secrets? | Parameter Store (encrypted). Nothing is hardcoded or in GitHub. The pipeline uses OIDC, not stored keys. |
| What happens if a server dies? | The load balancer stops sending traffic to it and the Auto Scaling Group launches a replacement. Tested: one 502 for a few seconds, replacement healthy in about 4.5 minutes. |
| What happens if the database dies? | It is a single point of failure. Rebooting caused about 35 seconds of downtime with no data loss. Improvement: a three-node MongoDB replica set or DocumentDB. |
| What is a single point of failure in your design? | One MongoDB instance, and one NAT gateway (in one zone). Both are listed in the report with the fix. |
| Why is it HTTP not HTTPS? | We have no domain name. HTTPS needs a certificate tied to a domain (AWS Certificate Manager). With a domain we would add it and redirect port 80 to 443. |
| How do you deploy without downtime? | Rolling deployment: one server at a time while the other serves traffic, then a health check. |
| What if a bad version is deployed? | The smoke test fails and the pipeline automatically redeploys the previous version. |
| How much does it cost? | About US$127 per month if always on; the biggest items are the NAT gateway (US$43), EC2 (US$39) and the load balancer (US$24). We only ran it while building, a few dollars per day. Optimizations: a NAT instance instead of the gateway, Graviton instances, running only during working hours. |
| Is the infrastructure reproducible? | Yes. Terraform created all 69 resources; we destroyed and rebuilt them. |
| Did you find any security problem? | Yes: the app role could read the database root password because of an AWS managed policy. We added explicit denies and re-tested. |
| What did not work at first? | The load test could not trigger scaling from one laptop; the first OIDC attempt was blocked by an organization policy; the GitHub identity format was newer than expected. Each was diagnosed and fixed. |

### 12.5 Honest limitations to volunteer

- Single MongoDB instance and single NAT gateway.
- HTTP only (no domain, no certificate).
- No staging environment.
- No CDN or cache.
- Load test came from one laptop in Pakistan to Sydney, so latency numbers (median 293 ms) include the long distance and are not a benchmark.
- Connection from the app to MongoDB is inside the private network but not TLS-encrypted.
- The cost estimate uses AWS's price list data rather than a saved Pricing Calculator export.

---

## 13. Test results to quote

| Test | Result |
| --- | --- |
| Automated tests | Backend 78, front end 108, all run in the pipeline |
| Pipeline | test, build-push and deploy green; `/api/health` shows the new commit |
| Failing PR | Check red, nothing deployed |
| Broken release | Deploy failed, automatic rollback restored the old version |
| Scaling | 2 → 4 servers at 100% CPU, back to 2 in about 15 minutes |
| Server termination | App stayed up (one 502), replacement healthy in about 4.5 minutes |
| Database reboot | About 35 seconds of 503, data intact |
| Backup and restore | Dump to S3, restored into a separate database, counts matched |
| Security | Private IPs and port 5000 unreachable from the internet; `/.env` returns the web page; no token gives 401; no public IPs; no port 22 |

---

## 14. Mapping to the brief's requirements

| Brief item | Where it is |
| --- | --- |
| 1. Network layer | `network.tf`: VPC, subnets, IGW, route tables, NAT |
| 2. Web tier | `frontend/Dockerfile`, Nginx, ALB |
| 3. Application tier | `backend/Dockerfile`, `docker-compose.yml`, private subnets |
| 4. Database tier | `database.tf`, MongoDB on private EC2 |
| 5. Container registry | `ecr.tf`, Amazon ECR |
| 6. CI/CD | `.github/workflows/deploy.yml` |
| 7. Load balancing and scaling | `alb.tf`, `compute.tf` |
| 8. Security | `security_groups.tf`, `iam.tf`, SSM Parameter Store, OIDC |
| 9. Enhancements | S3 backups, EBS volume, CloudWatch, Terraform, cost estimate (5 of 6; Kubernetes skipped) |
| 10. NFR justification | Report section 7 |

---

## 15. Repository map

| Path | What is in it |
| --- | --- |
| `frontend/` | React app, `Dockerfile`, `nginx.conf` |
| `backend/` | Express API (TypeScript), `Dockerfile`, tests |
| `docker-compose.yml` | Local 3-service stack (`docker compose up --build`) |
| `deploy/` | `docker-compose.prod.yml` and `deploy.sh` that run on the AWS servers |
| `infra/` | All Terraform code |
| `scripts/` | `create-ssm-params.sh` (secrets), `load-test.sh` |
| `.github/workflows/deploy.yml` | The CI/CD pipeline |
| `docs/` | Report, diagram, evidence, cost estimate, this guide, rebuild guide |
| `docs/evidence/` | Screenshots and test logs |

---

## 16. Command cheat sheet

```
# Run the app on your laptop
docker compose up --build            # open http://localhost:8080

# AWS: who am I? (profile notes-admin)
aws sts get-caller-identity --profile notes-admin

# Get the live address
aws elbv2 describe-load-balancers --names notes-alb --profile notes-admin --region ap-southeast-2 --query "LoadBalancers[0].DNSName" --output text

# Terraform (folder infra/)
terraform plan
terraform apply
terraform destroy                    # stop all billing

# Check the live version
curl http://<load-balancer-address>/api/health
```

Rebuilding the whole stack from nothing is described step by step in `docs/REBUILD.md`.

---

## 17. Glossary

| Term | Meaning |
| --- | --- |
| **Availability Zone (AZ)** | One physical data centre location inside an AWS region. Using two protects against one failing. |
| **VPC** | Your private network inside AWS. |
| **Subnet** | A slice of the VPC in one zone. Public if it routes to an internet gateway. |
| **Internet Gateway** | The door from the VPC to the internet. |
| **NAT Gateway** | Lets private servers go out to the internet without being reachable from it. |
| **Route table** | Rules that say where network traffic goes. |
| **Security group** | A firewall attached to a resource. |
| **EC2** | A virtual server. |
| **AMI** | The template image a server starts from. |
| **User data** | A script that runs once when a server first boots. |
| **EBS** | A network disk attached to a server. |
| **ALB** | Application Load Balancer: spreads web traffic over servers and checks their health. |
| **Target group** | The list of servers behind a load balancer. |
| **Auto Scaling Group** | Keeps the number of servers right: replaces failed ones, adds or removes on load. |
| **Launch template** | The recipe for the servers an Auto Scaling Group creates. |
| **ECR** | AWS's private store for Docker images. |
| **IAM role** | A set of permissions that a server or service can use through temporary credentials. |
| **OIDC** | A way for GitHub to prove its identity to AWS so no passwords or keys are stored. |
| **SSM Parameter Store** | Encrypted storage for secrets and settings. |
| **Systems Manager (SSM)** | Remote shell and remote commands for servers without SSH. |
| **CloudWatch** | AWS monitoring: logs, metrics, alarms, dashboards. |
| **SNS** | Notification service; here it emails the alarms. |
| **S3** | Object storage; here it holds the backups. |
| **Terraform** | Tool that builds infrastructure from code files. |
| **State file** | Terraform's record of what it has created. |
| **CI/CD** | Continuous Integration / Continuous Delivery: automatic test, build and deploy on every code change. |
| **Rolling deployment** | Updating servers one at a time so the app never goes fully down. |
| **Rollback** | Automatically going back to the previous version when a release fails. |
| **JWT** | The login token the API issues after sign-in. |
| **Immutable tag** | An image tag that can never be overwritten. |
| **Single point of failure** | One component whose failure takes the system down. |
| **Least privilege** | Giving each part only the permissions it needs, nothing more. |
