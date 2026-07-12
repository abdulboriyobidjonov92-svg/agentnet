export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="text-primary">•</span> {item}
        </li>
      ))}
    </ul>
  );
}
