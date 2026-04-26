import cv2
import numpy as np
import os
import time
import threading
from ultralytics import YOLO
from supabase import create_client, Client
from dotenv import load_dotenv

# 🔥 IMPORTS FOR WEB STREAMING
from flask import Flask, Response
from flask_cors import CORS

# ---------------------------------------------------------
# 1. SECURE DATABASE SETUP
# ---------------------------------------------------------
load_dotenv()

VITE_SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
VITE_SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_KEY")

if not VITE_SUPABASE_URL or not VITE_SUPABASE_SERVICE_KEY:
    print("ERROR: Could not find Supabase keys. Make sure your .env file is set up correctly!")
    exit()

supabase: Client = create_client(VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY)

# ⚠️ IMPORTANT: Paste your specific parking lot's UUID here!
TARGET_LOT_ID = "6928d8dc-1562-43cd-bad1-14c8bb412895" # Thesis Demo ID

def update_supabase_bg(db_id, db_status):
    """Runs the database status update in the background so the camera feed doesn't lag."""
    def run_update():
        try:
            supabase.table('parking_slots') \
                .update({'status': db_status}) \
                .eq('id', db_id) \
                .execute()
        except Exception as e:
            print(f"[CLOUD ERROR] Failed to update slot status: {e}")

    threading.Thread(target=run_update).start()

# ---------------------------------------------------------
# 2. CLOUD SYNC LOGIC (Bi-directional)
# ---------------------------------------------------------
data_lock = threading.Lock() # Protects lists while threads read/write

slot_ids = []  # Tracks the database UUID for each slot
all_slots = [] # Tracks the numpy arrays for OpenCV drawing
slot_data = [] # Tracks the current FREE/FULL status and timers
current_points = [] # Tracks the points you are currently drawing

pending_slots = [] # Slots created in the Web UI but not yet drawn in Python

def sync_db_loop():
    """Runs in background: Polls Supabase to handle web UI deletions and new pending slots."""
    global pending_slots
    while True:
        try:
            res = supabase.table('parking_slots').select('*').eq('lot_id', TARGET_LOT_ID).execute()
            db_slots = res.data

            mapped_db_ids = []
            unmapped_slots = []

            for row in db_slots:
                if row.get('coordinates'):
                    mapped_db_ids.append(row['id'])
                else:
                    unmapped_slots.append(row)

            with data_lock:
                # 1. Update pending queue for drawing
                pending_slots = unmapped_slots

                # 2. Handle Deletions (Exists locally, but deleted from Web UI)
                for i in range(len(slot_ids) - 1, -1, -1):
                    if slot_ids[i] not in mapped_db_ids:
                        print(f"🗑️ Sync: Slot removed from web UI. Deleting locally.")
                        all_slots.pop(i)
                        slot_data.pop(i)
                        slot_ids.pop(i)

        except Exception as e:
            print(f"[SYNC ERROR]: {e}")
            pass
        time.sleep(2) # Check every 2 seconds

# Start the bi-directional sync loop
sync_thread = threading.Thread(target=sync_db_loop, daemon=True)
sync_thread.start()

print("Syncing initial state with cloud...")
time.sleep(2.5) # Give it a moment to fetch data before opening camera

def save_new_slot_to_db(points_list, label):
    """Inserts a newly drawn slot directly into Supabase."""
    try:
        json_ready_points = [list(pt) for pt in points_list] 
        
        data, count = supabase.table('parking_slots').insert({
            'lot_id': TARGET_LOT_ID,
            'label': label,
            'status': 'available',
            'coordinates': json_ready_points
        }).execute()
        
        if data and len(data[1]) > 0:
            return data[1][0]['id'] 
    except Exception as e:
        print(f"[DB ERROR] Failed to save slot: {e}")
    return None

def delete_slot_from_db(db_id):
    """Deletes a slot from Supabase."""
    try:
        supabase.table('parking_slots').delete().eq('id', db_id).execute()
        print(f"[SUPABASE] Slot deleted successfully!")
    except Exception as e:
        print(f"[DB ERROR] Failed to delete slot: {e}")

# ---------------------------------------------------------
# 3. LOW-LATENCY RTSP STREAM READER
# ---------------------------------------------------------
class RTSPStream:
    def __init__(self, src):
        self.cap = cv2.VideoCapture(src)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.frame = None
        self.ret = False
        self.lock = threading.Lock()
        self.running = True
        threading.Thread(target=self._reader, daemon=True).start()
        print("RTSP stream reader started...")

    def _reader(self):
        while self.running:
            ret, frame = self.cap.read()
            with self.lock:
                self.ret = ret
                self.frame = frame

    def read(self):
        with self.lock:
            if self.frame is None:
                return False, None
            return self.ret, self.frame.copy()

    def release(self):
        self.running = False
        self.cap.release()

# ---------------------------------------------------------
# 4. FLASK WEB STREAMING SETUP
# ---------------------------------------------------------
app = Flask(__name__)
CORS(app) 

shared_frame = None
frame_lock = threading.Lock()

def generate_frames():
    """Generator that yields the latest frame for the web stream."""
    global shared_frame
    while True:
        with frame_lock:
            if shared_frame is None:
                continue
            ret, buffer = cv2.imencode('.jpg', shared_frame)
            frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.03) 

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

def run_flask():
    print("Starting Flask web server on http://127.0.0.1:5000/video_feed")
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)

flask_thread = threading.Thread(target=run_flask, daemon=True)
flask_thread.start()

# ---------------------------------------------------------
# 5. AI & CAMERA SETUP
# ---------------------------------------------------------
print("Loading custom AI brain (best.pt)...")
model = YOLO("best.pt")

# Camera RTSP Stream (Or use 0 for webcam)
video_path = "rtsp://admincam:admin123@192.168.43.161:554/stream2"
cap = RTSPStream(0) #change this 

print("Waiting for stream to stabilize...")
time.sleep(2)

# ---------------------------------------------------------
# 6. MOUSE CONTROLS (Draw/Delete Cloud Slots)
# ---------------------------------------------------------
def handle_mouse(event, x, y, flags, param):
    global current_points, all_slots, slot_data, slot_ids, pending_slots

    if event == cv2.EVENT_LBUTTONDOWN:
        current_points.append((x, y))
        if len(current_points) == 4:
            new_slot_array = np.array(current_points, np.int32)
            json_ready_points = [list(pt) for pt in current_points]

            with data_lock:
                # Check if there are slots waiting to be drawn from the web UI
                if len(pending_slots) > 0:
                    # Link to the existing unmapped slot
                    target_slot = pending_slots.pop(0) 
                    target_id = target_slot['id']
                    
                    try:
                        # Update Supabase with coordinates
                        supabase.table('parking_slots').update({
                            'coordinates': json_ready_points,
                            'status': 'available'
                        }).eq('id', target_id).execute()
                        
                        all_slots.append(new_slot_array)
                        slot_data.append({"status": "FREE", "time_in": 0})
                        slot_ids.append(target_id)
                        print(f"🔗 Mapped drawn slot to existing UI element: {target_slot['label']}")
                    except Exception as e:
                        print(f"Failed to map coordinates: {e}")
                else:
                    # No pending slots, create a brand new one
                    new_label = f"S{len(all_slots) + 1}"
                    new_db_id = save_new_slot_to_db(current_points, new_label)
                    
                    if new_db_id:
                        all_slots.append(new_slot_array)
                        slot_data.append({"status": "FREE", "time_in": 0})
                        slot_ids.append(new_db_id)
                        print(f"➕ Created brand new slot: {new_label}")
            
            current_points = []

    elif event == cv2.EVENT_RBUTTONDOWN:
        with data_lock:
            for i in range(len(all_slots)):
                if cv2.pointPolygonTest(all_slots[i], (x, y), False) >= 0:
                    delete_slot_from_db(slot_ids[i])
                    all_slots.pop(i)
                    slot_data.pop(i)
                    slot_ids.pop(i)
                    break

cv2.namedWindow("Smart Traffic Agent")
cv2.setMouseCallback("Smart Traffic Agent", handle_mouse)

print("Starting Smart Detection...")
paused = False

# ---------------------------------------------------------
# 7. MAIN AI LOOP
# ---------------------------------------------------------
while True:
    if not paused:
        ret, frame = cap.read()
        if not ret or frame is None:
            print("Camera feed ended or disconnected.")
            break

    display_frame = frame.copy()

    # Run YOLO detection
    results = model.predict(display_frame, verbose=False, conf=0.4, imgsz=416, device="cpu")

    vehicle_centers = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            cx = int((x1 + x2) / 2)
            cy = int(y2)  

            vehicle_centers.append((cx, cy))

            cv2.circle(display_frame, (cx, cy), 5, (255, 0, 0), -1)
            cv2.rectangle(display_frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 165, 0), 2)

    free_count = 0
    full_count = 0

# ---------------------------------------------------------
# 8. SLOT LOGIC & SUPABASE SYNC
# ---------------------------------------------------------
    with data_lock:
        for i, slot in enumerate(all_slots):
            is_occupied = False
            for center in vehicle_centers:
                if cv2.pointPolygonTest(slot, center, False) >= 0:
                    is_occupied = True
                    break

            slot_label = f"S{i+1}"

            if is_occupied:
                if slot_data[i]["status"] == "FREE":
                    slot_data[i]["status"] = "FULL"
                    slot_data[i]["time_in"] = time.time()
                    update_supabase_bg(slot_ids[i], "occupied")

                elapsed = int(time.time() - slot_data[i]["time_in"])
                mins, secs = divmod(elapsed, 60)

                color = (0, 0, 255)  # Red
                text = f"{slot_label}: FULL ({mins}m {secs}s)"
                full_count += 1

            else:
                if slot_data[i]["status"] == "FULL":
                    slot_data[i]["status"] = "FREE"
                    slot_data[i]["time_in"] = 0
                    update_supabase_bg(slot_ids[i], "available")

                color = (0, 255, 0)  # Green
                text = f"{slot_label}: FREE"
                free_count += 1

            cv2.polylines(display_frame, [slot], True, color, 3)
            cv2.putText(display_frame, text, (slot[0][0], slot[0][1] - 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

# ---------------------------------------------------------
# 9. UI RENDERING & FLASK SYNC
# ---------------------------------------------------------
    for point in current_points:
        cv2.circle(display_frame, point, 5, (0, 0, 255), -1)
    if len(current_points) > 1:
        cv2.polylines(display_frame, [np.array(current_points, np.int32)], False, (0, 0, 255), 2)

    # Restored UI Elements!
    cv2.rectangle(display_frame, (10, 10), (300, 100), (0, 0, 0), -1)
    cv2.putText