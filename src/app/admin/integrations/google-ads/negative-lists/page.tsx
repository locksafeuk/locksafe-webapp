"use client";

/**
 * Admin → Google Ads → Shared Negative Lists
 *
 * Manage reusable negative keyword lists that can be applied to multiple
 * campaigns at publish time.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const MASTER_NEGATIVES = [
  "locksmith training",
  "locksmith course",
  "locksmith jobs",
  "locksmith apprenticeship",
  "locksmith salary",
  "locksmith tools",
  "locksmith kit",
  "locksmith pick set",
  "how to pick a lock",
  "lock picking",
  "lock pick",
  "lockpick",
  "diy locksmith",
  "do it yourself locksmith",
  "become a locksmith",
  "locksmith school",
  "locksmith qualification",
  "automotive locksmith",
  "car locksmith",
  "car key locksmith",
  "car key cutting",
  "key duplication",
  "key cutting near me",
  "spare key",
  "key replacement",
  "key fob programming",
  "transponder key",
  "ignition repair",
  "immobiliser",
  "safe cracking",
  "safe combination",
  "safe repair",
  "safe installation",
  "safe opening",
  "antique lock",
  "vintage lock",
  "padlock",
  "combination padlock",
  "gun safe",
  "fireproof safe",
  "locksmith franchise",
  "locksmith business",
  "locksmith insurance",
  "locksmith van",
  "locksmith equipment supplier",
  "locksmith supply",
  "lock supply",
  "door handle",
  "door handle replacement",
  "door knob",
  "door hinge",
  "door frame",
  "window lock",
  "window handle",
  "patio door lock",
  "garage door lock",
  "garage door opener",
  "garage door repair",
  "locksmith review",
  "locksmith scam",
  "fake locksmith",
  "rogue locksmith",
  "locksmith complaints",
  "locksmith certifications",
  "locksport",
  "lock sport",
  "master lock",
  "yale lock price",
  "mortice lock price",
  "multipoint lock price",
  "lock mechanism",
];

interface NegativeList {
  id: string;
  name: string;
  keywords: string[];
  updatedAt: string;
}

interface Draft {
  id: string;
  name: string;
  status: string;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">{children}</div>
      </div>
    </div>
  );
}

export default function NegativeListsPage() {
  const [lists, setLists] = useState<NegativeList[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | "edit" | "apply" | "delete" | null>(null);
  const [editingList, setEditingList] = useState<NegativeList | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Apply modal
  const [publishedDrafts, setPublishedDrafts] = useState<Draft[]>([]);
  const [applyingList, setApplyingList] = useState<NegativeList | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/google-ads/shared-negative-lists");
      const data = await res.json();
      setLists(data.lists ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingList(null);
    setFormName("");
    setFormKeywords(MASTER_NEGATIVES.join("\n"));
    setFormError("");
    setModal("create");
  }

  function openEdit(list: NegativeList) {
    setEditingList(list);
    setFormName(list.name);
    setFormKeywords(list.keywords.join("\n"));
    setFormError("");
    setModal("edit");
  }

  async function saveForm() {
    if (!formName.trim()) { setFormError("Name is required"); return; }
    const keywords = formKeywords.split(/[\n,]/).map((k) => k.trim().toLowerCase()).filter(Boolean);
    setFormSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/google-ads/shared-negative-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingList?.id, name: formName.trim(), keywords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setModal(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setFormSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    try {
      await fetch(`/api/admin/google-ads/shared-negative-lists/${deletingId}`, { method: "DELETE" });
      setModal(null);
      setDeletingId(null);
      await load();
    } catch {
      // ignore — user can retry
    }
  }

  async function openApply(list: NegativeList) {
    setApplyingList(list);
    try {
      const res = await fetch("/api/admin/google-ads/drafts?status=PUBLISHED");
      const data = await res.json();
      setPublishedDrafts(data.drafts ?? []);
    } catch {
      setPublishedDrafts([]);
    }
    setModal("apply");
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Shared Negative Lists</h1>
          <p className="text-sm text-gray-500">Reusable negative keyword lists applied to campaigns at publish time.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + New List
        </button>
      </div>

      {/* Nav */}
      <div className="flex gap-4 text-sm border-b pb-2">
        <Link href="/admin/integrations/google-ads/drafts" className="text-gray-500 hover:text-gray-900">Drafts</Link>
        <Link href="/admin/integrations/google-ads/search-terms" className="text-gray-500 hover:text-gray-900">Search Terms</Link>
        <Link href="/admin/integrations/google-ads/performance" className="text-gray-500 hover:text-gray-900">Performance</Link>
        <span className="font-medium border-b-2 border-blue-600 pb-1">Negative Lists</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading…</p>
      ) : lists.length === 0 ? (
        <div className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No shared negative lists yet.{" "}
          <button type="button" onClick={openCreate} className="text-blue-600 hover:underline">Create the master list</button>{" "}
          with {MASTER_NEGATIVES.length} pre-suggested negatives.
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div key={list.id} className="rounded border p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{list.name}</p>
                  <p className="text-xs text-gray-500">
                    {list.keywords.length} keywords · last updated {new Date(list.updatedAt).toLocaleDateString("en-GB")}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => openApply(list)}
                    className="rounded border px-2 py-1 text-xs hover:bg-blue-50"
                  >
                    Apply preview
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(list)}
                    className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeletingId(list.id); setModal("delete"); }}
                    className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {list.keywords.slice(0, 20).map((k) => (
                  <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{k}</span>
                ))}
                {list.keywords.length > 20 && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">+{list.keywords.length - 20} more</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modal === "create" || modal === "edit") && (
        <Modal title={modal === "create" ? "New Negative List" : `Edit: ${editingList?.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">List name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full rounded border px-2 py-1 text-sm"
                placeholder="e.g. LockSafe Master Negatives"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Keywords (one per line or comma-separated) — {formKeywords.split(/[\n,]/).filter((k) => k.trim()).length} keywords
              </label>
              <textarea
                value={formKeywords}
                onChange={(e) => setFormKeywords(e.target.value)}
                rows={12}
                className="w-full rounded border px-2 py-1 text-xs font-mono"
                placeholder="locksmith training&#10;locksmith jobs&#10;lock picking"
              />
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
              <button
                type="button"
                onClick={saveForm}
                disabled={formSaving}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {formSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {modal === "delete" && (
        <Modal title="Delete Negative List" onClose={() => { setModal(null); setDeletingId(null); }}>
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to delete this list? This will not remove the negatives from any campaigns where it has already been applied.
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setModal(null); setDeletingId(null); }} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
              <button type="button" onClick={confirmDelete} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">Delete</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Apply preview Modal */}
      {modal === "apply" && applyingList && (
        <Modal title={`Apply preview: ${applyingList.name}`} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              This list will be applied to campaigns at <strong>publish time</strong> when a draft has this list selected.
              {" "}It will be applied IN ADDITION to campaign-level negatives.
            </p>
            <p className="text-xs font-medium text-gray-700">Published campaigns that would receive this list:</p>
            {publishedDrafts.length === 0 ? (
              <p className="text-xs text-gray-500">No published campaigns found.</p>
            ) : (
              <ul className="space-y-1">
                {publishedDrafts.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-green-700">PUBLISHED</span>
                    <Link href={`/admin/integrations/google-ads/drafts/${d.id}`} className="text-blue-600 hover:underline">{d.name}</Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-500 pt-1">
              Note: To apply this list to an existing campaign, edit the draft and set this list as the shared negative list, then republish.
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={() => setModal(null)} className="rounded border px-3 py-1.5 text-sm">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
