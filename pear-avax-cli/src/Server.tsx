import React, { FC, useCallback, useEffect, useState } from 'react'
import { Text, Box } from 'ink'
import TextInput from 'ink-text-input'
import { spawn } from 'child_process'

import { createLogStream, terminateExistingProcesses } from './utils'
import { ping, start, stop, health, endpoints, clusterStatus } from './lib/avaxApi'
import { IServerOptions } from './Entry'

const success = (text) => ({
	text,
	color: 'green',
})
const error = (text) => ({
	text,
	color: 'red',
})

async function startRunnerServer(out, options: IServerOptions) {
	const { logLevel, port, grpcGatewayPort, logPath } = options
	const startCmdArgs = [
		'server',
		'--log-level',
		logLevel,
		'--port',
		port,
		'--grpc-gateway-port',
		grpcGatewayPort,
	]
	const logStream = await createLogStream('server.log', logPath)
	const { stdout, stderr } = spawn('avalanche-network-runner', startCmdArgs)

	stdout.pipe(logStream)
	stderr.pipe(logStream)

	stdout.on('data', (_chunk) => {
		try {
			_chunk
				.split('\n')
				.filter((c) => c.length)
				.forEach((c) => console.log(JSON.parse(c.toString('utf8'))))
		} catch (e) {
			console.log(_chunk.toString('utf8'))
		}
	})

	stderr.on('data', (_chunk) => {
		try {
			_chunk
				.split('\n')
				.filter((c) => c.length)
				.forEach((c) => console.log(JSON.parse(c.toString('utf8'))))
		} catch (e) {
			console.log(_chunk.toString('utf8'))
		}
	})

	return new Promise((resolve, reject) => {})
}

// Hack to keep process running
setInterval(() => {}, 1 << 30)

const Server: FC<{ options: IServerOptions }> = ({ options }) => {
	const [output, setOutput] = useState([])
	const [input, setInput] = useState('')

	const op = (o) => setOutput((value) => [...value.slice(-5), o])

	useEffect(() => {
		;(async () => {
			await terminateExistingProcesses()
			await startRunnerServer(op, options)
			process.kill(0)
		})()
	}, [])

	const onSubmit = useCallback(() => {
		if (input === 'quit' || input === 'q') {
			process.kill(0)
		} else if (input === 'clear') {
			console.clear()
			setOutput([])
		} else if (input === 'ping') {
			ping()
		} else if (input === 'start') {
			start()
		} else if (input === 'stop') {
			stop()
		} else if (input === 'health') {
			health()
		} else if (input === 'endpoints') {
			endpoints()
		} else if (input === 'cluster-status') {
			clusterStatus()
		} else if (input === 'help') {
			op(
				success(`
	Server commands:
		help 		 		- shows help info
		q | quit 			- exit and kill server
		clear 				- clear out the server prompt
		start 				- starts 5 nodes runs health check
		stop 				- stops all nodes on the network
		ping 				- pings a node and returns response
		health 				- requests the nodes and returns response
		endpoints 			- returns the endpoints for all active nodes
		cluster-status      - returns the status of the cluster
	`)
			)
		} else {
			op(error(`Invalid command: ${input}`))
		}

		setInput('')
	}, [input, setInput])

	return (
		<Box flexDirection="column">
			{output.map(({ text, color }, idx) => {
				return (
					<Text key={idx} color={color}>
						{text}
					</Text>
				)
			})}
			<Box>
				<Box marginRight={1}>
					<Text>Enter your command:</Text>
				</Box>

				<TextInput value={input} onChange={setInput} onSubmit={onSubmit} />
			</Box>
		</Box>
	)
}

export default Server
