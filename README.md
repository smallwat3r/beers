# Beers

This repository hosts my personal beer journal application. It serves Untappd checkins photos automatically stored in a bucket hosted on Cloudflare R2 thanks to [untappd-recorder](https://github.com/smallwat3r/untappd-recorder), and provides a lightweight frontend interface.

It is a static site: the frontend reads `index.json` and the photos straight from the public R2 bucket, so there is no backend to run.

The bucket's public base URL is read from the `.env` file at the root of the repository (see `.env.example`), and baked into the bundle at build time:
```
R2_PUBLIC_URL="your_r2_public_url"
```

Then `make install && make build`, and deploy `frontend/dist` to any static host.

## Deploying to Cloudflare Pages

Connect the repository and use:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |

Set `R2_PUBLIC_URL` as a build-time environment variable in the Pages project (it is baked into the bundle, so a change needs a redeploy). `public/_headers` ships the security and cache headers, and `.node-version` pins the build to Node 20.

The bucket must allow cross-origin `GET` requests from the site's domain, otherwise the browser blocks the `index.json` fetch.

![beers.png](./img/beers.png)
