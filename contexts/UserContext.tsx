"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

type UserContextType = {
  userId: string | null;
  setUserId: (id: string | null) => void;
  loading: boolean;
  splashDone: boolean;
  setSplashDone: (done: boolean) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [splashDone, setSplashDoneState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("splashDone") === "true";
    }
    return false;
  });

  function setSplashDone(done: boolean) {
    if (typeof window !== "undefined") {
      if (done) {
        sessionStorage.setItem("splashDone", "true");
      } else {
        sessionStorage.removeItem("splashDone");
      }
    }
    setSplashDoneState(done);
  }

  function setUserId(id: string | null) {
    // When logging out (id = null), clear splash so it replays on next login
    if (!id) {
      sessionStorage.removeItem("splashPlayed");
      sessionStorage.removeItem("splashDone");
      setSplashDoneState(false);
    }
    setUserIdState(id);
  }

  useEffect(() => {
    fetch("/api/me")
      .then(async (res) => {
        if (res.status === 403) {
          const data = await res.json();
          if (data?.forceLogout) {
            // Clear splash so it replays on next login
            sessionStorage.removeItem("splashPlayed");
            sessionStorage.removeItem("splashDone");
            setSplashDoneState(false);

            setUserIdState(null);
            await fetch("/api/logout", { method: "POST" });
            window.location.href = "/login";
          }
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (data?.userId) {
          setUserIdState(data.userId);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Periodic status check for real-time resigned status detection
  useEffect(() => {
    if (!userId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch("/api/me");
        if (res.status === 403) {
          const data = await res.json();
          if (data?.forceLogout) {
            // Clear splash so it replays on next login
            sessionStorage.removeItem("splashPlayed");
            sessionStorage.removeItem("splashDone");
            setSplashDoneState(false);

            setUserIdState(null);
            await fetch("/api/logout", { method: "POST" });
            window.location.href = "/login";
          }
        }
      } catch (error) {
        console.error("Status check error:", error);
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000);

    return () => clearInterval(interval);
  }, [userId]);

  return (
    <UserContext.Provider value={{ userId, setUserId, loading, splashDone, setSplashDone }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserProvider");
  }
  return context;
}