#!/bin/sh
MAX_DAYS_AGO=14

# remove folders including recordings older than MAX_DAYS_AGO
# this should be run as a CronJob
find /data/hiki/cctv/* -mindepth 1 -type d -ctime +$MAX_DAYS_AGO -exec rm -rf {} \;
