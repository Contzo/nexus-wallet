"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { SendIcon } from "@/components/icons";
import { TOKEN_SYMBOL, TOKEN_DECIMALS, toWei } from "@/lib/format";

interface TransferCardProps {
  balanceWei?: string;
}

async function postTransfer({ receiver, amount }: { receiver: string; amount: string }) {
  const res = await fetch(
    `/api/wallet/transfer?receiver=${receiver}&amount=${toWei(amount)}`,
    { method: "POST" },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to transfer tokens.");
  return data as { userOpHash: `0x${string}` };
}

async function fetchStatus(hash: string) {
  const res = await fetch(`/api/wallet/status?hash=${hash}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to check status.");
  return data as { status: "pending" | "success" | "failed" };
}

export default function TransferCard({ balanceWei }: TransferCardProps) {
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [userOpHash, setUserOpHash] = useState<string | null>(null);

  const {
    mutate,
    isPending: isSubmitting,
    isError: isSubmitError,
    error: submitError,
    reset: resetMutation,
  } = useMutation({
    mutationFn: postTransfer,
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

  function handleTransfer() {
    if (!receiver || !amount) return;
    mutate({ receiver, amount });
  }

  function handleMax() {
    if (!balanceWei) return;
    setAmount(formatUnits(BigInt(balanceWei), TOKEN_DECIMALS));
    reset();
  }

  return (
    <Card>
      <CardHeader title="Send Tokens" subtitle="Transfer NXS to any address." />
      <CardBody className="space-y-3 pt-4">
        <Field
          label="Recipient address"
          type="text"
          placeholder="0x0000…0000"
          mono
          value={receiver}
          onChange={(e) => { reset(); setReceiver(e.target.value); }}
          disabled={isPending}
        />

        <Field
          label="Amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          suffix={TOKEN_SYMBOL}
          mono
          value={amount}
          onChange={(e) => { reset(); setAmount(e.target.value); }}
          disabled={isPending}
          trailing={
            <button
              type="button"
              onClick={handleMax}
              disabled={!balanceWei || isPending}
              className="shrink-0 rounded-md border border-line px-2 py-1 font-mono text-[10.5px] uppercase tracking-wide text-muted transition-colors hover:text-ink disabled:opacity-40"
            >
              Max
            </button>
          }
        />

        <Button
          variant="secondary"
          icon={<SendIcon size={15} />}
          pending={isPending}
          onClick={handleTransfer}
        >
          {isSubmitting ? "Sending…" : isConfirming ? "Confirming…" : "Send"}
        </Button>

        {isSuccess && (
          <StatusMessage kind="success">
            Sent {amount} {TOKEN_SYMBOL} to {receiver.slice(0, 6)}…{receiver.slice(-4)}.
          </StatusMessage>
        )}

        {isError && (
          <StatusMessage kind="error">
            {errorMsg}
          </StatusMessage>
        )}
      </CardBody>
    </Card>
  );
}
