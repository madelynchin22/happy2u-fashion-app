"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Invalid email or password");
    else router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#f1e8de" }}>
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-10">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="Happy2U"
            width={180}
            height={72}
            className="object-contain mb-3"
            priority
          />
          <p className="text-gray-500 text-sm">Business Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@happy2u.my"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full py-3 text-base" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
