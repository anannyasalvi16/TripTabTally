'use client';

import React, { useActionState, useState } from 'react';
import {
  recordSettlementAction,
  voidSettlementAction,
  type ActionState,
} from '@/actions/settlements';
import { formatPaise, type FamilyBalanceOutput } from '@/lib/money';
import { buildUpiLink } from '@/lib/upi';
import {
  formatDueReminderMessage,
  getWhatsAppShareUrl,
  getSmsShareUrl,
  canSendReminder,
} from '@/lib/reminders';
import { recordDueReminderAction } from '@/actions/reminders';

export interface MemberInfo {
  id: string;
  displayName: string;
  upiId?: string | null;
  familyId?: string | null;
  familyName?: string | null;
  phone?: string | null;
}

export interface PlannedPayment {
  fromId: string;
  fromName: string;
  fromPhone?: string | null;
  toId: string;
  toName: string;
  toUpiId?: string | null;
  amountPaise: number;
}

export interface PlannedFamilyPayment {
  fromId: string;
  fromName: string;
  isFromFamily: boolean;
  toId: string;
  toName: string;
  isToFamily: boolean;
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
  families: Array<{ id: string; name: string }>;
  currentMemberId: string;
  isAdmin: boolean;
  balances: Record<string, number>;
  familyBalances: FamilyBalanceOutput[];
  plannedTransfers: PlannedPayment[];
  plannedFamilyTransfers: PlannedFamilyPayment[];
  recordedSettlements: RecordedSettlement[];
  recentReminders?: Record<string, string>;
  isAllSettled: boolean;
}

export function SettleClientView({
  tripId,
  tripName,
  members,
  families,
  currentMemberId,
  isAdmin,
  balances,
  familyBalances,
  plannedTransfers,
  plannedFamilyTransfers,
  recordedSettlements,
  recentReminders = {},
  isAllSettled,
}: SettleClientViewProps) {
  const [viewMode, setViewMode] = useState<'individual' | 'family'>('individual');
  const [remindersMap, setRemindersMap] = useState<Record<string, string>>(recentReminders);
  const [activeReminder, setActiveReminder] = useState<PlannedPayment | null>(null);
  const [reminderStatus, setReminderStatus] = useState<{
    sending?: boolean;
    message?: string;
    error?: string;
  }>({});
  const [copiedReminderMsg, setCopiedReminderMsg] = useState(false);

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

  const handleRecordReminder = async (
    p: PlannedPayment,
    channel: 'whatsapp' | 'sms' | 'copy'
  ) => {
    setReminderStatus({ sending: true });
    try {
      const res = await recordDueReminderAction(
        tripId,
        p.fromId,
        p.toId,
        p.amountPaise,
        channel
      );
      if (res.ok) {
        setRemindersMap((prev) => ({
          ...prev,
          [p.fromId]: new Date().toISOString(),
        }));
        setReminderStatus({
          sending: false,
          message: 'Reminder sent and recorded. Rate limit: once per day per person.',
        });
      } else {
        setReminderStatus({
          sending: false,
          error: res.error || 'Failed to record reminder',
        });
      }
    } catch {
      setReminderStatus({
        sending: false,
        error: 'Network error recording reminder',
      });
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

      {/* View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex border border-rule">
          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`px-3 py-1.5 text-xs font-mono transition-colors ${
              viewMode === 'individual'
                ? 'bg-ink text-paper font-medium'
                : 'bg-paper text-ink-2 hover:text-ink'
            }`}
          >
            Individual (Person)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('family')}
            className={`px-3 py-1.5 text-xs font-mono border-l border-rule transition-colors ${
              viewMode === 'family'
                ? 'bg-ink text-paper font-medium'
                : 'bg-paper text-ink-2 hover:text-ink'
            }`}
          >
            Family
          </button>
        </div>
        <span className="text-xs text-ink-2 font-mono">
          {viewMode === 'individual'
            ? `${members.length} members`
            : `${familyBalances.length} units (${families.length} ${
                families.length === 1 ? 'family' : 'families'
              })`}
        </span>
      </div>

      {/* Net Balances Summary */}
      <div className="border border-rule p-4 bg-paper space-y-3">
        <div className="flex justify-between items-baseline border-b border-rule pb-1.5">
          <h3 className="font-serif text-base text-ink font-normal">
            {viewMode === 'individual'
              ? 'Individual net balances'
              : 'Family & solo net balances'}
          </h3>
          <span className="text-[11px] text-ink-2 font-mono">
            Zero-sum ledger
          </span>
        </div>

        <div className="divide-y divide-rule text-xs">
          {viewMode === 'individual' ? (
            members.map((m) => {
              const bal = balances[m.id] || 0;
              return (
                <div key={m.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-ink">{m.displayName}</span>
                    {m.familyName && (
                      <span className="text-ink-2 text-[11px]">
                        ({m.familyName})
                      </span>
                    )}
                    {bal < 0 && (
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 border border-brick text-brick">
                        Pending dues
                      </span>
                    )}
                  </div>
                  <div className="font-mono tabular-nums">
                    {bal > 0 ? (
                      <span className="text-moss font-medium">
                        +{formatPaise(bal)} (owed)
                      </span>
                    ) : bal < 0 ? (
                      <span className="text-brick font-medium">
                        -{formatPaise(Math.abs(bal))} (owes)
                      </span>
                    ) : (
                      <span className="text-ink-2">Settled</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            familyBalances.map((fb) => (
              <div key={fb.id} className="py-2 flex items-center justify-between">
                <div>
                  <span className="font-medium text-ink">{fb.name}</span>
                  <span className="text-ink-2 ml-1.5 text-[11px]">
                    {fb.isFamily
                      ? `(${fb.memberIds.length} ${
                          fb.memberIds.length === 1 ? 'member' : 'members'
                        })`
                      : '(Solo)'}
                  </span>
                </div>
                <div className="font-mono tabular-nums">
                  {fb.balancePaise > 0 ? (
                    <span className="text-moss font-medium">
                      +{formatPaise(fb.balancePaise)} (owed)
                    </span>
                  ) : fb.balancePaise < 0 ? (
                    <span className="text-brick font-medium">
                      -{formatPaise(Math.abs(fb.balancePaise))} (owes)
                    </span>
                  ) : (
                    <span className="text-ink-2">Settled</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
      ) : viewMode === 'individual' ? (
        <div className="space-y-4">
          <div className="border-b border-rule pb-1.5 flex justify-between items-baseline">
            <h3 className="font-serif text-lg text-ink font-normal">
              Recommended individual payments ({plannedTransfers.length})
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

                    <div className="flex items-center gap-2 flex-wrap">
                      {p.amountPaise > 0 && (
                        (() => {
                          const lastReminded = remindersMap[p.fromId];
                          const check = canSendReminder(lastReminded);
                          if (!check.allowed) {
                            return (
                              <span
                                title="Reminder already sent within the past 24 hours."
                                className="px-2.5 py-1 text-xs border border-rule text-ink-2 opacity-60 cursor-not-allowed font-mono"
                              >
                                Reminded today
                              </span>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReminder(p);
                                setReminderStatus({});
                              }}
                              className="px-2.5 py-1 text-xs border border-rule text-ink hover:bg-paper-2"
                            >
                              Remind
                            </button>
                          );
                        })()
                      )}

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
      ) : (
        <div className="space-y-4">
          <div className="border-b border-rule pb-1.5 flex justify-between items-baseline">
            <h3 className="font-serif text-lg text-ink font-normal">
              Recommended family payments ({plannedFamilyTransfers.length})
            </h3>
            <span className="text-xs text-ink-2 font-mono">
              Simplified across families & solo members
            </span>
          </div>

          {plannedFamilyTransfers.length === 0 ? (
            <p className="text-xs text-ink-2 py-4 border-t border-rule">
              All families and members are even.
            </p>
          ) : (
            <div className="border-t border-rule divide-y divide-rule text-xs">
              {plannedFamilyTransfers.map((p, idx) => (
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
                    <p className="text-[11px] text-ink-2 mt-1">
                      Family settlement. To record, pick a member from each family in the custom payment form below or switch to Individual view.
                    </p>
                  </div>
                </div>
              ))}
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
                      {m.familyName ? ` (${m.familyName})` : ''}
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
                      {m.familyName ? ` (${m.familyName})` : ''}
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

      {/* Remind Modal */}
      {activeReminder && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-paper border border-ink p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-baseline border-b border-rule pb-2">
              <h4 className="font-serif text-lg text-ink font-normal">
                Send payment reminder
              </h4>
              <button
                type="button"
                onClick={() => {
                  setActiveReminder(null);
                  setReminderStatus({});
                }}
                className="text-xs text-ink-2 hover:text-ink font-mono"
              >
                [Close]
              </button>
            </div>

            <div className="text-xs space-y-2">
              <p className="text-ink">
                Remind <span className="font-medium">{activeReminder.fromName}</span> about their pending share of{' '}
                <span className="font-mono font-medium">{formatPaise(activeReminder.amountPaise)}</span> to{' '}
                <span className="font-medium">{activeReminder.toName}</span>.
              </p>

              <div className="p-3 bg-paper-2 border border-rule font-mono text-[11px] text-ink whitespace-pre-wrap select-all">
                {formatDueReminderMessage({
                  debtorName: activeReminder.fromName,
                  creditorName: activeReminder.toName,
                  amountPaise: activeReminder.amountPaise,
                  tripName,
                  upiId: activeReminder.toUpiId,
                })}
              </div>
            </div>

            {reminderStatus.message && (
              <div className="p-2 border border-moss bg-paper text-moss text-xs font-mono">
                {reminderStatus.message}
              </div>
            )}
            {reminderStatus.error && (
              <div className="p-2 border border-brick bg-paper text-brick text-xs font-mono">
                {reminderStatus.error}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={async () => {
                    const msg = formatDueReminderMessage({
                      debtorName: activeReminder.fromName,
                      creditorName: activeReminder.toName,
                      amountPaise: activeReminder.amountPaise,
                      tripName,
                      upiId: activeReminder.toUpiId,
                    });
                    const url = getWhatsAppShareUrl(msg, activeReminder.fromPhone);
                    window.open(url, '_blank', 'noopener,noreferrer');
                    await handleRecordReminder(activeReminder, 'whatsapp');
                  }}
                  disabled={reminderStatus.sending}
                  className="px-3 py-2 border border-rule bg-paper hover:bg-paper-2 text-ink text-center disabled:opacity-50"
                >
                  Share via WhatsApp
                </button>

                {activeReminder.fromPhone ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const msg = formatDueReminderMessage({
                        debtorName: activeReminder.fromName,
                        creditorName: activeReminder.toName,
                        amountPaise: activeReminder.amountPaise,
                        tripName,
                        upiId: activeReminder.toUpiId,
                      });
                      const url = getSmsShareUrl(msg, activeReminder.fromPhone);
                      window.open(url, '_blank', 'noopener,noreferrer');
                      await handleRecordReminder(activeReminder, 'sms');
                    }}
                    disabled={reminderStatus.sending}
                    className="px-3 py-2 border border-rule bg-paper hover:bg-paper-2 text-ink text-center disabled:opacity-50"
                  >
                    Send SMS
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const msg = formatDueReminderMessage({
                        debtorName: activeReminder.fromName,
                        creditorName: activeReminder.toName,
                        amountPaise: activeReminder.amountPaise,
                        tripName,
                        upiId: activeReminder.toUpiId,
                      });
                      await navigator.clipboard.writeText(msg);
                      setCopiedReminderMsg(true);
                      setTimeout(() => setCopiedReminderMsg(false), 2500);
                      await handleRecordReminder(activeReminder, 'copy');
                    }}
                    disabled={reminderStatus.sending}
                    className="px-3 py-2 border border-rule bg-paper hover:bg-paper-2 text-ink text-center disabled:opacity-50"
                  >
                    {copiedReminderMsg ? 'Copied to clipboard' : 'Copy message'}
                  </button>
                )}
              </div>

              {activeReminder.fromPhone && (
                <button
                  type="button"
                  onClick={async () => {
                    const msg = formatDueReminderMessage({
                      debtorName: activeReminder.fromName,
                      creditorName: activeReminder.toName,
                      amountPaise: activeReminder.amountPaise,
                      tripName,
                      upiId: activeReminder.toUpiId,
                    });
                    await navigator.clipboard.writeText(msg);
                    setCopiedReminderMsg(true);
                    setTimeout(() => setCopiedReminderMsg(false), 2500);
                    await handleRecordReminder(activeReminder, 'copy');
                  }}
                  disabled={reminderStatus.sending}
                  className="w-full px-3 py-1.5 border border-rule text-xs text-ink-2 hover:text-ink text-center disabled:opacity-50"
                >
                  {copiedReminderMsg ? 'Copied to clipboard' : 'Copy message text'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
