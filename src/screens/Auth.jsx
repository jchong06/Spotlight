import { useState } from "react";
import { motion } from "motion/react";
import { login, signup } from "../auth.js";

// Full-screen login / create-account sheet. On success it hands the freshly
// authenticated user back up to App, which merges any guest favorites and
// loads the account's saved shows.
export default function Auth({ onAuthed, onClose, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup'
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isSignup = mode === "signup";

  const switchMode = () => {
    setError("");
    setConfirm("");
    setMode(isSignup ? "login" : "signup");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (isSignup && password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const user = isSignup
        ? await signup({ name, email, password })
        : await login({ email, password });
      onAuthed(user);
    } catch (err) {
      setError(err.message || "Something went wrong");
      setBusy(false);
    }
  };

  const base =
    "w-full rounded-xl bg-bg-2 py-3 text-[15px] font-medium text-ink outline-none ring-accent/40 placeholder:text-ink-3 focus:ring-2";
  const field = `${base} px-4`;
  const fieldPw = `${base} pl-4 pr-11`; // room for the show/hide eye

  const EyeButton = () => (
    <button
      type="button"
      onClick={() => setShowPw((v) => !v)}
      aria-label={showPw ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 active:scale-90"
    >
      {showPw ? (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a16.8 16.8 0 0 1-3.3 4.1M6.5 6.5A16.7 16.7 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4-.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      )}
    </button>
  );

  return (
    <motion.div
      className="absolute inset-0 z-[1200] overflow-y-auto bg-bg no-scrollbar"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
    >
      <div className="flex min-h-full flex-col px-6 pb-10 pt-6">
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full bg-bg-2 text-ink active:scale-90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className="mt-10">
          <span className="accent-grad glow grid h-12 w-12 place-items-center rounded-2xl text-xl font-extrabold text-white">
            S
          </span>
          <h1 className="font-display mt-5 text-[28px] font-bold leading-tight tracking-tight text-ink">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-[14px] text-ink-2">
            {isSignup
              ? "Save your favorite shows and keep them across sign-ins."
              : "Sign in to load your saved shows."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-3">
          {isSignup && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              autoComplete="name"
              className={field}
            />
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Email"
            autoComplete="email"
            className={field}
          />
          <div className="relative">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              placeholder="Password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              className={fieldPw}
            />
            <EyeButton />
          </div>

          {isSignup && (
            <div className="relative">
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type={showPw ? "text" : "password"}
                placeholder="Confirm password"
                autoComplete="new-password"
                className={fieldPw}
              />
              <EyeButton />
            </div>
          )}

          {error && <p className="px-1 text-[13px] font-medium text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="accent-grad mt-2 w-full rounded-xl py-3.5 text-[15px] font-bold text-white active:scale-95 disabled:opacity-60"
          >
            {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center text-[14px] text-ink-2">
          {isSignup ? "Already have an account?" : "New to Spotlight?"}{" "}
          <button
            onClick={switchMode}
            className="accent-text font-bold"
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
