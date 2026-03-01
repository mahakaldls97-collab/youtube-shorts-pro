# ClipTube AI Deployment Guide (Render.com)

Ye guide aapko **ClipTube AI** ko Render par live karne mein madad karegi.

## Step 1: GitHub Repository Setup
1. [GitHub](https://github.com/new) par jayein aur ek naya repository banayein (naam: `cliptube-ai`).
2. Aapne files pehle hi ready kar li hain. Ab unhe GitHub par upload karna hai.
   - Chunki aapke system par `git` command shayad path mein nahi hai, aap GitHub website par **"upload an existing file"** link ka use karke ye files upload kar sakte hain:
     - `server/` (poora folder)
     - `public/` (poora folder)
     - `package.json`
     - `package-lock.json`
     - `render-build.sh`
     - `.gitignore`

> [!IMPORTANT]
> `node_modules`, `temp`, `output`, aur `yt-dlp.exe` ko upload **NA KAREIN**. Ye automatic install honge.

## Step 2: Render Par Account Banayein
1. [Render.com](https://dashboard.render.com/) par jayein aur GitHub se login karein.
2. **"New +"** button par click karein aur **"Web Service"** select karein.
3. Apna `cliptube-ai` repository connect karein.

## Step 3: Configure Settings
Render par settings aise bharein:
- **Name**: `cliptube-ai`
- **Runtime**: `Node`
- **Build Command**: `bash render-build.sh`
- **Start Command**: `npm start`
- **Plan**: `Free` (Ya agar aapke paas heavy videos hain toh Paid plan behtar rahega)

## Step 4: Environment Variables (Optional)
Agar aap koi limit lagana chahte hain toh `PORT` automatic set ho jata hai.

## Step 5: Deploy!
**"Create Web Service"** par click karein. Render thoda time lega (yt-dlp download karne aur npm install karne mein). Ek baar "Live" likha aa jaye, toh aapka link taiyar hai!

---
### Kuch Zaruri Baatein:
- **Disk Space**: Render Free tier par storage permanent nahi hoti. Videos processing ke baad delete ho jayengi agar server restart hua.
- **Port 5000**: Maine code update kar diya hai, Render automatic sahi port pakad lega.
