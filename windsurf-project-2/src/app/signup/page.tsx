"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white flex items-center justify-center px-4">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -5%, rgba(41,141,255,0.35) 0%, rgba(41,141,255,0.08) 40%, rgba(41,141,255,0) 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/welcome">
            <Logo size="medium" variant="full" src="/logo-sidebar.png" />
          </Link>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8 border backdrop-blur-xl"
          style={{
            background: "rgba(8,13,27,0.85)",
            borderColor: "rgba(41,141,255,0.18)",
          }}
        >
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)] flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-sm text-[#94A3B8]">
                We sent a confirmation link to{" "}
                <span className="text-white font-medium">{email}</span>.
                Click it to activate your account.
              </p>
              <Link
                href="/login"
                className="inline-block mt-6 text-sm text-[#298DFF] hover:text-[#7CC0FF] transition-colors"
              >
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
              <p className="text-sm text-[#94A3B8] mb-7">
                Start managing your prop trading workspace
              </p>

              <form onSubmit={handleSignup} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[rgba(13,20,36,0.8)] border border-[rgba(148,163,184,0.15)] rounded-xl px-4 py-3 text-sm text-white placeholder-[#4A5568] outline-none transition-all duration-200 focus:border-[#298DFF] focus:ring-1 focus:ring-[rgba(41,141,255,0.4)]"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full bg-[rgba(13,20,36,0.8)] border border-[rgba(148,163,184,0.15)] rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-[#4A5568] outline-none transition-all duration-200 focus:border-[#298DFF] focus:ring-1 focus:ring-[rgba(41,141,255,0.4)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5568] hover:text-[#94A3B8] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Confirm password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[rgba(13,20,36,0.8)] border border-[rgba(148,163,184,0.15)] rounded-xl px-4 py-3 text-sm text-white placeholder-[#4A5568] outline-none transition-all duration-200 focus:border-[#298DFF] focus:ring-1 focus:ring-[rgba(41,141,255,0.4)]"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-xl px-4 py-3 text-sm text-[#FF6B6B] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#298DFF] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#1E6FE0] hover:shadow-lg hover:shadow-[rgba(41,141,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  {loading ? "Creating account…" : "Create account"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[#94A3B8]">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-[#298DFF] hover:text-[#7CC0FF] font-medium transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
