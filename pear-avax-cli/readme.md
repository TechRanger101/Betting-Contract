# Pear AVAX Cli

> CLI tool that creates and runs a local AVAX cluster of 5 nodes.

## Requirements

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [golang](https://go.dev/) -> (recommended go1.17.5)
- [Node.js](https://nodejs.org/en/) - (recommended v16.3.2)

## Install

```bash
npm install --global pear-avax-cli
```

## CLI

```shell
 Usage: $ pear-avax-cli [command]

 Commands:
  install - Install and configure AVAX node and network runner
  update - Update AVAX node and network runner
  server - Creates a cluster of 5 AVAX nodes running locally

 Options:
  [install, update]
   none
  [server]
  --log-level string     (default: "info")
  --port string       (default: ":8080")
  --grpc-gateway-port string   (default ":8081")

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
```
