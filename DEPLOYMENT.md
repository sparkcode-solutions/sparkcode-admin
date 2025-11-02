# Vercel Deployment Guide

## How Vercel Deployment Works

### Automatic Deployment (Recommended)

Vercel **automatically deploys** your app when you:
1. **Push code to your Git repository** (GitHub, GitLab, or Bitbucket)
2. **Connect your repo to Vercel**

Once connected, every push to your main/master branch triggers an automatic deployment.

### Deployment Process

1. **Initial Setup** (One-time):
   - Push your code to GitHub/GitLab/Bitbucket
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project"
   - Import your Git repository
   - Vercel will detect Next.js automatically
   - Add your environment variables (Firebase config, etc.)
   - Click "Deploy"

2. **Automatic Deployments** (After setup):
   - Every time you `git push` to your main branch → Vercel automatically builds and deploys
   - Every time you create a Pull Request → Vercel creates a preview deployment
   - You get a unique URL for each deployment

### Manual Deployment (Alternative)

If you prefer to deploy manually without Git:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project directory)
vercel

# For production deployment
vercel --prod
```

### Environment Variables Setup

**CRITICAL:** You must add these in Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
NEXT_PUBLIC_ALLOWED_EMAILS=biseshbhattaraiii@gmail.com,bishesh@sparkcode.tech
```

### What Happens During Deployment

1. Vercel runs `npm install` (installs dependencies)
2. Vercel runs `npm run build` (builds your Next.js app)
3. Vercel optimizes and deploys to their CDN
4. You get a live URL (e.g., `your-app.vercel.app`)

### Deployment Status

- ✅ **Success**: Green checkmark - Your app is live
- 🟡 **Building**: Yellow circle - Deployment in progress
- ❌ **Error**: Red X - Check build logs for errors

### Custom Domain (Optional)

After deployment, you can:
- Add a custom domain in Vercel Dashboard → Settings → Domains
- Vercel automatically handles SSL certificates

### Notes

- The `vercel.json` file is configured for Next.js
- Your `public/` folder is automatically served
- Environment variables are secure and only available at build/runtime
- Each deployment creates a new immutable version
- You can rollback to previous deployments anytime

