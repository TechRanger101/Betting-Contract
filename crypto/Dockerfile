FROM node:16-alpine as base

RUN npm install -g pnpm

COPY . ./usr/src/app
WORKDIR /usr/src/app
RUN apk add git;
RUN pnpm install --frozen-lockfile
COPY $PWD/docker/entrypoint.sh /usr/local/bin

EXPOSE 50521

ENTRYPOINT [ "/bin/sh", "/usr/local/bin/entrypoint.sh" ]
