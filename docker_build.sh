#!/bin/sh

if [ -f config.yml ]; then
  docker build --no-cache=true -t hiki .
else 
  cp config.yml.sample config.yml
  echo Please customise config.yml to reflect your camera configuration then re-run this command.
fi
