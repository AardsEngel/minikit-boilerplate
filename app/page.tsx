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
import Image from "next/image";

const PICTURES = [
  {
    id: "1",
    src: "/pictures/pic1.webp",
    title: "Sunset Overdrive",
    priceUSDC: 5,
  },
  {
    id: "2",
    src: "/pictures/pic2.jpg",
    title: "Ocean Calm",
    priceUSDC: 8,
  },
  {
    id: "3",
    src: "/pictures/pic3.jpg",
    title: "City Lights",
    priceUSDC: 10,
  },
];

function usePurchaseTracking() {
  const [purchased, setPurchased] = useState<{[picId: string]: boolean}>({});
  const storageKey = "purchased_pics_AardsEngel";
  const purchaseTimeKey = "purchase_time_AardsEngel";

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setPurchased(JSON.parse(stored));
    }
  }, []);

  const recordPurchase = (picId: string) => {
    const updated = { ...purchased, [picId]: true };
    setPurchased(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    localStorage.setItem(purchaseTimeKey, "2025-06-19 12:10:03"); // Using provided UTC time
  };

  return { purchased, recordPurchase };
}

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);

  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  // Gallery state
  const [buying, setBuying] = useState<string | null>(null);
  const { purchased, recordPurchase } = usePurchaseTracking();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const handlePurchase = useCallback(async (picId: string) => {
    setBuying(picId);
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    recordPurchase(picId);
    setBuying(null);
  }, [recordPurchase]);

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
      <div className="w-full max-w-2xl mx-auto px-4 py-3">
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
          {/* Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PICTURES.map(pic => {
              const isUnlocked = purchased[pic.id];
              return (
                <div key={pic.id} className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl shadow-lg border border-[var(--app-card-border)] p-4">
                  <div className="relative aspect-square mb-4">
                    <Image
                      src={pic.src}
                      alt={pic.title}
                      fill
                      className={`rounded-lg object-cover transition-all duration-500 ${
                        isUnlocked ? "" : "blur-lg brightness-50"
                      }`}
                    />
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                          Locked
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{pic.title}</h3>
                  {isUnlocked ? (
                    <div className="text-green-500 font-medium">✓ Purchased</div>
                  ) : (
                    <button
                      onClick={() => handlePurchase(pic.id)}
                      disabled={buying === pic.id}
                      className={`w-full px-4 py-2 bg-[var(--app-accent)] text-white rounded-lg 
                        ${buying === pic.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--app-accent-hover)]'}`}
                    >
                      {buying === pic.id ? 'Processing...' : `Buy for ${pic.priceUSDC} USDC`}
                    </button>
                  )}
                </div>
              );
            })}
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