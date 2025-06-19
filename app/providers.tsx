/**
 * App Providers
 * 
 * This file sets up the MiniKitProvider which wraps your entire app
 * and provides access to MiniKit functionality like wallet connections,
 * frame context, and OnchainKit components.
 */

"use client";

import { type ReactNode } from "react";
import { base } from "wagmi/chains"; // Using Base chain
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";

export function Providers(props: { children: ReactNode }) {
  return (
    <MiniKitProvider
      // Your OnchainKit API key from https://onchainkit.xyz
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      // Blockchain network (Base)
      chain={base}
      config={{
        appearance: {
          // Auto switches between light/dark based on user preference
          mode: "auto",
          // Custom theme defined in theme.css
          theme: "mini-app-theme",
          // App name shown in wallet connections
          name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
          // App logo shown in wallet connections
          logo: process.env.NEXT_PUBLIC_ICON_URL,
        },
      }}
    >
      {props.children}
    </MiniKitProvider>
  );
}
