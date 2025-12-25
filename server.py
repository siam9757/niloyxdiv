from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import sqlite3
import secrets
import os
import string
import random

app = Flask(__name__, static_folder='frontend', static_url_path='')
app.secret_key = secrets.token_hex(32)  # For session management
CORS(app, 
     supports_credentials=True,
     resources={r"/api/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response

# Database setup - use absolute path for Render.com deployment
DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'licenses.db')

def init_db():
    """Initialize the database with licenses table"""
    try:
        # Ensure directory exists
        db_dir = os.path.dirname(DATABASE)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        
        conn = sqlite3.connect(DATABASE, timeout=10.0)
        cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS licenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            amount REAL NOT NULL,
            license_key TEXT UNIQUE NOT NULL,
            devices INTEGER DEFAULT 0,
            is_blocked INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    ''')
    # Create device_registrations table for tracking devices
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS device_registrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            license_key TEXT NOT NULL,
            device_fingerprint TEXT NOT NULL,
            registered_at TEXT NOT NULL,
            last_seen TEXT NOT NULL,
            UNIQUE(license_key, device_fingerprint)
        )
    ''')
    # Add is_blocked column to existing tables if it doesn't exist
    try:
        cursor.execute('ALTER TABLE licenses ADD COLUMN is_blocked INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass  # Column already exists
    conn.commit()
    conn.close()

def update_device_count(license_key, conn=None):
    """Update device count for a license"""
    should_close = False
    if conn is None:
        conn = get_db_connection()
        should_close = True
    
    try:
        if not license_key:
            return 0
            
        cursor = conn.cursor()
        
        # Count unique devices for this license (handle case where table might not exist)
        try:
            cursor.execute('SELECT COUNT(DISTINCT device_fingerprint) FROM device_registrations WHERE license_key = ?', (license_key,))
            result = cursor.fetchone()
            device_count = result[0] if result else 0
        except sqlite3.OperationalError as e:
            # Table doesn't exist yet or other DB error, return 0
            print(f"Database operational error (non-critical): {str(e)}")
            device_count = 0
        except Exception as e:
            print(f"Error counting devices: {str(e)}")
            device_count = 0
        
        # Update device count in licenses table (only if we have a valid connection)
        try:
            cursor.execute('UPDATE licenses SET devices = ? WHERE license_key = ?', (device_count, license_key))
            conn.commit()
        except Exception as e:
            print(f"Warning: Could not update device count in licenses table: {str(e)}")
            # Don't fail - just log warning
        
        cursor.close()
        
        if should_close and conn:
            conn.close()
        
        return device_count
    except Exception as e:
        print(f"Error updating device count: {str(e)}")
        if should_close and conn:
            try:
                conn.close()
            except:
                pass
        return 0  # Return 0 on error

def get_db_connection():
    """Get database connection with error handling"""
    try:
        # Ensure database is initialized
        init_db()
        conn = sqlite3.connect(DATABASE, timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        print(f"Critical: Database connection error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        # Try to reconnect once
        try:
            # Ensure directory exists
            db_dir = os.path.dirname(DATABASE)
            if db_dir and not os.path.exists(db_dir):
                os.makedirs(db_dir, exist_ok=True)
            conn = sqlite3.connect(DATABASE, timeout=10.0)
            conn.row_factory = sqlite3.Row
            return conn
        except Exception as retry_error:
            print(f"Critical: Database reconnection failed: {str(retry_error)}")
            raise

def generate_license_key():
    """Generate a 6-character alphabet-only license key"""
    letters = string.ascii_uppercase
    return ''.join(random.choice(letters) for _ in range(6))

def validate_license_key(key):
    """Validate license key: must be 6 characters and alphabet only"""
    if not key:
        return False, "License key is required"
    if len(key) != 6:
        return False, "License key must be exactly 6 characters"
    if not key.isalpha():
        return False, "License key must contain only letters (A-Z)"
    return True, None

@app.route('/api/licenses', methods=['GET', 'OPTIONS'])
def get_licenses():
    """Handle OPTIONS preflight request"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return response
    
    """Get all licenses with optional search"""
    """Get all licenses with optional search"""
    conn = None
    try:
        search = request.args.get('search', '').strip()
        
        # Ensure database is initialized before querying
        try:
            init_db()
        except Exception as db_init_error:
            print(f"Warning: Database init check failed (non-critical): {str(db_init_error)}")
        
        conn = get_db_connection()
        
        try:
            if search:
                cursor = conn.execute(
                    'SELECT * FROM licenses WHERE username LIKE ? OR license_key LIKE ? ORDER BY id DESC',
                    (f'%{search}%', f'%{search}%')
                )
            else:
                cursor = conn.execute('SELECT * FROM licenses ORDER BY id DESC')
            
            rows = cursor.fetchall()
            licenses = []
            
            # Convert rows to dicts safely
            for row in rows:
                try:
                    if hasattr(row, 'keys'):
                        license_dict = dict(row)
                    else:
                        # Fallback if row_factory not working
                        license_dict = {
                            'id': row[0],
                            'username': row[1],
                            'amount': row[2],
                            'license_key': row[3],
                            'devices': row[4] if len(row) > 4 else 0,
                            'is_blocked': row[5] if len(row) > 5 else 0,
                            'created_at': row[6] if len(row) > 6 else ''
                        }
                    licenses.append(license_dict)
                except Exception as row_error:
                    print(f"Warning: Error converting row to dict: {str(row_error)}")
                    continue
            
            # Update device count for each license (skip if causes errors)
            for license in licenses:
                try:
                    license_key = license.get('license_key', '')
                    if not license_key:
                        license['devices'] = license.get('devices', 0)
                        continue
                    
                    # Try to update device count, but don't fail if it errors
                    try:
                        device_count = update_device_count(license_key, conn)
                        license['devices'] = device_count
                    except Exception as update_error:
                        # Keep existing device count or default to 0
                        print(f"Warning: Could not update device count for {license_key}: {str(update_error)}")
                        license['devices'] = license.get('devices', 0)
                except Exception as process_error:
                    print(f"Warning: Error processing license {license.get('id', 'unknown')}: {str(process_error)}")
                    license['devices'] = license.get('devices', 0)
            
            if conn:
                try:
                    conn.close()
                except:
                    pass
            
            response = jsonify(licenses)
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            return response
            
        except sqlite3.Error as db_error:
            print(f"Database error in get_licenses query: {str(db_error)}")
            if conn:
                try:
                    conn.close()
                except:
                    pass
            # Return empty array on database error
            response = jsonify([])
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            return response
            
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"Error in get_licenses: {error_msg}")
        print(traceback.format_exc())
        
        if conn:
            try:
                conn.close()
            except:
                pass
        
        # Return empty array instead of error to prevent script failure
        # This allows script to continue working even if server has issues
        response = jsonify([])
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response

@app.route('/api/licenses', methods=['POST', 'OPTIONS'])
def create_license():
    """Handle OPTIONS preflight request"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return response
    
    """Create a new license"""
    data = request.json
    
    username = data.get('username', '').strip()
    amount = data.get('amount', 0)
    license_key = data.get('license_key', '').strip().upper()
    
    # Validation
    if not username:
        return jsonify({'error': 'Username is required'}), 400
    
    try:
        amount = float(amount)
        if amount < 0:
            return jsonify({'error': 'Amount cannot be negative'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount'}), 400
    
    conn = get_db_connection()
    
    # Generate or validate license key
    if not license_key:
        # Generate a unique license key
        max_attempts = 100
        for _ in range(max_attempts):
            license_key = generate_license_key()
            existing = conn.execute('SELECT id FROM licenses WHERE license_key = ?', (license_key,)).fetchone()
            if not existing:
                break
        else:
            conn.close()
            return jsonify({'error': 'Unable to generate unique license key. Please try again.'}), 500
    else:
        # Validate provided license key
        is_valid, error_msg = validate_license_key(license_key)
        if not is_valid:
            conn.close()
            return jsonify({'error': error_msg}), 400
        
        # Check if license key already exists
        existing = conn.execute('SELECT id FROM licenses WHERE license_key = ?', (license_key,)).fetchone()
        if existing:
            # Auto-generate a new unique key
            max_attempts = 100
            for _ in range(max_attempts):
                license_key = generate_license_key()
                existing = conn.execute('SELECT id FROM licenses WHERE license_key = ?', (license_key,)).fetchone()
                if not existing:
                    break
            else:
                conn.close()
                return jsonify({'error': 'Unable to generate unique license key. Please try again.'}), 500
    
    # Create license
    try:
        created_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO licenses (username, amount, license_key, devices, is_blocked, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (username, amount, license_key, 0, 0, created_at)
        )
        conn.commit()
        
        # Get the created license
        license_id = cursor.lastrowid
        license_data = dict(conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,)).fetchone())
        cursor.close()
        conn.close()
        
        response = jsonify(license_data)
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 201
    except sqlite3.IntegrityError as e:
        conn.close()
        response = jsonify({'error': 'License key already exists'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        return response, 400
    except Exception as e:
        if conn:
            try:
                conn.close()
            except:
                pass
        import traceback
        error_msg = str(e)
        print(f"Error creating license: {error_msg}")
        print(traceback.format_exc())
        response = jsonify({'error': f'Server error: {error_msg}'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return response, 500

@app.route('/api/licenses/<int:license_id>', methods=['DELETE'])
def delete_license(license_id):
    """Delete a license"""
    conn = get_db_connection()
    conn.execute('DELETE FROM licenses WHERE id = ?', (license_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'License deleted successfully'}), 200

@app.route('/api/licenses/<int:license_id>', methods=['PUT'])
def update_license(license_id):
    """Update a license"""
    data = request.json
    
    conn = get_db_connection()
    existing = conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'License not found'}), 404
    
    username = data.get('username', existing['username']).strip()
    amount = data.get('amount', existing['amount'])
    license_key = data.get('license_key', existing['license_key']).strip()
    devices = data.get('devices', existing['devices'])
    
    try:
        amount = float(amount)
        devices = int(devices)
    except (ValueError, TypeError):
        conn.close()
        return jsonify({'error': 'Invalid amount or devices'}), 400
    
    # Validate and check if license key already exists (if changed)
    if license_key != existing['license_key']:
        license_key = license_key.upper()
        is_valid, error_msg = validate_license_key(license_key)
        if not is_valid:
            conn.close()
            return jsonify({'error': error_msg}), 400
        
        duplicate = conn.execute('SELECT id FROM licenses WHERE license_key = ? AND id != ?', 
                                 (license_key, license_id)).fetchone()
        if duplicate:
            conn.close()
            return jsonify({'error': 'License key already exists'}), 400
    
    conn.execute(
        'UPDATE licenses SET username = ?, amount = ?, license_key = ?, devices = ? WHERE id = ?',
        (username, amount, license_key, devices, license_id)
    )
    conn.commit()
    
    updated_license = dict(conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,)).fetchone())
    conn.close()
    
    return jsonify(updated_license), 200

@app.route('/api/licenses/<int:license_id>/block', methods=['POST'])
def block_license(license_id):
    """Block a license"""
    conn = get_db_connection()
    existing = conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'License not found'}), 404
    
    conn.execute('UPDATE licenses SET is_blocked = 1 WHERE id = ?', (license_id,))
    conn.commit()
    
    updated_license = dict(conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,)).fetchone())
    conn.close()
    
    return jsonify(updated_license), 200

@app.route('/api/licenses/<int:license_id>/unblock', methods=['POST'])
def unblock_license(license_id):
    """Unblock a license"""
    conn = get_db_connection()
    existing = conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({'error': 'License not found'}), 404
    
    conn.execute('UPDATE licenses SET is_blocked = 0 WHERE id = ?', (license_id,))
    conn.commit()
    
    updated_license = dict(conn.execute('SELECT * FROM licenses WHERE id = ?', (license_id,)).fetchone())
    conn.close()
    
    return jsonify(updated_license), 200

@app.route('/api/generate-key', methods=['GET'])
def generate_key():
    """Generate a random 6-character alphabet-only license key"""
    conn = get_db_connection()
    max_attempts = 100
    
    for _ in range(max_attempts):
        license_key = generate_license_key()
        existing = conn.execute('SELECT id FROM licenses WHERE license_key = ?', (license_key,)).fetchone()
        if not existing:
            conn.close()
            return jsonify({'license_key': license_key})
    
    conn.close()
    # If we can't find a unique key, return one anyway (very unlikely)
    license_key = generate_license_key()
    return jsonify({'license_key': license_key})

@app.route('/api/devices/register', methods=['POST', 'OPTIONS'])
def register_device():
    """Handle OPTIONS preflight request"""
    if request.method == 'OPTIONS':
        response = jsonify({})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return response
    
    """Register a device for a license key"""
    data = request.json
    
    license_key = data.get('license_key', '').strip().upper()
    device_fingerprint = data.get('device_fingerprint', '').strip()
    
    if not license_key:
        return jsonify({'error': 'License key is required'}), 400
    
    if not device_fingerprint:
        return jsonify({'error': 'Device fingerprint is required'}), 400
    
    # Validate license key format
    is_valid, error_msg = validate_license_key(license_key)
    if not is_valid:
        return jsonify({'error': error_msg}), 400
    
    conn = get_db_connection()
    
    # Check if license exists and is not blocked
    try:
        license = conn.execute('SELECT id, is_blocked FROM licenses WHERE license_key = ?', (license_key,)).fetchone()
        if not license:
            conn.close()
            return jsonify({'error': 'License key not found'}), 404
        
        # Convert Row to dict if needed
        if hasattr(license, 'keys'):
            license_dict = dict(license)
        else:
            license_dict = {'id': license[0], 'is_blocked': license[1]}
        
        if license_dict.get('is_blocked') == 1:
            conn.close()
            return jsonify({'error': 'License is blocked'}), 403
    except Exception as e:
        conn.close()
        print(f"Error checking license: {str(e)}")
        return jsonify({'error': 'Database error checking license'}), 500
        return jsonify({'error': 'License is blocked'}), 403
    
    # Register or update device
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        cursor = conn.cursor()
        
        # Check if device already exists
        existing = cursor.execute(
            'SELECT id FROM device_registrations WHERE license_key = ? AND device_fingerprint = ?',
            (license_key, device_fingerprint)
        ).fetchone()
        
        if existing:
            # Update last_seen
            cursor.execute(
                'UPDATE device_registrations SET last_seen = ? WHERE license_key = ? AND device_fingerprint = ?',
                (now, license_key, device_fingerprint)
            )
        else:
            # Insert new device
            cursor.execute(
                'INSERT INTO device_registrations (license_key, device_fingerprint, registered_at, last_seen) VALUES (?, ?, ?, ?)',
                (license_key, device_fingerprint, now, now)
            )
        
        conn.commit()
        cursor.close()
        
        # Update device count
        device_count = update_device_count(license_key)
        
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Device registered successfully',
            'device_count': device_count
        }), 200
        
    except Exception as e:
        conn.close()
        import traceback
        print(f"Error registering device: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Database error: {str(e)}'}), 500

@app.route('/api/licenses/<license_key>/devices', methods=['GET'])
def get_license_devices(license_key):
    """Get all devices for a license key"""
    license_key = license_key.upper()
    
    conn = get_db_connection()
    devices = conn.execute('''
        SELECT device_fingerprint, registered_at, last_seen 
        FROM device_registrations 
        WHERE license_key = ?
        ORDER BY last_seen DESC
    ''', (license_key,)).fetchall()
    
    device_list = [dict(row) for row in devices]
    conn.close()
    
    return jsonify(device_list), 200

@app.route('/')
def index():
    """Serve the main HTML file"""
    return send_from_directory('frontend', 'index.html')

@app.route('/login')
def login():
    """Serve the login page"""
    return send_from_directory('frontend', 'login.html')

# Initialize database on import (for Render.com deployment)
try:
    init_db()
    print("✓ Database initialized successfully")
except Exception as e:
    print(f"⚠ Warning: Database initialization error: {str(e)}")
    print("Server will continue, database will be initialized on first request")

if __name__ == '__main__':
    print("=" * 50)
    print("License Management System Server")
    print("=" * 50)
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    print(f"Server starting on http://{host}:{port}")
    print("Frontend available at: http://localhost:5000")
    print("API available at: http://localhost:5000/api")
    print("=" * 50)
    
    # Run server
    app.run(debug=True, port=port, host=host)

