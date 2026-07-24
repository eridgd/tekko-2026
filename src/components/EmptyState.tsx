export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; onClick?: () => void; href?: string };
}) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <p className="empty__title">{title}</p>
      <p>{body}</p>
      {action &&
        (action.href ? (
          <a className="btn btn--primary empty__action" href={action.href}>
            {action.label}
          </a>
        ) : (
          <button className="btn btn--primary empty__action" onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
