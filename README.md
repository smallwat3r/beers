# Beers

This repository hosts my personal beer journal application. It serves Untappd checkins photos automatically stored in a bucket hosted on Cloudflare R2 thanks to [untappd-recorder](https://github.com/smallwat3r/untappd-recorder), and provides a lightweight frontend interface.

It is a static site: the browser reads `index.json` and the photos straight from the public R2 bucket, so there is no backend to run.

## Development

The bucket's public base URL is read from the `.env` file at the root of the repository (see `.env.example`), and baked into the bundle at build time:
```
R2_PUBLIC_URL="your_r2_public_url"
```

Then `make install`, and `make dev` for the dev server, or `make build` to write `frontend/dist` and `make preview` to serve it. The bucket CORS policy needs to allow `http://localhost:5173` and `http://localhost:4173` for either to load anything.

## Deploying to Cloudflare Pages

Connect the repository, then set:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |

Set `R2_PUBLIC_URL` in the project environment variables, for production and preview. Node is pinned by `frontend/.node-version`.

The bucket needs a CORS policy allowing the site's origins, otherwise the browser refuses to read `index.json`:
```json
[
  {
    "AllowedOrigins": [
      "https://your-project.pages.dev",
      "https://your-custom-domain"
    ],
    "AllowedMethods": ["GET"]
  }
]
```

Origins are matched exactly, so use the deployment's real URL, and purge the Cloudflare cache after a change.

`index.json` decides how quickly a new checkin shows up, so give it `Cache-Control: no-cache` on the bucket side: R2 sends an ETag, and browsers then revalidate on every visit at the cost of a 304 rather than a re-download. A long `max-age` hides new checkins from returning visitors until it expires.

The security headers in `frontend/public/_headers` name the bucket host in the CSP, so update them when the bucket moves.

![beers.png](./img/beers.png)
