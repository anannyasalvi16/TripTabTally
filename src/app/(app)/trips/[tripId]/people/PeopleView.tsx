'use client';

import { useState, useActionState, useTransition } from 'react';
import {
  addPlaceholderAction,
  createFamilyAction,
  updateMemberFamilyAction,
  deleteFamilyAction,
  toggleMemberRoleAction,
  markMemberLeftAction,
  regenerateInviteAction,
  revokeInviteAction,
  type MemberActionResult,
} from '@/actions/members';
import { formatPaise } from '@/lib/money';

interface Member {
  id: string;
  user_id: string | null;
  display_name: string;
  role: 'admin' | 'member';
  left_at: string | null;
  joined_at: string | null;
  family_id: string | null;
  email: string | null;
  phone: string | null;
  upi_id?: string | null;
}

interface Family {
  id: string;
  name: string;
}

interface PeopleViewProps {
  tripId: string;
  isAdmin: boolean;
  currentUserId: string;
  members: Member[];
  families: Family[];
  inviteToken: string | null;
  inviteExpiresAt?: string | null;
  memberBalances?: Record<string, number>;
  siteUrl: string;
}

export function PeopleView({
  tripId,
  isAdmin,
  currentUserId,
  members,
  families,
  inviteToken,
  inviteExpiresAt = null,
  memberBalances,
  siteUrl,
}: PeopleViewProps) {
  const [copied, setCopied] = useState(false);
  const [activeToken, setActiveToken] = useState(inviteToken);
  const [activeExpiresAt, setActiveExpiresAt] = useState<string | null>(inviteExpiresAt);
  const [selectedExpiry, setSelectedExpiry] = useState<number | null>(14);
  const [regenerating, setRegenerating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const addPlaceholderWithTripId = addPlaceholderAction.bind(null, tripId);
  const [addState, formAction, isAdding] = useActionState<MemberActionResult | null, FormData>(
    addPlaceholderWithTripId,
    null
  );

  const createFamilyWithTripId = createFamilyAction.bind(null, tripId);
  const [familyState, createFamilyFormAction, isCreatingFamily] = useActionState<
    MemberActionResult | null,
    FormData
  >(createFamilyWithTripId, null);

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
      const res = await regenerateInviteAction(tripId, selectedExpiry);
      if (res.ok && res.token) {
        setActiveToken(res.token);
        const newExpiry =
          selectedExpiry === null
            ? null
            : new Date(Date.now() + selectedExpiry * 86400000).toISOString();
        setActiveExpiresAt(newExpiry);
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

  async function handleRevoke() {
    if (!window.confirm('Revoke this invite link? Nobody will be able to join with it.')) {
      return;
    }
    setRevoking(true);
    setStatusMessage(null);
    try {
      const res = await revokeInviteAction(tripId);
      if (res.ok) {
        setActiveToken(null);
        setActiveExpiresAt(null);
        setStatusMessage(res.message || 'Invite link revoked.');
      } else {
        setStatusMessage(res.message || 'Could not revoke invite link.');
      }
    } catch {
      setStatusMessage('Failed to revoke invite link.');
    } finally {
      setRevoking(false);
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

  function handleUpdateFamily(memberId: string, familyId: string | null) {
    setStatusMessage(null);
    startTransition(async () => {
      try {
        const res = await updateMemberFamilyAction(tripId, memberId, familyId);
        setStatusMessage(res.message || null);
      } catch {
        setStatusMessage('Could not update family assignment.');
      }
    });
  }

  function handleDeleteFamily(family: Family) {
    if (!window.confirm(`Delete "${family.name}"? Members in this family will become solo.`)) {
      return;
    }
    setStatusMessage(null);
    startTransition(async () => {
      try {
        const res = await deleteFamilyAction(tripId, family.id, family.name);
        setStatusMessage(res.message || null);
      } catch {
        setStatusMessage('Could not delete family.');
      }
    });
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
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                id="inviteUrl"
                aria-label="Trip invite link"
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-ink-2 gap-3 pt-1 border-t border-rule">
              <div>
                <span className="font-medium text-ink">Status: </span>
                <span>
                  {activeExpiresAt
                    ? `Expires on ${new Date(activeExpiresAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}`
                    : 'Permanent (Never expires)'}
                </span>
              </div>

              {isAdmin && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="expirySelect" className="text-ink-2">
                      Duration:
                    </label>
                    <select
                      id="expirySelect"
                      value={selectedExpiry === null ? 'never' : String(selectedExpiry)}
                      onChange={(e) =>
                        setSelectedExpiry(
                          e.target.value === 'never' ? null : parseInt(e.target.value, 10)
                        )
                      }
                      className="border border-rule bg-paper-2 px-2 py-1 text-xs text-ink"
                    >
                      <option value="1">1 day</option>
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                      <option value="never">Never expires</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="text-brick hover:underline disabled:opacity-50"
                  >
                    {regenerating ? 'Regenerating...' : 'Regenerate link'}
                  </button>

                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="text-ink-2 hover:text-brick hover:underline disabled:opacity-50"
                  >
                    {revoking ? 'Revoking...' : 'Revoke link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-ink-2">No active invite link for this trip.</p>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-1.5 text-xs">
                  <label htmlFor="newExpirySelect" className="text-ink-2">
                    Duration:
                  </label>
                  <select
                    id="newExpirySelect"
                    value={selectedExpiry === null ? 'never' : String(selectedExpiry)}
                    onChange={(e) =>
                      setSelectedExpiry(
                        e.target.value === 'never' ? null : parseInt(e.target.value, 10)
                      )
                    }
                    className="border border-rule bg-paper-2 px-2 py-1 text-xs text-ink"
                  >
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                    <option value="never">Never expires</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-xs font-medium transition-colors"
                >
                  {regenerating ? 'Generating...' : 'Generate invite link'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Families Section */}
      <div className="border border-rule p-5 bg-paper space-y-5">
        <div className="border-b border-rule pb-2">
          <h2 className="font-serif text-xl font-normal text-ink">
            Families ({families.length})
          </h2>
          <p className="text-xs text-ink-2 mt-0.5">
            Group members into families for family-based splitting and debt settlement. Members not in a family are solo.
          </p>
        </div>

        {families.length === 0 ? (
          <p className="text-xs text-ink-2">
            No families created yet. You can create one below (e.g. &ldquo;Sharma family&rdquo;).
          </p>
        ) : (
          <div className="border-t border-rule divide-y divide-rule text-xs">
            {families.map((fam) => {
              const familyMembers = activeMembers.filter((m) => m.family_id === fam.id);
              return (
                <div
                  key={fam.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-medium text-ink text-sm">{fam.name}</span>
                    <span className="text-ink-2 ml-2">
                      ({familyMembers.length}{' '}
                      {familyMembers.length === 1 ? 'member' : 'members'})
                    </span>
                    <p className="text-ink-2 text-[11px] mt-0.5">
                      {familyMembers.length > 0
                        ? familyMembers.map((m) => m.display_name).join(', ')
                        : 'No members assigned yet'}
                    </p>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteFamily(fam)}
                      className="text-brick hover:underline text-xs self-start sm:self-center"
                    >
                      Delete family
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Create Family Form */}
        {isAdmin && (
          <div className="pt-3 border-t border-rule">
            <h3 className="font-serif text-sm font-normal text-ink mb-2">
              Create a new family
            </h3>

            {familyState && !familyState.ok && familyState.message && (
              <div className="mb-3 p-2.5 border border-brick text-brick text-xs bg-paper-2">
                {familyState.message}
              </div>
            )}

            {familyState && familyState.ok && familyState.message && (
              <div className="mb-3 p-2.5 border border-moss text-moss text-xs bg-paper-2">
                {familyState.message}
              </div>
            )}

            <form
              action={createFamilyFormAction}
              className="flex flex-col sm:flex-row gap-2 max-w-form"
            >
              <input
                name="name"
                type="text"
                required
                maxLength={60}
                placeholder="Family name (e.g. Sharma family)"
                className="flex-1 border border-rule bg-paper-2 px-3 py-2 text-xs text-ink placeholder:text-ink-2 focus:border-brick"
              />
              <button
                type="submit"
                disabled={isCreatingFamily}
                className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isCreatingFamily ? 'Creating...' : 'Create family'}
              </button>
            </form>
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
            People on this trip, family assignments, roles, and payment details.
          </p>
        </div>

        <div className="border-t border-rule divide-y divide-rule">
          {activeMembers.map((member) => {
            const memberFamily = families.find((f) => f.id === member.family_id);

            return (
              <div
                key={member.id}
                className="py-3 px-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-ink">{member.display_name}</span>
                    {member.user_id === currentUserId && (
                      <span className="text-xs text-ink-2">(You)</span>
                    )}
                    {member.user_id === null && (
                      <span className="text-[11px] bg-paper-2 border border-rule px-1.5 py-0.5 text-ink-2">
                        Manual member (unclaimed)
                      </span>
                    )}
                    {memberFamily && (
                      <span className="text-[11px] bg-paper-2 border border-rule px-1.5 py-0.5 text-moss font-medium">
                        {memberFamily.name}
                      </span>
                    )}
                    {memberBalances && (memberBalances[member.id] || 0) < 0 && (
                      <span className="text-[11px] bg-paper-2 border border-brick px-1.5 py-0.5 text-brick font-mono font-medium">
                        Pending dues: {formatPaise(Math.abs(memberBalances[member.id] || 0))}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-ink-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="capitalize">{member.role}</span>
                    {member.email && <span>• Email: {member.email}</span>}
                    {member.phone && <span>• Phone: {member.phone}</span>}
                    {member.upi_id && <span>• UPI: {member.upi_id}</span>}
                  </div>

                  {/* Family selector for Admin */}
                  {isAdmin && (
                    <div className="pt-1 flex items-center gap-2 text-xs">
                      <label htmlFor={`family-select-${member.id}`} className="text-ink-2">
                        Family:
                      </label>
                      <select
                        id={`family-select-${member.id}`}
                        value={member.family_id || ''}
                        onChange={(e) =>
                          handleUpdateFamily(member.id, e.target.value || null)
                        }
                        className="border border-rule bg-paper px-2 py-0.5 text-xs text-ink"
                      >
                        <option value="">Solo (No family)</option>
                        {families.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {isAdmin && member.user_id !== currentUserId && (
                  <div className="flex items-center space-x-3 text-xs shrink-0">
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
            );
          })}
        </div>
      </div>

      {/* Add Manual Member */}
      <div className="border border-rule p-5 bg-paper">
        <h2 className="font-serif text-lg font-normal text-ink mb-1">
          Add manual member
        </h2>
        <p className="text-xs text-ink-2 mb-4">
          Add a member by name only (no sign-in required). They can be payers and participants in expenses immediately. If they later sign in with matching email or claim via invite link, their account will be linked.
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

        <form action={formAction} className="space-y-3 max-w-form text-xs">
          <div>
            <label htmlFor="displayName" className="block text-ink-2 mb-1">
              Name <span className="text-brick">*</span>
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              maxLength={60}
              placeholder="e.g. Kabir Sharma"
              className="w-full border border-rule bg-paper-2 px-3 py-2 text-xs text-ink placeholder:text-ink-2 focus:border-brick"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="email" className="block text-ink-2 mb-1">
                Email (optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="kabir@example.com"
                className="w-full border border-rule bg-paper-2 px-3 py-2 text-xs text-ink placeholder:text-ink-2 focus:border-brick"
              />
              <span className="text-[10px] text-ink-2 block mt-0.5">
                Auto-links when they sign in with this email
              </span>
            </div>

            <div>
              <label htmlFor="phone" className="block text-ink-2 mb-1">
                Phone (optional)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 9876543210"
                className="w-full border border-rule bg-paper-2 px-3 py-2 text-xs text-ink placeholder:text-ink-2 focus:border-brick"
              />
            </div>
          </div>

          <div>
            <label htmlFor="familyId" className="block text-ink-2 mb-1">
              Family (optional)
            </label>
            <select
              id="familyId"
              name="familyId"
              className="w-full border border-rule bg-paper-2 px-3 py-2 text-xs text-ink focus:border-brick"
            >
              <option value="">Solo (No family)</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isAdding}
            className="bg-brick hover:bg-brick-dark text-paper px-4 py-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isAdding ? 'Adding member...' : 'Add member'}
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
