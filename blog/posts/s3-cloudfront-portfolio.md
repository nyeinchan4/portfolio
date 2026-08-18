# Hosting a Portfolio on S3 + CloudFront for Near-Zero Cost

This is the exact infrastructure stack that powers this portfolio site. A static HTML site served globally through AWS CloudFront, stored in a private S3 bucket, with HTTPS via ACM and a keyless CI/CD deploy using GitHub Actions OIDC — all provisioned with a single CloudFormation template.

## Why Serverless Static Hosting?

For a personal portfolio, you have no backend logic — no logins, no database queries, no server-side rendering. Everything is static HTML, CSS, JavaScript, and Markdown files. The optimal pattern is:

- **Storage**: S3 (private bucket)
- **CDN**: CloudFront (450+ edge locations globally)
- **SSL**: ACM (free, auto-renewed)
- **DNS**: Route 53 (Alias records → CloudFront)
- **Deploy**: GitHub Actions with OIDC (no stored AWS keys)

Monthly cost for a typical portfolio: **$0.00 – $1.50**.

## Architecture Overview

```
GitHub (git push main)
        │
        ▼
GitHub Actions (OIDC → AssumeRole)
        │
        ├── aws s3 sync → SiteBucket (HTML/CSS/JS/.md)
        ├── aws s3 sync → BlogImagesBucket (*.png)
        └── cloudfront create-invalidation
                │
                ▼
        CloudFront Distribution
        ├── /blog/images/* → BlogImagesBucket
        ├── /assets/*      → SiteBucket (1yr cache)
        └── default        → SiteBucket (5min cache)
                │
                ▼
        Route 53 Alias → CloudFront
```

## CloudFormation — Key Resources

The entire stack is a single CloudFormation YAML file. Here are the critical resources:

### S3 Bucket (Private)

```yaml
SiteBucket:
  Type: AWS::S3::Bucket
  Properties:
    PublicAccessBlockConfiguration:
      BlockPublicAcls: true
      BlockPublicPolicy: true
      IgnorePublicAcls: true
      RestrictPublicBuckets: true
```

The bucket is fully private. CloudFront accesses it using **Origin Access Control (OAC)** with sigv4 request signing — more secure than the deprecated OAI.

### CloudFront OAC

```yaml
CloudFrontOAC:
  Type: AWS::CloudFront::OriginAccessControl
  Properties:
    OriginAccessControlConfig:
      OriginAccessControlOriginType: s3
      SigningBehavior: always
      SigningProtocol: sigv4
```

### Cache Behaviors

Two separate cache policies handle different content types:

| Path | TTL | Reason |
|------|-----|--------|
| `/*.html`, `/blog/posts/*` | 5 min | Fast publishing |
| `/assets/*`, `/blog/images/*` | 1 year | Fingerprinted names |

### GitHub Actions OIDC (Keyless Deploy)

Instead of storing `AWS_ACCESS_KEY_ID` in GitHub Secrets, we use OIDC:

```yaml
GitHubOIDCProvider:
  Type: AWS::IAM::OIDCProvider
  Properties:
    Url: https://token.actions.githubusercontent.com
    ClientIdList: [sts.amazonaws.com]
    ThumbprintList: [6938fd4d98bab03faadb97b34396831e3780aea1]
```

The IAM role trust policy restricts access to a specific repo and branch:

```yaml
Condition:
  StringLike:
    token.actions.githubusercontent.com:sub:
      !Sub "repo:${GitHubOwner}/${GitHubRepo}:ref:refs/heads/${GitHubBranch}"
```

## GitHub Actions Workflow

```yaml
permissions:
  id-token: write   # request OIDC token
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ secrets.GITHUB_DEPLOY_ROLE_ARN }}
      aws-region: us-east-1

  - name: Sync HTML (short cache)
    run: |
      aws s3 sync . s3://${{ secrets.SITE_BUCKET_NAME }} \
        --include "*.html" \
        --cache-control "max-age=300, must-revalidate"

  - name: Sync assets (long cache)
    run: |
      aws s3 sync assets/ s3://${{ secrets.SITE_BUCKET_NAME }}/assets/ \
        --cache-control "max-age=31536000, immutable"

  - name: Invalidate CloudFront
    run: |
      aws cloudfront create-invalidation \
        --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
        --paths "/*.html" "/blog/posts/*"
```

## Blog — Markdown Files in S3

Blog posts are plain `.md` files stored in S3 at `/blog/posts/<slug>.md`. The browser fetches the file and renders it client-side using **marked.js** — no backend, no CMS, no database.

Writing a new post is as simple as:

```bash
# Create the post
vim blog/posts/my-new-post.md

# Deploy
git add . && git commit -m "Add new blog post" && git push
```

The GitHub Actions workflow picks it up, syncs the `.md` file to S3, and invalidates the CloudFront cache. The post is live in under 60 seconds.

## Cost Breakdown

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| S3 | 5 GB/mo | $0.023/GB |
| CloudFront | 1 TB/mo | $0.0085/GB |
| ACM | Free | Free |
| Route 53 | — | $0.50/mo |
| **Total** | **$0.00** | **~$0.50–$1.50/mo** |

## Takeaways

1. **No servers to manage** — S3 and CloudFront handle everything
2. **Global performance** — 450+ edge locations cache your content
3. **Free HTTPS** — ACM certificate auto-renews forever
4. **Zero secrets stored** — OIDC eliminates the need for long-lived AWS keys
5. **IaC first** — one `aws cloudformation deploy` reproduces the entire stack
