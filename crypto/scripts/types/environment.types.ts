import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export interface IChainData {
  [key: string]: {
    chainId: number
    currency: string
  }
}

export interface IDeployer {
  deployer: SignerWithAddress
  balance: string
  networkCurrency: string
}
