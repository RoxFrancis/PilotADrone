# FishGameRegulatedRiver

<p align="left">
  <a href="https://github.com/RoxFrancis/PilotADrone/actions/workflows/docker-image.yml"><img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/RoxFrancis/PilotADrone/.github%2Fworkflows%2Fdocker-image.yml" /></a>
</p>

Canopy Drone: fly a pixel-art drone up through a forest, dodging trees and a diving eagle. Forked and reskinned from the original fish/river concept.

## Running it locally

Clone the repository:
```
git clone git@github.com:RoxFrancis/PilotADrone.git
cd PilotADrone
```

With Docker, build and start a local nginx server:
```
docker compose up -d --build
```

After a few seconds, open `http://localhost:3000` in your browser to play. When you're done:
```
docker compose down
```

Without Docker, serve the repo root with any static file server, e.g.:
```
python3 -m http.server 8080
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which publishes the repo to GitHub Pages automatically.
