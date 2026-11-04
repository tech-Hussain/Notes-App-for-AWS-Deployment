# Screenshot guide (take these from the AWS console)

Do these while the stack is running. Save every file in `docs/evidence/` with exactly the names below.

## Before you start
1. Sign in to the AWS console as `notes-admin` and set the region (top right) to **Asia Pacific (Sydney) ap-southeast-2**. If a page looks empty, the region is usually wrong.
2. Use the browser zoom at 80–90% so the whole table fits.
3. Windows screenshot: press **Win + Shift + S**, drag over the area, then open Paint (or any editor) and paste with Ctrl+V and save as PNG.
4. **Hide your 12-digit account ID** (top-right menu and inside some ARNs) because the repo is public. Easiest: drag your selection so it does not include the top-right menu. If an ARN shows the ID, draw a filled box over it in Paint.
5. Never include passwords, keys or the secret values of parameters.

Tip: search for each service with the search bar at the top (Alt+S).

## The list (21 screenshots)

| File name | Where to go (console path) | What must be visible |
| --- | --- | --- |
| `01-vpc.png` | VPC → Your VPCs → click **notes-vpc** | Name notes-vpc, IPv4 CIDR 10.0.0.0/16, state Available |
| `02-subnets.png` | VPC → Subnets, filter by VPC notes-vpc | All 6 subnets with names, CIDRs (10.0.1.0, 10.0.2.0, 10.0.11.0, 10.0.12.0, 10.0.21.0, 10.0.22.0) and two zones (2a, 2b) |
| `03-route-tables.png` | VPC → Route tables → **notes-public-rt**, open the **Routes** tab; then do **notes-private-rt**. Put both in one image (paste one under the other) | Public: 0.0.0.0/0 → igw-…; Private: 0.0.0.0/0 → nat-… and the S3 prefix-list route |
| `04-igw-nat.png` | VPC → Internet gateways (**notes-igw**, state Attached) and VPC → NAT gateways (**notes-nat**, state Available). Combine in one image. Optionally also VPC → Endpoints (**notes-s3-endpoint**) | Names and states |
| `05-security-groups.png` | EC2 → Security Groups → click each of **notes-alb-sg**, **notes-app-sg**, **notes-db-sg**, tab **Inbound rules**. Combine the three | ALB: port 80 from 0.0.0.0/0. App: port 80 whose Source is the ALB security group (sg-…). DB: port 27017 whose Source is the app security group |
| `06-ec2-instances.png` | EC2 → Instances | Instances notes-app (2 or more, running) and notes-mongodb (running), with different Availability zones. Add the columns Public IPv4 address (should be empty) |
| `07-alb.png` | EC2 → Load Balancers → **notes-alb** | DNS name, scheme Internet-facing, state Active, two Availability Zones, and the **Listeners** tab showing HTTP:80 → notes-web-tg |
| `08-target-group.png` | EC2 → Target Groups → **notes-web-tg** → **Targets** tab | Targets with status **healthy**, in two different zones |
| `09-asg.png` | EC2 → Auto Scaling Groups → **notes-app-asg**. Take one image of **Details** (min 2, desired 2, max 4), one of the **Automatic scaling** tab (target tracking policy 50% CPU) and one of **Activity** history | Min/desired/max and the scaling policy. The Activity tab should show the **Launching** and **Terminating** entries from the scale-out and scale-in test |
| `10-database.png` | EC2 → Instances → click **notes-mongodb** → **Details** tab | Private IPv4 10.0.21.10, **no public IPv4**, subnet notes-db-0, security group notes-db-sg |
| `11-ebs.png` | EC2 → Elastic Block Store → Volumes → **notes-mongo-data** | 20 GiB, gp3, **Encrypted: Yes**, state in-use, attached to the DB instance |
| `12-ecr.png` | ECR → Private repositories → open **notes-app/api**, then **notes-app/web**. Combine | Image tags that are git commit hashes (for example 72d5095) |
| `13-pipeline-run.png` | GitHub → your repo → **Actions** → click the green run named "CI/CD" | The three jobs test, build-push and deploy all with green ticks. Then also open the **deploy** job and screenshot the steps list ("Rolling deploy" succeeded, "Smoke test" succeeded) |
| `14-app-browser.png` | Open the ALB URL in the browser and sign in, create a note | The address bar showing the **notes-alb-…elb.amazonaws.com** URL and the app with a note and the footer "Deployed via CI/CD on AWS" |
| `15-cloudwatch.png` | CloudWatch → **Dashboards → notes-app**; CloudWatch → **Alarms**; CloudWatch → Logs → Log groups → /notes-app/api → a stream | Dashboard graphs with data; all 6 alarms (state OK); a log stream with request lines. Three images, or combine |
| `16-s3-backups.png` | S3 → bucket **notes-app-backups-…** → folder **mongo/** | At least one object like `notes-2026….archive.gz` |
| `17-scaling.png` | EC2 → Auto Scaling Groups → notes-app-asg → **Monitor** tab, or CloudWatch → alarm "TargetTracking-notes-app-asg-AlarmHigh…" graph | The CPU graph rising to about 100% (from around 23:34 local time on 4 Nov) and the instance count of 4. Use time range "3 hours" or "1 day". If the graph has scrolled off, say so and use the Activity history screenshot instead |
| `18-cost.png` | **AWS Pricing Calculator** (calculator.aws) with the line items from `docs/COST-ESTIMATE.md`, then export/print the estimate. Also Billing → **Cost Explorer** after a day | The estimate total and the service list. Save the PDF in `docs/evidence/` as well |

## Extra screenshots (the plan lists them as evidence for the security and secrets rows)

| File name | Where | What must be visible |
| --- | --- | --- |
| `19-budget.png` | Billing and Cost Management → Budgets → **notes-app-monthly** | US$50 limit and the three alert thresholds (50, 80, 100) |
| `20-iam-roles.png` | IAM → Roles → **notes-app-ec2-role**, **notes-db-ec2-role**, **notes-github-deploy-role** (Permissions tab and, for the last one, the **Trust relationships** tab) | The policies attached and the trust policy that names GitHub and the main branch |
| `21-ssm-and-secrets.png` | Systems Manager → Parameter Store (names and types only; **do not click "Show decrypted value"**). And GitHub → Settings → Secrets and variables → Actions | 7 parameters under /notes-app/prod, type SecureString for the secrets; one GitHub secret named AWS_DEPLOY_ROLE_ARN (the value is hidden) |

## After you finish
1. Put all files in `docs/evidence/`.
2. Tell Claude "screenshots done" and it will check the folder, commit and push.
3. Then say "tear down" to stop the billing.

## Don't forget
- Confirm the SNS email (check the inbox of syedmhussain209@gmail.com) so the alarm emails work.
- If you want the alarm-email screenshot (plan Checkpoint 10), tell Claude after confirming the email and it will trigger a short test alarm for you to capture.
