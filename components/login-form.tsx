"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";

import { dbLogs } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface LoginFormProps extends React.ComponentProps<"form"> {
  onLoginSuccess?: () => void;
}

export function LoginForm({ onLoginSuccess, ...props }: LoginFormProps) {
  const { setUserId } = useUser();
  const { theme } = useTheme();
  const isComic = theme === "comic";
  const isEngineer = theme === "engineer";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logLoginActivity(userId: string, email: string) {
    try {
      const deviceId =
        localStorage.getItem("deviceId") || crypto.randomUUID();

      localStorage.setItem("deviceId", deviceId);

      await addDoc(collection(dbLogs, "activity_logs"), {
        userId,
        email,
        status: "login",
        timestamp: new Date().toISOString(),
        deviceId,
        location: null,
        browser: navigator.userAgent,
        os: navigator.platform,
        date_created: serverTimestamp(),
      });
    } catch (error) {
      console.error("Login log failed:", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Email: email,
          Password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed");
        return;
      }

      setUserId(data.userId);
      await logLoginActivity(data.userId, email);

      // Trigger splash screen in the parent (LoginPage)
      onLoginSuccess?.();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="mb-4 sm:mb-6 text-center">
          <h1 className={`text-2xl sm:text-3xl text-red-500 ${
            isComic ? "font-comic-title comic-text-shadow comic-animate-bounce" : isEngineer ? "font-engineer-title text-orange-600 engineer-text-shadow" : "font-formal-title"
          }`}>
            {isComic ? "Login to your account" : isEngineer ? "👷 Sign In" : "Sign In"}
          </h1>

          <p className={`mt-2 text-xs sm:text-sm text-gray-600 ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
            Disruptive Solutions Inc. · Internal Operations Portal
          </p>
        </div>

        {error && (
          <div className={`mb-4 ${
            isComic
              ? "comic-bubble bg-red-100 border-red-400 comic-animate-shake"
              : isEngineer
              ? "engineer-sign bg-red-100"
              : "bg-red-50 border border-red-200 rounded-lg p-3"
          }`}>
            <p className={`text-sm text-red-600 text-center font-bold ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
              {isComic && "⚠️ "}{error}
            </p>
          </div>
        )}

        <Field>
          <FieldLabel className={`font-bold text-gray-700 ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
            {isComic ? "📧 Email" : isEngineer ? "🔧 Email" : "Email"}
          </FieldLabel>
          <Input
            type="email"
            required
            className={`h-10 sm:h-12 text-base sm:text-lg ${isComic ? "comic-input" : isEngineer ? "engineer-input" : "border-gray-300 focus:border-red-500 focus:ring-red-500"}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isComic ? "hero@disruptive.com" : isEngineer ? "e.spiron@disruptivesolutionsinc.com" : "Enter your email"}
          />
        </Field>

        <Field>
          <FieldLabel className={`font-bold text-gray-700 ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
            {isComic ? "🔑 Password" : isEngineer ? "🔐 Password" : "Password"}
          </FieldLabel>
          <Input
            type="password"
            required
            className={`h-10 sm:h-12 text-base sm:text-lg ${isComic ? "comic-input" : isEngineer ? "engineer-input" : "border-gray-300 focus:border-red-500 focus:ring-red-500"}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isComic ? "Your secret code!" : isEngineer ? "Your access code!" : "Enter your password"}
          />
        </Field>

        <Button
          type="submit"
          disabled={loading}
          className={`mt-3 sm:mt-4 h-12 sm:h-14 w-full text-base sm:text-lg text-white ${
            isComic
              ? "comic-button bg-linear-to-r from-red-500 to-orange-500 font-comic comic-animate-pulse"
              : isEngineer
              ? "engineer-button font-engineer"
              : "bg-red-600 hover:bg-red-700 font-formal rounded-md shadow-md hover:shadow-lg transition-all"
          }`}
        >
          {loading ? (
            <span className={`flex items-center gap-2 ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
              {isComic && <span className="animate-spin">⚡</span>}
              {isEngineer && <span className="animate-spin">🔧</span>}
              {isComic ? "Powering up..." : isEngineer ? "Building..." : "Signing in..."}
            </span>
          ) : (
            <span className={`flex items-center gap-2 ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
              {isComic ? "🚀 Let's Go!" : isEngineer ? "🔧 Let's Build!" : "Sign In"}
            </span>
          )}
        </Button>

        <p className={`mt-3 sm:mt-4 text-center text-xs text-gray-500 ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
          Having trouble? Contact your administrator{isComic && " 🦸"}{isEngineer && " 👷"}
        </p>
      </FieldGroup>
    </form>
  );
}
