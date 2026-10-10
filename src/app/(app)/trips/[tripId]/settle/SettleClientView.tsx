'use client';

import React, { useActionState, useState } from 'react';
import {
  recordSettlementAction,
  voidSettlementAction,
  type ActionState,
} from '@/actions/settlements';
import { formatPaise } from '@/lib/money';
import { buildUpiLink } from '@/lib/upi';

export interface MemberInfo {
  id: string;
  displayName: string;
  upiId?: string | null;
}

export interface PlannedPayment {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  toUpiId?: string | null;
  amountPaise: number;
}

export interface RecordedSettlement {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amountPaise: number;
  paidOn: string;
  note?: string | null;
  createdBy: string;
}

interface SettleClientViewProps {
  tripId: string;
  tripName: string;
  members: MemberInfo[];
  currentMemberId: string;
  isAdmin: boolean;
  plannedTransfers: PlannedPayment[];
  recordedSettlements: RecordedSettlement[];
  isAllSettled: boolean;
}

export function SettleClientView({
  tripId,
  tripName,
  members,
  currentMemberId,
  isAdmin,
  plannedTransfers,
  recordedSettlements,
  isAllSettled,
}: SettleClientViewProps) {
  const [recordState, recordAction, isPendingRecord] = useActionState<ActionState | null, FormData>(
    recordSettlementAction,
    null
  );

  const [voidState, voidAction, isPendingVoid] = useActionState<ActionState | null, FormData>(
    voidSettlementAction,
    null
  );

  const [copiedUpiId, setCopiedUpiId] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);

  const handleCopyUpi = async (upiId: string) => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopiedUpiId(upiId);
      setTimeout(() => setCopiedUpiId(null), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="border-b border-rule pb-3 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <h2 className="font-serif text-2xl font-normal text-ink">Settle up</h2>
          <p className="text-xs text-ink-2 mt-1">
            Minimum payments to clear all debts and record payments.
          </p>
        </div>
        <a
          href={`/api/trips/${tripId}/export`}
          className="text-xs text-ink-2 hover:text-ink underline underline-offset-2"
        >
          Export data to CSV
        </a>
      </div>

      {/* Notices */}
      {recordState?.message && (
        <div
          aria-live="polite"
          className={`p-3 border text-xs ${
            recordState.ok
              ? 'border-rule bg-paper text-ink'
              : 'border-brick bg-paper text-brick'
          }`}
        >
          {recordState.message}
        </div>
      )}

      {voidState?.message && (
        <div
          aria-live="polite"
          className={`p-3 border text-xs ${
            voidState.ok
              ? 'border-rule bg-paper text-ink'
              : 'border-brick bg-paper text-brick'
          }`}
        >
          {voidState.message}
        </div>
      )}

      {/* Settled state badge or Planned Transfers */}
      {isAllSettled ? (
        <div className="border border-rule p-5 bg-paper">
          <p className="text-sm font-medium text-moss">
            All settled. {recordedSettlements.length}{' '}
            {recordedSettlements.length === 1 ? 'payment' : 'payments'} recorded.
          </p>
          <p className="text-xs text-ink-2 mt-1">
            Everyone is even. No outstanding debts remaining for this trip.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-b border-rule pb-1.5 flex justify-between items-baseline">
            <h3 className="font-serif text-lg text-ink font-normal">
              Recommended payments ({plannedTransfers.length})
            </h3>
            <span className="text-xs text-ink-2 font-mono">
              Simplified to fewest transfers
            </span>
          </div>

          {plannedTransfers.length === 0 ? (
            <p className="text-xs text-ink-2 py-4 border-t border-rule">
              Everyone is even.
            </p>
          ) : (
            <div className="border-t border-rule divide-y divide-rule text-xs">
              {plannedTransfers.map((p, idx) => {
                const upiLink = p.toUpiId
                  ? buildUpiLink({
                      upiId: p.toUpiId,
                      receiverName: p.toName,
                      amountPaise: p.amountPaise,
                      tripName,
                    })
                  : null;

                const isPayerOrReceiverOrAdmin =
                  currentMemberId === p.fromId ||
                  currentMemberId === p.toId ||
                  isAdmin;

                return (
                  <div
                    key={`${p.fromId}-${p.toId}-${idx}`}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{p.fromName}</span>
                        <span className="text-ink-2">pays</span>
                        <span className="font-medium text-ink">{p.toName}</span>
                        <span className="font-mono text-sm tabular-nums font-medium text-brick ml-2">
                          {formatPaise(p.amountPaise)}
                        </span>
                      </div>

                      {p.toUpiId && (
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-ink-2">
                          <span>UPI ID: {p.toUpiId}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyUpi(p.toUpiId!)}
                            className="underline underline-offset-2 text-ink hover:text-brick"
                          >
                            {copiedUpiId === p.toUpiId ? 'Copied UPI ID' : 'Copy UPI ID'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {upiLink && (
                        <a
                          href={upiLink}
                          className="px-2.5 py-1 text-xs border border-rule text-ink hover:bg-paper-2"
                        >
                          Pay by UPI
                        </a>
                      )}

                      {isPayerOrReceiverOrAdmin && (
                        <form action={recordAction}>
                          <input type="hidden" name="tripId" value={tripId} />
                          <input type="hidden" name="fromMember" value={p.fromId} />
                          <input type="hidden" name="toMember" value={p.toId} />
                          <input
                            type="hidden"
                            name="amountRupees"
                            value={(p.amountPaise / 100).toFixed(2)}
                          />
                          <input
                            type="hidden"
                            name="note"
                            value="Settled via recommended plan"
                          />
                          <button
                            type="submit"
                            disabled={isPendingRecord}
                            className="px-2.5 py-1 text-xs bg-brick text-paper hover:bg-brick-dark disabled:opacity-50"
                          >
                            Mark as paid
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Toggle manual record settlement form */}
      <div>
        <button
          type="button"
          onClick={() => setShowManualForm(!showManualForm)}
          className="text-xs text-brick hover:text-brick-dark underline underline-offset-2"
        >
          {showManualForm ? 'Hide custom payment form' : 'Record a custom or cash payment'}
        </button>

        {showManualForm && (
          <form
            action={recordAction}
            className="mt-4 border border-rule p-4 bg-paper space-y-4"
          >
            <h4 className="text-xs font-mono uppercase text-ink-2">
              Record a payment outside the plan
            </h4>
            <input type="hidden" name="tripId" value={tripId} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor="fromMember" className="block text-ink-2 mb-1">
                  Payer
                </label>
                <select
                  id="fromMember"
                  name="fromMember"
                  defaultValue={currentMemberId}
                  className="w-full px-2.5 py-1.5 border border-rule bg-paper text-ink"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="toMember" className="block text-ink-2 mb-1">
                  Receiver
                </label>
                <select
                  id="toMember"
                  name="toMember"
                  className="w-full px-2.5 py-1.5 border border-rule bg-paper text-ink"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="amountRupees" className="block text-ink-2 mb-1">
                  Amount (₹)
                </label>
                <input
                  id="amountRupees"
                  name="amountRupees"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 1500"
                  required
                  className="w-full px-2.5 py-1.5 font-mono border border-rule bg-paper text-ink focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="paidOn" className="block text-ink-2 mb-1">
                  Payment date
                </label>
                <input
                  id="paidOn"
                  name="paidOn"
                  type="date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-2.5 py-1.5 border border-rule bg-paper text-ink focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="note" className="block text-xs text-ink-2 mb-1">
                Note (optional)
              </label>
              <input
                id="note"
                name="note"
                type="text"
                placeholder="e.g. Paid in cash at airport"
                maxLength={200}
                className="w-full px-2.5 py-1.5 text-xs border border-rule bg-paper text-ink focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPendingRecord}
              className="px-3.5 py-1.5 text-xs bg-brick text-paper hover:bg-brick-dark disabled:opacity-50"
            >
              {isPendingRecord ? 'Saving payment...' : 'Record payment'}
            </button>
          </form>
        )}
      </div>

      {/* Recorded settlements history */}
      <div className="space-y-3">
        <div className="border-b border-rule pb-1.5 flex justify-between items-baseline">
          <h3 className="font-serif text-lg text-ink font-normal">
            Payment history ({recordedSettlements.length})
          </h3>
        </div>

        {recordedSettlements.length === 0 ? (
          <p className="text-xs text-ink-2 py-4 border-t border-rule">
            No payments recorded yet.
          </p>
        ) : (
          <div className="border-t border-rule divide-y divide-rule text-xs">
            {recordedSettlements.map((s) => {
              const canVoid =
                currentMemberId === s.createdBy ||
                isAdmin;

              return (
                <div
                  key={s.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-ink font-medium">
                      {s.fromName} paid {s.toName}
                    </p>
                    <p className="text-[11px] text-ink-2 mt-0.5">
                      {s.paidOn}
                      {s.note ? ` • ${s.note}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-mono tabular-nums text-moss font-medium">
                      {formatPaise(s.amountPaise)}
                    </span>

                    {canVoid && (
                      <form action={voidAction}>
                        <input type="hidden" name="tripId" value={tripId} />
                        <input type="hidden" name="settlementId" value={s.id} />
                        <button
                          type="submit"
                          disabled={isPendingVoid}
                          className="text-[11px] text-brick hover:text-brick-dark underline underline-offset-2"
                        >
                          Void
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
