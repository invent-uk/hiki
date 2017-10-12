#!/bin/sh
MAX_DAYS_AGO=14

# this should be run as a CronJob

# remove files older than MAX_DAYS_AGO
find /data/hiki/cctv/* -mindepth 1 -type f -ctime +$MAX_DAYS_AGO -exec rm -f {} \;

# remove empty folders older than MAX_DAYS_AGO
find /data/hiki/cctv/* -mindepth 1 -type d -ctime +$MAX_DAYS_AGO -exec rm -d {} \;
