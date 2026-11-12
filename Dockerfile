# Copyright 2025 Alexey Baikov, Anton Karmanov

# Licensed under the Apache License, Version 2.0.
# See LICENSE.txt file in the project root for license information.

# This file is a part of Salt.Box system.


ARG SERVE_IMAGE=registry.saltbox.pro/saltbox/saltbox-compose/nginx:master

FROM registry.altlinux.org/alt/alt:p11 AS builder

#hadolint global ignore=DL3015,DL3008
RUN \
  --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
  <<EOF
set -e
mkdir --parents /var/cache/apt/archives/partial/ /var/lib/apt/lists/partial/
apt-get update
apt-get install -y gcc-common yarn npm
EOF

WORKDIR /root/saltbox-filebrowser-frontend/
COPY .yarnrc package.json yarn.lock ./
ARG YARN_CACHE_FOLDER=/root/.yarn/
RUN \
  --mount=type=cache,target=$YARN_CACHE_FOLDER \
  yarn install --frozen-lockfile
COPY . ./
RUN yarn build

FROM $SERVE_IMAGE
COPY --from=builder /root/saltbox-filebrowser-frontend/dist/ /srv/saltbox-filebrowser-frontend
COPY ./nginx-server.conf /etc/nginx/sites-enabled.d/saltbox.conf
