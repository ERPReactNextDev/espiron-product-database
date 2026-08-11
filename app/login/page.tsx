"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SplashScreen } from "@/components/splash-screen";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import Image from "next/image";

export default function LoginPage() {
  const { userId } = useUser();
  const router = useRouter();
  const { theme } = useTheme();
  const [showSplash, setShowSplash] = useState(false);
  const isComic = theme === "comic";
  const isEngineer = theme === "engineer";

  // If already logged in on page load, go straight to dashboard
  useEffect(() => {
    if (userId && !showSplash) {
      router.replace("/dashboard");
    }
  }, [userId, showSplash, router]);

  // Called by LoginForm after successful login
  function handleLoginSuccess() {
    setShowSplash(true);
  }

  if (showSplash) {
    return <SplashScreen onDone={() => router.replace("/dashboard")} />;
  }

  return (
    <div className={`flex items-center justify-center min-h-screen p-4 ${
      isComic ? "comic-bg-dots" : isEngineer ? "engineer-grid bg-[#ffeaa7]" : "bg-gray-100"
    }`}>
      {/* Floating decorations - only for comic theme */}
      {isComic && (
        <>
          <div className="fixed top-20 left-10 text-6xl comic-animate-float" style={{ animationDelay: '0s' }}>⭐</div>
          <div className="fixed top-40 right-20 text-5xl comic-animate-float" style={{ animationDelay: '1s' }}>🚀</div>
          <div className="fixed bottom-32 left-20 text-5xl comic-animate-float" style={{ animationDelay: '2s' }}>💡</div>
          <div className="fixed bottom-20 right-10 text-6xl comic-animate-float" style={{ animationDelay: '0.5s' }}>⚡</div>
        </>
      )}

      {/* Floating construction decorations - for engineer theme */}
      {isEngineer && (
        <>
          <div className="fixed top-20 left-10 text-6xl engineer-animate-bounce" style={{ animationDelay: '0s' }}>🔧</div>
          <div className="fixed top-40 right-20 text-5xl engineer-animate-bounce" style={{ animationDelay: '1s' }}>⚙️</div>
          <div className="fixed bottom-32 left-20 text-5xl engineer-animate-bounce" style={{ animationDelay: '2s' }}>🦺</div>
          <div className="fixed bottom-20 right-10 text-6xl engineer-animate-bounce" style={{ animationDelay: '0.5s' }}>🏗️</div>
        </>
      )}

      {/* CENTER MAIN CARD */}
      <div className={`w-full max-w-5xl overflow-hidden relative z-10 ${
        isComic
          ? "comic-card comic-shadow-box comic-animate-pop"
          : isEngineer
          ? "engineer-card engineer-animate-pop"
          : "bg-white rounded-lg shadow-2xl"
      }`}>

        {/* Header stripe */}
        <div className={`h-4 w-full ${
          isComic
            ? "bg-linear-to-r from-yellow-300 via-orange-400 to-red-400"
            : isEngineer
            ? "bg-linear-to-r from-orange-500 via-yellow-400 to-orange-500"
            : "bg-linear-to-r from-red-600 to-red-800"
        }`}></div>

        {/* INNER GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2">

          {/* LEFT CARD (LOGIN FORM) */}
          <div className="bg-white p-4 sm:p-6 lg:p-8 flex flex-col justify-center gap-4 sm:gap-6">

            <div className={`flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 ${isComic ? "comic-animate-bounce" : ""}`}>
              <div className={`relative w-16 h-16 sm:w-20 sm:h-20 lg:w-28 lg:h-28 p-1 sm:p-2 flex items-center justify-center ${
                isComic ? "comic-card-primary" : isEngineer ? "engineer-card-primary" : "bg-red-50 rounded-lg border border-red-100"
              }`}>
                <Image
                  src="/images/disruptive-logo.png"
                  alt="Disruptive Solutions"
                  fill
                  className="object-contain p-1 sm:p-2"
                  priority
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`text-xl sm:text-2xl ${
                    isComic ? "text-red-500 font-comic-title comic-text-outline" : isEngineer ? "text-orange-600 font-engineer-title engineer-text-shadow" : "text-red-500 font-formal-title"
                  }`}>
                    ESPIRON
                  </span>
                  {isEngineer && (
                    <span className="text-xl" style={{ marginTop: '-4px' }}>⚠️</span>
                  )}
                </div>
                <span className={`text-xs sm:text-sm ${isComic ? "text-gray-600 font-comic" : isEngineer ? "text-gray-700 font-engineer" : "text-gray-600 font-formal"}`}>
                  Product Database
                </span>
              </div>
            </div>

            {/* Welcome message */}
            {isComic ? (
              <div className="comic-bubble comic-bubble-yellow mb-2 sm:mb-4 comic-animate-pop">
                <p className="font-comic text-base sm:text-lg text-center font-bold text-gray-800">
                  👋 Welcome back, hero! Ready to explore?
                </p>
              </div>
            ) : isEngineer ? (
              <div className="engineer-sign mb-2 sm:mb-4 engineer-animate-pop">
                <p className="font-engineer text-base sm:text-lg text-center font-bold text-gray-800">
                  👷 Welcome back, TL Dept. Ready to work?
                </p>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3 sm:p-4 mb-2 sm:mb-4">
                <p className="font-formal text-center text-gray-800 text-sm sm:text-base">
                  Welcome back. Please sign in to continue.
                </p>
              </div>
            )}

            <LoginForm onLoginSuccess={handleLoginSuccess} />

          </div>

          {/* RIGHT CARD - hidden on mobile */}
          <div className={`relative hidden lg:block min-h-125 w-full ${
            isComic
              ? "bg-linear-to-br from-blue-400 via-purple-400 to-pink-400"
              : isEngineer
              ? "bg-linear-to-br from-orange-400 via-yellow-400 to-orange-500"
              : "bg-linear-to-br from-gray-100 to-gray-200"
          }`}>
            {isComic && <div className="absolute inset-0 comic-bg-stripes opacity-30"></div>}
            {isEngineer && <div className="absolute inset-0 engineer-caution-tape opacity-20"></div>}
            <Image
              src="/images/login-wallpaper-3.png"
              alt="Login Wallpaper"
              fill
              className="object-cover"
              priority
            />
            {/* Overlay elements */}
            {isComic ? (
              <>
                <div className="absolute top-4 right-4 comic-badge bg-yellow-400 text-black px-4 py-2 text-lg">
                  FUN ZONE! 🎉
                </div>
                <div className="absolute bottom-4 left-4 comic-card-blue p-4 max-w-xs">
                  <p className="font-comic text-white text-center">
                    Discover amazing products! 🚀
                  </p>
                </div>
              </>
            ) : isEngineer ? (
              <>
                <div className="absolute top-4 right-4 engineer-badge bg-orange-500 text-white px-4 py-2 text-lg">
                  CONSTRUCTION ZONE! 🔧
                </div>
                <div className="absolute bottom-4 left-4 engineer-card-blue p-4 max-w-xs">
                  <p className="font-engineer text-white text-center">
                    Build amazing things! 🏗️
                  </p>
                </div>
              </>
            ) : (
              <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 max-w-xs shadow-lg">
                <p className="font-formal text-gray-800 text-center">
                  Internal Operations Portal
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer stripe */}
        <div className={`h-4 w-full ${
          isComic
            ? "bg-linear-to-r from-red-400 via-orange-400 to-yellow-300"
            : isEngineer
            ? "bg-linear-to-r from-yellow-400 via-orange-500 to-yellow-400"
            : "bg-linear-to-r from-red-600 to-red-800"
        }`}></div>
      </div>
    </div>
  );
}
