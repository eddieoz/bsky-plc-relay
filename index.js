require('dotenv').config()
const https = require('https')
const fs = require('fs')
const express = require('express')
const fetch = require('node-fetch');
const url = require('url')

const app = express()
app.use(express.json())

// Load endpoints from environment
const WRITE_ENDPOINT = process.env.WRITE_ENDPOINT
if (!WRITE_ENDPOINT) {
  throw new Error('WRITE_ENDPOINT must be defined in .env')
}

const READ_ENDPOINTS = (process.env.READ_ENDPOINTS || '').split(',').map(e => e.trim()).filter(e => e)
if (!READ_ENDPOINTS.length) {
  throw new Error('READ_ENDPOINTS must be defined in .env')
}

const PORT = process.env.PORT || 3000

// Utility to forward requests
async function forwardRequest(targetUrl, req) {
  // Construct target URL by merging req path and query
  const requestUrl = new url.URL(req.originalUrl, targetUrl)
  
  // Preserve query parameters
  for (const [k, v] of Object.entries(req.query)) {
    requestUrl.searchParams.set(k, v)
  }

  // Prepare fetch options
  const headers = {}
  // Forward all headers except `host`, adjusting as needed
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.toLowerCase() !== 'host') {
      headers[k] = v
    }
  }

  const options = {
    method: req.method,
    headers,
    redirect: 'manual', // We'll forward redirects as-is
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // Forward request body for POST, PUT, etc.
    options.body = JSON.stringify(req.body)
  }

  const response = await fetch(requestUrl.toString(), options)
  return response
}

// Routing logic
app.use(async (req, res) => {
  try {
    // Decide if it's a write, health, export, or read request
    const isHealthOrExport = req.method === 'GET' && (req.path === '/_health' || req.path === '/export')
    const isPost = req.method === 'POST'

    if (isPost || isHealthOrExport) {
      // Forward to write endpoint
      const writeResp = await forwardRequest(WRITE_ENDPOINT, req)
      // Relay response directly
      res.status(writeResp.status)
      writeResp.headers.forEach((value, key) => {
        // set response headers
        res.setHeader(key, value)
      })
      const writeBody = await writeResp.buffer()
      res.send(writeBody)
      console.log(WRITE_ENDPOINT, writeResp)
      return
    }

    if (req.method === 'GET') {
      // For read requests (not _health or export),
      // try each read endpoint in order until success
      let lastErrorStatus = null
      for (const readEndpoint of READ_ENDPOINTS) {
        const readResp = await forwardRequest(readEndpoint, req)
        if (readResp.ok) {
          console.log(readResp)
          // Successful response from a read endpoint
          res.status(readResp.status)
          readResp.headers.forEach((value, key) => {
            res.setHeader(key, value)
          })
          const readBody = await readResp.buffer()
          res.send(readBody)
          console.log(readEndpoint, readResp)
          return
        } else {
          // If failed (404 or other), try next
          lastErrorStatus = readResp.status
          console.log(readEndpoint, lastErrorStatus, readResp.statusText)

          // If the response isn't 404 or 5xx, consider if we should stop
          // But per requirements, we try next read endpoint on errors including 404.
          // No break here, continue to next endpoint.
        }
      }
      // If we got here, all read endpoints failed
      res.sendStatus(lastErrorStatus || 502) // Bad gateway if no final status
      return
    }

    // If method is something else (e.g. PUT, DELETE), decide what to do.
    // The original routes only define GET and POST, so let's relay to write endpoint if unsure.
    const fallbackResp = await forwardRequest(WRITE_ENDPOINT, req)
    res.status(fallbackResp.status)
    fallbackResp.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    const fallbackBody = await fallbackResp.buffer()
    res.send(fallbackBody)

  } catch (err) {
    console.error('Proxy error:', err)
    res.sendStatus(500)
  }
})

// For TLS termination, you will need a certificate and key file
// In production: 
// const options = {
//   key: fs.readFileSync('/path/to/key.pem'),
//   cert: fs.readFileSync('/path/to/cert.pem'),
// }
// const server = https.createServer(options, app)
// For local dev/testing without TLS (not recommended for production):
const server = app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`)
})
