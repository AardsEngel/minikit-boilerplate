// types/minikit.d.ts
declare global {
  interface Window {
    MiniKit?: {
      sendTransaction: (params: {
        transactions: Array<{
          to: string;
          data: string;
          value: string;
        }>;
      }) => Promise<{
        transactionHash?: string;
        error?: string;
      }>;
    };
  }
}

export {};