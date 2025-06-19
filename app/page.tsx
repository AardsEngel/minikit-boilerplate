"use client";

import {
  useMiniKit,
  useAddFrame,
  useOpenUrl,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
  Identity,
  Address,
  Avatar,
  EthBalance,
} from "@coinbase/onchainkit/identity";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { useEffect, useMemo, useState, useCallback } from "react";

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);

  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <button
          onClick={handleAddFrame}
          className="flex items-center space-x-1 text-sm font-medium text-[var(--app-accent)] hover:text-[var(--app-accent-hover)] transition-colors p-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Save Frame</span>
        </button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-green-600 animate-fade-out">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] bg-gradient-to-b from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-md mx-auto px-4 py-3">
        {/* Header */}
        <header className="flex justify-between items-center mb-6 h-11">
          <div>
            <Wallet className="z-10">
              <ConnectWallet>
                <Name className="text-inherit" />
              </ConnectWallet>
              <WalletDropdown>
                <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                  <Avatar />
                  <Name />
                  <Address />
                  <EthBalance />
                </Identity>
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>
          <div>{saveFrameButton}</div>
        </header>

        {/* Main Content */}
        <main className="flex-1 space-y-6">
          {/* Welcome Card */}
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl shadow-lg border border-[var(--app-card-border)] p-6">
            <h1 className="text-2xl font-bold text-[var(--app-foreground)] mb-2">
              Welcome to Your MiniKit App
            </h1>
            <p className="text-[var(--app-foreground-muted)] mb-4">
              This is your starting point for building amazing Farcaster frames with MiniKit and OnchainKit.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-[var(--app-accent-light)] text-[var(--app-accent)] rounded-full text-sm font-medium">
                MiniKit
              </span>
              <span className="px-3 py-1 bg-[var(--app-accent-light)] text-[var(--app-accent)] rounded-full text-sm font-medium">
                OnchainKit
              </span>
              <span className="px-3 py-1 bg-[var(--app-accent-light)] text-[var(--app-accent)] rounded-full text-sm font-medium">
                Next.js
              </span>
            </div>
          </div>

          {/* Getting Started Card */}
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl shadow-lg border border-[var(--app-card-border)] p-6">
            <h2 className="text-lg font-semibold text-[var(--app-foreground)] mb-3">
              Ready to Build?
            </h2>
            <ul className="space-y-2 text-[var(--app-foreground-muted)]">
              <li className="flex items-start">
                <span className="text-[var(--app-accent)] mr-2">•</span>
                Edit <code className="bg-[var(--app-gray)] px-2 py-1 rounded text-sm">app/page.tsx</code> to customize this page
              </li>
              <li className="flex items-start">
                <span className="text-[var(--app-accent)] mr-2">•</span>
                Add your components in <code className="bg-[var(--app-gray)] px-2 py-1 rounded text-sm">app/components/</code>
              </li>
              <li className="flex items-start">
                <span className="text-[var(--app-accent)] mr-2">•</span>
                Customize your theme in <code className="bg-[var(--app-gray)] px-2 py-1 rounded text-sm">app/theme.css</code>
              </li>
              <li className="flex items-start">
                <span className="text-[var(--app-accent)] mr-2">•</span>
                Check the README.md for detailed instructions
              </li>
            </ul>
          </div>

          {/* Status Card */}
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl shadow-lg border border-[var(--app-card-border)] p-6">
            <h3 className="text-lg font-semibold text-[var(--app-foreground)] mb-3">
              Frame Status
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[var(--app-foreground-muted)]">MiniKit Ready:</span>
                <span className={`font-medium ${isFrameReady ? 'text-green-600' : 'text-yellow-600'}`}>
                  {isFrameReady ? '✓ Ready' : '⏳ Loading...'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--app-foreground-muted)]">Frame Added:</span>
                <span className={`font-medium ${context?.client.added ? 'text-green-600' : 'text-gray-500'}`}>
                  {context?.client.added ? '✓ Added' : '○ Not Added'}
                </span>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-8 pt-4 flex justify-center">
          <button
            className="text-[var(--app-foreground-muted)] text-xs hover:text-[var(--app-accent)] transition-colors"
            onClick={() => openUrl("https://base.org/builders/minikit")}
          >
            Built with MiniKit on Base
          </button>
        </footer>
      </div>
    </div>
  );
}
