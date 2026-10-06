const WHEN = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

const at = (value?: string | null) => (value ? WHEN.format(new Date(value)) : null);
const by = (names: Record<string, string>, person?: string | null) =>
  person ? (names[person] ?? "a former team member") : null;

/**
 * "Created … by … · Last edited … by …" — for a topic and each of its subtopics.
 * The database stamps both on every save (a subtopic only when it changed).
 */
export function EditStamp({
  createdAt,
  createdBy,
  updatedAt,
  updatedBy,
  names,
  className,
}: {
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  names: Record<string, string>;
  className?: string;
}) {
  const created = at(createdAt);
  if (!created) return null;
  const creator = by(names, createdBy);
  const edited = at(updatedAt);
  const editor = by(names, updatedBy);
  return (
    <p className={className ?? "text-[12px] text-[var(--color-ink-muted)]"}>
      Created {created}
      {creator ? ` by ${creator}` : ""}
      {edited && edited !== created ? (
        <>
          {" · "}last edited {edited}
          {editor ? ` by ${editor}` : ""}
        </>
      ) : null}
    </p>
  );
}
