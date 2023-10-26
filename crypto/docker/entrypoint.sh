#!/bin/sh

cd /usr/src/app

set -e

npm install -g solc

# npx hardhat compile
npx hardhat --show-stack-traces --verbose compile

npm run deploy:localchain

node docker/healthcheck.js

