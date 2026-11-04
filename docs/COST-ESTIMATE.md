# Monthly Cost Estimate – NoteNest on AWS (ap-southeast-2, Sydney)

Assumptions: 730 hours per month, on-demand prices, free tier and credits ignored, baseline of 2 app instances (peak 4 for short bursts). Prices below were read from the AWS Price List API on 2026-11-04 unless marked **approx**.

## Baseline (always on)

| Item | Quantity | Unit price (USD) | Monthly (USD) |
| --- | --- | --- | --- |
| EC2 app: t3.micro | 2 × 730 h | 0.0132 / h | 19.27 |
| EC2 database: t3.small | 1 × 730 h | 0.0264 / h | 19.27 |
| EBS gp3 (2 × 12 GiB app roots, 12 GiB DB root, 20 GiB data) | 56 GiB | 0.096 / GiB-month | 5.38 |
| Application Load Balancer | 730 h | 0.0252 / h | 18.40 |
| ALB capacity units (assume 1 LCU average) | 730 LCU-h | 0.008 / LCU-h | 5.84 |
| NAT Gateway hours | 730 h | 0.059 / h | 43.07 |
| NAT Gateway data (about 5 GB) | 5 GB | 0.059 / GB | 0.30 |
| Public IPv4 addresses (1 NAT + 2 ALB) | 3 × 730 h | 0.005 / h | 10.95 |
| **Subtotal from fetched prices** | | | **122.47** |
| ECR (about 2 GB), S3 (about 1 GB), CloudWatch (about 2 GB logs, 6 alarms, 1 dashboard) | | **approx** typical list rates | about 4.8 |
| **Estimated total** | | | **about US$127 per month** |

Not included: data transfer out (small at student traffic), SSM Parameter Store standard parameters (free), SNS email (free tier).

**Top three cost drivers:** NAT Gateway (US$43, 34%), Application Load Balancer (US$24, 19%), EC2 instances (US$39, 30%).

**Actual project spend** is far lower than this monthly figure because the stack only runs while we build and test. At the running rate (about US$4.0 per day from the hourly items above), a one or two day build costs US$4–8. Cost Explorer data lags by up to 24 hours; check it after a day for the real number.

## Optimizations (before → after)

| # | Change | Before | After | Monthly saving | Trade-off |
| --- | --- | --- | --- | --- | --- |
| 1 | Replace the NAT Gateway with a small NAT instance (for example fck-nat on t4g.nano at 0.0053 / h plus an 8 GiB root volume) | 43.37 | about 4.6 | **about 38.7** | One self-managed instance, lower bandwidth, you patch it. Not tested here. |
| 2 | Graviton: app on t4g.micro (0.0106 / h) and database on t4g.small (0.0212 / h) | 38.54 | 30.95 | **7.6** | Images must be built for `linux/arm64` as well; pipeline change. |
| 3 | Run only when needed (8 h per day, 22 days per month = 176 h): destroy or stop the stack outside demo hours | 111.0 (hourly items) | 26.7 | **about 84** | Data kept on EBS and S3; rebuild takes about 15 minutes. This is how this project is run. |
| 4 | Also available: 1-year Compute Savings Plan on the always-on baseline, Spot capacity for scale-out beyond 2 instances, shorter log retention (already 14 days), S3 lifecycle to Standard-IA (already configured) | | | not calculated | |

Combined 1 + 2 (always on): about US$127 → about US$81 per month.

## Pricing Calculator
The brief asks for a saved AWS Pricing Calculator estimate. Enter the line items in the first table at https://calculator.aws (region Asia Pacific (Sydney)), save and export it as PDF into `docs/evidence/`, and add the share link here. The numbers above can be cross-checked against it.
