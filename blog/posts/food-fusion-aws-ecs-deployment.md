# Deploying Food Fusion on AWS: ECS Fargate, CloudFormation & GitHub Actions OIDC

**Published:** August 22, 2026 · **Tags:** AWS · ECS · CloudFormation · CI/CD · Architecture

---

Food Fusion is a full-stack culinary web application (Laravel backend + React/Vite frontend) that I containerized and deployed on AWS ECS Fargate using a fully automated GitHub Actions CI/CD pipeline. No CodePipeline. No long-lived AWS credentials. Just `git push → live`.

This post is a complete step-by-step lab guide — every command, every CloudFormation resource, and every decision explained.

---

## Architecture Overview

![Food Fusion Architecture Diagram](/blog/images/food-fusion-project/architecture-diagram.png)

The stack is intentionally lean:

| Layer | Service | Why |
|---|---|---|
| **Compute** | ECS Fargate (3 services) | Serverless containers — no EC2 to manage |
| **Database** | RDS MySQL (private subnet) | Managed, Multi-AZ ready |
| **Networking** | VPC, 2 AZs, public/private/data subnets | Proper isolation |
| **Load Balancer** | ALB → Frontend only | Backend is internal via Cloud Map |
| **Service Discovery** | AWS Cloud Map | Backend DNS for Nginx → PHP-FPM |
| **Registry** | ECR (frontend + backend repos) | Native AWS, no DockerHub dependency |
| **CI/CD** | GitHub Actions + OIDC | No long-lived AWS keys anywhere |
| **Secrets** | SSM Parameter Store | Injected at container start |
| **Media** | S3 (public-read bucket) | Laravel `FILESYSTEM_DISK=s3` |
| **IaC** | CloudFormation (single stack) | Everything as code |

---

## Prerequisites

- AWS CLI configured (`aws configure`)
- Docker installed locally
- A GitHub repository for your project
- Domain in Route 53 (optional but recommended)

---

## Step 1 — Set Up SSM Parameters (Secrets)

Before deploying CloudFormation, store your secrets in SSM Parameter Store. CloudFormation will reference these by path — they are **never** stored in the template or in plaintext.

```bash
# Application key (generate with: php artisan key:generate)
aws ssm put-parameter \
  --name "/food-fusion/prod/app/key" \
  --value "base64:your_laravel_app_key_here==" \
  --type SecureString \
  --region ap-southeast-1

# Database password
aws ssm put-parameter \
  --name "/food-fusion/prod/db/password" \
  --value "YourStrongDBPassword123!" \
  --type SecureString \
  --region ap-southeast-1

# Backend Cloud Map DNS name (used by Nginx to proxy to PHP-FPM)
aws ssm put-parameter \
  --name "/food-fusion/prod/backend-host" \
  --value "backend.food-fusion.local" \
  --type String \
  --region ap-southeast-1
```

> **Why SSM over env files?** ECS injects SSM parameters as environment variables at container start time — no secrets ever touch the filesystem, the image, or the CI/CD logs.

---

## Step 2 — Deploy the CloudFormation Stack

The entire infrastructure is defined in a single CloudFormation template. It provisions:

- VPC with 6 subnets (2 public, 2 private, 2 data/isolated)
- NAT Gateway (single AZ for cost savings)
- RDS MySQL in isolated data subnets
- ECS Cluster + 3 Fargate services (frontend, backend, queue worker)
- ALB → Frontend target group
- Cloud Map private DNS namespace (`food-fusion.local`)
- ECR repositories (frontend + backend)
- S3 media bucket (public-read for uploaded images)
- GitHub Actions OIDC provider + deploy IAM role
- All security groups, IAM roles, task definitions

```bash
aws cloudformation deploy \
  --stack-name prod-food-fusion \
  --template-file infrastructure/AWS-CloudFormation/food-fusion-cfn.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      EnvironmentName=prod \
      ProjectName=food-fusion \
      DBUsername=foodfusion \
      DBName=food_fusion \
      DBPasswordSSMPath=/food-fusion/prod/db/password \
      AppKeySSMPath=/food-fusion/prod/app/key \
      BackendHostSSMPath=/food-fusion/prod/backend-host \
      FrontendECRRepoName=food-fusion-frontend \
      BackendECRRepoName=food-fusion-backend \
      GitHubOrg=nyeinchan4 \
      GitHubRepo=food-fusion \
      GitHubBranch=main \
      DomainName=yourdomain.com \
  --region ap-southeast-1
```

This takes ~10–15 minutes (RDS is the slowest part). Go get coffee.

![CloudFormation Stack in AWS Console](/blog/images/food-fusion-project/cloudformation-stack.png)

### Fetch the outputs you'll need next

```bash
# Get the GitHub Actions deploy role ARN (add to GitHub Secrets)
aws cloudformation describe-stacks \
  --stack-name prod-food-fusion \
  --query "Stacks[0].Outputs[?OutputKey=='GitHubActionsDeployRoleArn'].OutputValue" \
  --output text

# Get the ECR URIs
aws cloudformation describe-stacks \
  --stack-name prod-food-fusion \
  --query "Stacks[0].Outputs[?contains(OutputKey,'ECR')][OutputKey,OutputValue]" \
  --output table
```

---

## Step 3 — Push Initial Images to ECR

Before ECS can run your services, ECR needs images. The CloudFormation template defaults to `nginx:latest` and `php:8.4-fpm-alpine` as placeholder — push real images first.

### 3a — Authenticate Docker to ECR

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=ap-southeast-1

aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS \
  --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com
```

### 3b — Build and push the frontend image

```bash
FRONTEND_ECR="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/food-fusion-frontend"

docker build -f Dockerfile.frontend -t food-fusion-frontend:latest .
docker tag food-fusion-frontend:latest ${FRONTEND_ECR}:latest
docker push ${FRONTEND_ECR}:latest
```

### 3c — Build and push the backend image

```bash
BACKEND_ECR="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/food-fusion-backend"

docker build -f Dockerfile.backend -t food-fusion-backend:latest .
docker tag food-fusion-backend:latest ${BACKEND_ECR}:latest
docker push ${BACKEND_ECR}:latest
```

![ECR Repositories in AWS Console](/blog/images/food-fusion-project/ecr-repositories.png)

---

## Step 4 — Update Task Definitions with Real Image URIs

Now update the CloudFormation stack to use your real ECR images:

```bash
aws cloudformation deploy \
  --stack-name prod-food-fusion \
  --template-file infrastructure/AWS-CloudFormation/food-fusion-cfn.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      FrontendImageUri="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/food-fusion-frontend:latest" \
      BackendImageUri="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/food-fusion-backend:latest" \
      QueueImageUri="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/food-fusion-backend:latest" \
  --region ap-southeast-1
```

> The queue worker uses the same image as the backend (`php artisan queue:work` is the entrypoint override).

---

## Step 5 — Run Database Migrations

ECS Fargate tasks are ephemeral. Run migrations as a one-off task:

```bash
# Get the private subnet IDs and backend security group from stack outputs
PRIVATE_SUBNET=$(aws cloudformation describe-stacks \
  --stack-name prod-food-fusion \
  --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnets'].OutputValue" \
  --output text | cut -d',' -f1)

BACKEND_SG=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=prod-food-fusion-backend-task-sg" \
  --query "SecurityGroups[0].GroupId" --output text)

CLUSTER="prod-food-fusion-ecs-cluster"
TASK_DEF="prod-food-fusion-backend-task"

aws ecs run-task \
  --cluster $CLUSTER \
  --task-definition $TASK_DEF \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET],securityGroups=[$BACKEND_SG],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"prod-food-fusion-backend","command":["php","artisan","migrate","--force"]}]}' \
  --region $AWS_REGION
```

Check the migration output in CloudWatch Logs:

```bash
aws logs tail /ecs/prod-food-fusion/backend --follow
```

---

## Step 6 — Configure GitHub Actions OIDC (No AWS Keys)

The CloudFormation stack already created the OIDC provider and deploy role. You just need to add the role ARN as a GitHub secret.

### Add GitHub Secret

1. Go to your repo → **Settings → Secrets and variables → Actions**
2. Add secret: `GitHubActionsDeployRoleArn` = *(ARN from Step 2)*

### The OIDC trust relationship (what CloudFormation created)

```yaml
# The deploy role only trusts tokens from your exact repo + branch
Condition:
  StringLike:
    token.actions.githubusercontent.com:sub:
      - "repo:nyeinchan4/food-fusion*:ref:refs/heads/main"
      - "repo:nyeinchan4/food-fusion*:environment:prod"
```

This means **only pushes to `main` from your repo** can assume the deploy role. No other repo or branch can ever use it.

---

## Step 7 — How the GitHub Actions Pipeline Works

The deploy workflow (`.github/workflows/deploy-frontend.yml`) runs on every push to `main`:

```
git push main
    │
    ▼
GitHub Actions runner starts
    │
    ├─ aws-actions/configure-aws-credentials (OIDC)
    │  └─ Exchanges GitHub JWT for temporary AWS credentials
    │     (15 min TTL, no stored keys anywhere)
    │
    ├─ Login to ECR
    │
    ├─ docker build + push (tagged with git SHA)
    │
    ├─ aws ecs describe-task-definition → task-def.json
    │
    ├─ aws-actions/amazon-ecs-render-task-definition
    │  └─ Injects new image URI into task-def.json
    │
    ├─ aws-actions/amazon-ecs-deploy-task-definition
    │  └─ Registers new task def + triggers rolling deploy
    │
    └─ ECS replaces containers one at a time (zero downtime)
```

![GitHub Actions successful run](/blog/images/food-fusion-project/github-actions-run.png)

---

## Step 8 — Verify Everything is Running

```bash
# Check all 3 ECS services are RUNNING with desired count
aws ecs describe-services \
  --cluster prod-food-fusion-ecs-cluster \
  --services \
    prod-food-fusion-frontend-svc \
    prod-food-fusion-backend-svc \
    prod-food-fusion-queue-svc \
  --query "services[*].[serviceName,runningCount,desiredCount,status]" \
  --output table
```

![ECS Services running in AWS Console](/blog/images/food-fusion-project/ecs-services.png)

```bash
# Check the ALB target group health
aws elbv2 describe-target-health \
  --target-group-arn $(aws elbv2 describe-target-groups \
    --names prod-food-fusion-frontend-tg \
    --query "TargetGroups[0].TargetGroupArn" --output text) \
  --query "TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]" \
  --output table
```

Expected: all targets show `healthy`.

---

## Architecture Deep Dive: Key Design Decisions

### Why Cloud Map for Backend Discovery?

The frontend Nginx container needs to proxy API requests to the PHP-FPM backend. Options:
- **Internal ALB** — costs ~$20/mo just for the load balancer
- **Hard-coded private IP** — breaks every time a task restarts
- **Cloud Map** ✅ — free private DNS, resolves to current task IP

Nginx config:
```nginx
location /api {
    proxy_pass http://${BACKEND_HOST}:9000;
}
```

`BACKEND_HOST` is injected from SSM as `backend.food-fusion.local`, which Cloud Map resolves to the PHP-FPM task's private IP.

### Why No CodePipeline?

CodePipeline adds ~$1/pipeline/month plus complexity (CodeBuild projects, S3 artifact buckets, CodeStar Connections). GitHub Actions with OIDC achieves the same result — faster, for free, with better visibility in the repo itself.

### Security Group Topology

```
Internet → ALB (443/80) → Frontend Task SG (port 80 from ALB only)
                                │
                                │ proxy_pass :9000
                                ▼
                     Backend Task SG (port 9000 from Frontend SG only)
                                │
                                │ MySQL
                                ▼
                     RDS SG (port 3306 from Backend SG only)
```

No task is ever directly reachable from the internet. The only public entry point is the ALB.

---

## Cost Estimate

| Resource | Approx Monthly Cost |
|---|---|
| ECS Fargate (3 tasks, 0.25 vCPU / 0.5GB each) | ~$8 |
| RDS MySQL db.t3.micro | ~$15 |
| ALB | ~$18 |
| NAT Gateway | ~$32 |
| ECR storage | ~$0.50 |
| S3 media | ~$1 |
| **Total** | **~$75/mo** |

> NAT Gateway is the biggest cost driver. For dev/staging, consider using VPC endpoints or a single NAT instance instead.

---

## Repository

- **GitHub:** [github.com/nyeinchan4/food-fusion](https://github.com/nyeinchan4/food-fusion)
- **IaC:** `infrastructure/AWS-CloudFormation/food-fusion-cfn.yml`
- **CI/CD:** `.github/workflows/deploy-frontend.yml`

---

*Questions or issues? Open a GitHub issue or reach out on LinkedIn.*
