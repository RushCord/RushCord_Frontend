import logoImg from "../../assets/logo.png";

export const AuthHeader = ({ title, subtitle }) => {
  return (
    <div className="mb-8 text-center">
      <div className="group flex flex-col items-center gap-2">
        <div className="flex size-14 items-center justify-center rounded-[18px] bg-primary/15 transition-colors group-hover:bg-primary/25">
          <img
            src={logoImg}
            alt="RushCord logo"
            className="size-8 rounded-lg object-cover"
          />
        </div>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        {subtitle ? (
          <p className="text-base-content/60">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
};
