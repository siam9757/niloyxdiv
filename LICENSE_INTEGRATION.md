# License Key Integration Guide

## আপনার Script এর সাথে License Key Connect করা

আপনার license key: **NWSVZT**

## ব্যবহারের নিয়ম:

### 1. **License Validator Script যোগ করুন:**

আপনার original script এর আগে `license-validator.js` file টি include করুন:

```html
<!-- License Validator (আগে load করুন) -->
<script src="license-validator.js"></script>

<!-- আপনার Original Script -->
<script>
(function () {
    const hideBanner = () => {
        document.querySelectorAll('div[class*="react-features-Banner-styles-module__banner"]')
            .forEach(el => {
                el.style.display = "none";
                el.style.visibility = "hidden";
                el.style.opacity = "0";
            });
    };

    const observer = new MutationObserver(() => {
        hideBanner();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    hideBanner();
})();
</script>
```

### 2. **License Validator Script ব্যবহার করুন:**

আপনার original script টি `license-validator.js` এর সাথে integrate করুন:

```javascript
(function() {
    // License check function
    const checkLicense = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/licenses?search=NWSVZT');
            const licenses = await response.json();
            const license = licenses.find(l => l.license_key === 'NWSVZT');
            
            if (!license || license.is_blocked === 1) {
                return false; // License blocked or not found
            }
            return true; // License active
        } catch (error) {
            console.error('License check failed:', error);
            return false;
        }
    };

    // Your original script
    const hideBanner = () => {
        document.querySelectorAll('div[class*="react-features-Banner-styles-module__banner"]')
            .forEach(el => {
                el.style.display = "none";
                el.style.visibility = "hidden";
                el.style.opacity = "0";
            });
    };

    // Start script only if license is active
    const startScript = async () => {
        const isActive = await checkLicense();
        
        if (!isActive) {
            console.log('License is blocked. Script stopped.');
            return;
        }

        hideBanner();
        
        const observer = new MutationObserver(() => {
            checkLicense().then(active => {
                if (active) {
                    hideBanner();
                } else {
                    observer.disconnect();
                    console.log('License blocked. Script stopped.');
                }
            });
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    };

    startScript();
})();
```

### 3. **Standalone Version (সবকিছু একসাথে):**

```javascript
(function() {
    'use strict';
    
    const LICENSE_KEY = 'NWSVZT';
    const API_BASE_URL = 'http://localhost:5000/api';
    let isActive = false;
    let observer = null;

    const hideBanner = () => {
        document.querySelectorAll('div[class*="react-features-Banner-styles-module__banner"]')
            .forEach(el => {
                el.style.display = "none";
                el.style.visibility = "hidden";
                el.style.opacity = "0";
            });
    };

    const checkLicense = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/licenses?search=${LICENSE_KEY}`);
            const licenses = await response.json();
            const license = licenses.find(l => l.license_key === LICENSE_KEY);
            
            if (!license) {
                return false;
            }
            
            return !(license.is_blocked === 1 || license.is_blocked === true);
        } catch (error) {
            console.error('License check error:', error);
            return false;
        }
    };

    const startScript = async () => {
        const active = await checkLicense();
        
        if (!active) {
            console.log('[License] Blocked - Script stopped');
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            return;
        }

        if (!observer) {
            isActive = true;
            hideBanner();
            
            observer = new MutationObserver(async () => {
                const stillActive = await checkLicense();
                if (stillActive) {
                    hideBanner();
                } else {
                    isActive = false;
                    observer.disconnect();
                    observer = null;
                    console.log('[License] Blocked - Script stopped');
                }
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });

            console.log('[License] Active - Script running');
        }
    };

    // Initial check
    startScript();

    // Periodic check every 30 seconds
    setInterval(startScript, 30000);

    // Check on visibility change
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            startScript();
        }
    });
})();
```

## License Status:

- **Active**: Script কাজ করবে
- **Blocked**: Script automatically stop হবে
- **Unblocked**: Script আবার start হবে

## API Endpoints:

- `GET /api/licenses?search=NWSVZT` - License status check

## Testing:

1. License Management System এ আপনার license key (NWSVZT) block করুন
2. Script automatically stop হবে
3. License unblock করুন
4. Script আবার start হবে

