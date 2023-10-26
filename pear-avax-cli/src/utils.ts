import fs from 'fs'
import path from 'path'
import util from 'util'
import { exec as execute, spawn as spn } from 'child_process'
import emoji from 'node-emoji'

import { avaxNodeRepoPath, avaxRunnerRepoPath } from './constants'

export function reposExist(): { hasNode: boolean; hasRunner: boolean } {
	const hasNode = fs.existsSync(avaxNodeRepoPath)
	const hasRunner = fs.existsSync(avaxRunnerRepoPath)

	return {
		hasNode,
		hasRunner,
	}
}

export const emojiCheck = emoji.get('white_check_mark')

export const __dirname = path.resolve()

export const log = console.log

export const exec = util.promisify(execute)

export const spawn = util.promisify(spn)

export async function terminateExistingProcesses() {
	const { stdout = '' } = await exec('pgrep avalanche-network-runner')
	const runnerPID = Number(stdout.replace(/(\r\n|\n|\r)/gm, ''))
	if (runnerPID > 0) {
		process.kill(runnerPID, 'SIGTERM')
	}
}

process.on('exit', () => {
	terminateExistingProcesses()
})

process.on('SIGINT', () => {
	terminateExistingProcesses()
})

export const createLogStream = async function (fileName: string, pathName?: string) {
	const logDir = path.join(__dirname, pathName || '/logs/subnet')
	const logPath = `${logDir}/${fileName}`
	if (!fs.existsSync(logDir)) {
		await fs.promises.mkdir(logDir, { recursive: true })
	}

	return fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' })
}

export const sleep = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms))
