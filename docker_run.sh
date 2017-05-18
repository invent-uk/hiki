#!/bin/sh
OUTPUTDIR=$(pwd)/cctv

docker run $1 -v $OUTPUTDIR:/opt/app/cctv hiki
