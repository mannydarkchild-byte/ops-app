/** Native date with the same chrome as FieldSelect — looks tappable. */
export function FieldDate({
  id,
  name,
  value,
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  className = "",
}) {
  return (
    <div className={`ops-select-wrap ops-date-wrap ${className}`.trim()}>
      <input
        id={id}
        name={name}
        type="date"
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="ops-select ops-date"
      />
    </div>
  );
}

/** Native select with a visible gold chevron — no hidden custom picker. */
export function FieldSelect({
  id,
  name,
  value,
  onChange,
  placeholder,
  children,
  disabled = false,
  required = false,
  className = "",
}) {
  return (
    <div className={`ops-select-wrap ${className}`.trim()}>
      <select
        id={id}
        name={name}
        required={required}
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="ops-select"
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {children}
      </select>
    </div>
  );
}
