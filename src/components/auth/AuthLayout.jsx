import AuthImagePattern from "../AuthImagePattern";
import { AuthHeader } from "./AuthHeader";

export const AuthLayout = ({
  title,
  subtitle,
  patternTitle,
  patternSubtitle,
  maxWidth = "max-w-md",
  children,
  banner,
}) => {
  return (
    <div className="min-h-screen bg-[var(--discord-app)] lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className={`discord-card w-full ${maxWidth} p-8`}>
          <AuthHeader title={title} subtitle={subtitle} />
          {banner}
          {children}
        </div>
      </div>

      <AuthImagePattern title={patternTitle} subtitle={patternSubtitle} />
    </div>
  );
};
