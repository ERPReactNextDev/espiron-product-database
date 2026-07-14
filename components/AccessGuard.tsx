"use client";

import { useEffect, useState, useCallback } from "react";
import { useRoleAccess } from "@/contexts/RoleAccessContext";
import { Button } from "@/components/ui/button";
import { Shield, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

interface AccessGuardProps {
  accessKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AccessGuard({ accessKey, children, fallback }: AccessGuardProps) {
  const { hasAccess, loading, subscribeToUserAccess } = useRoleAccess();
  const { userId: currentUserId } = useUser();
  const router = useRouter();
  const [accessGranted, setAccessGranted] = useState<boolean | null>(null);

  const checkAccess = useCallback(async () => {
    if (!loading && currentUserId) {
      try {
        const granted = await hasAccess(accessKey);
        setAccessGranted(granted);
      } catch (error) {
        console.error("Error checking access:", error);
        setAccessGranted(false);
      }
    }
  }, [hasAccess, accessKey, loading, currentUserId]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Subscribe to real-time access updates
  useEffect(() => {
    if (!currentUserId) return;
    
    const unsubscribe = subscribeToUserAccess(currentUserId, (access) => {
      // Re-check access whenever the user's access data changes
      checkAccess();
    });

    return unsubscribe;
  }, [currentUserId, subscribeToUserAccess, checkAccess]);

  if (loading || accessGranted === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    );
  }

  if (!accessGranted) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to access this page. 
              Please contact IT Department or PD Manager to grand access to the system.
            </p>
            <div className="space-y-2">
              <Button onClick={() => router.push("/dashboard")} className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}