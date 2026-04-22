import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep console output for debugging in dev
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message =
      error instanceof Error ? error.message : "Unknown runtime error";
    const stack = error instanceof Error ? error.stack : "";

    return (
      <div className="min-h-screen bg-base-200 text-base-content p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-xl font-bold">Frontend crashed</h1>
          <p className="opacity-80">
            Lỗi runtime đã xảy ra khi render. Copy phần dưới gửi mình là mình fix
            đúng chỗ.
          </p>

          <div className="alert alert-error">
            <span className="font-mono break-all">{message}</span>
          </div>

          {stack ? (
            <pre className="bg-base-300 p-4 rounded-lg overflow-auto text-xs">
              {stack}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}

