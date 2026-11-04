#!/bin/bash
# Deploys the image tag from SSM (or the tag passed as $1, e.g. for rollback) on this instance.
set -euo pipefail
cd /opt/notes-app
P=/notes-app/prod
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
export AWS_REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/region)
export AWS_DEFAULT_REGION="$AWS_REGION"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export REGISTRY="$ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com"
get() { aws ssm get-parameter --with-decryption --name "$P/$1" --query Parameter.Value --output text; }
export IMAGE_TAG="${1:-$(get IMAGE_TAG)}"

umask 077
printf 'NODE_ENV=production\nPORT=5000\nAPP_VERSION=%s\nMONGODB_URI=%s\nJWT_SECRET=%s\n' \
  "$IMAGE_TAG" "$(get MONGO_URI)" "$(get JWT_SECRET)" > .env.runtime

aws ecr get-login-password | docker login --username AWS --password-stdin "$REGISTRY"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans

for i in $(seq 1 30); do curl -fs http://localhost/api/health >/dev/null && break; sleep 2; done
curl -fs http://localhost/api/health >/dev/null || { echo "HEALTH CHECK FAILED for $IMAGE_TAG"; exit 1; }
echo "$IMAGE_TAG" > CURRENT_TAG
docker image prune -af --filter "until=24h" || true
