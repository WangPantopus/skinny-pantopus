#!/usr/bin/env bash
set -Eeuo pipefail
: "${EC2_HOST:?}" "${EC2_USERNAME:?}" "${EC2_SSH_KEY:?}" "${EC2_KNOWN_HOSTS:?}"
: "${DOCKERHUB_USERNAME:?}" "${DOCKERHUB_TOKEN:?}" "${DEPLOY_IMAGE:?}" "${DEPLOY_TARGET:?}"
[[ "$EC2_HOST" =~ ^[a-zA-Z0-9.-]+$ && "$EC2_USERNAME" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 2
[[ "$DOCKERHUB_USERNAME" =~ ^[a-z0-9_-]+$ ]] || exit 2
[[ "$DEPLOY_TARGET" == production || "$DEPLOY_TARGET" == staging ]] || exit 2
[[ "$DEPLOY_IMAGE" =~ ^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$ ]] || exit 2
api_bind=${DEPLOY_API_BIND:-8000}
# This value enters an SSH command. Accept only a port and optional explicit
# loopback/all-interface IPv4 address; reject shell syntax before connecting.
[[ "$api_bind" =~ ^((127\.0\.0\.1|0\.0\.0\.0):)?([1-9][0-9]{0,4})$ ]] &&
  (( BASH_REMATCH[3] <= 65535 )) || { echo 'Invalid API host binding' >&2; exit 2; }
key_dir=$(mktemp -d)
trap 'rm -rf "$key_dir"' EXIT
printf '%s\n' "$EC2_SSH_KEY" > "$key_dir/key"
printf '%s\n' "$EC2_KNOWN_HOSTS" > "$key_dir/known_hosts"
chmod 600 "$key_dir/key" "$key_dir/known_hosts"
ssh_options=(-i "$key_dir/key" -o BatchMode=yes -o ConnectTimeout=20 -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$key_dir/known_hosts")
# Credentials go through stdin, never into remote command arguments or files.
printf '%s' "$DOCKERHUB_TOKEN" | ssh "${ssh_options[@]}" "$EC2_USERNAME@$EC2_HOST" \
  "docker login docker.io -u $DOCKERHUB_USERNAME --password-stdin"
ssh "${ssh_options[@]}" "$EC2_USERNAME@$EC2_HOST" \
  "bash -s -- $DEPLOY_TARGET $DEPLOY_IMAGE $api_bind" < scripts/deploy/backend.sh
