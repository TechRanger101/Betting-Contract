const http = require('http')

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200)
    res.end('Server is healthy')
  } else {
    res.writeHead(404)
    res.end('Not found')
  }
})

server.listen(50521)
