import "./Eo2DatePicker.css";

/** Native browser date control with a consistent EO2MATE field treatment. */
export default function Eo2DatePicker({
  type = "date",
  value = "",
  onChange,
  inputRef,
  min,
  max,
  minDate,
  disabled = false,
  required = false,
  hasError = false,
  className = "",
  ...props
}) {
  const effectiveMin = min ?? (type === "datetime-local" && minDate ? `${minDate}T00:00` : undefined);
  return (
    <input
      {...props}
      ref={inputRef}
      type={type}
      className={`eo2-date-picker-input${hasError ? " has-error" : ""}${className ? ` ${className}` : ""}`}
      value={value || ""}
      onChange={onChange}
      min={effectiveMin}
      max={max}
      disabled={disabled}
      required={required}
    />
  );
}
