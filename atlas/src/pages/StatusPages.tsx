import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { EmptyState } from "@/components/ui/primitives";
import { homePathFor, navItemForPath } from "@/lib/nav";

/** A page whose module ships in a later milestone. */
export const ComingSoon = () => {
  const { pathname } = useLocation();
  const item = navItemForPath(pathname);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="page-title m-0">{item?.label ?? "Atlas"}</h1>
      <EmptyState
        title={`This part of Atlas is built in milestone ${item?.milestone ?? "—"}. The navigation, permissions and shortcuts already work.`}
      />
    </div>
  );
};

/** 403 with a plain message, never a blank page. */
export const Forbidden = () => {
  const { user } = useAuth();
  return (
    <div className="flex flex-col gap-6">
      <span className="label-caps">403 · No access</span>
      <h1 className="page-title m-0">You don't have access to this page.</h1>
      <p className="m-0 max-w-xl text-[15px] leading-relaxed text-text-2">
        Your role doesn't include it. If you need it for your work, ask an admin to change your role.
      </p>
      {user ? (
        <Link to={homePathFor(user.role)} className="btn-outline self-start">
          Back to my pages →
        </Link>
      ) : null}
    </div>
  );
};

export const NotFound = () => (
  <div className="flex min-h-[60vh] flex-col justify-center gap-6">
    <span className="label-caps">404</span>
    <h1 className="page-title m-0">This page doesn't exist.</h1>
    <Link to="/" className="btn-outline self-start">
      Go to Atlas →
    </Link>
  </div>
);
