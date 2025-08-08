This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Prep this app for production on Vercel:

1. Set environment variables in Project Settings → Environment Variables
   - `NEXT_PUBLIC_API_URL` (e.g., https://api.example.com)
   - `NEXT_PUBLIC_WS_URL` (e.g., wss://api.example.com/api/ws)
2. Framework preset: Next.js
3. Build command: `next build`
4. Output: Next.js (App Router)
5. Optional: add a production `DISABLE_CSP=false` in Vercel envs (CSP should not be disabled in prod).

Local production test:

- `npm ci`
- `npm run build`
- `npm start`
