# Copyright 2025 Alexey Baikov, Anton Karmanov

# Licensed under the Apache License, Version 2.0.
# See LICENSE.txt file in the project root for license information.

# This file is a part of Salt.Box system.


ARG SERVE_IMAGE=registry.saltbox.pro/saltbox/saltbox-compose/nginx:master

FROM registry.altlinux.org/alt/alt:p11 AS builder
LABEL version='1.0'

RUN \
  --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
  <<EOF
set -e
mkdir --parents /var/cache/apt/archives/partial/ /var/lib/apt/lists/partial/
apt-get update
apt-get install -y gcc yarn npm
EOF

WORKDIR /root/saltbox-filesystem-frontend/
COPY .yarnrc package.json yarn.lock ./
ARG YARN_CACHE_FOLDER=/root/.yarn/
RUN \
  --mount=type=cache,target=$YARN_CACHE_FOLDER \
  yarn install --frozen-lockfile
COPY . ./
RUN yarn build

FROM $SERVE_IMAGE
LABEL name='saltbox-filesystem-frontend' version='1.0'
COPY --from=builder /root/saltbox-filesystem-frontend/dist/ /srv/saltbox-filesystem-frontend
COPY ./nginx-server.conf /etc/nginx/sites-enabled.d/saltbox.conf
