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

/* ---------- CONTRACT CONSTANTS ---------- */
const CONTRACT_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC

const PICTURES = [
  {
    id: "1",
    tokenId: 0,
    src: "/pictures/pic1.webp",
    title: "Sunset Overdrive",
    priceUSDC: 5,
  },
  {
    id: "2",
    tokenId: 1,
    src: "/pictures/pic2.jpg",
    title: "Ocean Calm",
    priceUSDC: 8,
  },
  {
    id: "3",
    tokenId: 2,
    src: "/pictures/pic3.jpg",
    title: "City Lights",
    priceUSDC: 10,
  },
];

// --------- ABI ENCODING HELPERS ----------
type AbiInput = { name: string; type: string };
type AbiFunction = {
  name: string;
  type: "function";
  inputs: AbiInput[];
  outputs?: Array<{ type: string }>;
};

const MARKETPLACE_ABI: AbiFunction[] = [
  {
    name: "purchasePhoto",
    type: "function",
    inputs: [{ name: "_tokenId", type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
];
const USDC_ABI: AbiFunction[] = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
];

// Utility: pad hex string to 32 bytes
function padHex(value: string, bytes = 32): string {
  return value.replace(/^0x/, "").padStart(bytes * 2, "0");
}

// Minimal Keccak256 for selector (uses SubtleCrypto, no require)
async function keccak256Selector(signature: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(signature);
  const hashBuffer = await window.crypto.subtle.digest("SHA-3-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}

// Encode selector and arguments
async function encodeFunctionCall(
  abi: AbiFunction[],
  functionName: string,
  params: (string | number)[]
): Promise<string> {
  const fn = abi.find((f) => f.name === functionName);
  if (!fn) throw new Error("Function not found in ABI");
  const selector =
    "0x" +
    (await keccak256Selector(
      `${fn.name}(${fn.inputs.map((i) => i.type).join(",")})`
    ));
  let encodedArgs = "";
  for (let i = 0; i < fn.inputs.length; i++) {
    let val = params[i];
    if (fn.inputs[i].type === "uint256") {
      val = BigInt(val).toString(16);
      encodedArgs += val.padStart(64, "0");
    } else if (fn.inputs[i].type === "address") {
      encodedArgs += padHex(val as string, 32);
    }
  }
  return selector + encodedArgs;
}

/* --------- USER ADDRESS HOOK FROM MINIKIT CLIENT --------- */
function useMiniKitAddress(context: unknown): string | undefined {
  // Try multiple possible MiniKit shapes (covers most versions)
  if (
    context &&
    typeof context === "object" &&
    "client" in context &&
    (context as { client?: unknown }).client &&
    typeof (context as { client: unknown }).client === "object"
  ) {
    const client = (context as { client: Record<string, unknown> }).client;
    // Try .address directly
    if (typeof client.address === "string" && client.address.length === 42) {
      return client.address;
    }
    // Sometimes available as .selectedAddress
    if (typeof client.selectedAddress === "string" && client.selectedAddress.length === 42) {
      return client.selectedAddress;
    }
    // Sometimes available as .accounts[0]
    if (Array.isArray(client.accounts) && client.accounts.length > 0 && typeof client.accounts[0] === "string") {
      return client.accounts[0];
    }
  }
  // Some older versions: context.address directly
  if (
    context &&
    typeof context === "object" &&
    "address" in context &&
    typeof (context as { address?: unknown }).address === "string" &&
    ((context as { address?: string }).address?.length ?? 0) === 42
  ) {
    return (context as { address: string }).address;
  }
  return undefined;
}

/* ------- HOOK: Onchain Ownership ------- */
function usePhotoOwnership(userAddress: string | undefined) {
  const [ownedPhotos, setOwnedPhotos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!userAddress || typeof window === "undefined" || !window.ethereum) return;
    let cancelled = false;
    (async () => {
      const owned: Record<string, boolean> = {};
      for (const pic of PICTURES) {
        const data = await encodeFunctionCall(MARKETPLACE_ABI, "ownerOf", [pic.tokenId]);
        try {
          const res: string = await window.ethereum.request({
            method: "eth_call",
            params: [
              {
                to: CONTRACT_ADDRESS,
                data,
              },
              "latest",
            ],
          });
          // Address is last 40 chars
          const owner = "0x" + res.slice(-40);
          owned[pic.id] = owner.toLowerCase() === userAddress.toLowerCase();
        } catch {
          owned[pic.id] = false;
        }
      }
      if (!cancelled) setOwnedPhotos(owned);
    })();
    return () => {
      cancelled = true;
    };
  }, [userAddress]);
  return ownedPhotos;
}

/* ---------------- MAIN COMPONENT ---------------- */
export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  // Get user address from MiniKit context
  const userAddress = useMiniKitAddress(context);
  const ownedPhotos = usePhotoOwnership(userAddress);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    if (!isFrameReady) setFrameReady();
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  // USDC approval + contract purchase with window.ethereum.request
  const handlePurchase = useCallback(
    async (pic: typeof PICTURES[number]) => {
      if (!userAddress || typeof window === "undefined" || !window.ethereum) {
        alert("Connect wallet first.");
        return;
      }
      setBuying(pic.id);

      try {
        // 1. Approve USDC (6 decimals)
        const usdcAmount = (BigInt(pic.priceUSDC) * BigInt(1_000_000)).toString();
        const approveData = await encodeFunctionCall(USDC_ABI, "approve", [
          CONTRACT_ADDRESS,
          usdcAmount,
        ]);
        await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: userAddress,
              to: USDC_ADDRESS,
              data: approveData,
            },
          ],
        });

        // 2. Purchase NFT
        const purchaseData = await encodeFunctionCall(
          MARKETPLACE_ABI,
          "purchasePhoto",
          [pic.tokenId]
        );
        await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: userAddress,
              to: CONTRACT_ADDRESS,
              data: purchaseData,
            },
          ],
        });

        // Ownership will update on next render
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        alert("Purchase failed or rejected.");
      }
      setBuying(null);
    },
    [userAddress]
  );

  const saveFrameButton = useMemo(() => {
    if (
      context &&
      "client" in context &&
      (context as { client?: { added?: boolean } }).client &&
      !(context as { client: { added?: boolean } }).client.added
    ) {
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
            {PICTURES.map((pic) => {
              const isUnlocked = ownedPhotos[pic.id];
              return (
                <div
                  key={pic.id}
                  className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl shadow-lg border border-[var(--app-card-border)] p-4"
                >
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
  onClick={() => handlePurchase(pic)}
  disabled={buying === pic.id}
  className={`...`}
>
  {buying === pic.id
    ? "Processing..."
    : `Buy for ${pic.priceUSDC} USDC`}
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
                <span
                  className={`font-medium ${
                    isFrameReady ? "text-green-600" : "text-yellow-600"
                  }`}
                >
                  {isFrameReady ? "✓ Ready" : "⏳ Loading..."}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--app-foreground-muted)]">
                  Frame Added:
                </span>
                <span
                  className={`font-medium ${
                    (context &&
                      "client" in context &&
                      (context as { client?: { added?: boolean } }).client &&
                      (context as { client: { added?: boolean } }).client.added)
                      ? "text-green-600"
                      : "text-gray-500"
                  }`}
                >
                  {(context &&
                    "client" in context &&
                    (context as { client?: { added?: boolean } }).client &&
                    (context as { client: { added?: boolean } }).client.added)
                    ? "✓ Added"
                    : "○ Not Added"}
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