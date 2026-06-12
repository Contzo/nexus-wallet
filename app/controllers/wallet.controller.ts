import { Scw } from "../lib/scw";
import { scwFactory } from "../lib/viemClient";
import { generateMintUserOperation, generateTransferUserOperation } from "../lib/generatePackedUserOperation";
import { sendUserOperation, getUserOperationReceipt } from "../lib/bundlerClient";
import { env } from "../lib/env";
import { Address } from "viem";

const TokenAddress = env("erc20Token") as Address;
const Paymaster = env("sponsorContract") as Address;

// How much to bump fees on a "replacement underpriced" retry (20%).
const FEE_BUMP_PCT = 120n;

export async function getBalance(scwAddress: string): Promise<{ balance: string }> {
  const scw = new Scw(scwAddress as Address);
  const balance = await scw.getBalance(TokenAddress);
  return { balance: balance.toString() };
}

export async function submitMint(
  subId: string,
  amount: bigint,
): Promise<{ userOpHash: `0x${string}` }> {
  const scwAddress = await scwFactory.predictScwAddress(subId);
  if (!scwAddress) throw new Error("Failed to predict SCW address.");

  const deployed = await scwFactory.getScwAddressFromChain(subId);
  if (!deployed) {
    const newAddress = await scwFactory.deployScw(subId);
    if (!newAddress) throw new Error("Failed to deploy SCW.");
  }

  const userOp = await generateMintUserOperation(TokenAddress, scwAddress, amount, Paymaster);
  if (!userOp) throw new Error("Failed to generate UserOp.");

  const userOpHash = await sendUserOperation(userOp);
  return { userOpHash };
}

export async function submitTransfer(
  subId: string,
  scwAddress: string,
  receiver: Address,
  amount: bigint,
): Promise<{ userOpHash: `0x${string}` }> {
  const deployed = await scwFactory.getScwAddressFromChain(subId);
  if (!deployed) throw new Error("SCW not deployed. Mint some tokens first to deploy your wallet.");

  // Retry up to 3 times. If the bundler rejects with "replacement underpriced" it means a
  // previous UserOp for the same nonce is still pending (e.g. from a timed-out request).
  // Re-generating with bumped fees (≥10% required by bundler) lets the new UserOp replace it.
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const feeMultiplierPct = attempt === 0 ? 100n : FEE_BUMP_PCT;
    const userOp = await generateTransferUserOperation(
      TokenAddress,
      scwAddress as Address,
      receiver,
      amount,
      Paymaster,
      feeMultiplierPct,
    );
    if (!userOp) throw new Error("Failed to generate UserOp.");

    try {
      const userOpHash = await sendUserOperation(userOp);
      return { userOpHash };
    } catch (e) {
      lastError = e;
      if (attempt < 2 && String(e).toLowerCase().includes("replacement underpriced")) {
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

type OperationStatus =
  | { status: "pending" }
  | { status: "success"; txHash: `0x${string}` }
  | { status: "failed"; txHash: `0x${string}` };

export async function getOperationStatus(
  userOpHash: `0x${string}`,
): Promise<OperationStatus> {
  const receipt = await getUserOperationReceipt(userOpHash);
  if (!receipt) return { status: "pending" };
  return {
    status: receipt.success ? "success" : "failed",
    txHash: receipt.txHash,
  };
}
