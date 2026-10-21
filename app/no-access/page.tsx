"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NoAccess() {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }
  return (
    <div className="centerwrap">
      <div className="authcard" style={{ textAlign: "center" }}>
        <div className="brand" style={{ padding: "0 0 16px", justifyContent: "center" }}>
          <span className="dot" />
          MealLens
        </div>
        <h2 style={{ fontFamily: "var(--display)", margin: "0 0 8px" }}>No canteen access</h2>
        <p className="lead">
          Your account is signed in but doesn&apos;t have canteen access yet. Ask an admin to set
          <code style={{ fontFamily: "var(--mono)" }}> can_canteen </code> on your DispatchLens access row.
        </p>
        <button className="btn" style={{ marginTop: 8 }} onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
