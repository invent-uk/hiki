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

for (var prop in config.cameras) {
  if (config.cameras.hasOwnProperty(prop)) {
    var cam = config.cameras[prop];
    cam.title = prop;
    for (var recTitle in cam.record) {
      if (cam.record.hasOwnProperty(recTitle)) {
        var rec = cam.record[recTitle];
        if (rec.title == null) {
          rec.title = recTitle;
        }
        if (recTitle == 'motion') {
          trackMotion(opt, cam, rec);
        } else if (recTitle == 'constant') {
          runSchedule(opt, cam, rec);
        } else if (recTitle == 'image') {
          runImageSchedule(opt, cam, rec);
        }
      }
    }

  }
}


function runSchedule(opt, cam, rec) {
  debugLog(info, `runSchedule starting on ${cam.title}`);
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
        debugLog(info, `Channel ${index}: Video Motion Detected`);
        startRecord(opt, cam, rec);
      } else if (code === 'VideoMotion'   && action === 'Stop') {
        debugLog(info, `Channel ${index}: Video Motion Ended`)
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

  var datePath = getDatePath();
  var recPath = `${opt.outputPath}/${datePath}/${cam.title}_${rec.title}`;
  if (!rec.fullPath || recPath != rec.fullPath) {
    rec.fullPath = recPath;
    if (!fs.existsSync(rec.fullPath)) {
      mkdirp.sync(rec.fullPath);
    }
  }
  downloadImage(opt, cam, rec, `${rec.fullPath}/${cam.title}_${rec.title}_`+getTS(),'.jpg');
}

function downloadImage(opt, cam, rec, name, extension) {
  if (rec.curl != null) {
    return
  };
  var options = cam.options;
  var args = [`http://${options.user}:${options.pass}@${options.host}${options.imagePath}`];
  debugLog(info, `Spawning curl with args ${args}`);

  rec.curl = spawn('curl', args,
  {
    cwd: opt.outputPath,
    stdio: [
      0,
      fs.openSync(name+extension, 'w') ,
      2
    ]
  });
  rec.curl.on('close', (code) => {
    if (code == 0) {
      if (rec.symlinkImageLabel && rec.symlinkImageLabel != "") {
        fs.link(name+extension,name+rec.symlinkImageLabel+extension,function(){});
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
  var datePath = getDatePath();
  var recPath = `${opt.outputPath}/${datePath}/${cam.title}_${rec.title}`;
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

rec.rtsp = spawn(opt.openRTSP, args,
  {
    cwd: opt.outputPath,
    stdio: [
      0, // Use parent's stdin for child
      fs.openSync(`${rec.fullPath}/${cam.title}_${rec.title}_`+getTS()+'.mp4', 'w') ,
      2 // Direct child's stderr to a file
    ]
  });
  debugLog(info, `Spawned RTSP child pid: ${rec.rtsp.pid}`);
  if (rec.captureImage != null && rec.captureImage == true) {
    downloadImage(opt, cam, rec, `${rec.fullPath}/${cam.title}_${rec.title}_`+getTS(),'.jpg');
  }
}

function stopRecord(opt, cam, rec) {
  if (rec.rtsp != null) {
    debugLog(info, `Stopping ${cam.title} - ${rec.title}`);
    rec.rtsp.kill('SIGUSR1');
    rec.rtsp = null;
    if (rec.postCommand) {
      var pc = exec(rec.postCommand,	function (error, stdout, stderr) {
        if (error) {
          debugLog(error, error.stack);
          debugLog(error, 'Error code: '+error.code);
          debugLog(error, 'Signal received: '+error.signal);
        }
        debugLog(info, 'Child Process STDOUT: '+stdout);
        debugLog(info, 'Child Process STDERR: '+stderr);
      });
    }
  }
}

function stopImage(opt,cam,rec) {
  if (rec.curl != null) {
    debugLog(info, `Stopping curl on ${cam.title} - ${rec.title}`);
    rec.curl.kill();
  }
}


function getDatePath() {
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
  return year + "/" + month + "/" + day ;
}

function getDateTime() {
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
  return year + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;
}

function getTS() {
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
  return year + month + day + "_" + hour + min + "_" + sec;
}

function debugLog(level, message) {
  if (level >= logLevel)
  console.log(getTS() + ": " + message);
}

function cleanUp() {
  for (var prop in config.cameras) {
    if (config.cameras.hasOwnProperty(prop)) {
      var cam = config.cameras[prop];
      cam.title = prop;

      for (var recTitle in cam.record) {
        if (cam.record.hasOwnProperty(recTitle)) {
          var rec = cam.record[recTitle];
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
