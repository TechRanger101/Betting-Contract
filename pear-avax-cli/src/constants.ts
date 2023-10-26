import chalk from 'chalk'

export const { HOME, GOPATH } = process.env
export const GO_PATH = GOPATH ? `${GOPATH}` : `${HOME}/go`;
export const avaxNode = "avalanchego";
export const avaxRunner = "avalanche-network-runner";
export const avaxNodeRepoPath = `${GO_PATH}/src/github.com/ava-labs/${avaxNode}`;
export const avaxRunnerRepoPath = `${GO_PATH}/src/github.com/ava-labs/${avaxRunner}`;
export const commandList = ['install', 'update', 'server']
export const invalidCommandMsg = chalk`
    {red Invalid command entered! -- Type 'help' for a list of valid commands and options.}
    {green Valid commands: ${JSON.stringify(commandList)}}
`