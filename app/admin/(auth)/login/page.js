"use client";

import Script from "next/script";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "../../../../services/apiClient";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const googleClientId = useMemo(() => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "", []);

  useEffect(() => {
    apiRequest("/api/auth/me")
      .then(() => router.replace("/admin"))
      .catch(() => {});
  }, [router]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      router.replace("/admin");
    } catch (requestError) {
      setError(requestError.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleLoaded = () => {
    if (!window.google || !googleClientId) return;

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        try {
          await apiRequest("/api/auth/google", {
            method: "POST",
            body: { idToken: response.credential },
          });
          router.replace("/admin");
        } catch (requestError) {
          setError(requestError.message || "Google sign in failed");
        }
      },
    });

    const button = document.getElementById("google-login-btn");
    if (button) {
      button.innerHTML = "";
      window.google.accounts.id.renderButton(button, {
        theme: "outline",
        size: "large",
        width: 320,
        shape: "rectangular",
      });
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={onGoogleLoaded} />

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Admin Login</h1>
        <p className="mt-1 text-sm text-slate-600">Balaji Ji Food Arts secure control panel</p>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-emerald-600"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="my-4 h-px bg-slate-200" />
        <div id="google-login-btn" className="flex justify-center" />
      </div>
    </main>
  );
}
