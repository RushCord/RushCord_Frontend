const AuthImagePattern = ({ title, subtitle }) => {
  return (
    <div className="hidden lg:flex items-center justify-center bg-[var(--discord-rail)] p-12">
      <div className="max-w-md text-center">
        <div className="mb-8 grid grid-cols-3 gap-3">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-[18px] border border-white/10 ${
                i === 4
                  ? "bg-primary shadow-lg shadow-primary/20"
                  : i % 2 === 0
                    ? "bg-white/5"
                    : "bg-black/10"
              }`}
            />
          ))}
        </div>
        <div className="discord-section-title mb-2">RushCord</div>
        <h2 className="mb-4 text-3xl font-bold">{title}</h2>
        <p className="leading-7 text-base-content/60">{subtitle}</p>
      </div>
    </div>
  );
};

export default AuthImagePattern;