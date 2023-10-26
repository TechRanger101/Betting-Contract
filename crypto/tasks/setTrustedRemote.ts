import getDeploymentAddresses from '../test/utils/readStatic'
import L0ChainIds from '../scripts/constants/L0ChainIds'

export default async function (taskArgs: any, hre: any) {
  const { ethers } = hre
  let localContract, remoteContract

  if (taskArgs.contract) {
    localContract = taskArgs.contract
    remoteContract = taskArgs.contract
  } else {
    localContract = taskArgs.localContract
    remoteContract = taskArgs.remoteContract
  }

  if (!localContract || !remoteContract) {
    console.log(
      'Must pass in contract name OR pass in both localContract name and remoteContract name'
    )
    return
  }

  const targetNetwork = taskArgs as keyof typeof L0ChainIds

  // get local contract
  const localContractInstance = await ethers.getContract(localContract)

  // get deployed remote contract address
  const remoteAddress = getDeploymentAddresses(targetNetwork)[remoteContract]

  // get remote chain id
  const remoteChainId = L0ChainIds[targetNetwork]

  // concat remote and local address
  let remoteAndLocal = hre.ethers.utils.solidityPack(
    ['address', 'address'],
    [remoteAddress, localContractInstance.address]
  )

  // check if pathway is already set
  const isTrustedRemoteSet = await localContractInstance.isTrustedRemote(
    remoteChainId,
    remoteAndLocal
  )

  if (!isTrustedRemoteSet) {
    try {
      let tx = await (
        await localContractInstance.setTrustedRemote(remoteChainId, remoteAndLocal)
      ).wait()
      console.log(`✅ [${hre.network.name}] setTrustedRemote(${remoteChainId}, ${remoteAndLocal})`)
      console.log(` tx: ${tx.transactionHash}`)
    } catch (e: any) {
      if (e.error.message.includes('The chainId + address is already trusted')) {
        console.log('*source already set*')
      } else {
        console.log(
          `❌ [${hre.network.name}] setTrustedRemote(${remoteChainId}, ${remoteAndLocal})`
        )
      }
    }
  } else {
    console.log('*source already set*')
  }
}
