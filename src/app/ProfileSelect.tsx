import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/features/settings/store";
import { useActiveProfile } from "@/features/subtitles/activeRules";
import { BUILT_IN_PROFILES } from "@/features/subtitles/ruleProfiles";
import { cn } from "@/lib/utils";
import { chooseRuleProfile } from "./ruleProfiles";

/** Picks the project's rule profile (RUL-01); the trigger always shows the active profile's name. */
export function ProfileSelect({ className }: { className?: string }) {
  const active = useActiveProfile();
  const custom = useSettings((s) => s.ruleProfiles);
  return (
    <Select value={active.id} onValueChange={chooseRuleProfile}>
      <SelectTrigger size="sm" aria-label="Rule profile" className={cn("w-full", className)}>
        <span className="shrink-0 text-muted-foreground">Rules:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Built-in</SelectLabel>
          {BUILT_IN_PROFILES.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectGroup>
        {custom.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Your profiles</SelectLabel>
              {custom.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
