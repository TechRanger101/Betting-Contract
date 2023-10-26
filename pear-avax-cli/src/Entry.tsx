import React, { FC } from 'react'

import Install from './Install'
import Update from './Update'
import Server from './Server'

export interface IServerOptions {
	logLevel: string
	port: string
	grpcGatewayPort: string
	logPath: string
}

interface IAppProps {
	flags: IServerOptions,
	input: string[]
}

const App: FC<IAppProps> = ({ flags = {}, input = [] }) => {
	const [command] = input

	if (command === 'update') {
		return <Update />
	} else if (command === 'install') {
		return <Install />
	}

	return <Server options={flags as IServerOptions} />
}

export default App
