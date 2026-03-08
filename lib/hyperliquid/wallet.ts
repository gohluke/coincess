import { createWalletClient, custom } from "viem";
import { arbitrum } from "viem/chains";

export function getWalletClient() {
  const eth = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!eth) return null;
  return createWalletClient({
    chain: arbitrum,
    transport: custom(eth as Parameters<typeof custom>[0]),
  });
}

export async function connectWallet(): Promise<string | null> {
  const eth = (window as unknown as {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
    };
  }).ethereum;

  if (!eth) {
    window.open("https://metamask.io/download/", "_blank");
    return null;
  }

  try {
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    return accounts[0] || null;
  } catch {
    return null;
  }
}

export async function getConnectedAddress(): Promise<string | null> {
  const client = getWalletClient();
  if (!client) return null;
  try {
    const [addr] = await client.getAddresses();
    return addr || null;
  } catch {
    return null;
  }
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function onAccountsChanged(cb: (accounts: string[]) => void): () => void {
  const eth = (window as unknown as {
    ethereum?: {
      on: (event: string, handler: (accounts: string[]) => void) => void;
      removeListener: (event: string, handler: (accounts: string[]) => void) => void;
    };
  }).ethereum;

  if (!eth) return () => {};
  eth.on("accountsChanged", cb);
  return () => eth.removeListener("accountsChanged", cb);
}
