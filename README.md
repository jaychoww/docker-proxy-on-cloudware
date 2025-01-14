# Proxy of Docker.io
This is a proxy running on cloudflare worker that proxy docker.io to avoid the rate limiter.

## usage
/etc/docker/daemon.json
```json
{
    "registry-mirrors": ["https://proxy-domain-of-your-worker.workers.dev"],
}
```