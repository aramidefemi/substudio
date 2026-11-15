import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteRuleProfile, saveRuleProfile, useSettings } from "@/features/settings/store";
import { useActiveProfile } from "@/features/subtitles/activeRules";
import {
  allProfiles,
  DEFAULT_PROFILE,
  findProfile,
  newProfileId,
  uniqueName,
  validateLimits,
  type GapUnit,
  type ProfileLimits,
  type RuleProfile,
} from "@/features/subtitles/ruleProfiles";
import { cn } from "@/lib/utils";
import { chooseRuleProfile, closeRuleProfiles, useRuleProfilesDialog } from "./ruleProfiles";

type NumberField = Exclude<keyof ProfileLimits, "minGapUnit">;
type Draft = Record<NumberField, string> & { minGapUnit: GapUnit; name: string };

const FIELDS: { key: NumberField; label: string; unit?: string }[] = [
  { key: "minDuration", label: "Min duration", unit: "s" },
  { key: "maxDuration", label: "Max duration", unit: "s" },
  { key: "maxCps", label: "Max reading speed", unit: "chars/s" },
  { key: "maxLineLength", label: "Max line length", unit: "chars" },
  { key: "maxLines", label: "Max lines" },
];

const show = (n: number) => String(Number(n.toFixed(3)));

function toDraft(p: RuleProfile): Draft {
  const l = p.limits;
  return {
    name: p.name,
    minDuration: show(l.minDuration),
    maxDuration: show(l.maxDuration),
    maxCps: show(l.maxCps),
    maxLineLength: show(l.maxLineLength),
    maxLines: show(l.maxLines),
    minGap: show(l.minGap),
    minGapUnit: l.minGapUnit,
  };
}

const parse = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

function fromDraft(d: Draft): ProfileLimits {
  return {
    minDuration: parse(d.minDuration),
    maxDuration: parse(d.maxDuration),
    maxCps: parse(d.maxCps),
    maxLineLength: parse(d.maxLineLength),
    maxLines: parse(d.maxLines),
    minGap: parse(d.minGap),
    minGapUnit: d.minGapUnit,
  };
}

/** Edits one profile. User profiles save on every valid change; built-ins are read-only. */
function ProfileForm({ profile }: { profile: RuleProfile }) {
  const [draft, setDraft] = useState(() => toDraft(profile));
  const readOnly = !!profile.builtIn;
  const limits = fromDraft(draft);
  const error = readOnly ? null : validateLimits(limits);

  const change = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const nextLimits = fromDraft(next);
    if (!validateLimits(nextLimits)) saveRuleProfile({ ...profile, name: next.name.trim() || profile.name, limits: nextLimits });
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium">
        Name
        <Input value={draft.name} disabled={readOnly} onChange={(e) => change({ name: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-xs font-medium">
            <span>
              {f.label}
              {f.unit && <span className="font-normal text-muted-foreground"> ({f.unit})</span>}
            </span>
            <Input
              inputMode="decimal"
              className="tabular-nums"
              value={draft[f.key]}
              disabled={readOnly}
              aria-invalid={!readOnly && !Number.isFinite(limits[f.key])}
              onChange={(e) => change({ [f.key]: e.target.value })}
            />
          </label>
        ))}
        <div className="flex flex-col gap-1 text-xs font-medium">
          <label htmlFor="profile-min-gap">
            Min gap <span className="font-normal text-muted-foreground">(0 = off)</span>
          </label>
          <div className="flex gap-2">
            <Input
              id="profile-min-gap"
              inputMode="decimal"
              className="min-w-0 flex-1 tabular-nums"
              value={draft.minGap}
              disabled={readOnly}
              onChange={(e) => change({ minGap: e.target.value })}
            />
            <Select
              value={draft.minGapUnit}
              disabled={readOnly}
              onValueChange={(v) => change({ minGapUnit: v as GapUnit })}
            >
              <SelectTrigger aria-label="Gap unit" className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frames">frames</SelectItem>
                <SelectItem value="ms">ms</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <p className={cn("min-h-4 text-xs", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
        {readOnly
          ? "Built-in profiles can't be changed. Duplicate one to make your own."
          : (error ?? "Changes are saved as you type.")}
      </p>
    </div>
  );
}

function ProfilesEditor() {
  const custom = useSettings((s) => s.ruleProfiles);
  const active = useActiveProfile();
  const [selectedId, setSelectedId] = useState(active.id);
  const profiles = allProfiles(custom);
  const selected = findProfile(selectedId, custom);

  const create = (from: RuleProfile, name: string) => {
    const profile: RuleProfile = { id: newProfileId(), name: uniqueName(name, profiles), limits: { ...from.limits } };
    saveRuleProfile(profile);
    setSelectedId(profile.id);
  };

  const remove = () => {
    if (selected.builtIn) return;
    const index = custom.findIndex((p) => p.id === selected.id);
    deleteRuleProfile(selected.id);
    if (active.id === selected.id) chooseRuleProfile(DEFAULT_PROFILE.id);
    setSelectedId(custom[index + 1]?.id ?? custom[index - 1]?.id ?? DEFAULT_PROFILE.id);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rule profiles</DialogTitle>
        <DialogDescription>
          Limits for each client. The project uses <span className="font-medium text-foreground">{active.name}</span>.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <ul aria-label="Profiles" className="flex max-h-72 flex-col overflow-auto rounded-lg border p-1">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-current={p.id === selected.id}
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex h-(--row-h) w-full items-center gap-1.5 rounded-md px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    p.id === selected.id ? "bg-row-selected" : "hover:bg-row-hover",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate" title={p.name}>
                    {p.name}
                  </span>
                  {p.id === active.id && <Check aria-label="In use" className="size-3.5 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => create(DEFAULT_PROFILE, "New profile")}>
              <Plus /> New
            </Button>
            <Button variant="outline" size="sm" onClick={() => create(selected, `${selected.name} copy`)}>
              <Copy /> Duplicate
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete profile"
              title="Delete profile"
              disabled={selected.builtIn}
              onClick={remove}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
        <ProfileForm key={selected.id} profile={selected} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={closeRuleProfiles}>
          Close
        </Button>
        <Button disabled={selected.id === active.id} onClick={() => chooseRuleProfile(selected.id)}>
          Use for this project
        </Button>
      </DialogFooter>
    </>
  );
}

/** Create, edit and pick rule profiles (RUL-01). */
export function RuleProfilesDialog() {
  const open = useRuleProfilesDialog((s) => s.open);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeRuleProfiles()}>
      <DialogContent className="sm:max-w-2xl">{open && <ProfilesEditor />}</DialogContent>
    </Dialog>
  );
}
