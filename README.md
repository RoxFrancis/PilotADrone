# FishGameRegulatedRiver

<p align="left">
  <a href="/github/actions/workflow/status/:user/:repo/:workflow"><img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/RoxFrancis/PilotADrone/.github%2Fworkflows%2Fdocker-image.yml" /></a>
</p>

Canopy Drone: fly a pixel-art drone up through a forest, dodging trees and a diving eagle. Forked and reskinned from the original fish/river concept.

## Running it locally

Run the following to clone this repository:
```
git clone git@github.com:RoxFrancis/PilotADrone.git
```

In your terminal, navigate into the directory on your local machine and run docker compose, which will build the application and start a local `node.js` server:
```
cd PilotADrone
docker compose
```

After a few seconds, your local server should be ready. In your browser, navigate to `localhost:3000`, which should start your game!

If you are done with the game and would like to stop the server, run the following:
```
docker compose down
```