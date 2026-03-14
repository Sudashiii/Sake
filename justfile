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
