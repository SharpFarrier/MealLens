"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/scan", label: "Scan" },
  { href: "/report", label: "Report" },
  { href: "/people", label: "People" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="app">
      <nav className="side">
        <div className="brand">
          <span className="dot" />
          MealLens
        </div>
        <div className="navsec">Canteen</div>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={"navlink" + (path === n.href || path.startsWith(n.href + "/") ? " on" : "")}
          >
            {n.label}
          </Link>
        ))}
        <div className="dbnote">
          Its own app &amp; URL — shares only the DispatchLens Supabase database.
          <button
            onClick={signOut}
            className="btn sm"
            style={{ marginTop: 10, width: "100%" }}
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
