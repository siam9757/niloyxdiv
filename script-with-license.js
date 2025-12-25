/**
 * License Key Validation Script
 * License Key: OSUBRP
 * Script will only work when license is active
 * Device tracking enabled
 * Server: https://niloyxdiv.onrender.com
 */

(function() {
    'use strict';
    
    // ========== CONFIGURATION ==========
    const LICENSE_KEY = 'OSUBRP';
    const API_BASE_URL = 'https://niloyxdiv.onrender.com/api';
    const CHECK_INTERVAL = 30000; // Check license every 30 seconds
    // ====================================
    
    // State variables
    let isLicenseActive = false;
    let observer = null;
    let checkInterval = null;
    let deviceFingerprint = null;

    /**
     * Generate Device Fingerprint
     * Creates a unique identifier for this device/browser
     */
    const generateDeviceFingerprint = () => {
        if (deviceFingerprint) {
            return deviceFingerprint;
        }

        // Try to get from localStorage first
        const stored = localStorage.getItem(`device_fp_${LICENSE_KEY}`);
        if (stored) {
            deviceFingerprint = stored;
            return deviceFingerprint;
        }

        // Generate fingerprint based on browser/device characteristics
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);

        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            canvas.toDataURL(),
            navigator.hardwareConcurrency || 'unknown',
            navigator.deviceMemory || 'unknown'
        ].join('|');

        // Create hash from fingerprint
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        deviceFingerprint = `fp_${Math.abs(hash).toString(36)}_${Date.now().toString(36)}`;
        
        // Store in localStorage
        localStorage.setItem(`device_fp_${LICENSE_KEY}`, deviceFingerprint);
        
        return deviceFingerprint;
    };

    /**
     * Register Device with License Server
     */
    const registerDevice = async () => {
        if (!deviceFingerprint) {
            deviceFingerprint = generateDeviceFingerprint();
        }

        try {
            const response = await fetch(`${API_BASE_URL}/devices/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    license_key: LICENSE_KEY,
                    device_fingerprint: deviceFingerprint
                }),
                mode: 'cors',
                credentials: 'omit'
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[License] Device registered. Total devices: ${data.device_count}`);
                return true;
            } else {
                // Try to get error message
                let errorMsg = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {
                    // Response is not JSON
                }
                console.warn(`[License] Device registration failed: ${errorMsg} (non-critical)`);
                return false;
            }
        } catch (error) {
            // Network errors are non-critical - don't spam console
            if (error.message && !error.message.includes('Failed to fetch')) {
                console.warn('[License] Device registration error (non-critical):', error.message);
            }
            return false;
        }
    };

    /**
     * Your Original Script Function
     */
    const hideBanner = () => {
        document.querySelectorAll('div[class*="react-features-Banner-styles-module__banner"]')
            .forEach(el => {
                // Instead of removing, just hide safely
                el.style.display = "none";
                el.style.visibility = "hidden";
                el.style.opacity = "0";
            });
    };

    /**
     * Check License Status from Server
     */
    const checkLicenseStatus = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/licenses?search=${encodeURIComponent(LICENSE_KEY)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                // Try to get error message from response
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.error || errorMsg;
                } catch (e) {
                    // Response is not JSON
                }
                console.error(`[License] Server error (${response.status}): ${errorMsg}`);
                
                // If server error, keep current state but log warning
                if (response.status >= 500) {
                    console.warn('[License] Server error detected. Keeping current license state.');
                }
                return isLicenseActive; // Keep current state on error
            }

            const licenses = await response.json();
            
            // Check if response is an error object
            if (licenses.error) {
                console.error(`[License] API error: ${licenses.error}`);
                return isLicenseActive;
            }
            
            // Check if licenses is an array
            if (!Array.isArray(licenses)) {
                console.error('[License] Invalid response format from server');
                return isLicenseActive;
            }
            
            const license = licenses.find(l => l.license_key === LICENSE_KEY);

            if (!license) {
                console.warn(`[License] License key "${LICENSE_KEY}" not found`);
                return false;
            }

            // Check if license is blocked
            const isBlocked = license.is_blocked === 1 || license.is_blocked === true;
            
            return !isBlocked; // Return true if active, false if blocked

        } catch (error) {
            console.error('[License] Error checking license:', error);
            // If network error or server down, keep current state (don't change)
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.warn('[License] Network error. Cannot reach server. Keeping current state.');
            }
            return isLicenseActive;
        }
    };

    /**
     * Start Your Script
     */
    const startScript = () => {
        if (observer) {
            return; // Already running
        }

        // Initial hide
        hideBanner();

        // Create mutation observer (your original observer)
        observer = new MutationObserver(() => {
            if (isLicenseActive) {
                hideBanner();
            }
        });

        // Start observing (your original observer setup)
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        console.log(`[License] Script started - License "${LICENSE_KEY}" is ACTIVE`);
    };

    /**
     * Stop Your Script
     */
    const stopScript = () => {
        if (observer) {
            observer.disconnect();
            observer = null;
            console.log(`[License] Script stopped - License "${LICENSE_KEY}" is BLOCKED`);
        }
    };

    /**
     * Main License Check and Control Function
     */
    const updateLicenseStatus = async () => {
        try {
            const active = await checkLicenseStatus();
            
            if (active && !isLicenseActive) {
                // License became active - register device
                isLicenseActive = true;
                await registerDevice(); // Register device when license becomes active
                startScript();
            } else if (!active && isLicenseActive) {
                // License became blocked
                isLicenseActive = false;
                stopScript();
            } else if (active && isLicenseActive) {
                // License is still active - update device last_seen (don't block on error)
                registerDevice().catch(err => {
                    console.warn('[License] Device registration update failed (non-critical):', err);
                });
            }
            // If status didn't change, do nothing
        } catch (error) {
            console.error('[License] Error in updateLicenseStatus:', error);
            // Don't change state on unexpected errors
        }
    };

    /**
     * Initialize Everything
     */
    const init = () => {
        console.log(`[License] Initializing license validation for key: ${LICENSE_KEY}`);
        console.log(`[License] Server URL: ${API_BASE_URL}`);
        
        // Generate device fingerprint
        deviceFingerprint = generateDeviceFingerprint();
        console.log(`[License] Device fingerprint: ${deviceFingerprint}`);
        
        // Initial license check (will register device if active)
        updateLicenseStatus();

        // Set up periodic checking
        checkInterval = setInterval(() => {
            updateLicenseStatus();
        }, CHECK_INTERVAL);

        // Check when page becomes visible (user switches tabs back)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                updateLicenseStatus();
            }
        });

        // Check when window gains focus
        window.addEventListener('focus', () => {
            updateLicenseStatus();
        });

        console.log(`[License] License validator initialized. Checking every ${CHECK_INTERVAL/1000} seconds.`);
    };

    /**
     * Cleanup on page unload
     */
    const cleanup = () => {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
        stopScript();
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // Export for manual control (optional - for debugging)
    window.LicenseControl = {
        check: updateLicenseStatus,
        getStatus: () => isLicenseActive,
        getLicenseKey: () => LICENSE_KEY,
        getDeviceFingerprint: () => deviceFingerprint,
        getServerURL: () => API_BASE_URL
    };

})();
