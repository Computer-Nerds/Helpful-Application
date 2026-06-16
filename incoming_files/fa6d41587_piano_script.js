let timeMinutes = document.getElementById('timer_minutes');
let timePart = document.getElementById('timer_part');
let timeSeconds = document.getElementById('timer_seconds');
let controlBtn = document.getElementById('play_btn');
let controlBtnImg = document.getElementById('play_btn_image');
let resetBtn = document.getElementById('reset_btn');

let timeInterval = null;
let remainingSeconds = 1500;

controlBtn.addEventListener("click", () => {
    if (timeInterval === null) {
        start();
    }
    else {
        stop();
    }
});
resetBtn.addEventListener("click", () => {
    remainingSeconds = 1500;
    updateInterfaceTime();
    stop();
});

function updateInterfaceTime() {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    timeMinutes.textContent = minutes;
    timeSeconds.textContent = seconds.toString().padStart(2, "0")
};


function updateInterfaceControls() {
    if (timeInterval === null) {
        controlBtn.classList.remove("pause_btn");
        controlBtn.classList.add("play_btn");
        controlBtnImg.classList.remove("pause_btn_image");
        controlBtnImg.classList.add("play_btn_image");
    }
    else {
        controlBtn.classList.add("pause_btn");
        controlBtn.classList.remove("play_btn");
        controlBtnImg.classList.add("pause_btn_image");
        controlBtnImg.classList.remove("play_btn_image");
        
    }
}

function start() {
    if (remainingSeconds === 0) return;
    timeInterval = setInterval(() => {
        remainingSeconds--;
        updateInterfaceTime();

        if(remainingSeconds === 0) {
            stop();
        }
    }, 1000);

    updateInterfaceControls();
}

function stop() {
    clearInterval(timeInterval);
    timeInterval = null;
    updateInterfaceControls();
}


let displayTimer = false;
let timerCtnr = document.getElementById('timer_container')
let timerBtn = document.getElementById('timer_btn');

timerBtn.addEventListener("click", () => {
    if (displayTimer == false) {
        timerCtnr.style.display = 'flex';
        displayTimer = true;
    }
    else if(displayTimer == true){
        timerCtnr.style.display = 'none';
        displayTimer = false;
    }
})

let start_Btn_Container = document.querySelector('.start_btn_container');
let start_Btn = document.querySelector('.start_btn');

  function startPiano() {
      start_Btn_Container.style.backgroundColor = '#ffffff';
      start_Btn.style.display = 'none'
  }


  navigator.permissions.query({ name: "midi", sysex: true }).then((result) => {
    if (result.state === "granted") {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
      // console.log('granted')
    } else if (result.state === "prompt") {
      // Using API will prompt for permission
    }
    // Permission was denied by user prompt or permission policy
  });
  
function onMIDISuccess(midiAccess) {
  for (var input of midiAccess.inputs.values()) {
    input.onmidimessage = getMIDIMessage;
  }
}

function onMIDIFailure() {
  console.log('Could not access your MIDI devices.');
}

let pressStartTime;

function getMIDIMessage(event) {
  var command = event.data[0];
  var note = event.data[1];
  var velocity = (event.data.length > 2) ? event.data[2] : 0; // a velocity value might not be included with a noteOff command
//   console.log(command);
  console.log(velocity);

  if (velocity > 0) { // When velocity is more than 0, play the sound
    pressStartTime = Date.now();
    playSound(note, velocity);
  } 
  else { // When velocity is 0, determine short or long press
      const pressDuration = Date.now() - pressStartTime;
      if (pressDuration < 200) { // Short press threshold
          handleShortPress(note);
      } else { // Long press
          handleLongPress(note);
      }
      stopSound(note);
  }
}

function playSound(note) {
  const audio = document.getElementById('note' + note);
  if (audio) {
      audio.currentTime = 0; // Reset to start
      audio.play();
  }
}

function stopSound(note) {
  const audio = document.getElementById('note' + note);
  if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0; // Reset to start
  }
}

function handleShortPress(note) {
    const audio = document.getElementById('note' + note);
    if (audio) {
        audio.currentTime = 0; // Start from the beginning
        audio.addEventListener('canplaythrough', () => {
            audio.play();
            setTimeout(() => {
                if (!audio.paused) {
                    audio.pause();
                    audio.currentTime = 0; // Reset to start
                }
            }, 2000); // Play for 200ms
        }, { once: true });
    }
    console.log('Short press detected on note', note);
}

function handleLongPress(note) {
    console.log('Long press detected on note', note);
    // Implement additional logic for long press if needed
}
console.log('larry');