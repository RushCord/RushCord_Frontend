const inputBaseClassName =
  "input discord-input-reset h-12 w-full rounded-xl border border-white/10 bg-black/10";
const inputWithIconClassName = `${inputBaseClassName} pl-10`;

export const AuthField = ({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  icon: Icon,
  disabled = false,
  inputMode,
  maxLength,
  hint,
}) => {
  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
      </label>
      <div className="relative">
        {Icon ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Icon className="size-5 text-base-content/40" />
          </div>
        ) : null}
        <input
          type={type}
          className={Icon ? inputWithIconClassName : inputBaseClassName}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          inputMode={inputMode}
          maxLength={maxLength}
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-base-content/50">{hint}</p> : null}
    </div>
  );
};
