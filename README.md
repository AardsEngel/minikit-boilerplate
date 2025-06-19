# MiniKit Boilerplate Template

A [Next.js](https://nextjs.org) boilerplate template for building MiniKit applications, configured with:

- [MiniKit](https://docs.base.org/builderkits/minikit/overview) - Farcaster Frame SDK
- [OnchainKit](https://www.base.org/builders/onchainkit) - Base blockchain components
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework
- [Next.js](https://nextjs.org/docs) - React framework
- [Redis](https://upstash.com) - Background notifications support
- [TypeScript](https://www.typescriptlang.org) - Type safety

## Quick Start

> 🚀 **Want to get started immediately?** Check out [QUICKSTART.md](./QUICKSTART.md) for a 5-minute setup guide!

1. **Clone or download this template**

2. **Install dependencies:**
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. **Set up environment variables:**

Create a `.env.local` file in your project root and add the following variables:

```bash
# Required - OnchainKit Configuration
NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME="Your App Name"
NEXT_PUBLIC_URL="http://localhost:3000"
NEXT_PUBLIC_ICON_URL="http://localhost:3000/icon.png"
NEXT_PUBLIC_ONCHAINKIT_API_KEY="your-onchainkit-api-key"

# Required - Frame Metadata (get these from `npx create-onchain --manifest`)
FARCASTER_HEADER="your-farcaster-header"
FARCASTER_PAYLOAD="your-farcaster-payload"
FARCASTER_SIGNATURE="your-farcaster-signature"

# Required - App Display Information
NEXT_PUBLIC_APP_ICON="http://localhost:3000/icon.png"
NEXT_PUBLIC_APP_SUBTITLE="Your app subtitle"
NEXT_PUBLIC_APP_DESCRIPTION="Your app description"
NEXT_PUBLIC_APP_SPLASH_IMAGE="http://localhost:3000/splash.png"
NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR="#ffffff"
NEXT_PUBLIC_APP_PRIMARY_CATEGORY="social"
NEXT_PUBLIC_APP_HERO_IMAGE="http://localhost:3000/hero.png"
NEXT_PUBLIC_APP_TAGLINE="Your app tagline"
NEXT_PUBLIC_APP_OG_TITLE="Your App Name"
NEXT_PUBLIC_APP_OG_DESCRIPTION="Your app description"
NEXT_PUBLIC_APP_OG_IMAGE="http://localhost:3000/hero.png"

# Optional - Redis for Background Notifications
REDIS_URL="your-redis-url"
REDIS_TOKEN="your-redis-token"
```

4. **Generate Farcaster Account Association:**

Run this command to generate the required Farcaster environment variables:
```bash
npx create-onchain --manifest
```

5. **Start the development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## Features

### 🎯 **Ready-to-Use Components**
- Pre-configured MiniKit provider setup
- OnchainKit wallet integration
- Responsive UI components
- Custom theme with dark/light mode support

### 🔔 **Background Notifications**
- Redis-backed notification system
- Webhook endpoints for frame events
- Notification client utilities
- User notification preferences management

### 🎨 **Modern UI/UX**
- Tailwind CSS with custom theme variables
- Responsive design for mobile and desktop
- Beautiful animations and transitions
- Geist font integration

### ⚡ **Developer Experience**
- TypeScript for type safety
- ESLint and Prettier configuration
- Hot reload development
- Production-ready build system

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── notify/          # Notification API endpoint
│   │   └── webhook/         # Webhook for frame events
│   ├── components/          # Your React components
│   ├── .well-known/
│   │   └── farcaster.json/  # Frame configuration
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Main page component
│   ├── providers.tsx        # MiniKit provider setup
│   └── theme.css            # Custom theme variables
├── lib/
│   ├── notification.ts      # Notification utilities
│   ├── notification-client.ts # Client for sending notifications
│   └── redis.ts             # Redis configuration
└── public/                  # Static assets
```

## Customization

### 1. **Update Your App Information**
Edit the environment variables in `.env.local` to match your app's branding and configuration.

### 2. **Customize the Theme**
Modify `app/theme.css` to change colors, fonts, and styling:
```css
:root {
  --app-background: #ffffff;
  --app-foreground: #111111;
  --app-accent: #0052ff;
  /* ... more variables */
}
```

### 3. **Build Your Components**
Create your app components in `app/components/` and import them into `app/page.tsx`.

### 4. **Add Your Logic**
- Modify `app/page.tsx` for your main app interface
- Add API routes in `app/api/` for backend functionality
- Use the notification system for user engagement

## Environment Setup

### Getting OnchainKit API Key
1. Visit [OnchainKit](https://onchainkit.xyz)
2. Create an account and get your API key
3. Add it to your `.env.local` file

### Setting Up Redis (Optional)
For background notifications, you'll need a Redis instance:
1. Sign up at [Upstash](https://upstash.com)
2. Create a Redis database
3. Add the connection details to your `.env.local`

### Farcaster Frame Setup
1. Run `npx create-onchain --manifest` in your project directory
2. Follow the prompts to generate frame association credentials
3. Copy the generated values to your `.env.local`

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add your environment variables in the Vercel dashboard
4. Deploy!

### Other Platforms
This template works with any Node.js hosting platform. Make sure to:
- Set all environment variables
- Run `npm run build` to create a production build
- Serve the application with `npm start`

## Examples

Check out the `examples/` directory for practical usage examples:
- `notification-example.ts` - How to send notifications to users

## Learn More

- [MiniKit Documentation](https://docs.base.org/builderkits/minikit/overview)
- [OnchainKit Documentation](https://docs.base.org/builderkits/onchainkit/getting-started)
- [Farcaster Frame SDK](https://docs.farcaster.xyz/developers/frames/v2/getting-started)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Contributing

This is a boilerplate template. Feel free to customize it for your needs!

## License

MIT License - feel free to use this template for your projects.
