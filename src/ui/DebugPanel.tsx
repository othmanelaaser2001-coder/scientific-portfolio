interface Props {
  title: string;
  rows: Array<[string, string]>;
  className?: string;
}

export default function DebugPanel({ title, rows, className }: Props) {
  return (
    <div className={`debug${className ? ` ${className}` : ''}`}>
      <h4>{title}</h4>
      {rows.map(([label, value]) => (
        <div className="debug-row" key={label}>
          <span>{label}</span>
          <span className="numeric">{value}</span>
        </div>
      ))}
    </div>
  );
}
