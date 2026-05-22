import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

const inputClassName =
  "input discord-input-reset h-12 w-full rounded-xl border border-white/10 bg-black/10 pl-10";

export const AuthPasswordField = ({
  label,
  placeholder = "••••••••",
  value,
  onChange,
  footer,
  hint,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
      </label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Lock className="size-5 text-base-content/40" />
        </div>
        <input
          type={showPassword ? "text" : "password"}
          className={inputClassName}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center pr-3"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="size-5 text-base-content/40" />
          ) : (
            <Eye className="size-5 text-base-content/40" />
          )}
        </button>
      </div>
      {hint ? <p className="mt-1 text-xs text-base-content/50">{hint}</p> : null}
      {footer ? <div className="label justify-end pt-1">{footer}</div> : null}
    </div>
  );
};
