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
load_dotenv()

VITE_SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
VITE_SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_KEY")

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
# 2. LOW-LATENCY RTSP STREAM READER
#    Continuously drains the camera buffer in a background
#    thread so your main loop always gets the latest frame.
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
        print("📡 RTSP stream reader started...")

    def _reader(self):
        """Continuously reads and discards frames, keeping only the latest."""
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
# 3. AI & CAMERA SETUP
# ---------------------------------------------------------
print("🧠 Loading custom AI brain (best.pt)...")
model = YOLO("best.pt")

# Use stream2 for lower latency (substream). Switch to stream1 if you need higher resolution.
video_path = "rtsp://admincam:admin123@10.0.1.69:554/stream2"

# For webcam testing, replace RTSPStream(video_path) with cv2.VideoCapture(0)
cap = RTSPStream(video_path)

# Wait briefly for the stream reader to grab the first frame
print("⏳ Waiting for stream to stabilize...")
time.sleep(2)

ret, original_frame = cap.read()
if not ret or original_frame is None:
    print("❌ Error reading video feed. Check your Tapo connection!")
    exit()

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
            print("⚠️ slots.json is empty or corrupted. Starting fresh!")
            all_slots = []
            slot_data = []

load_slots()

# ---------------------------------------------------------
# 4. MOUSE CONTROLS (Draw/Delete Slots)
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
paused = False

# ---------------------------------------------------------
# 5. MAIN AI LOOP
# ---------------------------------------------------------
while True:
    if not paused:
        ret, frame = cap.read()
        if not ret or frame is None:
            print("⚠️ Camera feed ended or disconnected.")
            break

    display_frame = frame.copy()

    # Run YOLO detection
    # - imgsz=640: good balance of speed vs accuracy. Drop to 416 if still slow on CPU.
    # - conf=0.4: slightly more sensitive than 0.5; tune up if you get false positives.
    # - device=0: uses GPU (CUDA). Remove or set device='cpu' if you don't have a GPU.
    results = model.predict(display_frame, verbose=False, conf=0.4, imgsz=416, device="mps")

    vehicle_centers = []
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = box.xyxy[0]

            # Use bottom-center instead of true center.
            # For angled/top-down cameras this lands closer to where
            # the vehicle actually sits in the parking slot.
            cx = int((x1 + x2) / 2)
            cy = int(y2)  # bottom edge of bounding box

            vehicle_centers.append((cx, cy))

            # Draw the centroid point and bounding box for debugging
            cv2.circle(display_frame, (cx, cy), 5, (255, 0, 0), -1)
            cv2.rectangle(display_frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 165, 0), 2)

            # Optional: print detected class names to verify your model's output
            # class_name = model.names[int(box.cls[0])]
            # print(f"Detected: {class_name}")

    free_count = 0
    full_count = 0

# ---------------------------------------------------------
# 6. SLOT LOGIC & SUPABASE SYNC
# ---------------------------------------------------------
    for i, slot in enumerate(all_slots):
        is_occupied = False
        for center in vehicle_centers:
            if cv2.pointPolygonTest(slot, center, False) >= 0:
                is_occupied = True
                break

        slot_label = f"S{i+1}"  # Maps to S1, S2, S3... in your Supabase DB

        if is_occupied:
            if slot_data[i]["status"] == "FREE":
                slot_data[i]["status"] = "FULL"
                slot_data[i]["time_in"] = time.time()
                update_supabase_bg(slot_label, "occupied")

            elapsed = int(time.time() - slot_data[i]["time_in"])
            mins, secs = divmod(elapsed, 60)

            color = (0, 0, 255)  # Red
            text = f"{slot_label}: FULL ({mins}m {secs}s)"
            full_count += 1

        else:
            if slot_data[i]["status"] == "FULL":
                slot_data[i]["status"] = "FREE"
                slot_data[i]["time_in"] = 0
                update_supabase_bg(slot_label, "available")

            color = (0, 255, 0)  # Green
            text = f"{slot_label}: FREE"
            free_count += 1

        cv2.polylines(display_frame, [slot], True, color, 3)
        cv2.putText(display_frame, text, (slot[0][0], slot[0][1] - 15),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

# ---------------------------------------------------------
# 7. UI RENDERING
# ---------------------------------------------------------
    # Draw in-progress slot points
    for point in current_points:
        cv2.circle(display_frame, point, 5, (0, 0, 255), -1)
    if len(current_points) > 1:
        cv2.polylines(display_frame, [np.array(current_points, np.int32)], False, (0, 0, 255), 2)

    # Stats overlay
    cv2.rectangle(display_frame, (10, 10), (300, 100), (0, 0, 0), -1)
    cv2.putText(display_frame, f"FREE SPACES: {free_count}", (20, 45),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 3)
    cv2.putText(display_frame, f"FULL SPACES: {full_count}", (20, 85),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

    if paused:
        cv2.putText(display_frame, "PAUSED", (10, 140),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 3)

    cv2.imshow("Smart Traffic Agent", display_frame)

    key = cv2.waitKey(30) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('p'):
        paused = not paused

# ---------------------------------------------------------
# 8. CLEANUP
# ---------------------------------------------------------
cap.release()
cv2.destroyAllWindows()
print("👋 Stream closed. Goodbye!")
