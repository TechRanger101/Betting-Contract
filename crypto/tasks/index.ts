import nodeUtil from 'util'
import { exec, spawn } from 'child_process'
import { task, types } from 'hardhat/config'
import type { BigNumber } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import numeral from 'numeral'
import setTrustedRemote from './setTrustedRemote'

const bashPromise = nodeUtil.promisify(exec)

async function execHardhatScript({
  script,
  shouldSpawn = false,
}: {
  script: string
  shouldSpawn?: boolean
}): Promise<void> {
  return new Promise((resolve) => {
    if (shouldSpawn) {
      const [_script, ...params] = script.split(' ')
      let args = ['hardhat', 'run', `scripts/${_script}`, ...params]
      const child = spawn('npx', args)
      const { stdout, stderr } = child

      stdout?.on('data', (chunk) => {
        console.log(chunk.toString('utf8'))
      })

      stderr?.on('data', (chunk) => {
        console.error(chunk.toString('utf8'))
      })

      child.on('close', () => {
        resolve()
      })
    } else {
      const bashScript = `npx hardhat run scripts/${script}`
      const { child } = bashPromise(bashScript)
      const { stdout, stderr } = child
      stdout?.on('data', (chunk) => {
        console.log(chunk.trim())
      })

      stderr?.on('data', (chunk) => {
        console.error(chunk.toString('utf8'))
      })

      child.on('exit', () => {
        resolve()
      })
    }
  })
}

task('accounts', 'Prints the list of accounts', async (_taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

task('balances', 'Prints the list of AVAX account balances', async (_args, hre): Promise<void> => {
  const accounts: SignerWithAddress[] = await hre.ethers.getSigners()
  for (const account of accounts) {
    const unformattedBalance: BigNumber = await hre.ethers.provider.getBalance(account.address)
    const balance: string = hre.ethers.utils.formatEther(unformattedBalance)

    console.log(
      `${account.address.substring(0, 12)} has balance ${numeral(balance).format('0,0.00000')}`
    )
  }
})

task('fetch', 'Fetch data for a specific smart contract')
  .addPositionalParam(
    'contract',
    'Valid options - spin, items, nft, roll(coming soon), crash(coming soon)',
    'spin',
    types.string,
    true
  )
  .setAction(async ({ contract }, { network }) => {
    if (contract === 'spin') {
      await execHardhatScript({
        script: `fetch/spin/balances.ts --network ${network.name}`,
        shouldSpawn: true,
      })
    }

    if (contract === 'items') {
      await execHardhatScript({
        script: `fetch/items/balances.ts --network ${network.name}`,
        shouldSpawn: true,
      })
    }

    if (contract === 'nft') {
      await execHardhatScript({
        script: `fetch/nft/lootTable.ts --network ${network.name}`,
        shouldSpawn: true,
      })
    }
  })

task('seed', 'Seed data for a specific smart contract')
  .addPositionalParam(
    'contract',
    'Valid options - spin, items, nft, roll(coming soon), crash(coming soon)',
    'items',
    types.string,
    true
  )
  .addOptionalPositionalParam(
    'seedType',
    'Valid options - openLootBox, lootItem, lootTable',
    'lootItem',
    types.string
  )
  .setAction(async ({ contract, seedType }, { network }) => {
    if (contract === 'items') {
      if (seedType === 'lootItem') {
        await execHardhatScript({
          script: `seed/items/lootItem.ts --network ${network.name}`,
        })
      }
    }

    if (contract === 'nft') {
      if (seedType === 'lootTable') {
        await execHardhatScript({
          script: `seed/nft/lootTable.ts --network ${network.name}`,
        })
      }

      if (seedType === 'lootBox') {
        await execHardhatScript({
          script: `seed/nft/lootBox.ts --network ${network.name}`,
        })
      }

      if (seedType === 'openLootBox') {
        await execHardhatScript({
          script: `seed/nft/openLootBox.ts --network ${network.name}`,
        })
      }
    }
  })

task(
  'setTrustedRemote',
  'setTrustedRemote(chainId, sourceAddr) to enable inbound/outbound messages with your other contracts',
  setTrustedRemote
)
  .addParam('targetNetwork', 'the target network to set as a trusted remote')
  .addOptionalParam('localContract', 'Name of local contract if the names are different')
  .addOptionalParam('remoteContract', 'Name of remote contract if the names are different')
  .addOptionalParam('contract', 'If both contracts are the same name')
