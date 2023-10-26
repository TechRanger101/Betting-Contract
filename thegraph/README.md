# fare-thegraph

## Get Started

### 1. Prerequisites

- Run Local Node (reference)[https://pear-labs.io/mono-projects/development]
- Install docker & docker-compose
- Run Graph Node

___How to run Graph Node___

```shell
git clone https://github.com/graphprotocol/graph-node
cd graph-node/docker
./setup.sh (Linux users only)
docker-compose up
```

___Notes___

- Require PostgreSQL (or libpq or libpq-dev) installed to run docker


### 2. Build & Deploy

```shell
yarn codegen
yarn build
yarn deploy-local
```
