#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import meow from 'meow'
import Entry, { IServerOptions } from './Entry'
import { commandList, invalidCommandMsg } from './constants'

const cli = meow(
	`
	Usage: $ pear-avax-cli [command]

	Commands:
		install - Install and configure AVAX node and network runner
		update - Update AVAX node and network runner
		server - Creates a cluster of 5 AVAX nodes running locally

	Options:
		[install, update]         (default: no options)
		[server]
		--log-level string 				    (default: "info")
		--port string			  		      (default: ":8080")
		--grpc-gateway-port string 		(default: ":8081")
		--log-path						         (default: "")

	Descriptions:
		[server]
			- Once initiated, it will create a launch a server instance
			- On success, you'll be put into a server console that allows you to send commands
			- Type 'help' at anytime to see a list of the different commands
			- Type 'q' or 'quit' at anytime to stop the server and quit the console

	Examples:
		$ pear-avax-cli install
		$ pear-avax-cli update
		$ pear-avax-cli server --log-level debug --port=":8080" --grpc-gateway-port=":8081"
`,
	{
		flags: {
			logLevel: {
				type: 'string',
				alias: 'l',
				default: 'debug',
			},
			port: {
				type: 'string',
				alias: 'p',
				default: ':8080',
			},
			grpcGatewayPort: {
				type: 'string',
				alias: 'gp',
				default: ':8081',
			},
			logPath: {
				type: 'string',
				alias: 'lp',
				default: '',
			},
		},
	}
)

const flags = cli.flags as IServerOptions
const [command] = cli.input
const commandExists = commandList.includes(command)

if (!commandExists) {
	console.log(`Invalid command entered. ${invalidCommandMsg}`)
	process.exit(0)
}
if (!cli.input.length) {
	process.exit(0)
}

render(<Entry flags={flags} input={cli.input} />)
