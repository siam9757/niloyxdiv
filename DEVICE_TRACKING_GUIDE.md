# Device Tracking System Guide

## Overview

Device tracking system automatically counts how many unique devices are using each license key. Each device is counted only once, even if the license is activated multiple times on the same device.

## How It Works

### 1. **Device Fingerprint Generation**
- When a user activates a license key, the system generates a unique device fingerprint
- Fingerprint is based on:
  - Browser User Agent
  - Screen resolution
  - Timezone
  - Canvas fingerprint
  - Hardware information
- Fingerprint is stored in browser's localStorage

### 2. **Device Registration**
- When license becomes active, device is automatically registered
- Same device activating multiple times = counted as 1 device
- Different devices = each counted separately

### 3. **Device Count Update**
- Device count is automatically updated in the licenses table
- Count shows in the "Devices" column in License List

## API Endpoints

### Register Device
```
POST /api/devices/register
Body: {
    "license_key": "NWSVZT",
    "device_fingerprint": "fp_abc123_xyz789"
}
Response: {
    "success": true,
    "message": "Device registered successfully",
    "device_count": 3
}
```

### Get Devices for License
```
GET /api/licenses/{license_key}/devices
Response: [
    {
        "device_fingerprint": "fp_abc123_xyz789",
        "registered_at": "2025-12-26 04:30:00",
        "last_seen": "2025-12-26 04:35:00"
    }
]
```

## Database Schema

### device_registrations Table
```sql
CREATE TABLE device_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT NOT NULL,
    device_fingerprint TEXT NOT NULL,
    registered_at TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    UNIQUE(license_key, device_fingerprint)
);
```

## Usage in Script

The `script-with-license.js` automatically:
1. Generates device fingerprint on first load
2. Registers device when license becomes active
3. Updates device count on server
4. Shows device count in License Management System

## Testing

1. **Create a license** with key "NWSVZT"
2. **Load script** in browser - device count = 1
3. **Load same script** in same browser again - device count still = 1 (same device)
4. **Load script** in different browser/device - device count = 2 (different device)
5. **Check License List** - Devices column shows the count

## Features

✅ **Unique Device Counting** - Same device counted only once
✅ **Automatic Registration** - No manual action needed
✅ **Real-time Updates** - Device count updates immediately
✅ **Persistent Storage** - Device fingerprint stored in localStorage
✅ **Cross-browser Support** - Works in all modern browsers

## Notes

- Device fingerprint is stored in localStorage per license key
- Clearing browser data will generate a new fingerprint
- Device count updates automatically when device registers
- Blocked licenses cannot register new devices

