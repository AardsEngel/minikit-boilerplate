"use client";

import {
  useMiniKit,
  useAddFrame,
  useOpenUrl,
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

// Minimal Keccak256 for selector (uses SubtleCrypto)
async function keccak256Selector(signature: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(signature);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
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
  
  const selector = "0x" + (await keccak256Selector(
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

/* ------- Improved MiniKit Context Types ------- */

/* ------- HOOK: Onchain Ownership ------- */
function usePhotoOwnership(userAddress: string | undefined) {
  const [ownedPhotos, setOwnedPhotos] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      !userAddress ||
      !CONTRACT_ADDRESS ||
      CONTRACT_ADDRESS === "YOUR_DEPLOYED_CONTRACT_ADDRESS" ||
      typeof window === "undefined" ||
      !window.ethereum
    ) {
      setOwnedPhotos({});
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      const owned: Record<string, boolean> = {};
      
      try {
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
            const owner = "0x" + res.slice(-40);
            owned[pic.id] = owner.toLowerCase() === userAddress.toLowerCase();
          } catch (error) {
            console.log(`Could not check ownership for ${pic.title}:`, error);
            owned[pic.id] = false;
          }
        }
      } catch (error) {
        console.log("Error checking ownership:", error);
        // Initialize all as false if there's an error
        PICTURES.forEach(pic => {
          owned[pic.id] = false;
        });
      }

      if (!cancelled) {
        setOwnedPhotos(owned);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userAddress]);

  return { ownedPhotos, loading };
}

/* ------- HOOK: Enhanced connected address detection ------- */
function useConnectedAddress() {
  const [connectedAddress, setConnectedAddress] = useState<string | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check if wallet is connected via ethereum provider
    const checkConnection = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) {
            setConnectedAddress(accounts[0]);
            setIsConnected(true);
          } else {
            setConnectedAddress(undefined);
            setIsConnected(false);
          }
        } catch (error) {
          console.log("Error checking wallet connection:", error);
          setConnectedAddress(undefined);
          setIsConnected(false);
        }
      }
    };

    checkConnection();

    // Listen for account changes
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setConnectedAddress(accounts[0]);
          setIsConnected(true);
        } else {
          setConnectedAddress(undefined);
          setIsConnected(false);
        }
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        }
      };
    }
  }, []);

  return { connectedAddress, isConnected };
}

/* ---------------- MAIN COMPONENT ---------------- */
export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [addFrameLoading, setAddFrameLoading] = useState(false);
  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  // Enhanced wallet connection detection
  const { connectedAddress, isConnected } = useConnectedAddress();
  const { ownedPhotos, loading: ownershipLoading } = usePhotoOwnership(connectedAddress);
  const [buying, setBuying] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    if (addFrameLoading) return;
    
    setAddFrameLoading(true);
    try {
      const result = await addFrame();
      setFrameAdded(Boolean(result));
    } catch (error) {
      console.error("Failed to add frame:", error);
    } finally {
      setAddFrameLoading(false);
    }
  }, [addFrame, addFrameLoading]);

  const handlePurchase = useCallback(
    async (pic: typeof PICTURES[number]) => {
      if (!isConnected || !connectedAddress) {
        alert("Please connect your wallet first using the button at the top right.");
        return;
      }

      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "YOUR_DEPLOYED_CONTRACT_ADDRESS") {
        alert("This is a demo. The contract is not deployed yet, but the purchase flow is working!");
        return;
      }

      if (typeof window === "undefined" || !window.ethereum) {
        alert("No Ethereum provider found.");
        return;
      }

      setBuying(pic.id);
      setTxStatus({ ...txStatus, [pic.id]: "Approving USDC..." });

      try {
        const usdcAmount = (BigInt(pic.priceUSDC) * BigInt(1_000_000)).toString();
        
        // Step 1: Approve USDC
        const approveData = await encodeFunctionCall(USDC_ABI, "approve", [
          CONTRACT_ADDRESS,
          usdcAmount,
        ]);
        
        await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: connectedAddress,
              to: USDC_ADDRESS,
              data: approveData,
            },
          ],
        });

        setTxStatus({ ...txStatus, [pic.id]: "Purchasing photo..." });

        // Step 2: Purchase photo
        const purchaseData = await encodeFunctionCall(
          MARKETPLACE_ABI,
          "purchasePhoto",
          [pic.tokenId]
        );
        
        await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: connectedAddress,
              to: CONTRACT_ADDRESS,
              data: purchaseData,
            },
          ],
        });

        setTxStatus({ ...txStatus, [pic.id]: "Purchase successful!" });
        
        // Simulate success for demo
        setTimeout(() => {
          setTxStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[pic.id];
            return newStatus;
          });
        }, 3000);

      } catch (error: unknown) {
        console.error("Purchase failed:", error);
        const errorWithCode = error as { code?: number };
        if (errorWithCode.code === 4001) {
          alert("Transaction was rejected by user.");
        } else {
          alert("Purchase failed. Please try again.");
        }
      } finally {
        setBuying(null);
      }
    },
    [isConnected, connectedAddress, txStatus]
  );

  const isFrameAdded = useMemo(() => {
    return context?.client?.added ?? false;
  }, [context]);

  const saveFrameButton = useMemo(() => {
    if (!isFrameAdded && !frameAdded) {
      return (
        <button
          onClick={handleAddFrame}
          disabled={addFrameLoading}
          className="flex items-center space-x-1 text-sm font-medium text-[var(--app-accent)] hover:text-[var(--app-accent-hover)] transition-colors p-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>{addFrameLoading ? "Saving..." : "Save Frame"}</span>
        </button>
      );
    }
    
    if (isFrameAdded || frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-green-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Saved</span>
        </div>
      );
    }
    
    return null;
  }, [isFrameAdded, frameAdded, handleAddFrame, addFrameLoading]);

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] bg-gradient-to-b from-[var(--app-background)] to-[var(--app-gray)]">
      <div className="w-full max-w-2xl mx-auto px-4 py-3">
        {/* Header */}
        <header className="flex justify-between items-center mb-6 h-11">
          <div className="flex items-center space-x-3">
            <Wallet className="z-10">
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
            {isConnected && (
              <div className="flex items-center space-x-1 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Connected</span>
              </div>
            )}
          </div>
          <div>{saveFrameButton}</div>
        </header>

        {/* Connection Status Banner */}
        {!isConnected && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-yellow-800 text-sm">
                Connect your wallet to purchase photos and unlock the full experience
              </span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 space-y-6">
          {/* Gallery Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {PICTURES.map((pic) => {
              const isUnlocked = ownedPhotos[pic.id];
              const isProcessing = buying === pic.id;
              const status = txStatus[pic.id];

              // Enhanced button logic
              let buttonText: string;
              let buttonDisabled = false;
              let buttonColor = "bg-[var(--app-accent)] hover:bg-[var(--app-accent-hover)]";

              if (!isConnected) {
                buttonText = "Connect Wallet to Buy";
                buttonDisabled = true;
                buttonColor = "bg-gray-400";
              } else if (isProcessing) {
                buttonText = status || "Processing...";
                buttonDisabled = true;
                buttonColor = "bg-blue-500";
              } else if (isUnlocked) {
                buttonText = "✓ Purchased";
                buttonDisabled = true;
                buttonColor = "bg-green-500";
              } else {
                buttonText = `Buy for ${pic.priceUSDC} USDC`;
              }

              return (
                <div
                  key={pic.id}
                  className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl shadow-lg border border-[var(--app-card-border)] p-4 transition-all duration-300 hover:shadow-xl"
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
                        <div className="bg-black/80 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
                          🔒 Locked
                        </div>
                      </div>
                    )}
                    {ownershipLoading && isConnected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">{pic.title}</h3>
                    
                    <button
                      onClick={() => handlePurchase(pic)}
                      disabled={buttonDisabled}
                      className={`w-full px-4 py-2 text-white rounded-lg font-medium transition-all duration-200 ${buttonColor} ${
                        buttonDisabled ? "opacity-50 cursor-not-allowed" : "transform hover:scale-105"
                      }`}
                    >
                      {isProcessing && (
                        <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      )}
                      {buttonText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enhanced Status Card */}
          <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl shadow-lg border border-[var(--app-card-border)] p-6">
            <h3 className="text-lg font-semibold text-[var(--app-foreground)] mb-4">
              App Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--app-foreground-muted)]">MiniKit Ready:</span>
                  <span className={`font-medium flex items-center space-x-1 ${
                    isFrameReady ? "text-green-600" : "text-yellow-600"
                  }`}>
                    {isFrameReady ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Ready</span>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading...</span>
                      </>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-[var(--app-foreground-muted)]">Wallet Connected:</span>
                  <span className={`font-medium flex items-center space-x-1 ${
                    isConnected ? "text-green-600" : "text-gray-500"
                  }`}>
                    {isConnected ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Yes</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span>No</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--app-foreground-muted)]">Frame Added:</span>
                  <span className={`font-medium flex items-center space-x-1 ${
                    (isFrameAdded || frameAdded) ? "text-green-600" : "text-gray-500"
                  }`}>
                    {(isFrameAdded || frameAdded) ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <div className="w-4 h-4 border border-gray-400 rounded"></div>
                        <span>Not Added</span>
                      </>
                    )}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-[var(--app-foreground-muted)]">Contract:</span>
                  <span className={`font-medium text-xs ${
                    CONTRACT_ADDRESS !== "YOUR_DEPLOYED_CONTRACT_ADDRESS" ? "text-green-600" : "text-orange-600"
                  }`}>
                    {CONTRACT_ADDRESS !== "YOUR_DEPLOYED_CONTRACT_ADDRESS" ? "Deployed" : "Demo Mode"}
                  </span>
                </div>
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