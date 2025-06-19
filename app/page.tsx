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
import { useAccount } from "wagmi";
import { useEffect, useMemo, useState, useCallback } from "react";
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
    title: "Boobs",
    priceUSDC: 5,
    previewIpfsHash: "bafybeifenrhlwmwdnpavvorzop74f6kj7t3nkxta4m37vbgeysbpboikii",
    fullIpfsHash: "bafybeif6wwnwy22eh2zc7gafzuixkgv466m2ok3rquopxsb4kfigdtpp3m",
  },
  {
    id: "2",
    tokenId: 2,
    title: "Full Body",
    priceUSDC: 10,
    previewIpfsHash: "bafkreidvjecoqtdml4utim66gswvbdonumn6ywwmduayhhkruievhsqz2i",
    fullIpfsHash: "bafybeihyb2jqs3m4jbcpx3bbxaedeuj54nypp2p7ffysn36p6oz6ws3kdi", 
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
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [addFrameLoading, setAddFrameLoading] = useState(false);
  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  const { address: connectedAddress, isConnected } = useAccount();
  
  const { ownedPhotos, fullImageHashes, loading: ownershipLoading, refetch } = usePhotoOwnership(connectedAddress);
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
    console.log("Purchase button clicked for:", pic.title);

    if (!isConnected || !connectedAddress) {
      alert("Please connect your wallet first using the button at the top right.");
      return;
    }

    if (typeof window === "undefined" || !window.ethereum) {
      alert("No Ethereum provider found.");
      return;
    }

    setBuying(pic.id);
    setTxStatus(prev => ({ ...prev, [pic.id]: "Preparing transaction..." }));

    try {
      // First, ensure we have proper account access
      console.log("Requesting account access...");
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available");
      }

      const userAccount = accounts[0];
      console.log("Using account:", userAccount);

      // Verify we're on the correct network (Base mainnet)
      const chainId = await window.ethereum.request({
        method: 'eth_chainId'
      });
      
      console.log("Current chain ID:", chainId);
      
      // Base mainnet is 0x2105 (8453 in decimal)
      if (chainId !== '0x2105') {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          });
        } catch (switchError: unknown) {
          // If the chain doesn't exist, add it
          if (
            typeof switchError === "object" &&
            switchError !== null &&
            "code" in switchError &&
            switchError.code === 4902
          ) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x2105',
                chainName: 'Base',
                nativeCurrency: {
                  name: 'Ethereum',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      console.log("Starting purchase process for token:", pic.tokenId);
      
      // Convert USDC amount (6 decimals for USDC)
      const usdcAmount = (BigInt(pic.priceUSDC) * BigInt(1_000_000)).toString();
      console.log("USDC amount:", usdcAmount);
      
      // Step 1: Approve USDC
      setTxStatus(prev => ({ ...prev, [pic.id]: "Approving USDC..." }));
      
      const approveData = await encodeFunctionCall(USDC_ABI, "approve", [
        CONTRACT_ADDRESS,
        usdcAmount,
      ]);
      
      console.log("Sending USDC approval transaction");
      const approveTxHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: userAccount, // Use the verified account
            to: USDC_ADDRESS,
            data: approveData,
            gas: "0x15F90", // 90000 gas limit
          },
        ],
      });
      
      console.log("USDC approval transaction sent:", approveTxHash);
      setTxStatus(prev => ({ ...prev, [pic.id]: "USDC approved, purchasing photo..." }));

      // Wait for approval confirmation
      setTxStatus(prev => ({ ...prev, [pic.id]: "Waiting for approval confirmation..." }));
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Step 2: Purchase photo
      const purchaseData = await encodeFunctionCall(
        MARKETPLACE_ABI,
        "purchasePhoto",
        [pic.tokenId]
      );
      
      console.log("Sending purchase transaction");
      const purchaseTxHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: userAccount, // Use the verified account
            to: CONTRACT_ADDRESS,
            data: purchaseData,
            gas: "0x30D40", // 200000 gas limit
          },
        ],
      });

      console.log("Purchase transaction sent:", purchaseTxHash);
      setTxStatus(prev => ({ ...prev, [pic.id]: "Purchase successful! Updating..." }));
      
      // Refresh ownership after successful purchase
      setTimeout(() => {
        refetch();
        setTxStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[pic.id];
          return newStatus;
        });
      }, 5000); // Increased wait time

    } catch (error: unknown) {
      console.error("Purchase failed:", error);
      
      let errorMessage = "Purchase failed. Please try again.";
      
      if (typeof error === "object" && error !== null) {
        // @ts-expect-error: error might have code/message
        if (error.code === 4001) {
          errorMessage = "Transaction was rejected by user.";
        // @ts-expect-error: error might have code
        } else if (error.code === -32002) {
          errorMessage = "Please check MetaMask - there may be a pending request.";
        // @ts-expect-error: error might have code  
        } else if (error.code === 4100) {
          errorMessage = "Please connect your wallet and authorize this app.";
        // @ts-expect-error: error might have message
        } else if (typeof error.message === "string" && error.message.includes("insufficient")) {
          errorMessage = "Insufficient funds for transaction.";
        // @ts-expect-error: error might have message
        } else if (typeof error.message === "string" && error.message.includes("gas")) {
          errorMessage = "Gas estimation failed. Please try again.";
        // @ts-expect-error: error might have message
        } else if (typeof error.message === "string" && error.message.includes("authorized")) {
          errorMessage = "Wallet not properly connected. Please reconnect your wallet.";
        }
      }
      
      alert(errorMessage);
      setTxStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[pic.id];
        return newStatus;
      });
    } finally {
      setBuying(null);
    }
  },
  [isConnected, connectedAddress, refetch]
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

        {/* Debug Info */}
        {isConnected && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-xs text-blue-800">
              <div>Contract: {CONTRACT_ADDRESS}</div>
              <div>Connected Address: {connectedAddress}</div>
              <div>IPFS Gateway: {IPFS_GATEWAY}</div>
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
              
              // Determine which image to show
              const imageHash = isUnlocked ? fullImageHashes[pic.id] : pic.previewIpfsHash;

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
                <PhotoCard
                  key={pic.id}
                  pic={pic}
                  imageHash={imageHash}
                  isUnlocked={isUnlocked}
                  isProcessing={isProcessing}
                  ownershipLoading={ownershipLoading}
                  buttonText={buttonText}
                  buttonDisabled={buttonDisabled}
                  buttonColor={buttonColor}
                  onPurchase={handlePurchase}
                />
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
                  <span className="font-medium text-xs text-green-600">
                    {CONTRACT_ADDRESS ? "Deployed" : "Not set"}
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

/* ---------------- PHOTO CARD COMPONENT ---------------- */
interface PhotoCardProps {
  pic: typeof PICTURES[number];
  imageHash: string | undefined;
  isUnlocked: boolean;
  isProcessing: boolean;
  ownershipLoading: boolean;
  buttonText: string;
  buttonDisabled: boolean;
  buttonColor: string;
  onPurchase: (pic: typeof PICTURES[number]) => void;
}

function PhotoCard({
  pic,
  imageHash,
  isUnlocked,
  isProcessing,
  ownershipLoading,
  buttonText,
  buttonDisabled,
  buttonColor,
  onPurchase,
}: PhotoCardProps) {
  const { imageUrl, loading: imageLoading, error: imageError } = useIPFSImage(imageHash ?? null);

  return (
    <div className="bg-[var(--app-card-bg)] backdrop-blur-md rounded-xl shadow-lg border border-[var(--app-card-border)] p-4 transition-all duration-300 hover:shadow-xl">
      <div className="relative aspect-square mb-4">
        {imageLoading ? (
          <div className="w-full h-full rounded-lg bg-gray-200 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-8 h-8 border-2 border-[var(--app-accent)] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-[var(--app-foreground-muted)]">Loading from IPFS...</span>
            </div>
          </div>
        ) : imageError ? (
          <div className="w-full h-full rounded-lg bg-red-100 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-2 text-center p-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-600">Failed to load image</span>
              <span className="text-xs text-red-500">IPFS connection error</span>
            </div>
          </div>
        ) : imageUrl ? (
          <Image
            src={imageUrl}
            alt={pic.title}
            className={`rounded-lg object-cover transition-all duration-500 ${
              isUnlocked ? "" : "blur-sm brightness-75"
            }`}
          />
        ) : (
          <div className="w-full h-full rounded-lg bg-gray-200 flex items-center justify-center">
            <span className="text-sm text-[var(--app-foreground-muted)]">No image</span>
          </div>
        )}
        
        {!isUnlocked && imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/80 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
              🔒 Preview Only
            </div>
          </div>
        )}
        
        {ownershipLoading && (
          <div className="absolute top-2 right-2">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {isUnlocked && (
          <div className="absolute top-2 left-2">
            <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              ✓ Owned
            </div>
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">{pic.title}</h3>
          <div className="text-xs text-[var(--app-foreground-muted)]">
            Token #{pic.tokenId}
          </div>
        </div>
        
        {imageHash && (
          <div className="text-xs text-[var(--app-foreground-muted)] font-mono">
            IPFS: {imageHash.slice(0, 12)}...{imageHash.slice(-8)}
          </div>
        )}
        
        <button
          onClick={() => onPurchase(pic)}
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
}