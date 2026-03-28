set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default:
    @just --list

docker-up:
    docker compose -f docker-compose.yaml up --build

docker-down:
    docker compose -f docker-compose.yaml down

selfhost-up:
    docker compose -f docker-compose.selfhost.yaml up --build

selfhost-down:
    docker compose -f docker-compose.selfhost.yaml down

docker-up-prebuilt:
    docker compose -f docker-examples/docker-compose.prebuilt.yaml up

docker-down-prebuilt:
    docker compose -f docker-examples/docker-compose.prebuilt.yaml down

selfhost-up-prebuilt:
    docker compose -f docker-examples/docker-compose.prebuilt.selfhost.yaml up

selfhost-down-prebuilt:
    docker compose -f docker-examples/docker-compose.prebuilt.selfhost.yaml down
