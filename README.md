# Sparkcode Admin Portal

Employee management portal for Sparkcode Solutions.

## Features

- Employee information and onboarding
- Employee days since joined tracking
- Employee promotion tracking
- Employee salary tracking (net salary without tax)
- Employee contract tracking (sent/not sent)
- Payslip generation in frontend (PDF download)
- Google Sign-in (restricted to authorized emails only)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment template:
```bash
cp env.template .env.local
```

3. Configure Firebase:
   - Create a Firebase project
   - Enable Google Authentication
   - Get your Firebase config values
   - Add them to `.env.local`

4. Set allowed emails:
   - Add comma-separated email addresses to `NEXT_PUBLIC_ALLOWED_EMAILS` in `.env.local`

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Deployment to Vercel

1. Push your code to a Git repository
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

The `vercel.json` file is already configured for Next.js deployment.

