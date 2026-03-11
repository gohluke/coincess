import { privateKeyToAccount } from "viem/accounts";

const AGENT_STORAGE_PREFIX = "coincess_agent_";

export interface StoredAgent {
  privateKey: string;
  address: string;
  approvedAt: number;
}

export function getStoredAgent(userAddress: string): StoredAgent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${AGENT_STORAGE_PREFIX}${userAddress.toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeAgent(userAddress: string, agent: StoredAgent) {
  localStorage.setItem(
    `${AGENT_STORAGE_PREFIX}${userAddress.toLowerCase()}`,
    JSON.stringify(agent),
  );
}

export function clearStoredAgent(userAddress: string) {
  localStorage.removeItem(`${AGENT_STORAGE_PREFIX}${userAddress.toLowerCase()}`);
}

/**
 * Returns a viem LocalAccount for the stored agent, usable as a wallet
 * parameter in signL1Action. Returns null if no agent is stored.
 */
export function getAgentAccount(userAddress: string) {
  const stored = getStoredAgent(userAddress);
  if (!stored) return null;
  return privateKeyToAccount(stored.privateKey as `0x${string}`);
}
