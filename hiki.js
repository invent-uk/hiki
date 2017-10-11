#!/usr/bin/nodejs

const	util = require('util');
const fs = require('fs');
const spawn = require('child_process').spawn;
const exec = require('child_process').exec;
const mkdirp = require('mkdirp');
const CronJob = require('cron').CronJob;
const yaml = require('js-yaml');

const ipcamera = require('node-hikvision-api');

const error=3;
const warning=2;
const info=1;
const debug=0;

const logLevel=info;

let config = {};
try {
  config = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));
} catch (e) {
  console.log(e);
}

var rtsp=null;
var opt=config.options;

debugLog(debug, config);

for (var camera in config.cameras) {
  if (config.cameras.hasOwnProperty(camera)) {
    var cam = config.cameras[camera];
    cam.title = camera;
    for (var recording in cam.record) {
      if (cam.record.hasOwnProperty(recording)) {
        var rec = cam.record[recording];
        if (rec.title == null) {
          rec.title = recording;
        }
        if (recording == 'motion') {
          trackMotion(opt, cam, rec);
        } else if (recording == 'line') {
          trackLine(opt, cam, rec);
        } else if (recording == 'field') {
          trackField(opt, cam, rec);
        } else if (recording == 'constant') {
          runVideoSchedule(opt, cam, rec);
        } else if (recording == 'image') {
          runImageSchedule(opt, cam, rec);
        }
      }
    }

  }
}

function runVideoSchedule(opt, cam, rec) {
  debugLog(info, `runVideoSchedule starting on ${cam.title}`);
  cam.cron = new CronJob(rec.schedule, function() {
    runJob(opt, cam, rec);
  }, null, true);
  runJob(opt, cam, rec);
}

function runImageSchedule(opt, cam, rec) {
  debugLog(info, `runImageSchedule starting on ${cam.title}`);
  cam.cron = new CronJob(rec.schedule, function() {
    fetchImage(opt, cam, rec);
  }, null, true, 'Europe/London');
}

function runJob(opt, cam, rec) {
  debugLog(info, `runJob running on ${cam.title} - ${rec.title}`);
  if (rec.rtsp != null) {
    stopRecord(opt, cam, rec);
  }
  startRecord(opt, cam, rec);
}

function trackMotion(opt, cam, rec) {
  debugLog(info, `trackMotion starting on ${cam.title} - ${rec.title}`);
  rec.hikvision 	= new ipcamera.hikvision(cam.options);
  rec.hikvision.on('connect', function(){

    rec.hikvision.on('alarm', function(code,action,index) {
      if (code === 'VideoMotion'   && action === 'Start') {
        debugLog(info, `Channel ${index}: Video Motion detected`);
        startRecord(opt, cam, rec);
      } else if (code === 'VideoMotion'   && action === 'Stop') {
        debugLog(info, `Channel ${index}: Video Motion ended`)
        requestStopRecord(opt, cam, rec);
      }
    });
  });
}

function trackLine(opt, cam, rec) {
  debugLog(info, `trackLine starting on ${cam.title} - ${rec.title}`);
  rec.hikvision 	= new ipcamera.hikvision(cam.options);
  rec.hikvision.on('connect', function(){

    rec.hikvision.on('alarm', function(code,action,index) {
      if (code === 'LineDetection'   && action === 'Start') {
        debugLog(info, `Channel ${index}: Line Crossing detected`);
        startRecord(opt, cam, rec);
      } else if (code === 'LineDetection'   && action === 'Stop') {
        debugLog(info, `Channel ${index}: Line Crossing ended`)
        requestStopRecord(opt, cam, rec);
      }
    });
  });
}

function trackField(opt, cam, rec) {
  debugLog(info, `trackField starting on ${cam.title} - ${rec.title}`);
  rec.hikvision 	= new ipcamera.hikvision(cam.options);
  rec.hikvision.on('connect', function(){

    rec.hikvision.on('alarm', function(code,action,index) {
      if (code === 'fielddetection'   && action === 'Start') {
        debugLog(info, `Channel ${index}: Field Entering detected`);
        startRecord(opt, cam, rec);
      } else if (code === 'fielddetection'   && action === 'Stop') {
        debugLog(info, `Channel ${index}: Field Entering ended`)
        requestStopRecord(opt, cam, rec);
      }
    });
  });
}

function requestStopRecord(opt, cam, rec) {
  rec.timeout = setTimeout(function() {
    stopRecord(opt, cam ,rec);
  }, rec.postDelay * 1000);
}

function fetchImage(opt, cam, rec) {
  var datePath = getDT('path');
  var recPath = `${opt.outputPath}/${datePath}/${cam.title}_${rec.title}`;
  if (!rec.fullPath || recPath != rec.fullPath) {
    rec.fullPath = recPath;
    if (!fs.existsSync(rec.fullPath)) {
      mkdirp.sync(rec.fullPath);
    }
  }
  downloadImage(opt, cam, rec, `${rec.fullPath}`, `${cam.title}_${rec.title}_${getDT('timestamp')}`, '.jpg');
}

function downloadImage(opt, cam, rec, file_path, file_name, file_ext) {
  if (rec.curl != null) {
    return
  };
  var options = cam.options;
  var args = [`http://${options.user}:${options.pass}@${options.host}${options.imagePath}`];

  // prepare full-qualified filenames
  var fq_file = file_path+file_name+file_ext;
  var fq_link = file_path+file_name+rec.symlinkImageLabel+file_ext;

  debugLog(info, `Spawning curl with args ${args}`);
  rec.curl = spawn('curl', args,
  {
    cwd: opt.outputPath,
    stdio: [
      0,
      fs.openSync(fq_file, 'w') ,
      2
    ]
  });
  rec.curl.on('close', (code) => {
    if (code == 0) {
      if (rec.symlinkImageLabel && rec.symlinkImageLabel != "") {
        fs.link(fq_file,fq_link,function(){});
      }
    }
    rec.curl=null;
  });
  debugLog(info, `Spawned curl with child pid: ${rec.curl.pid}`);

}


function startRecord(opt, cam, rec) {
  if (rec.timeout != null ) {
    clearTimeout(rec.timeout);
    rec.timeout=null;
  }
  if (rec.rtsp != null) {
    return;
  }
  var datePath = getDT('path');
  var relativePath=`${datePath}/${cam.title}_${rec.title}`;
  var recPath = `${opt.outputPath}/${relativePath}`;
  if (!rec.fullPath || recPath != rec.fullPath) {
    rec.fullPath = recPath;
    if (!fs.existsSync(rec.fullPath)) {
      mkdirp.sync(rec.fullPath);
    }
  }

  var options = cam.options;
  var args = options.video_params.split(/\s+/);
  args.push([
  `rtsp://${options.user}:${options.pass}@${options.host}${options.videoPath}`
]);

rec.videoFilename = `${rec.fullPath}/${cam.title}_${rec.title}_${getDT('timestamp')}.mp4`;
rec.rtsp = spawn(opt.openRTSP, args,
  {
    cwd: opt.outputPath,
    stdio: [
      0, // Use parent's stdin for child
      fs.openSync(rec.videoFilename, 'w') ,
      2 // Direct child's stderr to a file
    ]
  });
  debugLog(info, `Spawned RTSP child pid: ${rec.rtsp.pid}`);
  if (rec.captureImage != null && rec.captureImage == true) {
    var imageFilePath=`${rec.fullPath}/`;
    var imageFileName=`${cam.title}_${rec.title}_${getDT('timestamp')}`;
    downloadImage(opt, cam, rec, imageFilePath, imageFileName, '.jpg');
  }
  if (rec.postStartCommand) {
      runCommand(opt, cam, rec, rec.postStartCommand, rec.fullPath, rec.relativePath, rec.videoFilename);
  }

  }

function runCommand(opt, cam, rec, command, fullPath, relativePath, filename) {

  command = command.replace(/%p/g, fullPath);
  command = command.replace(/%r/g, relativePath);
  command = command.replace(/%f/g, filename);

  var pc = exec(command,	function (error, stdout, stderr) {
    if (error) {
      debugLog(error, error.stack);
      debugLog(error, 'Error code: '+error.code);
      debugLog(error, 'Signal received: '+error.signal);
    }
    debugLog(info, 'Child Process STDOUT: '+stdout);
    debugLog(info, 'Child Process STDERR: '+stderr);
  });
}

function stopRecord(opt, cam, rec) {
  if (rec.rtsp != null) {
    debugLog(info, `Stopping ${cam.title} - ${rec.title}`);
    rec.rtsp.kill('SIGUSR1');
    rec.rtsp = null;

    if (rec.postStopCommand) {
        runCommand(opt, cam, rec, rec.postStopCommand, rec.fullPath, rec.relativePath, rec.videoFilename);
    }
  }
}

function stopImage(opt,cam,rec) {
  if (rec.curl != null) {
    debugLog(info, `Stopping curl on ${cam.title} - ${rec.title}`);
    rec.curl.kill();
  }
}

// use generic function to get filepath or filename
function getStringByPattern(opt, cam, rec, date, pattern) {

  // prepare date/time-values
  var hour = date.getHours();
  hour = (hour < 10 ? "0" : "") + hour;
  var min  = date.getMinutes();
  min = (min < 10 ? "0" : "") + min;
  var sec  = date.getSeconds();
  sec = (sec < 10 ? "0" : "") + sec;
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  month = (month < 10 ? "0" : "") + month;
  var day  = date.getDate();
  day = (day < 10 ? "0" : "") + day;

  var result = pattern;
  result = result.replace(/%Y/g, year);
  result = result.replace(/%M/g, month);
  result = result.replace(/%D/g, day);
  result = result.replace(/%h/g, hour);
  result = result.replace(/%m/g, min);
  result = result.replace(/%s/g, sec);
  result = result.replace(/%cam/g, cam.title);
  result = result.replace(/%rec/g, rec.title);
  return result;
}

function getDT(format) {
  var date = new Date();
  var hour = date.getHours();
  hour = (hour < 10 ? "0" : "") + hour;
  var min  = date.getMinutes();
  min = (min < 10 ? "0" : "") + min;
  var sec  = date.getSeconds();
  sec = (sec < 10 ? "0" : "") + sec;
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  month = (month < 10 ? "0" : "") + month;
  var day  = date.getDate();
  day = (day < 10 ? "0" : "") + day;
  switch(format) {
    case "path":
      return year + "/" + month + "/" + day ;
    case "timestamp":
      return year + month + day + "_" + hour + min + "_" + sec;
    case "datetime":
      return year + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;
  }
}

function debugLog(level, message) {
  if (level >= logLevel)
  console.log(getDT('timestamp') + ": " + message);
}

function cleanUp() {
  for (var camera in config.cameras) {
    if (config.cameras.hasOwnProperty(camera)) {
      var cam = config.cameras[camera];
      cam.title = camera;

      for (var recording in cam.record) {
        if (cam.record.hasOwnProperty(recording)) {
          var rec = cam.record[recording];
          stopRecord(opt, cam, rec);
          stopImage(opt, cam, rec);
        }
      }

    }
  }
}

process.on( "SIGINT", function() {
  debugLog(info, 'CLOSING [SIGINT]');
  process.exit();
} );

process.on('uncaughtException', function(err) {
  debugLog(error, err);
  process.exit();
} );

process.on( "exit", function() {
  debugLog(info, 'CLOSING [exit]');
  cleanUp();
} );
