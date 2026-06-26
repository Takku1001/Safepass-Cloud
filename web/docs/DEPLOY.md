# SafePass Cloud - Render Deployment

## Deploy to Render (Free)

### Step 1: Push code to GitHub
1. Create a GitHub repository
2. Push your `web` folder to it

### Step 2: Deploy on Render
1. Go to https://render.com
2. Sign up/Login with GitHub
3. Click "New" → "Web Service"
4. Connect your GitHub repo
5. Configure:
   - Name: `safepass-cloud`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `npm run firebase`
6. Click "Create Web Service"

### Step 3: Add Environment Variable
After deployment, go to "Environment" tab and add:
- Key: `NODE_ENV`
- Value: `production`

Your app will be live at: `https://safepass-cloud.onrender.com`
