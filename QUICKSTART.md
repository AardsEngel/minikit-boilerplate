# Quick Start Guide

Get your MiniKit app running in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up Environment

Copy `env.example` to `.env.local` and fill in your values:

```bash
cp env.example .env.local
```

**Minimum required variables:**
- `NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME` - Your app name
- `NEXT_PUBLIC_URL` - Your app URL (use `http://localhost:3000` for development)
- `NEXT_PUBLIC_ONCHAINKIT_API_KEY` - Get from [OnchainKit](https://onchainkit.xyz)

## 3. Generate Farcaster Credentials

```bash
npx create-onchain --manifest
```

This will generate the required `FARCASTER_*` environment variables.

## 4. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app!

## 5. Start Building

- Edit `app/page.tsx` to customize your main page
- Add components in `app/components/`
- Modify `app/theme.css` for styling
- Use the notification system in `lib/` for user engagement

## Need Help?

- Check the main [README.md](./README.md) for detailed documentation
- Visit [MiniKit Docs](https://docs.base.org/builderkits/minikit/overview)
- Join the [Base Discord](https://discord.gg/base) for community support

Happy building! 🚀 