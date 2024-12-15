# PLC Relay

This project provides a simple relay/proxy service for the [PLC (Placeholder) directory](https://web.plc.directory/) used by [Bluesky](https://bsky.social/about/). It allows you to self-host a relay to forward requests to a central PLC server, as well as multiple distributed read endpoints. By doing so, you can offload some operations, maintain local copies of accounts, and ultimately reduce reliance on a single central PLC endpoint to validate DIDs.

## Why This Relay?

The entire Bluesky identity infrastructure currently hinges on a single primary PLC server. For those looking to self-host environments—like the one described in the [bluesky-selfhost-env](https://github.com/itaru2622/bluesky-selfhost-env) repository—this proxy provides a way to:
- Host your own PLC relay,
- Retrieve information from your local PLC server instances,
- Forward requests to external/public PLC servers when needed.

This can be beneficial if you want:
- More control over where identity data is fetched from,
- Failover capabilities when one PLC source is down,
- The ability to integrate multiple read endpoints so that a single failure doesn’t break the entire chain of requests.

## Key Features

- **Write Endpoint**: A single write endpoint for handling `POST` requests and special `GET` endpoints (`/_health` and `/export`).
- **Read Endpoints**: Multiple read endpoints are tried in order for standard `GET` requests. If the first read endpoint responds with a 404 or other error, the relay moves on to the next one, ensuring high availability and fault tolerance.
- **Transparent Relay**: The relay forwards all headers, query parameters, and request bodies as-is. No response transformations occur.
- **Configurable via Environment Variables**: Write and read endpoints are defined in a `.env` file, making it easy to configure different sets of endpoints without changing the code.

## Production Considerations

If you intend to run this relay in a production environment, you should ensure that your traffic is secure:

1. **SSL Certificates**:  
   Obtain a valid SSL certificate (e.g., from [Let’s Encrypt](https://letsencrypt.org/) or another Certificate Authority) and configure your Node.js server to serve via HTTPS. You’ll need to set up the TLS termination by providing the certificate and key files to the server configuration.

2. **Reverse Proxy Setup**:  
   Alternatively, you can run this relay behind a reverse proxy like **Nginx** or **Caddy**. These servers can handle SSL/TLS termination for you, making it easier to manage certificates and renew them automatically. You can also use self-signed certificates for testing or rely on Let’s Encrypt for free, automated certificates in production.

**In summary**: To ensure that data and identities remain secure, consider adding HTTPS support, either natively or via a reverse proxy, when deploying this relay to the public internet.

## How It Works

1. **Write Endpoint**:  
   Any `POST` request and `GET` requests to `/_health` or `/export` are forwarded directly to the configured `WRITE_ENDPOINT`.

2. **Read Endpoints**:  
   Other `GET` requests (like those fetching a DID document or logs) will first attempt the first configured read endpoint. If it returns a 404 or fails with another error, the request is tried against the next read endpoint in the list until one returns a successful response.

3. **Fallback Behavior**:  
   If no read endpoint returns a successful response, the relay returns the last error encountered.

## Example `.env` Configuration

```env
WRITE_ENDPOINT=https://your-write-plc-endpoint.example.com
READ_ENDPOINTS=https://read-plc-endpoint-1.example.com,https://read-plc-endpoint-2.example.com, [...]
PORT=3000
```

## Getting Started

1. **Install Dependencies**:
   ```sh
   yarn install
   ```

2. **Configure Environment**:  
   Create a `.env` file with your chosen write and read endpoints.

3. **Run the Relay**:
   ```sh
   yarn start
   ```
   The relay will listen on the configured `PORT` and forward requests accordingly.

## Contributing

Contributions are welcome! If you have suggestions for improving the reliability, adding features, or making the proxy easier to use, feel free to open an issue or submit a pull request.

## License

MIT License. See the [LICENSE](LICENSE) file for more details.
