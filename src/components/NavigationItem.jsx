export default function NavigationItem({
  label,
  icon: Icon,
  active = false,
  onClick,
  className = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[15px] ${
        active
          ? "bg-(--discord-active) text-(--discord-active-text)"
          : "text-(--discord-text) hover:bg-(--discord-hover)"
      } ${className}`}
    >
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      <span className="truncate">{label}</span>
    </button>
  );
}
