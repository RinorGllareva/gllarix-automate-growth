import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { data } from "@/data";
import { AtlasMark, Icon, ICONS } from "@/components/ui/primitives";
import { homePathFor } from "@/lib/nav";
import { safeNext } from "@/lib/safeNext";

const ERRORS = {
  invalid: "Email or password is wrong.",
  paused: "Your access is paused. Ask an admin.",
  rate_limited: "Too many attempts, try again in 15 minutes.",
  missing: "Enter your work email and password.",
} as const;

const FlowLines = () => (
  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g fill="none" strokeLinecap="round">
      <path d="M-60 180C200 60 420 260 640 180S980 -20 1180 90 1480 260 1520 160" style={{ stroke: "var(--surface-2)" }} strokeWidth="18" />
      <path d="M-60 180C200 60 420 260 640 180S980 -20 1180 90 1480 260 1520 160" style={{ stroke: "var(--line-strong)" }} strokeWidth="2" />
      <path d="M-40 640C160 520 300 760 520 700S860 460 1060 560 1320 820 1500 700" style={{ stroke: "var(--surface)" }} strokeWidth="26" />
      <path d="M-40 640C160 520 300 760 520 700S860 460 1060 560 1320 820 1500 700" style={{ stroke: "var(--line-strong)" }} strokeWidth="2" />
      <path d="M900 -40C860 160 1060 260 1000 420S760 620 820 820 1040 960 1080 960" style={{ stroke: "var(--surface-2)" }} strokeWidth="22" />
      <path d="M900 -40C860 160 1060 260 1000 420S760 620 820 820 1040 960 1080 960" style={{ stroke: "var(--line-button)" }} strokeWidth="2" />
      <path d="M1200 980C1160 780 1400 700 1380 520S1180 320 1260 140 1480 40 1500 20" style={{ stroke: "var(--surface)" }} strokeWidth="16" />
    </g>
  </svg>
);

const Login = () => {
  const { user, loading, signIn, sendMagicLink } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<keyof typeof ERRORS | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="min-h-screen bg-bg-deep" />;
  if (user) return <Navigate to={next ?? homePathFor(user.role)} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setInfo(null);
    if (!email.trim() || !password) {
      setError("missing");
      return;
    }
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) navigate(next ?? homePathFor(result.user.role), { replace: true });
    else setError(result.error);
  };

  const onMagicLink = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("missing");
      return;
    }
    setBusy(true);
    await sendMagicLink(email);
    setBusy(false);
    // Same message whether or not the account exists.
    setInfo("Check your inbox for a sign-in link.");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-deep text-text">
      <FlowLines />
      <div className="relative flex min-h-screen flex-col px-6 py-10 sm:px-12 lg:px-[120px] lg:py-14">
        <div className="flex items-center gap-3">
          <AtlasMark size={32} />
          <span className="text-[15px] font-medium tracking-[0.28em]">ATLAS</span>
        </div>

        <div className="my-auto grid items-center gap-12 py-12 lg:grid-cols-[1fr_400px] lg:gap-20">
          <div className="flex flex-col gap-[22px]">
            <div className="flex items-center gap-3.5 text-[11px] uppercase tracking-[0.3em] text-label">
              <span className="h-px w-12 bg-cyan-line" />
              <span>Sales operations · Arcadian × Gllarix</span>
            </div>
            <h1 className="m-0 text-[56px] font-light leading-[0.95] tracking-[-0.03em] sm:text-[72px] xl:text-[96px]">
              Every lead.
              <br />
              <span className="font-semibold text-ice">On the dot.</span>
            </h1>
            <p className="m-0 max-w-[460px] text-[16px] leading-relaxed text-text-2">
              Your queue, your calls and every deal in one place, ready before your shift starts.
            </p>
          </div>

          <form
            aria-label="Sign in"
            noValidate
            onSubmit={onSubmit}
            className="flex flex-col gap-[18px] border border-line bg-bg/[0.86] p-8"
          >
            <span className="label-caps">Sign in</span>
            <label className="flex flex-col gap-2">
              <span className="field-label">Work email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="input h-[46px] text-[15px]"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="field-label">Password</span>
              <span className="relative flex">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input h-[46px] pr-12 text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-text-3 hover:text-text"
                >
                  <Icon d={showPassword ? ICONS.eyeOff : ICONS.eye} />
                </button>
              </span>
            </label>

            {error ? (
              <p role="alert" className="m-0 text-[13px] text-coral">
                {ERRORS[error]}
              </p>
            ) : null}
            {info ? (
              <p role="status" className="m-0 text-[13px] text-mint">
                {info}
              </p>
            ) : null}

            <button type="submit" disabled={busy} className="btn-primary h-12 justify-between tracking-[0.24em]">
              <span>Sign in</span>
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" disabled={busy} onClick={onMagicLink} className="btn-outline text-[11px]">
              Email me a magic link
            </button>
            <span className="text-[12px] text-text-3">Access is by invite. Ask an admin to add you.</span>
            {data.kind === "demo" ? (
              <span className="border-t border-line-soft pt-3 text-[12px] leading-relaxed text-text-3">
                Demo mode: fake data in this browser only. Demo accounts are listed in{" "}
                <span className="font-mono">atlas/README.md</span>.
              </span>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
