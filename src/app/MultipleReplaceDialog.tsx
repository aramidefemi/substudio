import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import {
  applyReplaceSet,
  countRuleHits,
  newReplaceSet,
  type ReplaceRule,
  type ReplaceSet,
} from "@/features/subtitles/multipleReplace";
import { applyCueData } from "@/features/subtitles/qualityApply";
import { useSettings } from "@/features/settings/store";
import { useSubtitles } from "@/features/subtitles/store";
import { useUi } from "./actions";

function RuleRow({
  rule,
  onChange,
  onRemove,
  hits,
}: {
  rule: ReplaceRule;
  onChange: (r: ReplaceRule) => void;
  onRemove: () => void;
  hits: number;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          className="h-8"
          placeholder="Find"
          value={rule.find}
          onChange={(e) => onChange({ ...rule, find: e.target.value })}
        />
        <Input
          className="h-8"
          placeholder="Replace"
          value={rule.replace}
          onChange={(e) => onChange({ ...rule, replace: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["matchCase", "Match case"],
            ["wholeWord", "Whole word"],
            ["regex", "Regex"],
            ["enabled", "On"],
          ] as const
        ).map(([key, label]) => (
          <Toggle
            key={key}
            size="sm"
            variant="outline"
            pressed={key === "enabled" ? rule.enabled !== false : !!rule[key]}
            onPressedChange={(v) => onChange({ ...rule, [key]: v })}
            className="h-7 px-2 text-xs"
          >
            {label}
          </Toggle>
        ))}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{hits} hits</span>
        <Button size="sm" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}

/** Tools → Multiple replace with saved rule sets (QLT-04). */
export function MultipleReplaceDialog() {
  const open = useUi((s) => s.multipleReplaceOpen);
  const cues = useSubtitles((s) => s.cues);
  const sets = useSettings((s) => s.multipleReplaceSets);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = sets.find((s) => s.id === activeId) ?? sets[0] ?? null;

  const hitCounts = useMemo(
    () => (active ? active.rules.map((r) => countRuleHits(cues, r)) : []),
    [active, cues],
  );

  const saveSets = (multipleReplaceSets: ReplaceSet[]) => useSettings.setState({ multipleReplaceSets });

  const updateActive = (set: ReplaceSet) => {
    if (!sets.length) {
      saveSets([set]);
      setActiveId(set.id);
      return;
    }
    saveSets(sets.map((s) => (s.id === set.id ? set : s)));
    setActiveId(set.id);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => useUi.setState({ multipleReplaceOpen: v })}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Multiple replace</DialogTitle>
          <DialogDescription>Saved rule sets applied in order to every cue.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {sets.map((s) => (
            <Toggle
              key={s.id}
              size="sm"
              variant="outline"
              pressed={active?.id === s.id}
              onPressedChange={() => setActiveId(s.id)}
              className="h-7 px-2 text-xs"
            >
              {s.name}
            </Toggle>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const s = newReplaceSet(`Set ${sets.length + 1}`);
              saveSets([...sets, s]);
              setActiveId(s.id);
            }}
          >
            New set
          </Button>
        </div>

        {active && (
          <>
            <Input
              className="h-8"
              value={active.name}
              onChange={(e) => updateActive({ ...active, name: e.target.value })}
            />
            <div className="min-h-0 flex-1 space-y-2 overflow-auto">
              {active.rules.map((rule, i) => (
                <RuleRow
                  key={i}
                  rule={rule}
                  hits={hitCounts[i] ?? 0}
                  onChange={(r) => {
                    const rules = active.rules.slice();
                    rules[i] = r;
                    updateActive({ ...active, rules });
                  }}
                  onRemove={() =>
                    updateActive({ ...active, rules: active.rules.filter((_, j) => j !== i) })
                  }
                />
              ))}
            </div>
            <div className="flex justify-between gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  updateActive({
                    ...active,
                    rules: [
                      ...active.rules,
                      { find: "", replace: "", enabled: true, matchCase: false, wholeWord: false, regex: false },
                    ],
                  })
                }
              >
                Add rule
              </Button>
              <Button
                disabled={!active.rules.some((r) => r.find)}
                onClick={() => {
                  applyCueData(applyReplaceSet(cues, active.rules), "multiple-replace");
                  toast(`Applied “${active.name}”`);
                  useUi.setState({ multipleReplaceOpen: false });
                }}
              >
                Apply set
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
