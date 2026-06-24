# 🚀 Deploy Guide — Railway (Free Tier)

Railway gives you a free hobby tier that runs a persistent Node.js process — perfect for this app because we need a real server (not serverless) for the SSE streaming.

---

## 1. Run Locally First

```bash
# Install root deps (Express, pdf-lib, etc.)
cd d:\WORK\Appeal\Documenso\Merging-PDF-Web
npm install

# Install client deps (React, Vite, Tailwind)
cd client
npm install
cd ..

# Build the React frontend into client/dist
cd client && npm run build && cd ..

# Start the server (serves API + built React app)
node server.js
```

Open **http://localhost:3001** — you should see the UI.

> **Dev mode** (hot-reload):
> Terminal 1: `node server.js`
> Terminal 2: `cd client && npm run dev`
> Then open **http://localhost:3000** (proxies API calls to 3001).

---

## 2. Push to GitHub

```bash
git init
git add .
git commit -m "initial: PDF Merge Web App"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pdf-merge-web.git
git push -u origin main
```

Make sure `.gitignore` excludes `node_modules/`, `client/dist/`, `tmp_merged/`.

---

## 3. Deploy on Railway

### 3a. Create a Railway account
- Go to **https://railway.app** and sign up with GitHub (free)

### 3b. New Project
1. Click **New Project** then **Deploy from GitHub repo**
2. Select your `pdf-merge-web` repository
3. Railway will detect Node.js automatically

### 3c. Set Build and Start Commands
In the Railway dashboard:

1. Go to your service then **Settings** then **Deploy**
2. Set **Build Command**:
   ```
   npm install && cd client && npm install && npm run build && cd ..
   ```
3. Set **Start Command**:
   ```
   node server.js
   ```

### 3d. Environment Variables
Railway automatically sets `PORT` — no action needed.

### 3e. Deploy
Click **Deploy**. Railway will clone, build, and start the server.
Your app gets a public URL like: `https://pdf-merge-web-production.up.railway.app`

---

## 4. Free Tier Limits

| Resource | Free Hobby |
|---|---|
| Hours | 500 hrs/month |
| RAM | 512 MB |
| CPU | Shared |
| Sleep | Does NOT sleep (unlike Render) |

500 hours/month is plenty for a private tool used occasionally.

---

## 5. Update the Deployment

Just push to GitHub and Railway auto-deploys:

```bash
git add .
git commit -m "update: new combinations"
git push origin main
```

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| Cannot find module './config.js' | Make sure config.js is committed and not in .gitignore |
| Failed to connect in the UI | Check Railway logs — server may have crashed on startup |
| Build fails | Confirm Node 18+ is used in Railway settings |
