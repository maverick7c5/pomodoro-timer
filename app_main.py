from flask import Flask, render_template, jsonify, request
import time
import threading
import os
from werkzeug.utils import secure_filename
import shutil

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
DEFAULT_BACKGROUND = "su-san-lee-E_eWwM29wfU-unsplash.jpg"
app.background_image = DEFAULT_BACKGROUND

# Domyślne ustawienia timera
WORK_DURATION = 25 * 60
SHORT_BREAK_DURATION = 5 * 60
LONG_BREAK_DURATION = 15 * 60
pomodoro_count = 0
is_running = False
remaining_time = WORK_DURATION
current_mode = "pomodoro"
last_update = time.time()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def pomodoro_timer():
    global remaining_time, current_mode, pomodoro_count, is_running, last_update
    
    while is_running:
        now = time.time()
        if now - last_update >= 1:
            remaining_time -= 1
            last_update = now
            if remaining_time <= 0:
                break
        time.sleep(0.1)
    
    if is_running:
        play_sound = True  # Flaga informująca, że należy odtworzyć dźwięk
        if current_mode == "pomodoro":
            pomodoro_count += 1
            if pomodoro_count % 4 == 0:
                current_mode = "long_break"
                remaining_time = LONG_BREAK_DURATION
            else:
                current_mode = "short_break"
                remaining_time = SHORT_BREAK_DURATION
        else:
            current_mode = "pomodoro"
            remaining_time = WORK_DURATION
        
        if is_running:
            timer_thread = threading.Thread(target=pomodoro_timer)
            timer_thread.daemon = True
            timer_thread.start()
        
        return play_sound

@app.route('/')
def index():
    return render_template('index.html', background_image=app.background_image)

@app.route('/status')
def status():
    global last_mode_change
    return jsonify({
        'remaining_time': remaining_time,
        'is_running': is_running,
        'current_mode': current_mode,
        'pomodoro_count': pomodoro_count,
        'background_image': app.background_image,
        'should_play_sound': False  # Frontend sam decyduje o odtwarzaniu dźwięków
    })

@app.route('/start')
def start():
    global is_running, timer_thread, last_update
    
    if not is_running:
        is_running = True
        last_update = time.time()
        timer_thread = threading.Thread(target=pomodoro_timer)
        timer_thread.daemon = True
        timer_thread.start()
    
    return jsonify(success=True)

@app.route('/pause')
def pause():
    global is_running
    is_running = False
    return jsonify(success=True)

@app.route('/reset')
def reset():
    global is_running, remaining_time, current_mode, pomodoro_count
    
    is_running = False
    current_mode = "pomodoro"
    remaining_time = WORK_DURATION
    pomodoro_count = 0
    
    return jsonify(success=True)

@app.route('/switch_to_short_break', methods=['POST'])
def switch_to_short_break():
    global current_mode, remaining_time, is_running
    current_mode = "short_break"
    remaining_time = SHORT_BREAK_DURATION
    return jsonify(success=True)

@app.route('/switch_to_long_break', methods=['POST'])
def switch_to_long_break():
    global current_mode, remaining_time, is_running
    current_mode = "long_break"
    remaining_time = LONG_BREAK_DURATION
    return jsonify(success=True)

@app.route('/switch_to_pomodoro', methods=['POST'])
def switch_to_pomodoro():
    global current_mode, remaining_time, is_running
    if current_mode in ["short_break", "long_break"]:  # Tylko podczas przerw można ręcznie przejść do pomodoro
        current_mode = "pomodoro"
        remaining_time = WORK_DURATION
        if is_running:
            last_update = time.time()
    return jsonify(success=True)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'background' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['background']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        # if app.background_image:
        #     old_path = os.path.join(app.config['UPLOAD_FOLDER'], app.background_image)
        #     if os.path.exists(old_path):
        #         os.remove(old_path)
        
        file.save(filepath)
        app.background_image = filename
        return jsonify({'success': True, 'filename': filename})
    
    return jsonify({'error': 'Invalid file type'}), 400

@app.route('/remove_background', methods=['POST'])
def remove_background():
    if app.background_image:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], app.background_image)
        if os.path.exists(filepath):
            os.remove(filepath)
        app.background_image = None
    return jsonify({'success': True})

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs('static/sounds', exist_ok=True)
    app.run(debug=True, threaded=True)
