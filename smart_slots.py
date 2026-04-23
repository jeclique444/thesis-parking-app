import cv2
import numpy as np
import json
import os
import time
import threading
from ultralytics import YOLO
from supabase import create_client, Client
from dotenv import load_dotenv

# ---------------------------------------------------------
# 1. SECURE DATABASE SETUP
# ---------------------------------------------------------
load_dotenv() # This reads the hidden .env file

VITE_SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
VITE_SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_KEY") # Ensure this is your Service Role key!

if not VITE_SUPABASE_URL or not VITE_SUPABASE_SERVICE_KEY:
    print("❌ ERROR: Could not find Supabase keys. Make sure your .env file is set up correctly!")
    exit()

supabase: Client = create_client(VITE_SUPABASE_URL, VITE_SUPABASE_SERVICE_KEY)

def update_supabase_bg(slot_label, db_status):
    """Runs the database update in the background so the camera feed doesn't lag."""
    def run_update():
        try:
            supabase.table('parking_slots') \
                .update({'status': db_status}) \
                .eq('label', slot_label) \
                .execute()
            print(f"☁️ [SUPABASE] {slot_label} successfully marked as {db_status}")
        except Exception as e:
            print(f"❌ [CLOUD ERROR] Failed to update {slot_label}: {e}")
            
    threading.Thread(target=run_update).start()

# ---------------------------------------------------------
# 2. AI & CAMERA SETUP
# ---------------------------------------------------------
print("🧠 Loading custom AI brain (best.pt)...")
model = YOLO("best.pt")

# Tapo Camera RTSP Stream (Change to stream2 if the video lags)
video_path = "rtsp://admincam:admin123@10.21.48.81:554/stream2" 
cap = cv2.VideoCapture(0) # For testing with webcam, change to 0. Use video_path for Tapo feed.

all_slots = []
slot_data = [] 
current_points = []
slots_file = "slots.json"

def save_slots():
    slots_list = [slot.tolist() for slot in all_slots]
    with open(slots_file, 'w') as f:
        json.dump(slots_list, f)
    print("💾 Parking slots saved successfully!")

def load_slots():
    global all_slots, slot_data
    if os.path.exists(slots_file):
        try:
            with open(slots_file, 'r') as f:
                slots_list = json.load(f)
                all_slots = [np.array(slot, np.int32) for slot in slots_list]
                slot_data = [{"status": "FREE", "time_in": 0} for _ in range(len(all_slots))]
            print(f"📂 Loaded {len(all_slots)} saved slots from memory!")
        except json.JSONDecodeError:
            print("⚠️ slots.json is empty. Starting fresh!")
            all_slots = []
            slot_data = []

load_slots()

# ---------------------------------------------------------
# 3. MOUSE CONTROLS (Draw/Delete Slots)
# ---------------------------------------------------------
def handle_mouse(event, x, y, flags, param):
    global current_points, all_slots, slot_data
    
    if event == cv2.EVENT_LBUTTONDOWN:
        current_points.append((x, y))
        if len(current_points) == 4:
            all_slots.append(np.array(current_points, np.int32))
            slot_data.append({"status": "FREE", "time_in": 0}) 
            current_points = [] 
            save_slots() 
            
    elif event == cv2.EVENT_RBUTTONDOWN:
        for i in range(len(all_slots)):
            if cv2.pointPolygonTest(all_slots[i], (x, y), False) >= 0:
                all_slots.pop(i) 
                slot_data.pop(i) 
                save_slots() 
                break 

cv2.namedWindow("Smart Traffic Agent")
cv2.setMouseCallback("Smart Traffic Agent", handle_mouse)

print("🚀 Starting Smart Detection...")

# ---------------------------------------------------------
# 4. CAMERA STABILIZATION SETUP
# ---------------------------------------------------------
ret, original_frame = cap.read()
if not ret:
    print("❌ Error reading video feed. Check your Tapo connection!")
    exit()

prev_gray = cv2.cvtColor(original_frame, cv2.COLOR_BGR2GRAY)
prev_pts = cv2.goodFeaturesToTrack(prev_gray, maxCorners=200, qualityLevel=0.01, minDistance=30)
paused = False

# ---------------------------------------------------------
# 5. MAIN AI LOOP
# ---------------------------------------------------------
while True:
    if not paused:
        ret, frame = cap.read()
        if not ret:
            print("⚠️ Camera feed ended or disconnected.")
            break
            
        # Optional: Stabilization logic to prevent jitter
        #curr_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        #if prev_pts is not None:
            #curr_pts, status, err = cv2.calcOpticalFlowPyrLK(prev_gray, curr_gray, prev_pts, None)
            #good_prev = prev_pts[status == 1]
            #good_curr = curr_pts[status == 1]
            #if len(good_prev) >= 4: 
                #matrix, _ = cv2.estimateAffinePartial2D(good_curr, good_prev)
                #if matrix is not None:
                #    frame = cv2.warpAffine(frame, matrix, (frame.shape[1], frame.shape[0]))

    display_frame = frame.copy()
    
    # Run the trained AI on the frame!
    results = model.predict(display_frame, verbose=False, conf=0.5)

    vehicle_centers = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)
            vehicle_centers.append((cx, cy))
            cv2.circle(display_frame, (cx, cy), 5, (255, 0, 0), -1)

    free_count = 0
    full_count = 0

# ---------------------------------------------------------
# 6. LOGIC & SUPABASE SYNC
# ---------------------------------------------------------
    for i, slot in enumerate(all_slots):
        is_occupied = False
        for center in vehicle_centers:
            if cv2.pointPolygonTest(slot, center, False) >= 0: 
                is_occupied = True
                break
        
        slot_label = f"S{i+1}" # Maps to S1, S2, S3 in your Supabase DB

        if is_occupied:
            # Slot just went from FREE to FULL
            if slot_data[i]["status"] == "FREE":
                slot_data[i]["status"] = "FULL"
                slot_data[i]["time_in"] = time.time()
                update_supabase_bg(slot_label, "occupied")
            
            elapsed = int(time.time() - slot_data[i]["time_in"])
            mins, secs = divmod(elapsed, 60)
            
            color = (0, 0, 255) # Red
            text = f"{slot_label}: FULL ({mins}m {secs}s)"
            full_count += 1 
            
        else:
            # Slot just went from FULL to FREE
            if slot_data[i]["status"] == "FULL":
                slot_data[i]["status"] = "FREE"
                slot_data[i]["time_in"] = 0
                update_supabase_bg(slot_label, "available")
                
            color = (0, 255, 0) # Green
            text = f"{slot_label}: FREE"
            free_count += 1
            
        cv2.polylines(display_frame, [slot], True, color, 3)
        cv2.putText(display_frame, text, (slot[0][0], slot[0][1] - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    # UI Rendering
    for point in current_points:
        cv2.circle(display_frame, point, 5, (0, 0, 255), -1)
    if len(current_points) > 1:
        cv2.polylines(display_frame, [np.array(current_points, np.int32)], False, (0, 0, 255), 2)

    cv2.rectangle(display_frame, (10, 10), (300, 100), (0, 0, 0), -1)
    cv2.putText(display_frame, f"FREE SPACES: {free_count}", (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 3)
    cv2.putText(display_frame, f"FULL SPACES: {full_count}", (20, 85), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

    if paused:
        cv2.putText(display_frame, "PAUSED", (10, 140), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 3)

    cv2.imshow("Smart Traffic Agent", display_frame)

    key = cv2.waitKey(30) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('p'):
        paused = not paused 

cap.release()
cv2.destroyAllWindows()