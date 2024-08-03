var recording = false;
var playing = false;
var mediaRecorder;
var audioChunks = [];
var audioBlob;
window.AudioContext = window.AudioContext || window.webkitAudioContext;
let buffer;
let source;
let timeint;
let url;
let filesize;

function humanFileSize(fileSizeInBytes) {
    var i = -1;
    var byteUnits = ['kB', 'MB', 'GB', 'TB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1000;
        i++;
    } while (fileSizeInBytes > 1000);

    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
}

function encodemp3(raw) {
    let channels = 1; //1 for mono or 2 for stereo
    let sampleRate = buffer.sampleRate; //44.1khz (normal mp3 samplerate)
    let kbps = 128; //encode 128kbps mp3
    let mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);

    let samples = raw.slice();
    for (var i = 0; i < samples.length; i++) {
        //Let's take the constant factor as 2
        samples[i] = samples[i] * 32767;
    }
    let sampleBlockSize = 1152; //can be anything but make it a multiple of 576 to make encoders life easier
    let sampleChunk;
    var mp3Data = [];
    for (var i = 0; i < samples.length; i += sampleBlockSize) {
        sampleChunk = samples.subarray(i, i + sampleBlockSize);
        var mp3buf = mp3encoder.encodeBuffer(sampleChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }
    mp3buf = mp3encoder.flush();   //finish writing mp3

    if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
    }

    var blob = new Blob(mp3Data, {type: 'audio/mp3'});
    filesize = humanFileSize(blob.size);
    return window.URL.createObjectURL(blob);
}

function hms(duration) {
    var sec_num = Math.floor(duration); // don't forget the second param
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor(sec_num / 60) % 60;
    var seconds = sec_num % 60;
    var stenths = (Math.floor(duration * 10) % 10); // tenths of a second
    if (hours === 0) {
        hours = "";
    } else {
        if (hours < 10) {
            hours = "0" + hours;
        }
        hours += ":";
    }
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    if (seconds < 10) {
        seconds = "0" + seconds;
    }

    return hours + minutes + ':' + seconds + "." + stenths;
}

function hms2(duration) {
    var sec_num = Math.floor(duration);
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor(sec_num / 60) % 60;
    var seconds = sec_num % 60;
    if (hours === 0) {
        hours = "";
    } else {
        hours += "h";
    }
    if (minutes === 0) {
        minutes = "";
    } else {
        minutes += "m";
    }
    if (seconds === 0) {
        seconds = "";
    } else {
        seconds += "s";
    }

    return hours + minutes + seconds;
}

function stopa() {
    source.stop();
}

function play() {
    $(".download-button").hide();
    audioContext = new AudioContext();
    playing = true;
    //$("#play").addClass("play-disabled").removeClass("play-enabled");
    source = audioContext.createBufferSource();
    source.buffer = buffer;

    source.connect(audioContext.destination);
    source.start(0);
    timeint = setInterval(function () {
        $(".time").html(hms(audioContext.currentTime) + " / " + hms(buffer.duration));
    }, 100);
    source.onended = function () {
        let button = $(".play-button").html("<i class=\"fas fa-play\"></i>")[0];
        button.removeEventListener("click", stopa);
        button.addEventListener('click', play);
        $(".record-button").show();
        $(".download-button").show();
        clearInterval(timeint);
        $(".time").html(`${hms2(buffer.duration)} <span class="small text-muted">${filesize} mp3</span>`);
        playing = false;
    };
    let button = $(".play-button").html("<i class=\"fas fa-stop\"></i>")[0];
    $(".record-button").hide();
    button.removeEventListener("click", play);
    button.addEventListener('click', stopa);
}

function stopr() {
    console.log("stopping recording...");
    recording = false;
    clearInterval(timeint);
    $(".time").html("");
    $(".record-button").hide()[0].removeEventListener("click", stopr);
    $(".spinner").show();
    mediaRecorder.addEventListener("stop", () => {
        audioBlob = new Blob(audioChunks);
        audioBlob.arrayBuffer()
            .then(buf => {
                let audioContext = new AudioContext();
                return audioContext.decodeAudioData(buf, audioBuffer => {
                    buffer = audioBuffer;
                    url = encodemp3(buffer.getChannelData(0));
                    $(".time").html(`${hms2(buffer.duration)} <span class="small text-muted">${filesize} mp3</span>`);
                    $(".spinner").hide();
                    $(".record-button").show().html("<i class=\"fas fa-microphone\"></i>")[0].addEventListener('click', record);
                    $(".play-button").show()[0].addEventListener('click', play);
                    $(".download-button").show().attr("href", url);

                });
            });
    });
    mediaRecorder.stop();
}

function micready(stream) {
    mediaRecorder = new MediaRecorder(stream, {mimeType: 'audio/webm\;codecs=opus'});
    mediaRecorder.start();

    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });
    $(".spinner").hide();
    $(".record-button").html("<i class=\"fas fa-stop\"></i>").show()[0].addEventListener('click', stopr);
    recording = true;
    var start = Date.now() / 1000;
    timeint = setInterval(function () {
        $(".time").html(hms(Date.now() / 1000 - start));
    }, 100);
    console.log("recording");
}

function record() {
    console.log("about to record...");
    $(".record-button").hide()[0].removeEventListener("click", record);
    $(".spinner").show();
    $(".play-button").hide();
    $(".download-button").hide();
    if (navigator.mediaDevices) {
        audioChunks = [];
        navigator.mediaDevices.getUserMedia({
            audio: {
                autoGainControl: true,
                noiseSuppression: true,
                echoCancellation: true
            }
        }).catch(function () {
            console.log("browser doesnt support constraints probably, retrying without");
            navigator.mediaDevices.getUserMedia({audio: true, video: false})
                .catch(function () {
                    alert("There was an error starting voxcord. If you're using an iPhone, you need to enable MediaRecorder. Go to Settings > Safari > Advanced > Experimental Features > MediaRecorder.");
                })
                .then(micready);
        })
            .then(micready);
    } else {
        alert("Your browser doesn't support voxcord. Please update.");
    }


}

$(document).ready(function () {
    $(".record-button")[0].addEventListener('click', record);
});
File.prototype.arrayBuffer = File.prototype.arrayBuffer || myArrayBuffer;
Blob.prototype.arrayBuffer = Blob.prototype.arrayBuffer || myArrayBuffer;

function myArrayBuffer() {
    return new Promise((resolve) => {
        let fr = new FileReader();
        fr.onload = () => {
            resolve(fr.result);
        };
        fr.readAsArrayBuffer(this);
    })
}


