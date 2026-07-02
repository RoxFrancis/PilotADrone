# FishGameRegulatedRiver
Canopy Drone: fly a pixel-art drone up through a forest, dodging trees and a diving eagle. Forked and reskinned from the original fish/river concept.

## Run locally

With Docker:

```
docker compose up -d --build
```

Then open http://localhost:3000. Stop it with `docker compose down`.

Without Docker, serve the `src/` folder with any static file server, e.g.:

```
cd src && python3 -m http.server 8080
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which publishes `src/` to GitHub Pages automatically.
