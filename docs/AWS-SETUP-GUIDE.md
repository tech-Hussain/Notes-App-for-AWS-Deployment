# AWS Account Setup Guide (Phase 4) – for complete beginners

Goal: finish this guide with (1) a secured AWS account, (2) a safe everyday login that is not the root user, (3) a budget alarm so you are never surprised by a bill, and (4) the AWS CLI on your laptop talking to the `ap-southeast-2` (Sydney) region.

Do the steps in order. Where it says **TELL CLAUDE**, come back to Claude Code and say it. Claude will then verify from the command line. Never paste passwords, secret keys or MFA codes into chat.

Time needed: about 45 minutes. Have your phone nearby (for MFA) and a credit/debit card that works internationally (AWS requires one to open an account).

---

## Words you need to know

| Word | Meaning |
| --- | --- |
| **Root user** | The email and password you used to open the account. It can do everything, including closing the account. Use it as rarely as possible. |
| **IAM user** | A named login you create for daily work. Permissions are given by attaching policies. |
| **MFA** | Multi-factor authentication: a 6-digit code from a phone app, needed in addition to your password. |
| **Access key** | An ID plus secret, like a password for the command line. Shown only once. Keep it on your laptop only; never put it in GitHub. |
| **Region** | A geographic location of AWS data centres. We use `ap-southeast-2` (Sydney). Always check the region name at the top-right of the console. |
| **Budget** | An alert that emails you when spending reaches a limit you set. |

---

## Step 0 – Check the cost before you start (read this)

The architecture (load balancer, NAT gateway, 3 virtual servers) costs real money **per hour while it exists**. Rough order of magnitude: about **US$2.50–4 per day** while everything is running, much less if you destroy it when you are not working (Phase 14 covers this). Exact prices are on the AWS Pricing pages; we will compute them properly in Phase 12.

- New AWS accounts often get a **free plan with credits**. Look at it in Step 3 below.
- Some "free plan" accounts block certain services until you upgrade to the paid plan (AWS shows a banner when this happens). Upgrading does not spend money by itself, but it means charges beyond credits are possible. Decide this with the budget from Step 5 in place.
- The rule for this project: **build it, take screenshots, then destroy it** (Claude Code will run `terraform destroy` only with your explicit approval).

---

## Step 1 – Create the AWS account (skip if you already have one)

1. Open https://aws.amazon.com and click **Create an AWS Account**.
2. Enter your email address and an account name (for example `notes-app-cea`), then verify the email code.
3. Choose a strong, unique root password (use a password manager).
4. Account type: **Personal**. Fill in your name, address and phone number.
5. Add your payment card (a small temporary charge may appear and is reversed).
6. Verify your phone by SMS or voice call.
7. Support plan: choose **Basic (free)**.
8. Wait for the confirmation email, then sign in at https://console.aws.amazon.com as **Root user**.

If you use a university or class AWS account (for example AWS Academy or Educate), tell Claude: the steps differ (no root access, temporary credentials). Do not continue this guide until Claude has adapted it.

---

## Step 2 – Secure the root user with MFA

1. In the console, click your account name (top right) -> **Security credentials**.
2. Under **Multi-factor authentication (MFA)** click **Assign MFA device**.
3. Name: `root-phone`. Device type: **Authenticator app**. Click Next.
4. Install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy). Click **Show QR code** and scan it with the app.
5. Type two consecutive 6-digit codes from the app (wait for the code to change in between). Click **Add MFA**.
6. Log out and log in again once to confirm the MFA prompt appears.

Tip: save the account's recovery codes or take a backup of the authenticator app if it offers that.

---

## Step 3 – Look at your free-tier / credits

1. Search for **Billing and Cost Management** in the top search bar and open it.
2. Left menu -> **Credits** (see what you have and when it expires) and **Free tier** (see which services are free and for how long).
3. Write down: credits amount, expiry date.

**TELL CLAUDE** the credits amount and expiry date (only these). It will use them in the cost section of your report.

---

## Step 4 – Set the region

1. Top right of the console, click the region name and choose **Asia Pacific (Sydney) ap-southeast-2**.
2. Keep this region selected for everything. If something "disappears", you are probably looking at a different region.

---

## Step 5 – Create a budget with email alerts (do this before anything else)

1. Billing and Cost Management -> **Budgets** -> **Create budget**.
2. Choose **Use a template (simplified)** -> **Monthly cost budget**.
3. Budget name: `notes-app-monthly`. Budgeted amount: an amount you can afford, for example **15** (US$). Email recipients: your email.
4. Click **Create budget**. The template sends alerts at 85%, 100% and a forecast alert at 100%.
5. For the extra 50% alert the plan wants: open the budget -> **Edit** -> add an alert threshold of **50%** of actual cost, with your email. Save.
6. **Take a screenshot** of the budget page (evidence for the report's cost section). Save it in `docs/evidence/` (create the folder if missing).

Budgets are alarms, not brakes: they email you but do not stop spending. That is why we destroy resources after each work session.

---

## Step 6 – Enable Cost Explorer

1. Billing and Cost Management -> **Cost Explorer** -> **Launch Cost Explorer** (or "Enable").
2. It takes up to 24 hours to show data. You only need it enabled now.

---

## Step 7 – Create your everyday admin user (stop using root)

We use an IAM user because it is the simplest for a beginner and the plan allows it.

1. Search for **IAM** in the top search bar and open it.
2. Left menu -> **Users** -> **Create user**.
3. User name: `notes-admin`. Tick **Provide user access to the AWS Management Console**. Choose **I want to create an IAM user**, set a strong password, and untick "must create new password at next sign-in". Click Next.
4. **Set permissions** -> **Attach policies directly** -> search `AdministratorAccess`, tick it. Next -> **Create user**.
   (This is broad on purpose because Terraform has to create many kinds of resources. It is acceptable for a student project when the user has MFA and the account has a budget. Never share this user.)
5. On the confirmation page, copy the **console sign-in URL** (it contains your 12-digit account ID). Save it.
6. Open the user `notes-admin` -> **Security credentials** tab -> **Assign MFA device** and do the same MFA steps as in Step 2 (name it `notes-admin-phone`, you can use the same authenticator app; it will show a second entry).
7. Still on **Security credentials** -> **Create access key** -> use case **Command Line Interface (CLI)** -> tick the confirmation -> Next -> **Create access key**.
8. **Important:** you now see an **Access key ID** and a **Secret access key**. Click **Download .csv file** and keep it somewhere private (not inside the project folder, not in GitHub, not in cloud-synced Desktop). The secret is shown only once. Do not paste it in chat.

Now sign out of root. From now on sign in with the console URL from step 5, as the IAM user `notes-admin`.

**TELL CLAUDE** "IAM user created", but do not send keys.

---

## Step 8 – Configure the AWS CLI on your laptop

Claude has already installed AWS CLI v2 (version 2.39.3). Open **PowerShell** in any folder and run:

```powershell
aws configure --profile notes-admin
```

It asks four questions:

| Prompt | What to type |
| --- | --- |
| AWS Access Key ID | the Access key ID from the CSV |
| AWS Secret Access Key | the secret from the CSV (typing is hidden; paste and Enter) |
| Default region name | `ap-southeast-2` |
| Default output format | `json` |

The keys are stored in `C:\Users\<you>\.aws\credentials` on your laptop only.

Test it:

```powershell
aws sts get-caller-identity --profile notes-admin
```

You should see a JSON with `Account` (12 digits) and `Arn` ending in `user/notes-admin`. If the Arn ends in `:root`, you used root keys by mistake: delete them in the console and redo Step 7.

**TELL CLAUDE** "profile ready". Claude will run the Phase 4 verification checks (identity, instance types and zones, quotas).

---

## Step 9 – Check quotas (new accounts sometimes have small limits)

Claude will check this from the CLI, but you can look yourself:

1. Console -> search **Service Quotas** -> **AWS services** -> **Amazon Elastic Compute Cloud (Amazon EC2)**.
2. Search `Running On-Demand Standard` -> value should be at least **8** vCPUs.
3. Search `EC2-VPC Elastic IPs` -> at least **1** (needed for the NAT gateway).
4. If a value is too low, click it -> **Request increase at account level**. Approvals can take hours to days, so do this early.

---

## What you should have at the end (Checkpoint 4)

- [ ] Root user has MFA, and you no longer use it for daily work
- [ ] IAM user `notes-admin` with MFA and an access key saved privately
- [ ] CLI profile `notes-admin` works; `aws sts get-caller-identity` does not end in `:root`
- [ ] Budget with email alerts (50% / 85% / 100%) and a screenshot of it
- [ ] Cost Explorer enabled
- [ ] Region `ap-southeast-2`; vCPU quota >= 8; Elastic IPs >= 1

## Safety rules (keep for the whole project)

1. Never commit or paste access keys, secrets, passwords or `.tfstate` files.
2. If you ever leak a key: IAM -> Users -> `notes-admin` -> Security credentials -> **Deactivate**, then **Delete**, then create a new one.
3. Check the **Billing** page every day while the project runs.
4. When not working on the project, tell Claude "tear down" and approve the destroy (Phase 14), so the hourly-billed resources stop.
5. If a screen looks different from this guide, AWS has probably redesigned it. Send Claude a description (not secrets) and it will adjust the steps.
