// frontend/src/pages/Login.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Assumptions (adjust if your project differs):
 * - API: POST /api/t/:tenantSlug/auth/login
 * - Returns JSON: { accessToken: string } (or { token: string })
 * - On success you want to navigate to "/t/:tenantSlug/app" (adjust below)
 */

// Demo credentials (safe defaults; can be overridden via Vite env)
const DEMO_TENANT = "demo";
const DEMO_EMAIL =
  (import.meta as any).env?.VITE_DEMO_EMAIL || "owner@demo.com";
const DEMO_PASSWORD =
  (import.meta as any).env?.VITE_DEMO_PASSWORD || "12345678";

function normalizeSlug(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function Login() {
  const navigate = useNavigate();

  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [identifier, setIdentifier] = useState<string>(""); // phoneOrEmail
  const [password, setPassword] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const apiUrl = useMemo(() => {
    const slug = normalizeSlug(tenantSlug);
    if (!slug) return "";
    return `/api/t/${encodeURIComponent(slug)}/auth/login`;
  }, [tenantSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const slug = normalizeSlug(tenantSlug);
    if (!slug) return setError("نام سازمان (Tenant) را وارد کنید.");
    if (!identifier.trim()) return setError("شماره موبایل یا ایمیل را وارد کنید.");
    if (!password) return setError("رمز عبور را وارد کنید.");

    setLoading(true);
    try {
      const res = await fetch(`/api/t/${encodeURIComponent(slug)}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // for refresh cookie (if backend sets it)
        body: JSON.stringify({
          phoneOrEmail: identifier.trim(),
          password,
        }),
      });

      const text = await res.text();
      const data = safeJsonParse(text) || {};

      if (!res.ok) {
        const msg =
          data?.message ||
          data?.error ||
          `خطا در ورود (${res.status})`;
        throw new Error(msg);
      }

      const accessToken = data?.accessToken || data?.token;
      if (accessToken) {
        localStorage.setItem("accessToken", accessToken);
      }

      // ✅ Adjust this route if your app path differs
      // Common patterns:
      // - `/t/${slug}/app/dashboard`
      // - `/t/${slug}/app`
      // - `/app` (if slug is stored elsewhere)
      navigate(`/t/${slug}/app`);
    } catch (err: any) {
      setError(err?.message || "خطای نامشخص در ورود");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setTenantSlug(DEMO_TENANT);
    setIdentifier(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError("");
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>ورود به Sakhtar CRM</div>
            <div style={styles.subtitle}>Tenant را وارد کنید و وارد پنل شوید.</div>
          </div>

          <button type="button" onClick={fillDemo} style={styles.demoBtn}>
            ورود دمو
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Tenant (نام سازمان)
            <input
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              placeholder="مثلاً: demo یا acme"
              autoComplete="organization"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            موبایل یا ایمیل
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="0912... یا email@example.com"
              autoComplete="username"
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            رمز عبور
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              autoComplete="current-password"
              style={styles.input}
            />
          </label>

          {apiUrl ? (
            <div style={styles.hint}>
              API: <code style={styles.code}>{apiUrl}</code>
            </div>
          ) : null}

          {error ? <div style={styles.error}>{error}</div> : null}

          <button type="submit" disabled={loading} style={styles.submit}>
            {loading ? "در حال ورود..." : "ورود"}
          </button>
        </form>

        <div style={styles.footer}>
          <div style={styles.footerText}>
            اگر Tenant را نمی‌دانید، از ادمین فروش دریافت کنید.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "#0b1220",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "#0f1b33",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 18,
    color: "white",
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: 800 },
  subtitle: { fontSize: 12, opacity: 0.8, marginTop: 6 },
  demoBtn: {
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    borderRadius: 10,
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12 },
  input: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.25)",
    color: "white",
    padding: "12px 12px",
    outline: "none",
  },
  hint: { fontSize: 12, opacity: 0.8 },
  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    opacity: 0.9,
  },
  error: {
    background: "rgba(255, 0, 0, 0.10)",
    border: "1px solid rgba(255, 0, 0, 0.25)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12,
  },
  submit: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(86, 182, 255, 0.18)",
    color: "white",
    padding: "12px 12px",
    cursor: "pointer",
    fontWeight: 700,
    marginTop: 4,
  },
  footer: { marginTop: 12, opacity: 0.8 },
  footerText: { fontSize: 12 },
};
