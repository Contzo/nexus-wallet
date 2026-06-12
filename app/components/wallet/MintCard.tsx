"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { PlusIcon } from "@/components/icons";
import { TOKEN_SYMBOL, toWei } from "@/lib/format";

async function postMint(amount: string) {
  const res = await fetch(`/api/wallet/mint?amount=${toWei(amount)}`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to mint tokens.");
  return data as { userOpHash: `0x${string}` };
}

async function fetchStatus(hash: string) {
  const res = await fetch(`/api/wallet/status?hash=${hash}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to check status.");
  return data as { status: "pending" | "success" | "failed" };
}

export default function MintCard() {
  const [amount, setAmount] = useState("");
  const [userOpHash, setUserOpHash] = useState<string | null>(null);

  const {
    mutate,
    isPending: isSubmitting,
    isError: isSubmitError,
    error: submitError,
    reset: resetMutation,
  } = useMutation({
    mutationFn: postMint,
    onSuccess: (data) => setUserOpHash(data.userOpHash),
  });

  const { data: statusData, isError: isStatusError, error: statusError } = useQuery({
    queryKey: ["opStatus", userOpHash],
    queryFn: () => fetchStatus(userOpHash!),
    enabled: !!userOpHash,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  });

  function reset() {
    resetMutation();
    setUserOpHash(null);
  }

  const isConfirming = !!userOpHash && statusData?.status === "pending";
  const isPending = isSubmitting || isConfirming;
  const isSuccess = statusData?.status === "success";
  const isError = isSubmitError || isStatusError || statusData?.status === "failed";
  const errorMsg = isSubmitError
    ? (submitError as Error).message
    : isStatusError
    ? (statusError as Error).message
    : "Transaction failed on-chain.";

  function handleMint() {
    if (!amount) return;
    mutate(amount);
  }

  return (
    <Card>
      <CardHeader
        title="Get Tokens"
        subtitle="Mint test NXS to your smart account."
      />
      <CardBody className="space-y-3 pt-4">
        <Field
          label="Amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          suffix={TOKEN_SYMBOL}
          mono
          value={amount}
          onChange={(e) => {
            reset();
            setAmount(e.target.value);
          }}
          disabled={isPending}
        />

        <Button icon={<PlusIcon size={16} />} pending={isPending} onClick={handleMint}>
          {isSubmitting ? "Minting…" : isConfirming ? "Confirming…" : "Mint"}
        </Button>

        {isSuccess && (
          <StatusMessage kind="success">
            Minted {amount} {TOKEN_SYMBOL} successfully.
          </StatusMessage>
        )}

        {isError && (
          <StatusMessage kind="error">
            {errorMsg}
          </StatusMessage>
        )}

        {!isPending && !isSuccess && !isError && (
          <p className="flex items-center gap-1.5 text-[12px] text-dim">
            <span className="h-1 w-1 rounded-full bg-accentdim" />
            Gas sponsored by the Nexus paymaster.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
