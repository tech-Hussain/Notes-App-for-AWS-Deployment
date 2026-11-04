#!/usr/bin/env bash
# Creates the production secrets in SSM Parameter Store. Skips any parameter that already exists
# unless run with --overwrite. Values are never printed and never enter git or Terraform state.
set -euo pipefail
P=/notes-app/prod
DB_IP=10.0.21.10          # fixed private IP of the MongoDB instance
OVERWRITE=""; [ "${1:-}" = "--overwrite" ] && OVERWRITE="--overwrite"
export AWS_PROFILE="${AWS_PROFILE:-notes-admin}" AWS_REGION="${AWS_REGION:-ap-southeast-2}"

ROOT_PW=$(openssl rand -hex 24)   # hex = no URL-encoding problems in the URI
APP_PW=$(openssl rand -hex 24)
JWT=$(openssl rand -hex 48)

put() {
  if [ -z "$OVERWRITE" ] && aws ssm get-parameter --name "$P/$1" >/dev/null 2>&1; then
    echo "exists, skipped $P/$1"; return
  fi
  aws ssm put-parameter --name "$P/$1" --type "$2" --value "$3" $OVERWRITE >/dev/null && echo "created $P/$1"
}
put MONGO_ROOT_USERNAME String notesroot
put MONGO_ROOT_PASSWORD SecureString "$ROOT_PW"
put MONGO_APP_USERNAME  String notesapp
put MONGO_APP_PASSWORD  SecureString "$APP_PW"
put MONGO_URI           SecureString "mongodb://notesapp:${APP_PW}@${DB_IP}:27017/notes?authSource=notes"
put JWT_SECRET          SecureString "$JWT"
put IMAGE_TAG           String bootstrap
