# Terraform Infrastructure Setup

**Role:** You are helping a team member set up Terraform + Terragrunt infrastructure for a new project.

**Context:** This team already has shared AWS infrastructure (profile `pharmer`, S3 state bucket `terraform-state-sensitive`, API tokens in Secrets Manager). Your job is to help them create project-specific Terraform configuration following team patterns.

**Goal:** Create a well-organized, maintainable Terraform structure that follows team conventions and integrates with existing shared infrastructure.

---

## Step 1: Understand Team Infrastructure

Before you begin, know that these are **already configured** for the team:

- **AWS Profile:** `pharmer` (use this, don't create new profile)
- **AWS Region:** `ca-central-1` (use this for all resources)
- **S3 State Bucket:** `terraform-state-sensitive` (already exists)
- **Vercel API Token:** `shared/vercel` in AWS Secrets Manager
- **BunnyNet API Key:** `shared/bunnynet` in AWS Secrets Manager
- **Vercel OIDC Provider:** Already configured in AWS account
- **Shared VPCs:** `prod-shared-vpc` and `staging-shared-vpc` (already exist, use these for RDS/ECS/EC2)

**Never ask the user to create these.** They're shared team resources.

---

## Step 2: Gather Project Requirements

**Before asking questions, explain the team architecture:**

"Our team uses a shared + environment architecture. Resources like Route53, S3 assets, and ECR repos will go in `live/shared/` and be used by both staging and production. Environment-specific compute (Lambda, ECS) and data (databases) will be in `live/staging/` and `live/production/`."

Ask the user:

1. **Project name** - What's the repository/project name?
2. **Environment** - Starting with staging, production, or both?
3. **Shared resources needed** - Which shared resources do you need?
   - Route53 DNS? (which domains?)
   - S3 assets bucket?
   - ECR container registry?
4. **Environment-specific services** - Which services per environment?
   - Lambda functions?
   - ECS/Fargate containers?
   - RDS/Aurora databases?
   - Step Functions?
   - Vercel OIDC integration?
   - BunnyNet CDN?
5. **Build artifacts** - Do Lambda packages exist? Docker images built?

**CRITICAL RULE:**

- **ONLY create infrastructure for services the user explicitly requests**
- **DO NOT infer services from .env files, package.json dependencies, or codebase inspection**
- If you see environment variables or code suggesting they might need a service they didn't request, **ASK FIRST** - don't assume

**Example:** If user says "Route53 only" but you see `S3_BUCKET_NAME` in their .env, ask: "I noticed S3_BUCKET_NAME in your .env. Do you need S3 infrastructure, or is that managed elsewhere?"

---

## Step 2.5: Auto-Generated Environment Variables

If the user wants Vercel environment variable management, you'll automatically create env vars based on the services they selected. **Use these standard naming conventions:**

| Service Selected | Auto-Generated Env Vars      | Terraform Value            |
| ---------------- | ---------------------------- | -------------------------- |
| Vercel OIDC      | `AWS_ROLE_ARN`, `AWS_REGION` | IAM role ARN, AWS region   |
| S3 Buckets       | `S3_BUCKET_NAME`             | Bucket name (`.id`)        |
| Lambda Functions | `LAMBDA_FUNCTION_ARN`        | Function ARN (`.arn`)      |
| Step Functions   | `STATE_MACHINE_ARN`          | State machine ARN (`.arn`) |
| BunnyNet CDN     | `CDN_URL`                    | CDN pull zone URL          |
| ECR              | `ECR_REPOSITORY_URL`         | Repository URL             |

**Important:**

- Don't ask user to name these env vars - use the standard names above
- Only ask what **secrets/credentials** their app needs (DATABASE_URL, API keys, etc.)
- These Terraform-managed vars auto-update when infrastructure changes

---

## Step 3: Create Directory Structure

**Team Standard Architecture:**

Create this exact structure:

```
infra/
├── terragrunt.hcl              # Root config (global settings)
├── live/
│   ├── shared/                 # Multi-tenant resources (Route53, S3 assets, ECR)
│   │   └── terragrunt.hcl
│   ├── staging/                # Environment-specific compute/data
│   │   └── terragrunt.hcl
│   └── production/             # Environment-specific compute/data
│       └── terragrunt.hcl
└── modules/
    ├── shared/                 # Shared resources module
    │   ├── main.tf             # Provider, data sources, locals
    │   ├── variables.tf        # Input variables
    │   ├── outputs.tf          # CRITICAL: Export IDs for env modules
    │   ├── s3.tf               # Assets bucket with path prefixing
    │   ├── route53.tf          # Hosted zones and records
    │   └── ecr.tf              # Container registries
    └── stack/                  # Environment-specific module
        ├── main.tf             # Provider, data sources, locals
        ├── variables.tf        # All input variables
        ├── outputs.tf          # Exported values
        ├── lambda.tf           # Per-environment functions
        ├── ecs.tf              # Per-environment containers
        ├── rds.tf              # Per-environment databases
        ├── stepfunctions.tf    # Per-environment workflows
        ├── vercel-oidc.tf     # Vercel OIDC
        ├── vercel-env-vars.tf # Vercel config
        └── bunny-cdn.tf       # BunnyNet CDN
```

**Architecture Principles:**

✅ **Shared Module** (live/shared → modules/shared):

- Route53 hosted zones and DNS records
- S3 assets bucket (uses path prefixing: `/staging/*`, `/production/*`)
- ECR repositories (uses tags: `v1-staging`, `v1-production`)
- Resources that are naturally multi-tenant or stateless

❌ **NOT in Shared** (goes in stack module):

- Lambda functions, ECS tasks (each environment needs independent compute)
- Databases (staging and production MUST be isolated)
- Step Functions (workflows should be environment-specific)
- Secrets (each environment has its own SSM parameters)

**Principles to explain to user:**

- Root `terragrunt.hcl`: Global settings, team constants pre-filled
- Shared module: Multi-tenant resources used by all environments (Route53, S3 assets, ECR)
- Environment configs: Depend on shared outputs, contain environment-specific values
- Stack module: One `.tf` file per AWS service
- Terragrunt eliminates duplication between environments

---

## Step 4: Create Root Configuration

**File:** `infra/terragrunt.hcl`

**Instructions:** Create this file with team constants pre-filled. Only ask user for `repo_name`.

**Template:**

```hcl
locals {
  aws_profile = "pharmer"                    # Team constant
  repo_name   = "project-name"               # Project-specific
  aws_region  = "ca-central-1"               # Team constant
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite"
  }
  config = {
    bucket  = "terraform-state-sensitive"    # Team constant
    key     = "${local.repo_name}/${path_relative_to_include()}/terraform.tfstate"
    region  = local.aws_region
    profile = local.aws_profile
    encrypt = true
  }
}

inputs = {
  aws_profile = local.aws_profile
  repo_name   = local.repo_name
  aws_region  = local.aws_region
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite"
  contents  = <<EOF
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Environment = var.env
      Project     = var.repo_name
      ManagedBy   = "terraform"
    }
  }
}
EOF
}
```

**Important:**

- Pre-fill `aws_profile = "pharmer"`
- Pre-fill `aws_region = "ca-central-1"`
- Pre-fill `bucket = "terraform-state-sensitive"`
- Ask user for `repo_name`

---

## Step 5: Create Environment Configurations

### Base Environment (Staging)

**File:** `infra/live/staging/terragrunt.hcl`

**Instructions:** Ask user for `name_prefix` (usually `projectname-staging`). Add only the services they requested.

**Template (without shared dependencies):**

```hcl
terraform {
  source = "../../modules/stack"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  env         = "staging"
  name_prefix = "project-staging"
  # Add service-specific configuration based on Step 2 requirements
}
```

### If User Needs Shared Resources (Route53, S3 assets, ECR)

**1. Create Shared Environment:**

**File:** `infra/live/shared/terragrunt.hcl`

```hcl
terraform {
  source = "../../modules/shared"
}

include "root" {
  path = find_in_parent_folders()
}

inputs = {
  env         = "shared"
  name_prefix = "project-shared"
  # domains = ["example.com"], enable_ecr = true, etc.
}
```

**2. Update Staging to Depend on Shared:**

**Instructions:** Add dependency block to staging/production configs to consume shared outputs.

**Pattern:**

```hcl
terraform {
  source = "../../modules/stack"
}

include "root" {
  path = find_in_parent_folders()
}

# CRITICAL: Read outputs from the shared environment
dependency "shared" {
  config_path = "../shared"

  # Mock outputs allow 'plan' to run even if shared isn't deployed yet
  mock_outputs = {
    assets_bucket_name   = "temporary-mock-bucket-name"
    route53_zone_id      = "Z1234567890ABC"
    ecr_repository_url   = "123456789012.dkr.ecr.ca-central-1.amazonaws.com/mock-repo"
  }
}

inputs = {
  env         = "staging"
  name_prefix = "project-staging"

  # Pass shared resource IDs to the stack module
  shared_assets_bucket     = dependency.shared.outputs.assets_bucket_name
  shared_route53_zone_id   = dependency.shared.outputs.route53_zone_id
  shared_ecr_repository_url = dependency.shared.outputs.ecr_repository_url

  # Environment-specific configuration
  # lambda_function_zip = "${get_repo_root()}/path/to/function.zip"
}
```

**Key Points:**

- Shared deploys first → environments depend on its outputs → correct deployment order
- Mock outputs allow planning before shared exists
- Prevents resource duplication, reduces costs

---

## Step 6: Implement Service Modules

### Provider Configuration

**CRITICAL:** Every Terraform module must start with a `main.tf` file that specifies exact provider versions. This ensures consistent behavior across all environments and team members.

**File:** `modules/stack/main.tf`

**Instructions:** Create this file first, before any service-specific `.tf` files. Use these exact versions:

```hcl
terraform {
  required_version = ">= 1.13.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.14.1"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.15"
    }
    bunnynet = {
      source  = "BunnyWay/bunnynet"
      version = "~> 0.10"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id

  # Common tags
  common_tags = {
    ManagedBy   = "terraform"
    Environment = var.env
    Project     = var.repo_name
  }
}
```

**CRITICAL - Provider Declaration vs Configuration:**

- This file ONLY declares providers in `required_providers` block
- DO NOT add `provider "vercel" {}` or `provider "bunnynet" {}` blocks here (causes duplicate provider errors)
- Vercel/BunnyNet providers are configured in their service files (`vercel-env-vars.tf`, `bunny-cdn.tf`) where they access Secrets Manager

**Key Points:**

- AWS provider: Always included, auto-configured by root `terragrunt.hcl`
- Vercel/BunnyNet providers: Only include if user needs those services
- Versions are team standards (`~>` allows patch updates only)
- Don't modify versions without team approval

---

### Service Implementation Patterns

For each service the user needs, create a `.tf` file in `modules/stack/`. Follow these patterns:

### Universal Patterns (Apply to ALL Resources)

**Resource Naming:** Always use `${var.name_prefix}` for names (prevents collisions, identifies environment)

```hcl
locals {
  bucket_name = "${var.name_prefix}-app"
  lambda_name = "${var.name_prefix}-function"
}
```

**IAM Policies:** ALWAYS use ALLOW policies. NEVER create DENY policies. (More predictable, easier to debug)

```hcl
resource "aws_iam_role_policy" "example" {
  name = "${var.name_prefix}-policy"
  role = aws_iam_role.example.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = ["..."], Resource = "..." }]
  })
}
```

**Secrets Management:** SSM parameters with lifecycle ignore (keeps secrets out of state)

```hcl
resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.name_prefix}/database-url"
  type  = "SecureString"
  value = "placeholder-set-manually-after-deploy"
  lifecycle { ignore_changes = [value] }
  tags = local.common_tags
}
```

User sets actual values after deploy: `aws ssm put-parameter --name "/project-staging/database-url" --value "postgresql://..." --type "SecureString" --profile pharmer --overwrite`

**Common Tags:** Define once in `main.tf`, apply to every resource (cost tracking, resource management)

```hcl
locals {
  common_tags = { ManagedBy = "terraform", Environment = var.env, Project = var.repo_name }
}
resource "aws_s3_bucket" "example" {
  tags = local.common_tags
}
```

**File Organization:** One `.tf` file per AWS service (easy to find, reduces merge conflicts)

- `main.tf` - Provider, data sources, locals, SSM params
- `variables.tf` / `outputs.tf` - All inputs/outputs
- `s3.tf`, `lambda.tf`, `ecs.tf`, etc. - Service-specific resources

Within each service file:

```terraform
########################################################################################################################
# SERVICE NAME
########################################################################################################################
# IAM roles/policies → Main resources → CloudWatch logs (apply common_tags to everything)
```

---

## Step 7: Create Variables and Outputs

### Variables File Pattern

**File:** `modules/stack/variables.tf`

**Instructions:** Include core variables (always needed) plus service-specific variables.

```hcl
# Core variables (passed from root)
variable "env" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.env)
    error_message = "Must be staging or production"
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for all resource names"
  type        = string
}

# Service-specific variables
variable "lambda_function_zip" {
  description = "Path to Lambda deployment package"
  type        = string
}
```

### Outputs File Pattern

**File:** `modules/stack/outputs.tf`

**Instructions:** Export values the application will need (bucket names, ARNs, URLs, etc.):

```hcl
output "bucket_name" {
  description = "Name of S3 bucket"
  value       = aws_s3_bucket.app.id
}

output "lambda_function_arn" {
  description = "ARN of Lambda function"
  value       = aws_lambda_function.example.arn
}
```

---

## Step 8: Implement Services

### Shared Resources (`modules/shared/`)

**When to create:** User needs Route53, S3 assets, or ECR (90%+ of projects)

**IMPORTANT:** The shared module must export outputs for environment modules to consume.

#### Shared Module Provider Configuration

**File:** `modules/shared/main.tf` - Same as stack module but AWS-only (no Vercel/BunnyNet). Set `Environment = "shared"` in common_tags.

#### Route53 (`modules/shared/route53.tf`)

**Pattern:** One hosted zone per domain, subdomains differentiate environments

```hcl
########################################################################################################################
# ROUTE53
########################################################################################################################

# Import existing hosted zones (team likely already has these)
data "aws_route53_zone" "domains" {
  for_each = var.domains

  name         = each.value
  private_zone = false
}

# Staging subdomains
resource "aws_route53_record" "staging_records" {
  for_each = var.staging_dns_records

  zone_id = data.aws_route53_zone.domains[each.value.domain].zone_id
  name    = each.value.subdomain  # e.g., "app-staging"
  type    = each.value.type
  ttl     = each.value.ttl
  records = each.value.records
}

# Production subdomains
resource "aws_route53_record" "production_records" {
  for_each = var.production_dns_records

  zone_id = data.aws_route53_zone.domains[each.value.domain].zone_id
  name    = each.value.subdomain  # e.g., "app"
  type    = each.value.type
  ttl     = each.value.ttl
  records = each.value.records
}
```

**Variables:**

```hcl
variable "domains" {
  description = "Map of domain keys to domain names"
  type        = map(string)
  default     = {}
}

variable "staging_dns_records" {
  description = "DNS records for staging environment"
  type = map(object({
    domain    = string
    subdomain = string
    type      = string
    ttl       = number
    records   = list(string)
  }))
  default = {}
}

variable "production_dns_records" {
  description = "DNS records for production environment"
  type = map(object({
    domain    = string
    subdomain = string
    type      = string
    ttl       = number
    records   = list(string)
  }))
  default = {}
}
```

**Tell user:** They'll configure specific records in `live/shared/terragrunt.hcl` inputs.

#### S3 Assets (`modules/shared/s3.tf`)

**Pattern:** One bucket, path-based environment separation

```hcl
resource "aws_s3_bucket" "assets" {
  count  = var.enable_assets_bucket ? 1 : 0
  bucket = "${var.repo_name}-assets"
  tags   = local.common_tags
}

resource "aws_s3_bucket_versioning" "assets" {
  # ... (enable versioning)
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  # ... (cleanup staging/ prefix after 30 days)
}

resource "aws_s3_bucket_public_access_block" "assets" {
  # ... (block all public access)
}
```

**Key Points:**

- Staging: `s3://bucket/staging/*` | Production: `s3://bucket/production/*`
- Staging files auto-delete after 30 days | Public access blocked
- Variable: `enable_assets_bucket` (bool, default false)

#### ECR (`modules/shared/ecr.tf`)

**Pattern:** One repo per image type, tags differentiate environments

```hcl
resource "aws_ecr_repository" "repos" {
  for_each             = var.ecr_repositories
  name                 = "${var.repo_name}-${each.key}"
  image_tag_mutability = "MUTABLE"
  # ... (scan_on_push = true, tags)
}

resource "aws_ecr_lifecycle_policy" "repos" {
  # ... (keep last 10 staging images with prefix "staging")
  # ... (keep last 10 production images with prefix "v", "prod")
}
```

**Key Points:**

- Tag convention: Staging `v1.0-staging`, `latest-staging` | Production `v1.0`, `latest`, `prod-v1.0`
- Lifecycle: Keep last 10 images per environment
- Variable: `ecr_repositories` (set(string), default [])

#### Shared Outputs (`modules/shared/outputs.tf`)

**CRITICAL:** Environment modules depend on these outputs.

```hcl
output "assets_bucket_name" {
  description = "Name of shared S3 assets bucket"
  value       = var.enable_assets_bucket ? aws_s3_bucket.assets[0].id : null
}

output "route53_zone_ids" {
  description = "Map of domain names to hosted zone IDs"
  value = {
    for k, v in data.aws_route53_zone.domains : k => v.zone_id
  }
}

output "ecr_repository_urls" {
  description = "Map of ECR repository URLs"
  value = {
    for k, v in aws_ecr_repository.repos : k => v.repository_url
  }
}
```

---

### Environment-Specific Services

Create `.tf` files in `modules/stack/` for services user requested:

| Service                                 | When to Create                                   | Key Pattern                                                                                                                                                         | Ask User                       |
| --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **S3 Buckets** (`s3.tf`)                | Environment-specific storage (NOT shared assets) | Bucket name: `${var.name_prefix}-<purpose>`, versioning, lifecycle rules, block public access                                                                       | Storage purpose                |
| **Lambda** (`lambda.tf`)                | Serverless functions                             | Shared IAM role, SSM GetParameter access, env vars reference SSM, CloudWatch logs (7-day retention)                                                                 | Path to deployment package     |
| **ECS/Fargate** (`ecs.tf`)              | Containerized applications                       | Container insights, `awsvpc` mode, separate execution/task roles, SSM secrets, CloudWatch logs. Use existing shared VPCs: `staging-shared-vpc` or `prod-shared-vpc` | CPU/memory, image location     |
| **RDS** (`rds.tf`)                      | Databases (per-environment isolation required)   | Use existing shared VPCs: `staging-shared-vpc` or `prod-shared-vpc`. Import VPC with data source, reference subnet groups and security groups                       | Database engine, instance size |
| **ECR** (`ecr.tf`)                      | Environment-specific repos (rare)                | One repo per image, lifecycle cleanup, mutable tags                                                                                                                 | Why not use shared ECR?        |
| **Step Functions** (`stepfunctions.tf`) | Workflow orchestration                           | State machine definition as variable, IAM role with service permissions, CloudWatch logs, use variables for ARNs                                                    | Workflow requirements          |

**Notes:**

- For shared assets, use shared S3 bucket (see Shared Resources)
- Most projects use shared ECR - only create environment-specific if isolation required
- **NEVER create VPCs per-project** - use existing shared VPCs (`staging-shared-vpc`, `prod-shared-vpc`) for RDS, ECS, or EC2
- Import shared VPCs with `data "aws_vpc"` and reference their subnet groups and security groups

### Vercel OIDC (`vercel-oidc.tf`)

**When to create:** User deploys to Vercel and needs AWS access

**Pattern:** The structure is standard - only customization needed is project name and permissions.

**Standard OIDC configuration:**

```hcl
# Use existing OIDC provider (team-shared)
data "aws_iam_openid_connect_provider" "vercel" {
  count = var.enable_vercel_integration ? 1 : 0
  url   = "https://oidc.vercel.com/${var.vercel_team_slug}"
}

# IAM role with standard trust policy
resource "aws_iam_role" "vercel" {
  count = var.enable_vercel_integration ? 1 : 0
  name  = "${var.name_prefix}-vercel-integration"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = data.aws_iam_openid_connect_provider.vercel[0].arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "oidc.vercel.com/${var.vercel_team_slug}:aud" = "https://vercel.com/${var.vercel_team_slug}"
        }
        StringLike = {
          "oidc.vercel.com/${var.vercel_team_slug}:sub" = [
            for env in var.vercel_allowed_environments :
            "owner:${var.vercel_team_slug}:project:${var.vercel_project_name}:environment:${env}"
          ]
        }
      }
    }]
  })
  tags = local.common_tags
}
```

**Permissions (customize based on what Vercel needs to access):**

Most commonly, Vercel needs to start Step Functions executions:

```hcl
resource "aws_iam_role_policy" "vercel" {
  count = var.enable_vercel_integration ? 1 : 0
  name  = "vercel-permissions"
  role  = aws_iam_role.vercel[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["states:StartExecution"]
        Resource = aws_sfn_state_machine.pipeline.arn
      },
      {
        Effect   = "Allow"
        Action   = ["states:DescribeExecution", "states:GetExecutionHistory"]
        Resource = "arn:aws:states:${var.aws_region}:${local.account_id}:execution:${local.state_machine_name}:*"
      }
    ]
  })
}
```

**Ask user:**

- Vercel team slug (usually same for all projects)
- Vercel project name
- Which environments to allow (production, preview, development)?
- What AWS services does Vercel need to access? (Step Functions, S3, etc.)

**Tell user:**

- The OIDC provider already exists for the team
- They'll need to add `AWS_ROLE_ARN` env var in Vercel (or use vercel-env-vars.tf)
- This enables passwordless AWS access from Vercel deployments

### Vercel Environment Variables (`vercel-env-vars.tf`)

**When to create:** User wants Terraform to manage Vercel env vars

**🚨 CRITICAL - Vercel Sensitive Flag:**

- Vercel's `sensitive` flag ONLY hides values in UI - it's NOT real security
- If marked sensitive, users CANNOT edit in dashboard (problem: Terraform creates placeholders)
- **SOLUTION: ALL Vercel resources must have `sensitive = false` hardcoded**
- Real security: `lifecycle { ignore_changes = [value] }` + Vercel platform security

**Ask about deployment model:**

1. "Production from main branch? Staging from staging branch?"
2. "Use Vercel preview deployments for PRs?"

**Variable Categories:**

**1. TF-Managed (auto-update from Terraform):**
Based on Step 2.5 services: `AWS_REGION`, `AWS_ROLE_ARN`, `S3_BUCKET_NAME`, `LAMBDA_FUNCTION_ARN`, `STATE_MACHINE_ARN`, `CDN_URL`, `ECR_REPOSITORY_URL`

**2. Manual (placeholders with lifecycle ignore):**
Security credentials user sets in Vercel: `DATABASE_URL`, `STRIPE_SECRET_KEY`, etc.

- Ask: "What secrets/credentials does your app need? Provide exact env var names + descriptions."

**File Structure:**

```hcl
########################################################################################################################
# VERCEL PROVIDER SETUP
########################################################################################################################
data "aws_secretsmanager_secret" "vercel_secret" {
  count = var.enable_vercel_integration ? 1 : 0
  name  = "shared/vercel"
}

data "aws_secretsmanager_secret_version" "vercel_secret_version" {
  count     = var.enable_vercel_integration ? 1 : 0
  secret_id = data.aws_secretsmanager_secret.vercel_secret[0].id
}

locals {
  vercel_api_token = var.enable_vercel_integration ? jsondecode(data.aws_secretsmanager_secret_version.vercel_secret_version[0].secret_string)["tf_token_adpharm_exp_apr_2026"] : ""
}

provider "vercel" {
  api_token = local.vercel_api_token
  team      = var.vercel_team_slug
}

########################################################################################################################
# ENVIRONMENT VARIABLES DEFINITION
########################################################################################################################
locals {
  # Auto-determined TF-managed vars (from Step 2.5 services)
  tf_managed_vars_base = merge(
    var.enable_vercel_integration ? {
      AWS_REGION   = { value = var.aws_region, comment = "AWS region - Managed by Terraform", tf_managed = true }
      AWS_ROLE_ARN = { value = aws_iam_role.vercel[0].arn, comment = "IAM role - Managed by Terraform", tf_managed = true }
    } : {},
    # Add: S3_BUCKET_NAME, LAMBDA_FUNCTION_ARN, STATE_MACHINE_ARN, CDN_URL based on enabled services
  )

  # User-specified manual secrets
  manual_vars_base = {
    DATABASE_URL = { value = "MANUALLY_SET_IN_VERCEL", comment = "PostgreSQL - Set manually", tf_managed = false }
    # Add more based on user's secrets requirements
  }

  common_env_vars_base = merge(local.tf_managed_vars_base, local.manual_vars_base)
  tf_managed_vars = { for k, v in local.common_env_vars_base : k => v if v.tf_managed }
  manual_vars     = { for k, v in local.common_env_vars_base : k => v if !v.tf_managed }
}

########################################################################################################################
# PRODUCTION ENVIRONMENT
########################################################################################################################
resource "vercel_project_environment_variable" "production_tf_managed" {
  for_each   = var.env == "production" && var.enable_vercel_integration ? local.tf_managed_vars : {}
  project_id = var.vercel_project_id
  key        = each.key
  value      = each.value.value
  target     = ["production"]
  comment    = lookup(each.value, "comment", null)
  sensitive  = false  # Must be false - users need to edit placeholders
}

resource "vercel_project_environment_variable" "production_manual" {
  for_each   = var.env == "production" && var.enable_vercel_integration ? local.manual_vars : {}
  project_id = var.vercel_project_id
  key        = each.key
  value      = each.value.value
  target     = ["production"]
  comment    = lookup(each.value, "comment", null)
  sensitive  = false
  lifecycle { ignore_changes = [value] }
}

# STAGING ENVIRONMENT (if user deploys from staging branch)
# Create vercel_custom_environment "staging" resource with REQUIRED branch_tracking:
#   branch_tracking = {
#     pattern = "staging"
#     type    = "equals"
#   }
# Create staging_tf_managed + staging_manual resources with:
#   - target = ["development"], custom_environment_ids = [vercel_custom_environment.staging[0].id]
#   - Same pattern as production but with staging custom environment

# PREVIEW ENVIRONMENT (if user uses PR preview deployments)
# Create preview_tf_managed + preview_manual resources with target = ["preview"]
# Only if var.enable_vercel_preview_env is true
```

**Key Points:**

- Production: `target = ["production"]`
- Staging: Custom environment + `target = ["development"]` (for `vercel env pull`)
- Preview: `target = ["preview"]` (only if user uses PR previews)
- ALL variables: `sensitive = false` (placeholders need editing in dashboard)
- Manual vars: Add `lifecycle { ignore_changes = [value] }`

### BunnyNet CDN (`bunny-cdn.tf`)

**When to create:** User needs CDN for S3 assets

**🚨 CRITICAL - S3 Authentication Required:**
BunnyNet requires AWS credentials to access private S3 buckets. You must create IAM resources for authentication.

**Complete Implementation Pattern:**

```hcl
########################################################################################################################
# BUNNYNET CDN
########################################################################################################################

# Get BunnyNet API token from AWS Secrets Manager
data "aws_secretsmanager_secret" "bunnynet_secret" {
  count = var.enable_bunnynet ? 1 : 0
  name  = "shared/bunnynet"
}

data "aws_secretsmanager_secret_version" "bunnynet_secret_version" {
  count     = var.enable_bunnynet ? 1 : 0
  secret_id = data.aws_secretsmanager_secret.bunnynet_secret[0].id
}

locals {
  bunnynet_api_token = var.enable_bunnynet ? jsondecode(data.aws_secretsmanager_secret_version.bunnynet_secret_version[0].secret_string)["bunny_api_key"] : ""
  bunny_user_name    = "${var.name_prefix}-bunnynet-user"
  bunny_policy_name  = "${var.name_prefix}-bunnynet-policy"
  pullzone_name      = "${var.name_prefix}-cdn"
}

# Configure the BunnyNet Provider
provider "bunnynet" {
  api_key = local.bunnynet_api_token
}

########################################################################################################################
# IAM RESOURCES FOR BUNNYNET S3 ACCESS
########################################################################################################################

# Create an IAM user that BunnyNet can use to access the S3 bucket
resource "aws_iam_user" "bunnynet" {
  count = var.enable_bunnynet ? 1 : 0
  name  = local.bunny_user_name
  tags  = local.common_tags
}

# Create an IAM policy that allows read access to the S3 bucket
resource "aws_iam_policy" "bunnynet" {
  count       = var.enable_bunnynet ? 1 : 0
  name        = local.bunny_policy_name
  description = "Policy to allow ${local.bunny_user_name} to access S3 bucket"
  tags        = local.common_tags

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = ["s3:ListBucket"]
        Effect   = "Allow"
        Resource = [var.s3_bucket_arn]
        Condition = length(var.bunnynet_allowed_prefixes) > 0 ? {
          StringLike = {
            "s3:prefix" = var.bunnynet_allowed_prefixes
          }
        } : null
      },
      {
        Action = ["s3:GetObject"]
        Effect = "Allow"
        Resource = length(var.bunnynet_allowed_prefixes) > 0 ? [
          for prefix in var.bunnynet_allowed_prefixes : "${var.s3_bucket_arn}/${prefix}*"
        ] : ["${var.s3_bucket_arn}/*"]
      }
    ]
  })
}

# Attach the policy to the IAM user
resource "aws_iam_user_policy_attachment" "bunnynet" {
  count      = var.enable_bunnynet ? 1 : 0
  user       = aws_iam_user.bunnynet[0].name
  policy_arn = aws_iam_policy.bunnynet[0].arn
}

# Create an access key for the IAM user
resource "aws_iam_access_key" "bunnynet" {
  count = var.enable_bunnynet ? 1 : 0
  user  = aws_iam_user.bunnynet[0].name
}

########################################################################################################################
# BUNNYNET CDN RESOURCES
########################################################################################################################

# Create the pull zone for the S3 bucket
resource "bunnynet_pullzone" "cdn" {
  count = var.enable_bunnynet ? 1 : 0
  name  = local.pullzone_name

  origin {
    type = "OriginUrl"
    url  = "https://${var.s3_bucket_name}.s3.${var.aws_region}.amazonaws.com"
  }

  routing {
    tier  = "Standard"
    zones = var.bunnynet_routing_zones
  }

  # Cache settings
  cache_enabled         = true
  cache_expiration_time = var.bunnynet_cache_expiration

  # S3 authentication (CRITICAL - required for private buckets)
  s3_auth_enabled = true
  s3_auth_key     = aws_iam_access_key.bunnynet[0].id
  s3_auth_secret  = aws_iam_access_key.bunnynet[0].secret
  s3_auth_region  = var.aws_region

  # Additional settings
  originshield_enabled = false
  optimizer_enabled    = false

  depends_on = [
    aws_iam_user_policy_attachment.bunnynet,
    aws_iam_access_key.bunnynet
  ]
}
```

**Variables Needed:**

```hcl
variable "enable_bunnynet" {
  description = "Enable BunnyNet CDN"
  type        = bool
  default     = false
}

variable "s3_bucket_name" {
  description = "S3 bucket name for CDN origin"
  type        = string
  default     = ""
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN for IAM policy"
  type        = string
  default     = ""
}

variable "bunnynet_allowed_prefixes" {
  description = "S3 prefixes BunnyNet can access (empty = all)"
  type        = list(string)
  default     = []
}

variable "bunnynet_cache_expiration" {
  description = "Cache expiration time in seconds"
  type        = number
  default     = 3600
}

variable "bunnynet_routing_zones" {
  description = "BunnyNet routing zones"
  type        = list(string)
  default     = ["US", "EU"]
}
```

**Outputs:**

```hcl
output "cdn_url" {
  description = "BunnyNet CDN URL"
  value       = var.enable_bunnynet ? "https://${bunnynet_pullzone.cdn[0].name}.b-cdn.net" : null
}

output "cdn_pullzone_id" {
  description = "BunnyNet pull zone ID"
  value       = var.enable_bunnynet ? bunnynet_pullzone.cdn[0].id : null
}
```

**Key Architecture Points:**

1. **IAM User Authentication**: BunnyNet uses dedicated IAM user (not role) with access keys
2. **Prefix-Based Access Control**: Restrict to specific paths with `bunnynet_allowed_prefixes`
   - Empty list = full bucket access
   - `["public/", "assets/"]` = only those prefixes
3. **S3 Auth Settings**: Must set all three: `s3_auth_enabled`, `s3_auth_key`, `s3_auth_secret`, `s3_auth_region`
4. **Origin URL**: Direct S3 endpoint (`https://bucket.s3.region.amazonaws.com`)

**Ask user:**

1. Which S3 bucket should the CDN serve? (provide bucket name from S3 or shared outputs)
2. Restrict access to specific prefixes? (e.g., `["public/"]` or `[]` for all)
3. Cache expiration time? (default: 3600 seconds / 1 hour)
4. Routing zones? (default: `["US", "EU"]`)

**Common Patterns:**

- **Environment-specific bucket**: Use bucket from `s3.tf` in same module
- **Shared assets bucket**: Pass `dependency.shared.outputs.assets_bucket_name` and ARN
- **Prefix pattern for shared**: `["${var.env}/"]` (staging = `/staging/*`, production = `/production/*`)

### Route53 DNS (`route53.tf`)

**When to create:** User needs to manage DNS records

**🚨 CRITICAL - Hosted Zones vs Records:**
A **hosted zone** is the ROOT DOMAIN (e.g., `example.com`), NOT subdomains.

- ✅ Hosted zone: `example.com`
- ❌ NOT a hosted zone: `api.example.com` (this is a record)

**Ask user:**

1. What ROOT DOMAIN(S) do you need? (e.g., example.com)
2. Do these zones already exist in Route53? (if yes: import_existing = true)
3. What DNS records to create? (e.g., api.example.com, app.example.com)

**Pattern:** See Route53 implementation in Shared Resources section above. Key differences for environment-specific:

- Import zones with `data "aws_route53_zone"` if `import_existing = true`
- Create new zones with `resource "aws_route53_zone"` if `import_existing = false`
- Use locals for reusable CNAME values (Vercel endpoints): `vercel_cname_values = { "app" = "abc123.vercel-dns.com" }`
- Record names relative to domain: `"app"` → `app.example.com`, `"@"` → `example.com`
- Support A, CNAME, MX, TXT records via flexible `domains` variable

---

## Step 9: Guide Deployment

### Optional: Add Taskfile Commands

**If project has a Taskfile (most likely), add these convenience tasks:**

```yaml
# Apply shared infrastructure first
tfapply-shared:
  desc: Apply shared infrastructure
  internal: true
  interactive: true
  deps:
    - check-aws-identity
  dir: infra/live/shared
  cmds:
    - terragrunt apply {{.CLI_ARGS}}

# `terragrunt apply`
tfapply:
  desc: Run Terragrunt apply (use ENV=staging or ENV=production)
  interactive: true
  deps:
    - tfapply-shared
  vars:
    ENV: '{{default "staging" .ENV}}'
  dir: infra/live/{{.ENV}}
  cmds:
    - terragrunt apply {{.CLI_ARGS}}

# `terragrunt plan`
tfplan:
  desc: Run Terragrunt plan (use ENV=staging or ENV=production)
  vars:
    ENV: '{{default "staging" .ENV}}'
  dir: infra/live/{{.ENV}}
  cmds:
    - terragrunt plan {{.CLI_ARGS}}
```

**Usage:** `task tfapply ENV=staging` or `task tfplan ENV=production`

### Initial Deployment

**1. Verify AWS access:**

```bash
task check-aws-identity  # If not logged in: task login
```

**2. Deploy shared infrastructure (if applicable):**

```bash
cd infra/live/shared
terragrunt plan && terragrunt apply  # Route53, S3 assets, ECR
# OR: task tfapply-shared
```

Explain: Shared deploys first so environments can read its outputs.

**3. Deploy staging:**

```bash
cd infra/live/staging
terragrunt plan && terragrunt apply
# OR: task tfapply ENV=staging
```

**4. Set secrets manually:**

```bash
aws ssm put-parameter --name "/<name_prefix>/database-url" --value "postgresql://..." --type "SecureString" --profile pharmer --overwrite
```

### Making Updates

```bash
cd infra/live/staging && terragrunt plan && terragrunt apply
# OR: task tfapply ENV=staging
```

### Adding Production

```bash
cp -r live/staging live/production
# Edit live/production/terragrunt.hcl: env="production", name_prefix="project-prod", increase sizing
# If DNS changes: Update live/shared/terragrunt.hcl first, apply shared, then production
cd live/production && terragrunt plan && terragrunt apply
# OR: task tfapply ENV=production
```

Explain: Production shares Route53/S3/ECR with staging (differentiated by subdomains/paths/tags).

---

## Critical Rules to Follow

**Never do these:**

1. ❌ Don't create DENY IAM policies (always ALLOW)
2. ❌ Don't ask user to create AWS profile (use `pharmer`)
3. ❌ Don't ask user to create S3 state bucket (already exists)
4. ❌ Don't ask user to create Secrets Manager entries (already exist)
5. ❌ Don't ask user to create Vercel OIDC provider (already exists)
6. ❌ Don't ask user to create VPCs (use existing `staging-shared-vpc` and `prod-shared-vpc`)
7. ❌ Don't hardcode secrets in Terraform files
8. ❌ Don't modify provider versions without team approval
9. ❌ Don't add `provider "vercel" {}` or `provider "bunnynet" {}` blocks to main.tf (causes duplicate provider errors)
10. ❌ Don't include `sensitive` field in local variable definitions
11. ❌ Don't use subdomains as Route53 domain keys (use root domain only: example.com not api.example.com)
12. ❌ Don't put Lambda, ECS, databases, or Step Functions in shared module (environment-isolated only)
13. ❌ Don't create BunnyNet CDN without S3 authentication (IAM user + access keys required)

**Always do these:**

1. ✅ Use exact provider versions specified in Step 6
2. ✅ Declare providers in `required_providers` in main.tf, configure them in their service files
3. ✅ Use `${var.name_prefix}` for all resource names
4. ✅ Apply `local.common_tags` to every resource
5. ✅ Use SSM parameters with `lifecycle { ignore_changes = [value] }` for secrets
6. ✅ One `.tf` file per AWS service
7. ✅ Add validation blocks to critical variables
8. ✅ Use `task` commands instead of raw AWS CLI
9. ✅ Use Step 2.5 auto-generated env var names - don't ask user to name TF-managed vars
10. ✅ Ask about Vercel deployment model (production/staging/preview)
11. ✅ Only ask user for security credentials/secrets (DATABASE_URL, API keys, etc.)
12. ✅ Don't include `sensitive` field in local variable definitions
13. ✅ Hardcode `sensitive = false` in ALL Vercel resources (users need to edit placeholders in dashboard)
14. ✅ Add `comment` field to all Vercel variables for documentation
15. ✅ For Route53, use ROOT DOMAIN as domain key (example.com), create subdomains as records within it
16. ✅ Use shared module for Route53, S3 assets, ECR (team standard - 90%+ of projects)
17. ✅ Keep compute and data environment-isolated (Lambda, ECS, databases in stack module)
18. ✅ Deploy in order: shared → staging → production
19. ✅ Use path prefixes for shared S3 (`/staging/*` vs `/production/*`)
20. ✅ Use tags for shared ECR (`v1-staging` vs `v1-production`)
21. ✅ Shared module outputs must be consumed via Terragrunt `dependency` blocks
22. ✅ Use mock_outputs in dependency blocks to allow planning before shared is deployed
23. ✅ Include complete S3 authentication for BunnyNet (IAM user, policy, access key, s3*auth*\* settings)
24. ✅ Use existing shared VPCs (`staging-shared-vpc`, `prod-shared-vpc`) for RDS, ECS, EC2 - import with data sources

---

## How to Help the User

**Workflow:**

1. **Gather requirements** - Ask, don't assume
2. **Explain structure** - Show shared + environment architecture
3. **Create files** - Step by step
4. **Verify before showing:**
   - Shared: Route53, S3 assets, ECR (if needed) + proper outputs.tf
   - Stack: Lambda, ECS, databases, Step Functions (environment-isolated)
   - Environment configs: Use `dependency` block to consume shared outputs
   - TF-managed env vars: Standard names from Step 2.5 (AWS_ROLE_ARN, S3_BUCKET_NAME, etc.)
   - Vercel: ALL resources `sensitive = false` hardcoded, comment field on all vars
   - Providers: Declared in main.tf `required_providers`, configured in service files (NO `provider "vercel/bunnynet" {}` blocks in main.tf)
   - Route53: Domain keys use ROOT DOMAIN only (example.com, not api.example.com)
   - BunnyNet: IAM user + policy + access key + all s3*auth*\* settings configured
5. **Explain patterns** - Why we do this (cost, consistency)
6. **Guide deployment** - Shared → staging → production
7. **Set secrets** - Help configure SSM parameters

**Communication:** Concise, explain "why", use project examples, reference team constants (pharmer, ca-central-1)

**If violates patterns:** Politely explain team standard + why it exists
