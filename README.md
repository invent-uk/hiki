# Hiki - CCTV Network Video Recorder

## Background

Running a software CCTV NVR (Network Video Recorder) involves a lot of moving parts.

Hiki is different, it designed around the [KISS principle](https://en.wikipedia.org/wiki/KISS_principle). It relies on the IP camera for the complicated stuff (motion detection, video configuration) and instead provides reliable recording of network video stream to disk.

## Benefits

- Motion detection is handled by the camera, reducing workload on the server.
- No transcoding of video is required, the native format is streamed to disk.
- Keeps control over your files, doesn't lock them away in a proprietary format.

## Features

- 24x7 continuous recording (With configurable duration per file)
- Simultaneous motion event driven recording
- Scheduled image recording
- Motion event driven image recording
- Ability to trigger external commands on completion of motion event recording (For post processing or media library update)
- Thumbnail files can be generated alongside the video file to allow programs such as [Plex](http://plex.tv/) to display correctly.

## Requirements

- A Linux server or a system running docker
- One or more recent [Hikvision](http://www.hikvision.co.uk/products_755.html) IPTV cameras
- [nodejs](https://nodejs.org/en/)
- [openRTSP](http://www.live555.com/openRTSP/) - Used to record the video streams
- curl - Used to download images
- [node-hikvision-api](https://github.com/nayrnet/node-hikvision-api) - Used to receive motion events from the camera

## Installation

### There are two routes to installation, the first is a manual install following these steps:

- Install [nodejs](https://nodejs.org/en/)
- Install [openRTSP](http://www.live555.com/openRTSP/) (livemedia-utils package)
- clone the repo (`git clone https://github.com/refinitive/hiki.git`)
- download node modules (`npm install`)
- Customise config.yml for cameras and output directory (copy from .sample)
- Run node hiki.js

### Or install using docker and let it sort out the pre-reqs:

- Install [docker](https://www.docker.com/community-edition)
- clone the repo `git clone https://github.com/refinitive/hiki.git`
- Customise config.yml to match your cameras
- execute `./docker_build.sh`
- execute `./docker_run.sh` (Ctrl+C to exit)
- execute `./docker_daemon.sh` to run in the background

## Using Hiki

Hiki will store output files in a logical hierarchy depending on the date, camera and type of recording. Each day is represented by its own directory under which will be each camera and type of recording. As such it is easy to apply different retention logic based on the kind of recording (continuous vs motion detect)

Output files will be written to ./cctv by default with the hiearachy created at run-time. It is possible for hiki to execute a command once the recording is complete for use cases such as add the recording to Plex or push the recording up to the cloud.

Example output:

The following shows the output from a camera called 'driveway' that is using 24x7 recording.
The additional jpg files are created to allow thumbnail to be displayed in the media library:

```cctv/2017/05/18/driveway_constant/driveway_constant_20170518_2156_01.mp4
cctv/2017/05/18/driveway_constant/driveway_constant_20170518_2156_01.jpg
cctv/2017/05/18/driveway_constant/driveway_constant_20170518_2156_01-fanart.jpg
```

The following files were created by a motion event, triggered by the Hikvision API. The recording will start on detection of motion and then complete a configurable number of seconds after stops being detected:

```cctv/2017/05/18/driveway_motion/driveway_motion_20170518_2156_01-fanart.jpg
cctv/2017/05/18/driveway_motion/driveway_motion_20170518_2156_01.mp4
cctv/2017/05/18/driveway_motion/driveway_motion_20170518_2156_01.jpg
```


## Supported cameras

| Make          | Model            | Resolution | Issues    |
| ------------- |-------------     | -----------| ----------|
| Hikvision     | DS-2CD2142FWD-IS [(Amazon)](https://www.amazon.co.uk/Hikvision-DS-2CD2142FWD-External-Network-Camera/dp/B017C4CCI4)| 2688x1520 @20fps | None|
