"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const accounts = [
  { value: "ben", label: "Ben Holley" },
  { value: "cook", label: "Andrew Cook" },
  { value: "admin", label: "Operator" },
];

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [username, setUsername] = useState("ben");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") || "");
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, next }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || json?.message || "Login failed");
      }
      router.replace(json.redirectTo || "/buyer-launch");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-12 text-neutral-900">
      <div className="w-full max-w-md rounded-[28px] border border-black/[0.06] bg-white/95 p-8 shadow-[0_32px_80px_-40px_rgba(0,0,0,0.2)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b6d44]">
          Liftoff Buyer Launch
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Buyer access is isolated. Ben and Andrew only see their own launch surface.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
              Account
            </div>
            <select
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-black/[0.08] bg-[#fbf8f2] px-4 py-3 text-sm outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            >
              {accounts.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
              Password
            </div>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-black/[0.08] bg-[#fbf8f2] px-4 py-3 text-sm outline-none transition focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
              placeholder="Enter your password"
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-[#0071e3] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#005ec0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
