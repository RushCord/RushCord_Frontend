import { Link } from "react-router-dom";

/**
 * @param {{ lines: Array<{ text: string, linkTo?: string, linkLabel?: string, muted?: boolean }> }} props
 */
export const AuthFooter = ({ lines }) => {
  if (!lines?.length) return null;

  return (
    <div className="mt-6 space-y-2 text-center">
      {lines.map((line, index) => (
        <p
          key={index}
          className={
            line.muted ? "text-sm text-base-content/50" : "text-base-content/60"
          }
        >
          {line.text}
          {line.linkTo && line.linkLabel ? (
            <>
              {" "}
              <Link to={line.linkTo} className="link link-primary">
                {line.linkLabel}
              </Link>
            </>
          ) : null}
        </p>
      ))}
    </div>
  );
};
