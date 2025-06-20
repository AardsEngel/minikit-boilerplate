"use client";

import {
  useMiniKit,
} from "@coinbase/onchainkit/minikit";
import {
  Name,
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
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusLabel,
  TransactionStatusAction,
} from '@coinbase/onchainkit/transaction';
import type { LifecycleStatus } from '@coinbase/onchainkit/transaction';
import { useAccount } from "wagmi";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";


/* ---------- CONTRACT CONSTANTS ---------- */
const CONTRACT_ADDRESS = "0x219Db2A089dae44eE612E042a41Fc2473e8d318F";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC

// IPFS Gateway - using only Pinata for consistency
const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";


// Photo data - make sure these IPFS hashes are correct
const PICTURES = [
  {
    id: "1",
    tokenId: 0,
    title: "Exclusive Content",
    priceUSDC: 5,
    previewIpfsHash: "bafybeifenrhlwmwdnpavvorzop74f6kj7t3nkxta4m37vbgeysbpboikii",
    fullIpfsHash: "bafybeif6wwnwy22eh2zc7gafzuixkgv466m2ok3rquopxsb4kfigdtpp3m",
    description: "Premium exclusive content",
  },
  {
    id: "2",
    tokenId: 2,
    title: "VIP Collection",
    priceUSDC: 10,
    previewIpfsHash: "bafkreidvjecoqtdml4utim66gswvbdonumn6ywwmduayhhkruievhsqz2i",
    fullIpfsHash: "bafybeihyb2jqs3m4jbcpx3bbxaedeuj54nypp2p7ffysn36p6oz6ws3kdi",
    description: "High-quality VIP content",
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
    name: "userOwnsPhoto",
    type: "function",
    inputs: [
      { name: "user", type: "address" },
      { name: "_tokenId", type: "uint256" }
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "getFullImageHash",
    type: "function",
    inputs: [{ name: "_tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "getPreviewImageHash",
    type: "function",
    inputs: [{ name: "_tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    name: "getPhotoDetails",
    type: "function",
    inputs: [{ name: "_tokenId", type: "uint256" }],
    outputs: [
      { type: "string" }, // previewHash
      { type: "uint256" }, // priceUSDC
      { type: "bool" }, // isActive
      { type: "bool" } // isPurchased
    ],
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

// Fixed Keccak256 implementation using a simple hash for function selectors
// Note: This is a simplified implementation. For production, use a proper keccak256 library
function getMethodId(signature: string): string {
  // Common method IDs for standard functions
  const knownMethods: Record<string, string> = {
    "approve(address,uint256)": "0x095ea7b3",
    "purchasePhoto(uint256)": "0xa6f2ae3a", // You'll need to get the actual method ID
    "userOwnsPhoto(address,uint256)": "0x8f4ffcb1", // You'll need to get the actual method ID
    "getFullImageHash(uint256)": "0x1e7d6ef3", // You'll need to get the actual method ID
  };
  
  return knownMethods[signature] || "0x00000000";
}

// Enhanced function encoding with better error handling
async function encodeFunctionCall(
  abi: AbiFunction[],
  functionName: string,
  params: (string | number)[]
): Promise<string> {
  const fn = abi.find((f) => f.name === functionName);
  if (!fn) throw new Error(`Function ${functionName} not found in ABI`);
  
  // Create function signature
  const signature = `${fn.name}(${fn.inputs.map((i) => i.type).join(",")})`;
  console.log(`Encoding function: ${signature}`);
  
  // Get the proper method ID
  const selector = getMethodId(signature);
  
  let encodedArgs = "";
  for (let i = 0; i < fn.inputs.length; i++) {
    const param = params[i];
    const inputType = fn.inputs[i].type;
    
    if (inputType === "uint256") {
      const bigIntValue = BigInt(param);
      encodedArgs += bigIntValue.toString(16).padStart(64, "0");
    } else if (inputType === "address") {
      const cleanAddress = (param as string).replace(/^0x/, "").toLowerCase();
      encodedArgs += cleanAddress.padStart(64, "0");
    }
  }
  
  const result = selector + encodedArgs;
  console.log(`Encoded function call: ${result}`);
  return result;
}

// Enhanced decode functions
function decodeBool(response: string): boolean {
  if (!response || response.length < 2) return false;
  const hex = response.replace(/^0x/, "");
  return hex.slice(-1) === "1";
}

function decodeString(response: string): string {
  if (!response || response.length < 2) return "";
  
  try {
    const hex = response.replace(/^0x/, "");
    
    // Skip the first 64 characters (offset)
    // Next 64 characters contain the length
    const lengthHex = hex.slice(64, 128);
    const length = parseInt(lengthHex, 16) * 2;
    
    if (length <= 0 || length > hex.length) return "";
    
    // Extract the actual string data
    const stringHex = hex.slice(128, 128 + length);
    
    // Convert hex to string
    let result = "";
    for (let i = 0; i < stringHex.length; i += 2) {
      const byte = stringHex.substr(i, 2);
      if (byte !== "00") {
        result += String.fromCharCode(parseInt(byte, 16));
      }
    }
    
    return result.trim();
  } catch (error) {
    console.error("Error decoding string:", error);
    return "";
  }
}

/* ------- ENHANCED IPFS IMAGE LOADER ------- */
function useIPFSImage(ipfsHash: string | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ipfsHash) {
      setImageUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Skip invalid hashes
    if (ipfsHash.includes("QmPreviewHash") || ipfsHash.includes("QmFullHash")) {
      setError("Invalid IPFS hash - placeholder detected");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const url = `${IPFS_GATEWAY}${ipfsHash}`;
    console.log(`Loading image from: ${url}`);
    
    const img = new window.Image();
    
    const timeout = setTimeout(() => {
      setError("Image load timeout");
      setLoading(false);
    }, 15000); // 15 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      setImageUrl(url);
      setLoading(false);
      console.log(`Successfully loaded image: ${url}`);
    };
    
    img.onerror = (e) => {
      clearTimeout(timeout);
      console.error(`Failed to load image: ${url}`, e);
      setError("Failed to load image from IPFS");
      setLoading(false);
    };
    
    img.src = url;

    return () => {
      clearTimeout(timeout);
    };
  }, [ipfsHash]);

  return { imageUrl, loading, error };
}

/* ------- ENHANCED OWNERSHIP HOOK ------- */
function usePhotoOwnership(userAddress: string | undefined) {
  const [ownedPhotos, setOwnedPhotos] = useState<Record<string, boolean>>({});
  const [fullImageHashes, setFullImageHashes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const checkOwnership = useCallback(async () => {
    if (!userAddress || !window.ethereum) {
      setOwnedPhotos({});
      setFullImageHashes({});
      return;
    }

    setLoading(true);
    const owned: Record<string, boolean> = {};
    const fullHashes: Record<string, string> = {};

    try {
      for (const pic of PICTURES) {
        try {
          console.log(`Checking ownership for token ${pic.tokenId}`);
          
          const ownershipData = await encodeFunctionCall(
            MARKETPLACE_ABI, 
            "userOwnsPhoto", 
            [userAddress, pic.tokenId]
          );
          
          const ownershipRes: string = await window.ethereum.request({
            method: "eth_call",
            params: [
              {
                to: CONTRACT_ADDRESS,
                data: ownershipData,
              },
              "latest",
            ],
          });
          
          console.log(`Ownership response for ${pic.title}:`, ownershipRes);
          const isOwned = decodeBool(ownershipRes);
          owned[pic.id] = isOwned;
          
          if (isOwned) {
            try {
              const fullHashData = await encodeFunctionCall(
                MARKETPLACE_ABI,
                "getFullImageHash",
                [pic.tokenId]
              );
              
              const fullHashRes: string = await window.ethereum.request({
                method: "eth_call",
                params: [
                  {
                    to: CONTRACT_ADDRESS,
                    data: fullHashData,
                  },
                  "latest",
                ],
              });
              
              const fullHash = decodeString(fullHashRes);
              if (fullHash) {
                fullHashes[pic.id] = fullHash;
                console.log(`Full hash for ${pic.title}:`, fullHash);
              }
            } catch (error) {
              console.error(`Could not get full hash for ${pic.title}:`, error);
            }
          }
        } catch (error) {
          console.error(`Could not check ownership for ${pic.title}:`, error);
          owned[pic.id] = false;
        }
      }
    } catch (error) {
      console.error("Error in ownership check:", error);
    }

    setOwnedPhotos(owned);
    setFullImageHashes(fullHashes);
    setLoading(false);
  }, [userAddress]);

  useEffect(() => {
    checkOwnership();
  }, [checkOwnership]);

  return { ownedPhotos, fullImageHashes, loading, refetch: checkOwnership };
}

/* ---------------- MAIN COMPONENT ---------------- */
export default function App() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  const { address: connectedAddress } = useAccount();
  
  const { ownedPhotos, fullImageHashes, loading: ownershipLoading, refetch } = usePhotoOwnership(connectedAddress);
  const [buying, setBuying] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const createPurchaseCalls = useCallback(async (pic: typeof PICTURES[number]): Promise<Array<{
    to: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
  }>> => {
    const usdcAmount = BigInt(pic.priceUSDC) * BigInt(1_000_000);
    
    return [
      // Step 1: Approve USDC
      {
        to: USDC_ADDRESS as `0x${string}`,
        data: await encodeFunctionCall(USDC_ABI, "approve", [CONTRACT_ADDRESS, usdcAmount.toString()]) as `0x${string}`,
        value: BigInt(0),
      },
      // Step 2: Purchase photo
      {
        to: CONTRACT_ADDRESS as `0x${string}`,
        data: await encodeFunctionCall(MARKETPLACE_ABI, "purchasePhoto", [pic.tokenId]) as `0x${string}`,
        value: BigInt(0),
      },
    ];
  }, []);

  const handleTransactionStatus = useCallback((status: LifecycleStatus, picId: string) => {
    console.log('Transaction status:', status);
    
    switch (status.statusName) {
      case 'transactionIdle':
        setTxStatus(prev => ({ ...prev, [picId]: "Ready to purchase..." }));
        setBuying(null); // Clear buying state when idle
        break;
      case 'buildingTransaction':
        setTxStatus(prev => ({ ...prev, [picId]: "Preparing transaction..." }));
        setBuying(picId);
        break;
      case 'transactionPending':
        setTxStatus(prev => ({ ...prev, [picId]: "Transaction pending..." }));
        break;
      case 'success':
        setTxStatus(prev => ({ ...prev, [picId]: "Purchase successful!" }));
        setTimeout(() => {
          refetch();
          setTxStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[picId];
            return newStatus;
          });
          setBuying(null);
        }, 2000);
        break;
      case 'error':
        console.error('Transaction error:', status.statusData);
        // Clear the status and buying state immediately on error
        setTxStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[picId];
          return newStatus;
        });
        setBuying(null);
        break;
    }
  }, [refetch]);

  // Transaction success handler
  const handleTransactionSuccess = useCallback((response: unknown, picId: string) => {
    console.log(`Transaction successful for ${picId}:`, response);
    // The status handler will take care of the rest
  }, []);

  // Transaction error handler
  const handleTransactionError = useCallback((error: unknown, picId: string) => {
    console.error(`Transaction failed for ${picId}:`, error);
    // Clear states immediately on error to prevent stuck UI
    setTxStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[picId];
      return newStatus;
    });
    setBuying(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--app-background)] via-[var(--app-gray)] to-black">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[var(--app-accent)] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[var(--app-secondary)] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-6">
        {/* Header with Logo */}
        <header className="text-center mb-8">
          <div className="flex flex-col items-center space-y-4">
            {/* Logo */}
            <div className="relative">
              <h1 className="text-4xl md:text-6xl font-bold gradient-text pulse-glow">
                OnlyMe
              </h1>
              <div className="absolute -inset-1 bg-gradient-to-r from-[var(--app-accent)] via-[var(--app-secondary)] to-[var(--app-accent)] rounded-lg blur opacity-30 animate-pulse"></div>
            </div>
            
            {/* Subtitle */}
            <p className="text-[var(--app-foreground-muted)] text-lg md:text-xl max-w-md">
              Exclusive Premium Content on the Blockchain
            </p>
            
            {/* Decorative line */}
            <div className="w-32 h-1 bg-gradient-to-r from-transparent via-[var(--app-accent)] to-transparent"></div>
          </div>

          {/* Hidden wallet connection (for Farcaster mini-app auto-connection) */}
          <div className="hidden">
            <Wallet>
              <ConnectWallet>
                <Avatar className="h-6 w-6" />
                <Name className="text-inherit" />
              </ConnectWallet>
              <WalletDropdown>
                <Avatar />
                <Name />
                <Address />
                <EthBalance />
                <WalletDropdownDisconnect />
              </WalletDropdown>
            </Wallet>
          </div>
        </header>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl border border-[var(--app-card-border)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--app-accent)]">{PICTURES.length}</div>
            <div className="text-sm text-[var(--app-foreground-muted)]">Collections</div>
          </div>
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl border border-[var(--app-card-border)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--app-accent)]">
              {Object.values(ownedPhotos).filter(Boolean).length}
            </div>
            <div className="text-sm text-[var(--app-foreground-muted)]">Owned</div>
          </div>
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl border border-[var(--app-card-border)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--app-accent)]">💎</div>
            <div className="text-sm text-[var(--app-foreground-muted)]">Premium</div>
          </div>
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl border border-[var(--app-card-border)] p-4 text-center">
            <div className="text-2xl font-bold text-[var(--app-accent)]">🔥</div>
            <div className="text-sm text-[var(--app-foreground-muted)]">Exclusive</div>
          </div>
        </div>

        {/* Main Content */}
        <main className="space-y-8">
          {/* Section Title */}
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--app-foreground)] mb-2">
              Premium Gallery
            </h2>
            <p className="text-[var(--app-foreground-muted)]">
              Unlock exclusive content with cryptocurrency
            </p>
          </div>

          {/* Gallery Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {PICTURES.map((pic) => {
              const isUnlocked = ownedPhotos[pic.id];
              const isProcessing = buying === pic.id;
              const status = txStatus[pic.id];
              
              // Determine which image to show
              const imageHash = isUnlocked ? fullImageHashes[pic.id] : pic.previewIpfsHash;

              // Enhanced button logic
              let buttonText: string;
              let buttonDisabled = false;
              let buttonColor = "btn-primary";

              if (isProcessing) {
                buttonText = status || "Processing...";
                buttonDisabled = true;
                buttonColor = "bg-blue-500 hover:bg-blue-600";
              } else if (isUnlocked) {
                buttonText = "✨ Unlocked";
                buttonDisabled = true;
                buttonColor = "bg-green-500 hover:bg-green-600";
              } else {
                buttonText = `🔓 Unlock for ${pic.priceUSDC} USDC`;
              }

              return (
                <PhotoCard
                  key={pic.id}
                  pic={pic}
                  imageHash={imageHash}
                  isUnlocked={isUnlocked}
                  ownershipLoading={ownershipLoading}
                  buttonText={buttonText}
                  buttonDisabled={buttonDisabled}
                  buttonColor={buttonColor}
                  createPurchaseCalls={createPurchaseCalls}
                  handleTransactionStatus={handleTransactionStatus}
                  handleTransactionSuccess={handleTransactionSuccess}
                  handleTransactionError={handleTransactionError}
                />
              );
            })}
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-16 text-center">
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl border border-[var(--app-card-border)] p-6">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-[var(--app-foreground-muted)]">
                Secured by Blockchain Technology
              </span>
            </div>
            <p className="text-xs text-[var(--app-foreground-muted)]">
              All content is tokenized and stored on IPFS. Payments processed via USDC on Base network.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ---------------- PHOTO CARD COMPONENT ---------------- */
interface PhotoCardProps {
  pic: typeof PICTURES[number];
  imageHash: string | undefined;
  isUnlocked: boolean;
  ownershipLoading: boolean;
  buttonText: string;
  buttonDisabled: boolean;
  buttonColor: string;
  createPurchaseCalls: (pic: typeof PICTURES[number]) => Promise<Array<{
    to: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
  }>>;
  handleTransactionStatus: (status: LifecycleStatus, picId: string) => void;
  handleTransactionSuccess: (response: unknown, picId: string) => void;
  handleTransactionError: (error: unknown, picId: string) => void;
}

// Updated PhotoCard component with enhanced UI
function PhotoCard({
  pic,
  imageHash,
  isUnlocked,
  ownershipLoading,
  buttonText,
  buttonDisabled,
  createPurchaseCalls,
  handleTransactionStatus,
  handleTransactionSuccess,
  handleTransactionError,
}: PhotoCardProps) {
  const { imageUrl, loading: imageLoading, error: imageError } = useIPFSImage(imageHash ?? null);

  return (
    <div className="group bg-[var(--app-card-bg)] backdrop-blur-md rounded-2xl shadow-2xl border border-[var(--app-card-border)] p-6 transition-all duration-500 hover:shadow-3xl card-hover">
      {/* Card Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-[var(--app-foreground)] mb-1">{pic.title}</h3>
          <p className="text-sm text-[var(--app-foreground-muted)]">{pic.description}</p>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <div className="text-xs text-[var(--app-foreground-muted)] bg-black/20 px-2 py-1 rounded-full">
            #{pic.tokenId}
          </div>
          {ownershipLoading && (
            <div className="w-4 h-4 border-2 border-[var(--app-accent)] border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
      </div>

      {/* Image Container */}
      <div className="relative aspect-[4/5] mb-6 rounded-xl overflow-hidden">
        {imageLoading ? (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="w-12 h-12 loading-spinner rounded-full"></div>
              <span className="text-sm text-[var(--app-foreground-muted)]">Loading from IPFS...</span>
            </div>
          </div>
        ) : imageError ? (
          <div className="w-full h-full bg-gradient-to-br from-red-900/20 to-red-800/20 flex items-center justify-center border-2 border-red-500/20 rounded-xl">
            <div className="flex flex-col items-center space-y-3 text-center p-6">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm text-red-400">Content unavailable</span>
              <span className="text-xs text-red-500/70">IPFS loading failed</span>
            </div>
          </div>
        ) : imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={pic.title}
              className={`w-full h-full object-cover transition-all duration-700 ${
                isUnlocked ? "filter-none" : "blur-md brightness-50 saturate-150"
              }`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            
            {/* Overlay effects */}
            {!isUnlocked && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/90 backdrop-blur-sm text-white px-6 py-3 rounded-full border border-[var(--app-accent)]/30">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-[var(--app-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span className="text-sm font-medium">Exclusive Content</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {isUnlocked && (
              <div className="absolute top-3 left-3">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  ✨ UNLOCKED
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border-2 border-gray-700 rounded-xl">
            <div className="flex flex-col items-center space-y-3 text-center p-6">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm text-gray-400">Preview Coming Soon</span>
              <span className="text-xs text-gray-500">Content being uploaded...</span>
            </div>
          </div>
        )}
      </div>

      {/* Price and Rarity Tags */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <div className="bg-gradient-to-r from-[var(--app-accent)] to-[var(--app-secondary)] text-white px-3 py-1 rounded-full text-sm font-bold">
            {pic.priceUSDC} USDC
          </div>
          <div className="bg-black/30 text-[var(--app-accent)] px-2 py-1 rounded-full text-xs font-medium border border-[var(--app-accent)]/20">
            Premium
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <div className="text-[var(--app-accent)] text-lg">🔥</div>
          <span className="text-xs text-[var(--app-foreground-muted)]">Exclusive</span>
        </div>
      </div>

      {/* Action Button */}
      <div className="space-y-3">
        {!isUnlocked ? (
          <Transaction
            calls={createPurchaseCalls(pic)}
            onStatus={(status) => handleTransactionStatus(status, pic.id)}
            onSuccess={(response) => handleTransactionSuccess(response, pic.id)}
            onError={(error) => handleTransactionError(error, pic.id)}
          >
            <TransactionButton
              className={`w-full py-4 px-6 rounded-xl font-bold text-white transition-all duration-300 ${
                buttonDisabled 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'btn-primary hover:scale-105 active:scale-95'
              }`}
              disabled={buttonDisabled}
              text={buttonText}
            />
            <TransactionStatus>
              <TransactionStatusLabel className="text-sm text-[var(--app-foreground-muted)] mt-2" />
              <TransactionStatusAction className="mt-2" />
            </TransactionStatus>
          </Transaction>
        ) : (
          <div className="w-full py-4 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 text-center">
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Content Unlocked</span>
            </div>
          </div>
        )}
        
        {/* Additional metadata */}
        <div className="flex justify-between items-center text-xs text-[var(--app-foreground-muted)]">
          <div className="flex items-center space-x-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Blockchain Verified</span>
          </div>
          <div className="flex items-center space-x-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>IPFS Secured</span>
          </div>
        </div>
      </div>
    </div>
  );
}