'use client';

import { useState, useActionState } from 'react';
import {
  addPlaceholderAction,
  toggleMemberRoleAction,
  markMemberLeftAction,
  regenerateInviteAction,
  type MemberActionResult,
} from '@/actions/members';

interface Member {
  id: string;
  user_id: string | null;
  display_name: string;
  role: 'admin' | 'member';
  left_at: string | null;
  joined_at: string | null;
  upi_id?: string | null;
}

interface PeopleViewProps {
  tripId: string;
  isAdmin: boolean;
  currentUserId: string;
  members: Member[];
  inviteToken: string | null;
  siteUrl: string;
}

export function PeopleView({
  tripId,
  isAdmin,
  currentUserId,
  members,
  inviteToken,
  siteUrl,
}: PeopleViewProps) {
  const [copied, setCopied] = useState(false);
  const [activeToken, setActiveToken] = useState(inviteToken);
  const [regenerating, setRegenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const addPlaceholderWithTripId = addPlaceholderAction.bind(null, tripId);
  const [addState, formAction, isAdding] = useActionState<MemberActionResult | null, FormData>(
    addPlaceholderWithTripId,
    null
  );

  const inviteUrl = activeToken ? `${siteUrl}/join/${activeToken}` : null;

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMessage('Could not copy link to clipboard.');
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setStatusMessage(null);
    try {
      const res = await regenerateInviteAction(tripId);
      if (res.ok && res.token) {
        setActiveToken(res.token);
        setStatusMessage(res.message || 'New invite link generated.');
      } else {
        setStatusMessage(res.message || 'Could not generate invite link.');
      }
    } catch {
      setStatusMessage('Failed to generate invite link.');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleToggleRole(member: Member) {
    setStatusMessage(null);
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    try {
      const res = await toggleMemberRoleAction(tripId, member.id, newRole, member.display_name);
      setStatusMessage(res.message || null);
    } catch {
      setStatusMessage('Could not update role.');
    }
  }

  async function handleMarkLeft(member: Member) {
    setStatusMessage(null);
    try {
      const res = await markMemberLeftAction(tripId, member.id, member.display_name);
      setStatusMessage(res.message || null);
    } catch {
      setStatusMessage('Could not update member status.');
    }
  }

  const activeMembers = members.filter((m) => !m.left_at);
  const pastMembers = members.filter((m) => Boolean(m.left_at));

  return (
    <div className="space-y-10">
      {statusMessage && (
        <div className="p-3 border border-moss text-moss text-xs bg-paper-2">
          {statusMessage}
        </div>
      )}

      {/* Invite Link Section */}
      <div className="border border-rule p-5 bg-paper">
        <h2 className="font-serif text-lg font-normal text-ink mb-1">
          Invite friends
        </h2>
        <p className="text-xs text-ink-2 mb-4">
          Send this link to group members. Anyone with the link can join or claim their placeholder.
        </p>

        {inviteUrl ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 border border-rule bg-paper-2 px-3 py-2 text-xs text-ink font-mono select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-xs font-medium transition-colors"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-ink-2">
              <span>Expires after 14 days</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="text-brick hover:underline disabled:opacity-50"
                >
                  {regenerating ? 'Regenerating...' : 'Revoke and get new link'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-ink-2 mb-3">No active invite link.</p>
            {isAdmin && (
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-xs font-medium transition-colors"
              >
                {regenerating ? 'Generating...' : 'Generate invite link'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Members List */}
      <div>
        <div className="border-b border-rule pb-2 mb-4">
          <h2 className="font-serif text-xl font-normal text-ink">
            Trip members ({activeMembers.length})
          </h2>
          <p className="text-xs text-ink-2 mt-0.5">
            People on this trip, their roles, and payment details.
          </p>
        </div>

        <div className="border-t border-rule divide-y divide-rule">
          {activeMembers.map((member) => (
            <div
              key={member.id}
              className="py-3 px-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm"
            >
              <div>
                <span className="font-medium text-ink">{member.display_name}</span>
                {member.user_id === currentUserId && (
                  <span className="text-xs text-ink-2 ml-2">(You)</span>
                )}
                {member.user_id === null && (
                  <span className="text-xs bg-paper-2 border border-rule px-1.5 py-0.5 text-ink-2 ml-2">
                    Unclaimed placeholder
                  </span>
                )}
                <div className="text-xs text-ink-2 mt-0.5">
                  <span className="capitalize">{member.role}</span>
                  {member.upi_id && <span> • UPI: {member.upi_id}</span>}
                </div>
              </div>

              {isAdmin && member.user_id !== currentUserId && (
                <div className="flex items-center space-x-3 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleRole(member)}
                    className="text-ink-2 hover:text-ink underline"
                  >
                    {member.role === 'admin' ? 'Make member' : 'Make admin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkLeft(member)}
                    className="text-brick hover:underline"
                  >
                    Mark as left
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add Placeholder Member */}
      <div className="border border-rule p-5 bg-paper">
        <h2 className="font-serif text-lg font-normal text-ink mb-1">
          Add placeholder member
        </h2>
        <p className="text-xs text-ink-2 mb-4">
          Add a friend who has not signed up yet. They can claim this slot and their past expenses when they join.
        </p>

        {addState && !addState.ok && addState.message && (
          <div className="mb-4 p-3 border border-brick text-brick text-xs bg-paper-2">
            {addState.message}
          </div>
        )}

        {addState && addState.ok && addState.message && (
          <div className="mb-4 p-3 border border-moss text-moss text-xs bg-paper-2">
            {addState.message}
          </div>
        )}

        <form action={formAction} className="flex flex-col sm:flex-row gap-2 max-w-form">
          <input
            name="displayName"
            type="text"
            required
            maxLength={60}
            placeholder="Friend's name (e.g. Kabir)"
            className="flex-1 border border-rule bg-paper-2 px-3 py-2 text-xs text-ink placeholder:text-ink-2 focus:border-brick"
          />
          <button
            type="submit"
            disabled={isAdding}
            className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isAdding ? 'Adding...' : 'Add placeholder'}
          </button>
        </form>
      </div>

      {/* Past Members */}
      {pastMembers.length > 0 && (
        <div>
          <div className="border-b border-rule pb-2 mb-3">
            <h3 className="font-serif text-base font-normal text-ink-2">
              Past members ({pastMembers.length})
            </h3>
          </div>
          <div className="border-t border-rule divide-y divide-rule opacity-75">
            {pastMembers.map((member) => (
              <div key={member.id} className="py-2.5 px-2 text-xs text-ink-2 flex justify-between">
                <span>{member.display_name}</span>
                <span>Left trip</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
