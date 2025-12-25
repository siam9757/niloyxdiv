const ADMIN_PASSWORD = 'xx9';
// Auto-detect API URL based on current hostname
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : `${window.location.protocol}//${window.location.host}/api`;

// Check if already logged in
if (sessionStorage.getItem('admin_authenticated') === 'true') {
    window.location.href = '/';
}

// Handle form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value.trim();
    const errorMessage = document.getElementById('errorMessage');
    const loginBtn = document.querySelector('.login-btn');
    
    // Clear previous error
    errorMessage.textContent = '';
    errorMessage.classList.remove('show');
    
    // Validate password
    if (!password) {
        errorMessage.textContent = 'Please enter password';
        errorMessage.classList.add('show');
        return;
    }
    
    // Disable button
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    
    try {
        // Check password
        if (password === ADMIN_PASSWORD) {
            // Set authentication
            sessionStorage.setItem('admin_authenticated', 'true');
            sessionStorage.setItem('admin_login_time', new Date().toISOString());
            
            // Redirect to admin panel
            window.location.href = '/';
        } else {
            errorMessage.textContent = 'Invalid password. Please try again.';
            errorMessage.classList.add('show');
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = 'An error occurred. Please try again.';
        errorMessage.classList.add('show');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
});

// Focus on password field on load
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('password').focus();
});

