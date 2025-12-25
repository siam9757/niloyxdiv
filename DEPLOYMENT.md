# Deployment Guide - Render.com

## Render.com Configuration

### Build Command:
```bash
pip install -r requirements.txt
```

### Start Command:
```bash
gunicorn server:app --bind 0.0.0.0:$PORT
```

## Environment Variables (Optional)

Render.com automatically provides `PORT` environment variable. No additional configuration needed for basic deployment.

## Important Notes:

1. **Database**: SQLite database will be created automatically on first run
2. **Port**: Render automatically sets `PORT` environment variable
3. **Static Files**: Frontend files are served from `frontend/` folder
4. **CORS**: Already configured for cross-origin requests

## Deployment Steps:

1. Go to Render.com dashboard
2. Click "New Web Service"
3. Connect your GitHub repository: `siam9757/niloyxdiv`
4. Set the following:
   - **Name**: License Management System (or any name)
   - **Environment**: Python 3
   - **Branch**: main
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app --bind 0.0.0.0:$PORT`
5. Click "Create Web Service"

## After Deployment:

- Your app will be available at: `https://your-app-name.onrender.com`
- Login page: `https://your-app-name.onrender.com/login`
- Admin panel: `https://your-app-name.onrender.com`
- Password: `xx9`

## Troubleshooting:

- If build fails, check Python version (should be 3.11+)
- If app doesn't start, check logs in Render dashboard
- Database will be created automatically on first request

