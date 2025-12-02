# Render Deployment Guide

## Quick Deploy

### Step 1: Create Render Account
Go to https://render.com and sign up

### Step 2: Create New Web Service
1. Click "New" → "Web Service"
2. Connect your GitHub/GitLab repo OR use "Deploy from URL"
3. Select this folder

### Step 3: Configure Service
- **Name**: telegram-file-bot
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (or Starter for always-on)

### Step 4: Add Environment Variables
In Render Dashboard → Environment tab, add:

| Variable | Value | Required |
|----------|-------|----------|
| BOT_TOKEN | Bot 1 token from @BotFather | Yes |
| BOT2_TOKEN | Bot 2 token from @BotFather | Yes |
| BOT2_USERNAME | Bot 2 username (without @) | Yes |
| BIN_CHANNEL_ID | Storage channel ID | Yes |
| SUPABASE_URL | Supabase project URL | Yes |
| SUPABASE_ANON_KEY | Supabase anon key | Yes |
| FORCE_SUB_CHANNEL_ID | Force sub channel ID | Optional |
| FORCE_SUB_CHANNEL_LINK | Force sub channel link | Optional |

### Step 5: Deploy
Click "Create Web Service" and wait for deployment.

## Important Notes

1. **Free Plan**: Sleeps after 15 min inactivity (use UptimeRobot to keep alive)
2. **Starter Plan ($7/mo)**: Always running, recommended for bots
3. Both bots must be ADMIN in storage channel
4. If using Force Subscribe, Bot 2 must be ADMIN in that channel too

## Keep Alive (Free Plan)

Use https://uptimerobot.com to ping your Render URL every 5 minutes:
- Monitor Type: HTTP(s)
- URL: `https://your-app.onrender.com/health`
- Interval: 5 minutes

## Logs

View logs in Render Dashboard → Logs tab
