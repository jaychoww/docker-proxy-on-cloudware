# Proxy of Docker.io
This is a proxy operating on Cloudflare Workers that forwards requests to Docker.io to bypass the rate limiter.

## Usage
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

### [offical document about cache API](https://developers.cloudflare.com/workers/examples/cache-api/)


# Proxy of private-maven
## Usage
* Create a worker on cloudflare named "maven-proxy"
* Connect this worker to the github repo
* Build it on cloudflare worker
* Update environment Variable of Woker
```
     MAVEN_REPO_URL=https://your-private-maven.com
```
* Update your maven configuration:
```
MAVEN URL: https://proxy-domain-of-your-worker.workers.dev/repository
```
