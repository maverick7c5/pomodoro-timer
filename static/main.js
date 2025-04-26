// === Constants ===
const WORK_DURATION = 25 * 60;
const SHORT_BREAK_DURATION = 5 * 60;
const LONG_BREAK_DURATION = 15 * 60;
const POMODOROS_PER_CYCLE = 4;

// === DOM Elements ===
const timerDisplay = document.getElementById('timerDisplay');
const pomodoroCount = document.getElementById('pomodoroCount');
const body = document.body;
const settingsPanel = document.getElementById('settingsPanel');
const backgroundForm = document.getElementById('backgroundForm');
const backgroundInput = document.getElementById('backgroundInput');
const fileName = document.getElementById('fileName');
const errorMessage = document.getElementById('errorMessage');
const uploadBtn = document.getElementById('uploadBtn');
const removeBackgroundBtn = document.getElementById('removeBackgroundBtn');
const settingsToggle = document.getElementById('settingsToggle');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const pomodoroBtn = document.getElementById('pomodoroBtn');
const shortBreakBtn = document.getElementById('shortBreakBtn');
const longBreakBtn = document.getElementById('longBreakBtn');
const volumeSlider = document.getElementById('volumeSlider');
const volumeControl = document.getElementById('volumeControl');
const volumeIcon = document.getElementById('volumeIcon');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const spotifyButton = document.getElementById('spotifyButton');

const pomodoroStartSound = document.getElementById('pomodoroStartSound');
const shortBreakStartSound = document.getElementById('shortBreakStartSound');
const longBreakStartSound = document.getElementById('longBreakStartSound');
const timerStartSound = document.getElementById('timerStartSound');

// === State ===
let currentMode = 'pomodoro';
let lastUpdateTime = 0;
let animationFrameId;
let completedPomodoros = 0;
let lastMode = null;
let isFirstUpdate = true;
let volume = 0.5;

// === Volume Control ===
function updateAllSoundsVolume() {
  const sounds = [
    pomodoroStartSound,
    shortBreakStartSound,
    longBreakStartSound,
    timerStartSound
  ];
  
  sounds.forEach(sound => {
    if (sound) sound.volume = volume;
  });
}

function updateVolumeIcon() {
  if (volume === 0) {
    volumeIcon.className = 'fas fa-volume-mute';
  } else if (volume < 0.5) {
    volumeIcon.className = 'fas fa-volume-down';
  } else {
    volumeIcon.className = 'fas fa-volume-up';
  }
}

function initVolume() {
  const savedVolume = localStorage.getItem('pomodoroVolume');
  if (savedVolume !== null) {
    volume = parseFloat(savedVolume);
    volumeSlider.value = volume;
  }
  updateAllSoundsVolume();
  updateVolumeIcon();
}

// === Sound Functions ===
function playSound(sound) {
  if (!sound) return;
  
  sound.volume = volume;
  sound.currentTime = 0;
  
  sound.pause();
  
  setTimeout(() => {
    sound.play().catch(e => {
      console.log("Playback prevented, trying fallback");
      sound.volume = 0;
      sound.play().then(() => {
        sound.volume = volume;
      }).catch(e => console.log("Fallback failed"));
    });
  }, 50);
}

// === Timer Functions ===
function updateActiveButton(mode) {
  [pomodoroBtn, shortBreakBtn, longBreakBtn].forEach(btn => btn.classList.remove('active'));
  if (mode === 'pomodoro') pomodoroBtn.classList.add('active');
  if (mode === 'short_break') shortBreakBtn.classList.add('active');
  if (mode === 'long_break') longBreakBtn.classList.add('active');
}

function updatePomodoroCount(count) {
  pomodoroCount.innerHTML = '';
  
  const totalCycles = Math.ceil(count / POMODOROS_PER_CYCLE);
  
  for (let cycle = 0; cycle < totalCycles; cycle++) {
    const cycleContainer = document.createElement('div');
    cycleContainer.className = 'pomodoro-cycle';
    
    const sessionsInCycle = Math.min(
      POMODOROS_PER_CYCLE,
      count - (cycle * POMODOROS_PER_CYCLE)
    );
    
    for (let i = 0; i < sessionsInCycle; i++) {
      const icon = document.createElement('i');
      icon.className = 'fas fa-check-circle pomodoro-icon';
      cycleContainer.appendChild(icon);
    }
    
    pomodoroCount.appendChild(cycleContainer);
  }
}

function updateDisplay(seconds, mode, count, bgImage) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  if (mode !== currentMode || isFirstUpdate) {
    if (!isFirstUpdate && currentMode) {
      if (currentMode === 'pomodoro') playSound(pomodoroStartSound);
      if (currentMode === 'short_break') playSound(shortBreakStartSound);
      if (currentMode === 'long_break') playSound(longBreakStartSound);
    }
    lastMode = currentMode;
    currentMode = mode;
    updateActiveButton(mode);
    body.className = `${mode.replace('_', '-')}-mode`;
    isFirstUpdate = false;
  }
  updatePomodoroCount(count);

  body.style.backgroundImage = bgImage
    ? `url('/static/uploads/${bgImage}')`
    : "url('/static/default_backgrounds/default_bg.jpg')";
}

async function fetchStatus() {
  try {
    const response = await fetch('/status');
    if (!response.ok) throw new Error('Network error');
    const data = await response.json();
    completedPomodoros = data.pomodoro_count;
    updateDisplay(data.remaining_time, data.current_mode, completedPomodoros, data.background_image);
  } catch (error) {
    console.error('Error fetching status:', error);
  }
}

function smoothUpdate() {
  const now = Date.now();
  if (now - lastUpdateTime >= 1000) {
    fetchStatus();
    lastUpdateTime = now;
  }
  animationFrameId = requestAnimationFrame(smoothUpdate);
}

// === Event Listeners ===
startBtn.addEventListener('click', async () => {
  try {
    timerStartSound.volume = volume;
    await timerStartSound.play();
    timerStartSound.pause();
  } catch {}
  const res = await fetch('/start');
  if (res.ok) playSound(timerStartSound);
});

pauseBtn.addEventListener('click', () => fetch('/pause').catch(console.error));
resetBtn.addEventListener('click', () => fetch('/reset').catch(console.error));

pomodoroBtn.addEventListener('click', async () => {
  const status = await fetch('/status').then(res => res.json());
  if (['short_break', 'long_break'].includes(status.current_mode)) {
    await fetch('/switch_to_pomodoro', { method: 'POST' });
    await fetch('/start', { method: 'POST' });
    fetchStatus();
  }
});

shortBreakBtn.addEventListener('click', () => 
  fetch('/switch_to_short_break', { method: 'POST' }).then(fetchStatus));
longBreakBtn.addEventListener('click', () => 
  fetch('/switch_to_long_break', { method: 'POST' }).then(fetchStatus));

settingsToggle.addEventListener('click', () => {
  settingsPanel.style.display = settingsPanel.style.display === 'block' ? 'none' : 'block';
});

closeSettingsBtn.addEventListener('click', () => {
  settingsPanel.style.display = 'none';
});

backgroundInput.addEventListener('change', (e) => {
  fileName.textContent = e.target.files[0]?.name || 'No file selected';
  errorMessage.textContent = '';
});

backgroundForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = backgroundInput.files[0];
  if (!file) return errorMessage.textContent = 'Please select a file first';

  const formData = new FormData();
  formData.append('background', file);

  try {
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    const response = await fetch('/upload', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Upload failed');

    fileName.textContent = `Current: ${data.filename}`;
    errorMessage.textContent = '';
    fetchStatus();
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload';
  }
});

removeBackgroundBtn.addEventListener('click', async () => {
  try {
    await fetch('/remove_background', { method: 'POST' });
    fileName.textContent = 'No background';
    backgroundInput.value = '';
    fetchStatus();
  } catch (error) {
    errorMessage.textContent = error.message;
  }
});

volumeSlider.addEventListener('input', (e) => {
  volume = parseFloat(e.target.value);
  localStorage.setItem('pomodoroVolume', volume);
  updateAllSoundsVolume();
  updateVolumeIcon();
});

volumeSlider.addEventListener('change', (e) => {
  volume = parseFloat(e.target.value);
  localStorage.setItem('pomodoroVolume', volume);
  updateAllSoundsVolume();
  updateVolumeIcon();
});

spotifyButton.addEventListener('click', () => {
  window.open('https://open.spotify.com/playlist/0Ec6DatLDguXsx4UDntZbw', '_blank');
});

// === Initialization ===
window.addEventListener('DOMContentLoaded', () => {
  initVolume();
  smoothUpdate();
  fetchStatus();
});

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(animationFrameId);
});
