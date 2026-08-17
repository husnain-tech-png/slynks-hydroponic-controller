#!/usr/bin/env python3
"""
SLYNKS HYDROPONIC CONTROLLER - PRODUCTION BACKEND SERVER
Handles hardware REST ingestion, actuator commands, and verified Pakistani payment ledger.
"""

import os
import json
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse

PORT = 8080
DB_FILE = os.path.join(os.path.dirname(__file__), "payments_db.json")

# In-memory hardware telemetry cache
latest_hardware_telemetry = {
    "online": False,
    "lastSeen": None,
    "telemetry": None,
    "deviceId": "ESP32_NODE_01"
}

def load_payments_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "designatedNumber": "03154483615",
        "accountTitle": "Slynks Hydroponics / Official Receiver",
        "transactions": []
    }

def save_payments_db(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

class SlynksRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS and no-cache headers for API
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        # API: Get Latest Hardware Telemetry
        if path == "/api/hardware/telemetry":
            # Check timeout (if > 15 seconds without packet, mark offline)
            if latest_hardware_telemetry["lastSeen"]:
                elapsed = time.time() - latest_hardware_telemetry["lastSeen"]
                if elapsed > 15:
                    latest_hardware_telemetry["online"] = False
            self.send_json(200, latest_hardware_telemetry)
            return

        # API: Payment Status Inquiry
        elif path.startswith("/api/payments/status/"):
            trx_id = path.replace("/api/payments/status/", "").strip().upper()
            db = load_payments_db()
            tx = next((t for t in db["transactions"] if t.get("trxId", "").upper() == trx_id), None)
            if tx:
                self.send_json(200, {"found": True, "transaction": tx})
            else:
                self.send_json(404, {"found": False, "message": "Transaction ID not found in ledger."})
            return

        # API: Admin List Transactions
        elif path == "/api/admin/payments":
            db = load_payments_db()
            self.send_json(200, db)
            return

        # Default static file handler
        return super().do_GET()

    def do_POST(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        content_length = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else "{}"
        
        try:
            body = json.loads(post_body)
        except Exception:
            body = {}

        # API: Ingest Telemetry from ESP32 WiFi
        if path == "/api/hardware/ingest":
            global latest_hardware_telemetry
            latest_hardware_telemetry = {
                "online": True,
                "lastSeen": time.time(),
                "telemetry": body,
                "deviceId": body.get("deviceId", "ESP32_HYDRO_NODE")
            }
            print(f"[Hardware Ingest] Real telemetry received from {latest_hardware_telemetry['deviceId']}")
            self.send_json(200, {"status": "ACK", "received": True})
            return

        # API: Dispatch Command to Hardware
        elif path == "/api/hardware/control":
            print(f"[Hardware Control] Command dispatched: {body}")
            self.send_json(200, {"status": "DISPATCHED", "cmd": body})
            return

        # API: Submit New Payment for Verification (Status: PENDING)
        elif path == "/api/payments/submit":
            sender_name = body.get("senderName", "").strip()
            sender_mobile = body.get("senderMobile", "").strip()
            payment_channel = body.get("paymentChannel", "Easypaisa")
            trx_id = body.get("trxId", "").strip().upper()
            amount = body.get("amount", "50")

            if not sender_mobile or not trx_id:
                self.send_json(400, {"error": "Sender mobile number and Transaction/Reference ID are required."})
                return

            db = load_payments_db()

            # Prevent duplicate TRX IDs
            if any(t.get("trxId", "").upper() == trx_id for t in db["transactions"]):
                self.send_json(409, {"error": "This Transaction ID has already been submitted."})
                return

            new_tx = {
                "trxId": trx_id,
                "senderName": sender_name or "Subscriber",
                "senderMobile": sender_mobile,
                "paymentChannel": payment_channel,
                "amount": f"₨ {amount} PKR",
                "designatedReceiver": db["designatedNumber"],
                "status": "PENDING", # Strictly PENDING until verified by admin
                "submissionTime": time.strftime("%Y-%m-%d %H:%M:%S PST", time.localtime()),
                "verificationTime": None,
                "adminNotes": "Awaiting bank statement confirmation"
            }

            db["transactions"].insert(0, new_tx)
            save_payments_db(db)

            print(f"[Payment Submission] New payment submitted: {trx_id} (Status: PENDING)")
            self.send_json(201, {
                "success": True,
                "status": "PENDING",
                "message": "Payment submitted successfully. Awaiting admin verification.",
                "transaction": new_tx
            })
            return

        # API: Admin Verify / Reject Payment
        elif path == "/api/admin/verify":
            trx_id = body.get("trxId", "").strip().upper()
            new_status = body.get("status", "").strip().upper() # 'VERIFIED' or 'REJECTED'
            admin_notes = body.get("notes", "")

            if new_status not in ["VERIFIED", "REJECTED"]:
                self.send_json(400, {"error": "Status must be VERIFIED or REJECTED."})
                return

            db = load_payments_db()
            tx = next((t for t in db["transactions"] if t.get("trxId", "").upper() == trx_id), None)
            
            if not tx:
                self.send_json(404, {"error": "Transaction ID not found."})
                return

            tx["status"] = new_status
            tx["verificationTime"] = time.strftime("%Y-%m-%d %H:%M:%S PST", time.localtime())
            tx["adminNotes"] = admin_notes or ("Verified and approved" if new_status == "VERIFIED" else "Rejected")
            save_payments_db(db)

            print(f"[Admin Verification] Transaction {trx_id} updated to {new_status}")
            self.send_json(200, {
                "success": True,
                "message": f"Transaction {trx_id} marked as {new_status}.",
                "transaction": tx
            })
            return

        self.send_json(404, {"error": "Endpoint not found"})

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, SlynksRequestHandler)
    print(f"🚀 Slynks Production Server running at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
