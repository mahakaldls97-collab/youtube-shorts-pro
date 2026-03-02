# ClipTube AI Deployment Guide (Koyeb)

Ye guide aapko **ClipTube AI** ko Koyeb par live karne mein madad karegi, jo Railway ka ek behtar aur free alternative hai.

## Step 1: GitHub Setup
1. [GitHub](https://github.com/new) par jayein aur naya repository banayein: `cliptube-ai-pro`.
2. Ye files upload karein:
   - `server/` (Folder)
   - `public/` (Folder)
   - `package.json`
   - `package-lock.json`
   - `.gitignore`
   - `nixpacks.toml` (Agar hai)

## Step 2: Koyeb par Account Banayein
1. [Koyeb.com](https://app.koyeb.com/auth/signup) par jayein aur GitHub se login karein.
2. **"Create Service"** par click karein.

## Step 3: Configure Deployment
1. **GitHub** choose karein aur apna repository `cliptube-ai-pro` select karein.
2. **Instance Type**: `Nano` (Free) select karein.
3. **Build Strategy**: Koyeb automatic nixpacks use karega. 
4. **Environment Variables**: 
   - `PORT`: `5000` (Optional, Koyeb automatically handles this).
5. **App Name**: `cliptube-ai` rakhein.
6. **"Deploy"** par click karein.

---

### Kyun Koyeb?
- Koyeb ka Free tier band nahi hota agar aapka use limit mein hai.
- Bina credit card ke bhi shuru kar sakte hain (kuch regions mein).
- FFmpeg support built-in mil jayega nixpacks ki wajah se.

---
### Local Test:
Agar aap apne computer par abhi test karna chahte hain, toh terminal mein ye command chalayein:
`node server/index.js`
