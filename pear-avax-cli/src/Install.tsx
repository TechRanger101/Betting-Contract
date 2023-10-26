import React, { FC, useEffect, useState } from "react";
import fs from 'fs'
import { Text, Box } from "ink";
import git from 'simple-git'
import Spinner from "ink-spinner";

import { reposExist, exec, emojiCheck } from "./utils";
import {
    GO_PATH,
    avaxNode,
    avaxRunner,
} from "./constants";

const log = (text) => ({
    text,
    color: 'white',
})
const success = (text) => ({
    text,
    color: 'green',
})
const error = (text) => ({
    text,
    color: 'red',
})

const nodeGitUrl = "https://github.com/ava-labs/avalanchego.git";
const runnerGitUrl =
    "https://github.com/ava-labs/avalanche-network-runner.git";
const ensurePath = `${GO_PATH}/src/github.com/ava-labs`;
export const fullNodePath = `${ensurePath}/${avaxNode}`;
export const fullRunnerPath = `${ensurePath}/${avaxRunner}`;

async function installSource(out: any, loadingText: any) {
    try {
        const { hasNode, hasRunner } = reposExist();

        if (hasNode && hasRunner) {
            out(error("------------------------------------------"));
            out(error("AVAX Node and Runner already exists."));
            out(error("Run the update command to fetch the latest source code."));
            out(error("------------------------------------------"));
            return;
        }

        if (!fs.existsSync(ensurePath)) {
            out(log(`Creating path for repos...`));
            await fs.promises.mkdir(ensurePath, { recursive: true });
        }

        loadingText("...")

        if (!hasNode) {
            loadingText(`Fetching ${avaxNode} source code...`)
            await git().clone(nodeGitUrl, `${fullNodePath}`);
            out(success(`${emojiCheck} Downloaded ${avaxNode} source code!\n`));
            loadingText(`Building ${avaxNode}...`)
            await exec(`cd ${fullNodePath} && sh ./scripts/build.sh`);
            out(success(`${emojiCheck} ${avaxNode} build was successful!\n`));
        }

        if (!hasRunner) {
            loadingText(`Fetching ${avaxRunner} source code...`)
            await git().clone(runnerGitUrl, `${fullRunnerPath}`);
            out(success(`${emojiCheck} Downloaded ${avaxRunner} source code!\n`));
            loadingText(`Installing ${avaxRunner}...`)
            await exec(`cd ${fullRunnerPath} && go install -v ./cmd/${avaxRunner}`);
            out(success(`${emojiCheck} Installed ${avaxRunner}!\n`));
        }

        loadingText("Finished installing and building!")
        out(success("Successfully downloaded/built the node and runner source code!"));
        out(success(`AVAX Node Path: ${fullNodePath}`));
        out(success(`AVAX Runner Path: ${fullRunnerPath}`));
    } catch (err: any) {
        console.log(err)
        error(err);
        throw err;
    }
}

const Install: FC<{}> = () => {
    const [loadingText, setLoadingText] = useState('Downloading AVAX source code')
    const [output, setOutput] = useState([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        (async () => {
            const op = (o) => setOutput((value) => [...value, o])
            await installSource(op, setLoadingText)
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
    );

}

export default Install;
