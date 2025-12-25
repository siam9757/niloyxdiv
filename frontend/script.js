// Auto-detect API URL based on current hostname
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : `${window.location.protocol}//${window.location.host}/api`;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    if (sessionStorage.getItem('admin_authenticated') !== 'true') {
        window.location.href = '/login';
        return;
    }
    
    loadLicenses();
});

// Handle form submission
document.getElementById('createLicenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const amount = parseFloat(document.getElementById('amount').value) || 0;
    let licenseKey = document.getElementById('licenseKey').value.trim().toUpperCase();
    
    // Validation
    if (!username) {
        showNotification('Please enter a username', 'error');
        return;
    }
    
    if (amount < 0) {
        showNotification('Amount cannot be negative', 'error');
        return;
    }
    
    // Validate license key format if provided
    if (licenseKey) {
        if (licenseKey.length !== 6) {
            showNotification('License key must be exactly 6 characters', 'error');
            return;
        }
        if (!/^[A-Z]+$/.test(licenseKey)) {
            showNotification('License key must contain only letters (A-Z)', 'error');
            return;
        }
    }
    
    const formData = {
        username: username,
        amount: amount,
        license_key: licenseKey
    };

    // Disable create button to prevent double submission
    const createBtn = document.querySelector('.create-btn');
    const originalText = createBtn.innerHTML;
    createBtn.disabled = true;
    createBtn.innerHTML = '<span>Creating...</span>';

    try {
        const response = await fetch(`${API_BASE_URL}/licenses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData),
            mode: 'cors',
            credentials: 'omit'
        });

        if (response.ok) {
            const license = await response.json();
            console.log('License created:', license);
            
            // Reset form
            document.getElementById('createLicenseForm').reset();
            document.getElementById('amount').value = '0';
            document.getElementById('licenseKey').value = '';
            
            // Reload licenses
            loadLicenses();
            
            // Show success message
            showNotification(`License created successfully! Key: ${license.license_key}`, 'success');
        } else {
            let errorMessage = 'Failed to create license';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
            }
            console.error('License creation failed:', errorMessage);
            showNotification(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Error creating license:', error);
        let errorMsg = 'Error creating license. ';
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMsg += 'Cannot connect to server. Please check your connection.';
        } else {
            errorMsg += error.message || 'Make sure the server is running.';
        }
        showNotification(errorMsg, 'error');
    } finally {
        // Re-enable create button
        createBtn.disabled = false;
        createBtn.innerHTML = originalText;
    }
});

// Format license key input (uppercase, letters only)
function formatLicenseKey(input) {
    // Remove non-alphabetic characters
    input.value = input.value.replace(/[^A-Za-z]/g, '');
    // Convert to uppercase
    input.value = input.value.toUpperCase();
    // Limit to 6 characters
    if (input.value.length > 6) {
        input.value = input.value.substring(0, 6);
    }
}

// Generate license key
async function generateLicenseKey() {
    try {
        const response = await fetch(`${API_BASE_URL}/generate-key`);
        if (response.ok) {
            const data = await response.json();
            document.getElementById('licenseKey').value = data.license_key.toUpperCase();
        } else {
            // Fallback: generate locally
            const key = generateRandomKey();
            document.getElementById('licenseKey').value = key;
        }
    } catch (error) {
        // Fallback: generate locally
        const key = generateRandomKey();
        document.getElementById('licenseKey').value = key;
    }
}

// Generate random 6-character alphabet-only key locally
function generateRandomKey() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let key = '';
    for (let i = 0; i < 6; i++) {
        key += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    return key;
}

// Load licenses
async function loadLicenses(searchTerm = '') {
    try {
        const url = searchTerm 
            ? `${API_BASE_URL}/licenses?search=${encodeURIComponent(searchTerm)}`
            : `${API_BASE_URL}/licenses`;
        
        const response = await fetch(url);
        if (response.ok) {
            const licenses = await response.json();
            displayLicenses(licenses);
        } else {
            console.error('Failed to load licenses');
            showNotification('Failed to load licenses', 'error');
        }
    } catch (error) {
        console.error('Error loading licenses:', error);
        const tableBody = document.getElementById('licenseTableBody');
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Error loading licenses. Make sure the server is running.</td></tr>';
    }
}

// Display licenses in table
function displayLicenses(licenses) {
    const tableBody = document.getElementById('licenseTableBody');
    
    if (licenses.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No licenses found.</td></tr>';
        return;
    }

    tableBody.innerHTML = licenses.map(license => {
        const isBlocked = license.is_blocked === 1 || license.is_blocked === true;
        const statusClass = isBlocked ? 'status-blocked' : 'status-active';
        const statusText = isBlocked ? 'Blocked' : 'Active';
        
        return `
        <tr>
            <td>${license.id}</td>
            <td>${escapeHtml(license.username)}</td>
            <td>${parseFloat(license.amount).toFixed(2)}</td>
            <td class="license-key-cell" title="${escapeHtml(license.license_key)}">${escapeHtml(license.license_key)}</td>
            <td>${license.devices || 0}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${formatDate(license.created_at)}</td>
            <td class="actions-cell">
                <button class="action-btn edit-btn" onclick="openEditModal(${license.id})" title="Edit License">Edit</button>
                ${isBlocked 
                    ? `<button class="action-btn unblock-btn" onclick="unblockLicense(${license.id})" title="Unblock License">Unblock</button>`
                    : `<button class="action-btn block-btn" onclick="blockLicense(${license.id})" title="Block License">Block</button>`
                }
                <button class="action-btn delete-btn" onclick="deleteLicense(${license.id})" title="Delete License">Delete</button>
            </td>
        </tr>
        `;
    }).join('');
}

// Block license
async function blockLicense(id) {
    if (!confirm('Are you sure you want to block this license?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/licenses/${id}/block`, {
            method: 'POST'
        });

        if (response.ok) {
            loadLicenses();
            showNotification('License blocked successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to block license', 'error');
        }
    } catch (error) {
        console.error('Error blocking license:', error);
        showNotification('Error blocking license', 'error');
    }
}

// Unblock license
async function unblockLicense(id) {
    if (!confirm('Are you sure you want to unblock this license?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/licenses/${id}/unblock`, {
            method: 'POST'
        });

        if (response.ok) {
            loadLicenses();
            showNotification('License unblocked successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to unblock license', 'error');
        }
    } catch (error) {
        console.error('Error unblocking license:', error);
        showNotification('Error unblocking license', 'error');
    }
}

// Delete license
async function deleteLicense(id) {
    if (!confirm('Are you sure you want to delete this license? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/licenses/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadLicenses();
            showNotification('License deleted successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to delete license', 'error');
        }
    } catch (error) {
        console.error('Error deleting license:', error);
        showNotification('Error deleting license', 'error');
    }
}

// Open edit modal
async function openEditModal(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/licenses`);
        if (!response.ok) {
            showNotification('Failed to load license data', 'error');
            return;
        }
        
        const licenses = await response.json();
        const license = licenses.find(l => l.id === id);
        
        if (!license) {
            showNotification('License not found', 'error');
            return;
        }
        
        // Populate form
        document.getElementById('editLicenseId').value = license.id;
        document.getElementById('editUsername').value = license.username;
        document.getElementById('editAmount').value = license.amount;
        document.getElementById('editLicenseKey').value = license.license_key;
        document.getElementById('editDevices').value = license.devices || 0;
        
        // Show modal
        document.getElementById('editModal').classList.add('show');
    } catch (error) {
        console.error('Error opening edit modal:', error);
        showNotification('Error loading license data', 'error');
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    document.getElementById('editLicenseForm').reset();
}

// Handle edit form submission
document.getElementById('editLicenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editLicenseId').value;
    const username = document.getElementById('editUsername').value.trim();
    const amount = parseFloat(document.getElementById('editAmount').value) || 0;
    let licenseKey = document.getElementById('editLicenseKey').value.trim().toUpperCase();
    const devices = parseInt(document.getElementById('editDevices').value) || 0;
    
    // Validation
    if (!username) {
        showNotification('Please enter a username', 'error');
        return;
    }
    
    if (amount < 0) {
        showNotification('Amount cannot be negative', 'error');
        return;
    }
    
    if (licenseKey.length !== 6 || !/^[A-Z]+$/.test(licenseKey)) {
        showNotification('License key must be exactly 6 letters (A-Z)', 'error');
        return;
    }
    
    const formData = {
        username: username,
        amount: amount,
        license_key: licenseKey,
        devices: devices
    };
    
    const saveBtn = document.querySelector('.btn-save');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/licenses/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            closeEditModal();
            loadLicenses();
            showNotification('License updated successfully!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Failed to update license', 'error');
        }
    } catch (error) {
        console.error('Error updating license:', error);
        showNotification('Error updating license', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
});

// Close modal when clicking outside
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
        closeEditModal();
    }
});

// Handle search
let searchTimeout;
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadLicenses(searchTerm);
    }, 300);
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear authentication
        sessionStorage.removeItem('admin_authenticated');
        sessionStorage.removeItem('admin_login_time');
        
        // Redirect to login page
        window.location.href = '/login';
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showNotification(message, type = 'info') {
    // Simple notification - you can enhance this with a toast library
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background-color: ${type === 'success' ? '#4CAF50' : '#dc3545'};
        color: white;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

