import axios from 'axios'
import { exec } from '../utils'

function ansiRegex({ onlyFirst = false } = {}) {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))',
	].join('|')

	return new RegExp(pattern, onlyFirst ? undefined : 'g')
}

function stripAnsi(string) {
	if (typeof string !== 'string') {
		throw new TypeError(`Expected a \`string\`, got \`${typeof string}\``)
	}

	return string.replace(ansiRegex(), '')
}

const { HOME } = process.env

export async function ping() {
	try {
		const { data } = await axios({
			method: 'POST',
			url: 'http://localhost:8081/v1/ping',
		})

		console.log(data)
	} catch (err: any) {
		console.log('Error:', err.code)
	}
}

export async function start() {
	try {
		const { child } = exec(
			`avalanche-network-runner control start --log-level warn --endpoint="0.0.0.0:8080" --avalanchego-path ${HOME}/go/src/github.com/ava-labs/avalanchego/build/avalanchego`
		)
		const { stdout, stderr } = child

		stdout.on('data', (_chunk) => {
			try {
				_chunk
					.split('\n')
					.filter((c) => c.length)
					.forEach((c) => console.log(JSON.parse(c)))
			} catch (e) {
				console.log(_chunk)
			}
		})

		stderr.on('data', (_chunk) => {
			try {
				_chunk
					.split('\n')
					.filter((c) => c.length)
					.forEach((c) => console.log(JSON.parse(c)))
			} catch (e) {
				console.log(_chunk)
			}
		})
	} catch (err: any) {
		console.log('Error', err.code)
	}
}

export async function health() {
	try {
		exec(`avalanche-network-runner control health --log-level debug --endpoint="0.0.0.0:8080"`)
	} catch (err: any) {
		console.log('Error', err.code)
	}
}

export async function endpoints() {
	try {
		const { child } = exec(
			`avalanche-network-runner control uris --log-level debug --endpoint="0.0.0.0:8080"`
		)
		const { stdout, stderr } = child

		stdout.on('data', (_chunk) => {
			try {
				_chunk
					.split('\n')
					.filter((c) => c.length)
					.forEach((c) => console.log(JSON.parse(c)))
			} catch (e) {
				console.log(_chunk)
			}
		})

		stderr.on('data', (_chunk) => {
			try {
				_chunk
					.split('\n')
					.filter((c) => c.length)
					.forEach((c) => console.log(JSON.parse(c)))
			} catch (e) {
				console.log(_chunk)
			}
		})
	} catch (err: any) {
		console.log('Error', err.code)
	}
}

export async function clusterStatus() {
	try {
		const { child } = exec(
			`avalanche-network-runner control status --log-level debug --endpoint="0.0.0.0:8080"`
		)
		const { stdout, stderr } = child

		stdout.on('data', (_chunk) => {
			console.log(stripAnsi(_chunk))
		})

		stderr.on('data', (_chunk) => {
			console.log(stripAnsi(_chunk))
		})
	} catch (err: any) {
		console.log('Error', err.code)
	}
}

export async function stop() {
	try {
		const { child } = exec(
			`avalanche-network-runner control stop --log-level debug --endpoint="0.0.0.0:8080"`
		)
		const { stdout, stderr } = child

		stdout.on('data', (_chunk) => {
			console.log(stripAnsi(_chunk))
		})

		stderr.on('data', (_chunk) => {
			console.log(stripAnsi(_chunk))
		})
	} catch (err: any) {
		console.log('Error', err.code)
	}
}
