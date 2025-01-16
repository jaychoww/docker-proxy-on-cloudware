# Proxy of Docker.io
This is a proxy operating on Cloudflare Workers that forwards requests to Docker.io to bypass the rate limiter.

## DEPLOY
* Create a worker on cloudflare named "docker-proxy"
* Connect this worker to the github repo
* Build it

## USAGE
* Update your docker configuration:
/etc/docker/daemon.json
```json
{
    "registry-mirrors": ["https://proxy-domain-of-your-worker.workers.dev"],
}
```

### [offical document about cache API](https://developers.cloudflare.com/workers/examples/cache-api/)


# Proxy of private-maven
## DEPLOY
* Create a worker on cloudflare named "maven-proxy"
* Connect this worker to the github repo
* Set `Deploy Command` = `npx wrangler deploy --keep-vars` in Cloudflare workers dashboard
* Create an environment Variable named `MAVEN_REPO_URL` in Cloudflare workers dashboard
* Build it
```
     MAVEN_REPO_URL=https://your-private-maven.com
```

## USAGE
* Update your maven configuration:
```
MAVEN URL: https://proxy-domain-of-your-worker.workers.dev/repository
```
