#!/bin/bash

# Funktion zur Anzeige der Nutzungshinweise
usage() {
  echo "Usage: $0 [-d|--delete] [-f|--file compose-file] -r|--repo <GitHub Repository URL> -v|--volume <Volume Name>"
  echo "  -d, --delete         Delete the volume before cloning"
  echo "  -f, --file           Specify the Docker Compose file (default: compose-dev.yml)"
  echo "  -r, --repo           Specify the GitHub Repository URL"
  echo "  -v, --volume         Specify the Docker Volume Name"
  exit 1
}

# Standardwerte setzen
DELETE_VOLUME=false
COMPOSE_FILE="compose-dev.yml"
REPO_URL=""
VOLUME_NAME=""

# Überprüfen der Optionen
OPTS=$(getopt -o df:r:v: --long delete,file:,repo:,volume: -n 'parse-options' -- "$@")
if [ $? != 0 ] ; then usage ; exit 1 ; fi

eval set -- "$OPTS"

while true; do
  case "$1" in
    -d | --delete ) DELETE_VOLUME=true; shift ;;
    -f | --file ) COMPOSE_FILE="$2"; shift; shift ;;
    -r | --repo ) REPO_URL="$2"; shift; shift ;;
    -v | --volume ) VOLUME_NAME="$2"; shift; shift ;;
    -- ) shift; break ;;
    * ) break ;;
  esac
done

# Überprüfen, ob die erforderlichen Argumente übergeben wurden
if [ -z "$REPO_URL" ] || [ -z "$VOLUME_NAME" ]; then
  usage
fi

# Löschen des Volumes, falls die Option -d gesetzt wurde
if $DELETE_VOLUME; then
  echo "Deleting volume $VOLUME_NAME..."
  if ! docker volume rm $VOLUME_NAME; then
    echo "Failed to delete volume $VOLUME_NAME."
    exit 1
  fi
  echo "Volume $VOLUME_NAME deleted successfully."
fi

# Überprüfen, ob das Volume bereits existiert
VOLUME_EXISTS=$(docker volume ls --format '{{.Name}}' | grep -w $VOLUME_NAME)

if [ -z "$VOLUME_EXISTS" ]; then
  # Docker-Container verwenden, um das Repository in das Volume zu klonen
  echo "Cloning repository $REPO_URL into volume $VOLUME_NAME..."
  if ! docker run --rm -it -v $VOLUME_NAME:/devenv docker git clone $REPO_URL /devenv; then
    echo "Failed to clone repository."
    exit 1
  fi
  echo "Repository cloned into volume $VOLUME_NAME successfully."
else
  echo "Volume $VOLUME_NAME already exists. Skipping clone."
fi

# Docker Compose ausführen, wobei das geklonte Repository als Volume verwendet wird
echo "Starting Docker Compose with $COMPOSE_FILE..."
docker run --rm -e VOLUME_NAME=$VOLUME_NAME -v $VOLUME_NAME:/devenv -v /var/run/docker.sock:/var/run/docker.sock -w /repo docker compose -f $COMPOSE_FILE up

