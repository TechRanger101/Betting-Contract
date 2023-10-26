import { utils } from 'ethers'
import { exec } from 'node:child_process'
import Chance from 'chance'
import forge from 'node-forge'
import { os2ip } from './cryptoUtils'

const MAX_ETH_UINT_256 = 2 ** 256 - 1

const { keccak256 } = utils

export interface IFareVRFOptions {
  seed?: string
  mod?: number
}

export async function generatePrivateKey(): Promise<string> {
  return new Promise((resolve, reject) => {
    exec('openssl rand -hex 32', (error, stdout, stderr) => {
      if (error) reject(error)
      if (stderr) reject(stderr)
      resolve(`0x${stdout.trim()}`)
    })
  })
}

export type CommitRevealData = {
  hash: string
  salt: string
  randomNum: number
}

export const chance = new Chance()
export const abiCoder = new utils.AbiCoder()

/* VRF Standard IETF: https://datatracker.ietf.org/doc/draft-irtf-cfrg-vrf/ */
export class FareRandomness {
  async getRandomBytes(bytes = 32, seed?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      forge.random.getBytes(bytes, (err, randomBytes) => {
        if (err) return reject(err)
        ;(forge.random as any).collect(randomBytes)
        if (seed) {
          ;(forge.random as any).collect(seed)
        }
        resolve(randomBytes)
      })
    })
  }

  async generateSalt() {
    const salt = await generatePrivateKey()

    return salt
  }

  async generateHash(salt: string, randomNum: string) {
    const encodedRandomNum = abiCoder.encode(['string', 'string'], [salt, randomNum])
    const keccakRandomNum = keccak256(encodedRandomNum)
    return keccakRandomNum
  }

  bytesToHex(byteStr: string) {
    return forge.util.bytesToHex(byteStr)
  }

  async generateRandomness() {
    const bytes = 256
    const randomBytes = await this.getRandomBytes(bytes)
    const randomBytesHex = this.bytesToHex(randomBytes)
    const sha256Md = forge.md.sha256.create()
    sha256Md.update(randomBytesHex, 'utf8')
    const fullRandomNumber =
      os2ip(Buffer.from(sha256Md.digest().toHex())) % BigInt(MAX_ETH_UINT_256)
    const randomNum = fullRandomNumber % BigInt(100)

    return {
      randomBytesHex,
      randomBytes,
      // randomSeed,
      fullRandomNumber,
      randomNum,
    }
  }
}

const fareRandomness = new FareRandomness()
// const randomNum = await fareRandomness.generateRandomness()
// const salt = await fareRandomness.generateSalt()
// const hash = await fareRandomness.generateHash(salt, randomNum.toString())
// console.log(randomNum)
// console.log(hash)
// console.log(salt)

export default fareRandomness
