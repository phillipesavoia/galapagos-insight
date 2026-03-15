import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const periods = ["1M", "3M", "YTD", "12M", "Máx"] as const;
export type Period = (typeof periods)[number];

interface PeriodFilterProps {
  value: Period;
  onChange: (v: Period) => void;
}

export function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as Period);
      }}
      className="bg-secondary/50 border border-border rounded-lg p-0.5"
    >
      {periods.map((p) => (
        <ToggleGroupItem
          key={p}
          value={p}
          className="px-3 py-1 text-xs font-medium rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground text-muted-foreground"
        >
          {p}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
