# Lumina – Cloud-Native GitOps on EKS: Terraform, ArgoCD Image Updater & Traefik

**Published:** August 22, 2026 · **Tags:** AWS · EKS · GitOps · Terraform · ArgoCD · Kubernetes

---

Lumina is a full-stack authentication platform (React frontend + Node.js/Express backend + PostgreSQL) that I used as a vehicle for building a production-grade GitOps pipeline on AWS EKS. The goal: **push code → image builds → Kubernetes reconciles automatically**, with zero manual `kubectl apply` needed after initial setup.

This is the complete step-by-step lab guide — every command, every manifest, and every decision explained.

---

## Architecture Overview

```
Developer pushes code
        │
        ▼
GitHub Actions
  ├── Build Docker image
  └── Push to Docker Hub (:dev tag)
              │
              ▼
  ArgoCD Image Updater polls Docker Hub every 2 min
  detects digest change on :dev tag
              │
              ▼
  ArgoCD syncs rolling restart to EKS (lumina-dev namespace)
              │
              ▼
  Traefik Ingress Controller routes external traffic
  to frontend and backend services
```

| Layer | Technology | Why |
|---|---|---|
| **Infrastructure** | Terraform (4 modules) | Reproducible VPC + EKS + RDS |
| **Cluster** | EKS (self-managed nodes) | Full control over node AMI and sizing |
| **GitOps** | ArgoCD + Image Updater | Pull-based, no push credentials in CI |
| **Ingress** | Traefik Ingress Controller | Lightweight, CRD-based routing |
| **Manifests** | Kustomize (base + overlays) | DRY manifests, environment-specific patches |
| **CI** | GitHub Actions | Build + push on path-filtered triggers |
| **Database** | RDS PostgreSQL (private subnet) | Managed, no public access |

---

## Repository Structure

```
lumina/
├── app/
│   ├── backend/          # Node.js + Express API
│   └── frontend/         # React + Vite SPA
├── K8s/
│   ├── base/
│   │   ├── backend/      # deployment, service, ingress, kustomization
│   │   └── frontend/     # deployment, service, ingress, kustomization
│   ├── overlays/dev/     # image tag patches per environment
│   ├── ingress-controller/  # Traefik Helm values + install script
│   └── argocd/           # ArgoCD install + Application manifests
└── terraform/
    ├── DEV/              # Root module (entry point)
    └── modules/
        ├── networking/   # VPC, subnets, IGW, NAT
        ├── eks_cluster/  # EKS control plane + IAM
        ├── eks_cluster_nodes/  # Self-managed ASG nodes
        └── rds/          # PostgreSQL RDS instance
```

---

## Prerequisites

- AWS CLI configured with sufficient IAM permissions
- Terraform >= 1.0 installed
- `kubectl` and `helm` installed
- Docker Hub account (free tier is fine)
- GitHub repository with Actions enabled

---

## Step 1 — Provision AWS Infrastructure with Terraform

All AWS resources live in 4 composable Terraform modules. The root module in `terraform/DEV/` wires them together.

```bash
cd terraform/DEV

# Initialise providers and download modules
terraform init

# Preview what will be created
terraform plan -var="db_password=YourStrongPassword123!"

# Provision (takes ~15 min — EKS control plane is the slow part)
terraform apply -var="db_password=YourStrongPassword123!"
```

**What gets provisioned:**

| Resource | Details |
|---|---|
| VPC | 2 public + 2 private subnets, tagged for EKS ELB auto-discovery |
| EKS Cluster | `dev-cluster`, `us-east-1`, Kubernetes 1.29 |
| Node Group | Self-managed ASG, 2× `t3.medium`, Amazon Linux 2 EKS-optimised AMI |
| RDS PostgreSQL | `db.t3.micro`, private subnets, no public access, `coredb` database |

Capture outputs for later steps:

```bash
terraform output rds_endpoint        # → DB_HOST for the K8s secret
terraform output eks_node_role_arn   # → ARN for aws-auth ConfigMap
```

---

## Step 2 — Configure kubectl + Join Nodes

```bash
# Point kubeconfig at the new cluster
aws eks update-kubeconfig --region us-east-1 --name dev-cluster

# Nodes show NotReady until aws-auth is applied — that's expected
kubectl get nodes
```

Update `terraform/aws-auth-cm.yaml` with the node role ARN from Step 1:

```yaml
# terraform/aws-auth-cm.yaml
mapRoles: |
  - rolearn: arn:aws:iam::<ACCOUNT_ID>:role/lumina-eks-node-role  # ← paste from terraform output
    username: system:node:{{EC2PrivateDNSName}}
    groups:
      - system:bootstrappers
      - system:nodes
```

```bash
kubectl apply -f terraform/aws-auth-cm.yaml
kubectl get nodes   # should now show Ready
```

![EKS nodes in Ready state](/blog/images/lumina-project/eks-nodes.png)

---

## Step 3 — Install Traefik Ingress Controller

Traefik is installed via Helm with a custom `values.yaml` that provisions an AWS NLB.

```bash
cd K8s/ingress-controller
bash install.sh
```

The install script does:

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm install traefik traefik/traefik \
  --namespace traefik --create-namespace \
  -f values.yaml
```

Verify:

```bash
kubectl -n traefik get pods       # should show Running
kubectl -n traefik get svc        # EXTERNAL-IP = NLB DNS
kubectl get ingressclass          # traefik should be listed
```

> **Tip:** The NLB DNS name is your cluster's public endpoint. Point a Route 53 record (or test with `/etc/hosts`) to this address.

---

## Step 4 — Install ArgoCD + Image Updater

```bash
cd K8s/argocd
bash install.sh
```

The install script installs ArgoCD and the Image Updater add-on:

```bash
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml
```

Access the ArgoCD UI:

```bash
kubectl port-forward svc/argocd-server -n argocd 8443:443
# open https://localhost:8443

# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d && echo
```

---

## Step 5 — Create Docker Hub Secret for Image Updater

ArgoCD Image Updater needs credentials to poll your Docker Hub repos. Fill in `K8s/argocd/dockerhub-secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: argocd-image-updater-dockerhub
  namespace: argocd
  labels:
    app.kubernetes.io/name: argocd-image-updater
stringData:
  .dockerconfigjson: |
    {
      "auths": {
        "https://index.docker.io/v1/": {
          "username": "<your-dockerhub-username>",
          "password": "<your-dockerhub-token>"
        }
      }
    }
```

```bash
kubectl apply -f K8s/argocd/dockerhub-secret.yaml
```

---

## Step 6 — Create the DB Secret (one-time, gitignored)

The backend reads DB credentials from a Kubernetes Secret injected as environment variables. Fill in `K8s/base/backend/secret.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: lumina-backend-secret
  namespace: lumina-dev
stringData:
  DB_HOST: "<rds_endpoint from terraform output>"
  DB_PORT: "5432"
  DB_NAME: "coredb"
  DB_USER: "postgres"
  DB_PASSWORD: "<your-db-password>"
  JWT_SECRET: "<random-string-min-32-chars>"
  DB_SSL: "true"
```

```bash
# Create the namespace first
kubectl create namespace lumina-dev --dry-run=client -o yaml | kubectl apply -f -

# Apply the secret (never commit this file — it is gitignored)
kubectl apply -f K8s/base/backend/secret.yaml -n lumina-dev
```

Secret flow:

```
RDS (Terraform) → secret.yaml (manual, gitignored) → K8s Secret → backend Pod (envFrom)
```

---

## Step 7 — Set Up GitHub Actions (CI)

Two path-filtered workflows build and push images to Docker Hub on every push to `main`.

**`backend-dev.yml`** — triggers on changes to `app/backend/**`

```yaml
name: Build & Push Backend
on:
  push:
    branches: [main]
    paths: ['app/backend/**']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: ./app/backend
          push: true
          tags: ${{ secrets.DOCKERHUB_USERNAME }}/lumina-backend:dev
```

**Required GitHub Secrets:**

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token (not password) |

![GitHub Actions pipeline run](/blog/images/lumina-project/github-actions-pipeline.png)

---

## Step 8 — Register ArgoCD Applications

The ArgoCD Application manifests point to the `K8s/overlays/dev/` directory in your Git repo. ArgoCD continuously reconciles the cluster state against this path.

```bash
kubectl apply -f K8s/argocd/backend-app.yaml
kubectl apply -f K8s/argocd/frontend-app.yaml
```

ArgoCD will:
1. Create the `lumina-dev` namespace (if not exists)
2. Apply all Kustomize-rendered manifests
3. Start polling Docker Hub for new `:dev` image digests

Verify:

```bash
kubectl get applications -n argocd
kubectl get all -n lumina-dev
```

![ArgoCD dashboard showing synced applications](/blog/images/lumina-project/argocd-dashboard.png)

---

## Step 9 — How Kustomize Overlays Work

The `K8s/base/` directory has the canonical manifests. The `overlays/dev/` directory patches only what differs per environment (currently: image tags).

```
K8s/base/backend/
├── deployment.yaml      # 3 replicas, envFrom secret
├── service.yaml         # ClusterIP on port 4000
├── ingress.yaml         # Traefik IngressRoute
└── kustomization.yaml   # lists all resources

K8s/overlays/dev/backend/
└── kustomization.yaml   # patches image to :dev tag
```

`overlays/dev/backend/kustomization.yaml`:
```yaml
resources:
  - ../../base/backend
images:
  - name: lumina-backend
    newTag: dev
```

ArgoCD Image Updater **automatically updates this `newTag`** in Git when it detects a new image digest on Docker Hub — no manual commit needed.

---

## Step 10 — Verify End-to-End Flow

```bash
# Watch ArgoCD reconcile in real time
kubectl get applications -n argocd -w

# Check all pods are running
kubectl get pods -n lumina-dev

# Quick smoke test via port-forward
kubectl port-forward svc/lumina-frontend-service 8080:80 -n lumina-dev &
kubectl port-forward svc/lumina-backend-service 4000:4000 -n lumina-dev &

# Test registration endpoint
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","email":"demo@mail.com","password":"secret123"}'

# Test login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"demo","password":"secret123"}'

# Open frontend
open http://localhost:8080
```

---

## Key Design Decisions

### Why ArgoCD Image Updater instead of `kubectl set image`?

With `kubectl set image` in CI, your pipeline needs write access to the cluster — a long-lived kubeconfig or service account token stored as a secret. Image Updater flips this:

- CI only needs Docker Hub credentials (push image)
- ArgoCD polls Docker Hub from inside the cluster
- No cluster credentials in CI ever

### Why self-managed EKS nodes instead of managed node groups?

KodeKloud sandbox environments have IAM restrictions that prevent `performance_insights` and certain managed nodegroup APIs. Self-managed nodes with a Launch Template + ASG give full control and work within those constraints.

### Why Kustomize over Helm for app manifests?

Helm adds templating complexity for a 2-service app. Kustomize's `base + overlay` pattern is simpler: the base is plain YAML, overlays are surgical patches. ArgoCD Image Updater also integrates cleanly with Kustomize's `images:` field.

---

## Cost Estimate

| Resource | Approx Monthly Cost |
|---|---|
| EKS Control Plane | ~$73 |
| 2× t3.medium EC2 nodes | ~$60 |
| RDS PostgreSQL db.t3.micro | ~$15 |
| NAT Gateway | ~$32 |
| **Total** | **~$180/mo** |

> This is a dev environment. For production, consider managed node groups, Spot instances for workers, and Reserved Instances for baseline capacity.

---

## Repository

- **GitHub:** [github.com/nyeinchan4/lumina](https://github.com/nyeinchan4/lumina)
- **IaC:** `terraform/DEV/` + `terraform/modules/`
- **GitOps manifests:** `K8s/`
- **CI workflows:** `.github/workflows/`

---

*Questions or issues? Open a GitHub issue or reach out on LinkedIn.*
