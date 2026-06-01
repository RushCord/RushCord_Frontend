export const AuthOtpField = ({ label, value, onChange, placeholder = "000000" }) => {
  const handleChange = (e) => {
    onChange(e.target.value.replace(/\D/g, "").slice(0, 6));
  };

  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
      </label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={6}
        className="input discord-input-reset h-12 w-full rounded-xl border border-white/10 bg-black/10 text-center text-lg tracking-widest"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
};
