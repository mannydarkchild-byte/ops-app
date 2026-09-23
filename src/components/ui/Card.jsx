export function Card({ className = "", children, as: Tag = "div" }) {
  return (
    <Tag className={`rounded-2xl border border-ops-border bg-ops-card shadow-ops ${className}`}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, action, className = "" }) {
  return (
    <div className={`px-4 pt-4 pb-3 border-b border-ops-border/80 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <h2 className="font-ui text-base font-semibold text-ops-text">{title}</h2>}
          {description && <p className="font-body text-sm text-ops-muted mt-1 leading-relaxed">{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function CardBody({ className = "", children }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
