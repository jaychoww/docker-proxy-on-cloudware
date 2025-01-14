# Proxy of Docker.io
This is a proxy operating on Cloudflare Workers that forwards requests to Docker.io to bypass the rate limiter.

## usage
* Create a worker on cloudflare named "docker-proxy"
* Connect this worker to the github repo
* Build it on cloudflare worker
* Update your docker configuration:
/etc/docker/daemon.json
```json
{
    "registry-mirrors": ["https://proxy-domain-of-your-worker.workers.dev"],
}
```