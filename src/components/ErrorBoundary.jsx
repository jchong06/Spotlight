import { Component } from "react";

// Stops a render error in one screen (Favorites/Profile/etc.) from blanking the
// whole app — shows a small fallback with a recover button instead.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Screen error:", error, info);
  }
  componentDidUpdate(prev) {
    // recover automatically when the user switches to another tab
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
          <div className="accent-grad grid h-14 w-14 place-items-center rounded-2xl text-white">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="mt-4 text-[17px] font-bold text-ink">Something went wrong</h3>
          <p className="mt-1 max-w-[16rem] text-[14px] text-ink-3">
            This screen hit an error. Switch tabs and come back, or reload.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="accent-grad mt-4 rounded-full px-5 py-2.5 text-[14px] font-bold text-white active:scale-95"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
