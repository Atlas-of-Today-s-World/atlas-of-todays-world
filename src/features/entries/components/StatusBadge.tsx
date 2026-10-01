import { Badge, type Tone } from "@/components/ui/badge";
import { ENTRY_STATUSES, STATUS_LABEL, type EntryStatus } from "../schema";

const STATUS_TONE: Record<EntryStatus, Tone> = {
  draft: "neutral",
  pending: "warning",
  published: "success",
  planned: "outline",
};

/** Article statuses as DataTable column options (badge, filter, KPI). */
export const STATUS_OPTIONS = ENTRY_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABEL[status],
  tone: STATUS_TONE[status],
}));

export function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} size="md">
      {STATUS_LABEL[status]}
    </Badge>
  );
}
