"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Challenge, Rule } from "@/lib/types";

export default function RulesTab({
  challenge,
  isOwner,
  rules,
  onChanged,
}: {
  challenge: Challenge;
  isOwner: boolean;
  rules: Rule[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newPoints, setNewPoints] = useState(1);
  const [busy, setBusy] = useState(false);

  async function updateRule(rule: Rule, patch: Partial<Rule>) {
    setError(null);
    const { error } = await supabase
      .from("point_rules")
      .update(patch)
      .eq("id", rule.id);
    if (error) setError(error.message);
    onChanged();
  }

  async function deleteRule(rule: Rule) {
    if (!confirm(`Regel "${rule.label}" löschen? Zugehörige Check-ins gehen verloren.`))
      return;
    const { error } = await supabase.from("point_rules").delete().eq("id", rule.id);
    if (error) setError(error.message);
    onChanged();
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("point_rules").insert({
      challenge_id: challenge.id,
      key: `custom_${Date.now()}`,
      label: newLabel,
      points: newPoints,
      sort: rules.length + 1,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setNewLabel("");
    onChanged();
  }

  if (!isOwner) {
    return (
      <div className="card">
        <h3 className="mb-3 font-semibold">Punkteregeln</h3>
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex justify-between border-b border-[#3A2E1B] pb-2">
              <span>
                {r.label}
                {r.weekend_only && (
                  <span className="ml-2 text-xs text-[#3A2E1B]/60">(nur Sa/So)</span>
                )}
              </span>
              <span
                className={`font-bold ${
                  r.points >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {r.points > 0 ? `+${r.points}` : r.points}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[#3A2E1B]/60">
          Nur der Ersteller der Challenge kann Regeln ändern.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h3 className="font-semibold">Punkteregeln bearbeiten</h3>
        {rules.map((r) => (
          <RuleEditor key={r.id} rule={r} onSave={updateRule} onDelete={deleteRule} />
        ))}
      </div>

      <form onSubmit={addRule} className="card space-y-3">
        <h3 className="font-semibold">Neue Regel</h3>
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1"
            required
            placeholder="z. B. 60 min Rad gefahren"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <input
            className="input w-24"
            type="number"
            value={newPoints}
            onChange={(e) => setNewPoints(Number(e.target.value))}
          />
          <button className="btn" disabled={busy}>
            Hinzufügen
          </button>
        </div>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

function RuleEditor({
  rule,
  onSave,
  onDelete,
}: {
  rule: Rule;
  onSave: (rule: Rule, patch: Partial<Rule>) => void;
  onDelete: (rule: Rule) => void;
}) {
  const [label, setLabel] = useState(rule.label);
  const [points, setPoints] = useState(rule.points);
  const dirty = label !== rule.label || points !== rule.points;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#3A2E1B] pb-3">
      <input
        className="input flex-1"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <input
        className="input w-20"
        type="number"
        value={points}
        onChange={(e) => setPoints(Number(e.target.value))}
      />
      <button
        className="btn text-sm"
        disabled={!dirty}
        onClick={() => onSave(rule, { label, points })}
      >
        Speichern
      </button>
      <button className="btn-ghost text-sm" onClick={() => onDelete(rule)}>
        🗑
      </button>
    </div>
  );
}
