# Proxy of Docker.io
This is a proxy operating on Cloudflare Workers that forwards requests to Docker.io to bypass the rate limiter.

## usage
/etc/docker/daemon.json
```json
{
    "registry-mirrors": ["https://proxy-domain-of-your-worker.workers.dev"],
}
```