import React, { FC, useEffect, useState } from 'react'
import { Text, Box } from 'ink'
import git, { SimpleGit } from 'simple-git'
import Spinner from 'ink-spinner'

import { reposExist, emojiCheck, exec } from './utils'
import { avaxNode, avaxRunner, avaxNodeRepoPath, avaxRunnerRepoPath } from './constants'
import { fullRunnerPath, fullNodePath } from './Install'

const log = (text: string) => ({
    text,
    color: 'white',
})

const success = (text: string) => ({
    text,
    color: 'green',
})

const error = (text: string) => ({
    text,
    color: 'red',
})

async function updateSource(out: any, loadingText: any) {
    const { hasNode, hasRunner } = reposExist()

    const gitHandler = (_command: any, stdout: any, stderr: any, path: any) => {
        stdout.on('data', (chunk: Buffer) => {
            out(log(`[${path}]: ${chunk.toString('utf8')}`))
        })
        stderr.on('data', (chunk: Buffer) => {
            out(log(`[${path}]: ${chunk.toString('utf8')}`))
        })
    }

    if (!hasNode || !hasRunner) {
        error('Unable to find AVAX node and runner repo path(s)')
        error('Please run the install command or check the repos below exist.')
        if (!hasNode) error(`Expected Node Path: ${avaxNodeRepoPath}`)
        if (!hasRunner) error(`Expected Node Path: ${avaxRunnerRepoPath}`)
        return
    }

    const gitNode: SimpleGit = git(avaxNodeRepoPath, {
        binary: 'git',
    }).outputHandler((c, o, e) => gitHandler(c, o, e, avaxNode))
    const gitRunner: SimpleGit = git(avaxRunnerRepoPath, {
        binary: 'git',
    }).outputHandler((c, o, e) => gitHandler(c, o, e, avaxRunner))

    loadingText('...')

    loadingText(`Updating ${avaxNode} source code...`)
    await gitNode.pull()
    await exec(`cd ${fullNodePath} && sh ./scripts/build.sh`)
    out(success(`${emojiCheck} ${avaxNode} source code is up to date!\n`))
    loadingText(`Updating ${avaxNode} source code...`)

    await gitRunner.pull()
    await exec(`cd ${fullRunnerPath} && go install -v ./cmd/${avaxRunner}`)
    out(success(`${emojiCheck} ${avaxRunner} source code is up to date!\n`))
    loadingText('Finished updated')
    out(log('Finished updating the AVAX node and runner.'))
}

const Update: FC<{}> = () => {
    const [loadingText, setLoadingText] = useState('Updating AVAX source code')
    const [output, setOutput] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        ; (async () => {
            const op = (o: any) => setOutput((value) => [...value, o])
            await updateSource(op, setLoadingText)
            setIsLoading(false)
            process.exit(0)
        })()
    }, [])

    return (
        <Box flexDirection="column">
            {output.map(({ text, color }, idx) => (
                <Text key={idx} color={color}>
                    {text}
                </Text>
            ))}
            {isLoading && (
                <Text>
                    <Text color="green">
                        <Spinner type="dots12" />
                    </Text>
                    {` ${loadingText}`}
                </Text>
            )}
        </Box>
    )
}

export default Update
