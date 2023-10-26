SERVER_CRYPTO_TYPE_PATH="../../fareplay-backend/crypto/types/typechain"

rm -rf $SERVER_CRYPTO_TYPE_PATH
echo "\033[33mCleared typechain types from server"
npx hardhat compile
echo "Compiled smart contracts and generated artifacts"
npm run export:abis
echo "Generated abi json files"
pnpm typechain --target ethers-v5 --out-dir $SERVER_CRYPTO_TYPE_PATH --discriminate-types true './abis/*.json'
echo "Server types generated successfully -> fareplay-backend/crypto/types/typechain/**/*.ts"
