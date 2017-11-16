#!/bin/sh
MAX_DAYS_AGO=14
BASE_FOLDER=/data/hiki/cctv/*

# this should be run as a CronJob

# remove files older than MAX_DAYS_AGO located in subtree of BASE_FOLDER
find $BASE_FOLDER -mindepth 1 -type f -ctime +$MAX_DAYS_AGO -exec rm -f {} \;

# remove empty folders located in subtree of BASE_FOLDER
# find /data/hiki/cctv/* -mindepth 1 -type d -ctime +$MAX_DAYS_AGO -exec rm -d {} \;
find $BASE_FOLDER -depth -type d -empty -exec rmdir {} \;
