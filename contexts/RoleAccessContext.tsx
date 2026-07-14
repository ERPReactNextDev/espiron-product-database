"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection,
  query,
  where 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUser } from "@/contexts/UserContext";

export type AccessKey = 
  | "page:requests"
  | "page:products" 
  | "page:suppliers"
  | "page:roles"
  | "page:add-product"
  | "page:edit-product"
  | "page:analytics"
  | "page:history"
  | "page:notes"
  | "feature:approval-bypass"
  | "component:spf-request-create"
  | "component:spf-request-fetch"
  | "component:upload-product"
  | "component:upload-supplier"
  | "component:add-product-btn"
  | "component:edit-product"
  | string;

export interface RoleAccess {
  [key: AccessKey]: boolean;
}

export interface UserAccess {
  userId: string;
  access: RoleAccess;
  lastUpdated?: Date;
}

type RoleAccessContextType = {
  hasAccess: (key: AccessKey) => Promise<boolean>;
  toggleAccess: (userId: string, key: AccessKey, value: boolean) => Promise<void>;
  getUserAccess: (userId: string) => Promise<RoleAccess | null>;
  subscribeToUserAccess: (userId: string, callback: (access: RoleAccess) => void) => () => void;
  loading: boolean;
};

const RoleAccessContext = createContext<RoleAccessContextType | undefined>(undefined);

const defaultAccess: RoleAccess = {
  "page:requests": true,
  "page:products": true,
  "page:suppliers": true,
  "page:roles": true,
  "page:add-product": true,
  "page:edit-product": true,
  "page:analytics": true,
  "page:history": true,
  "page:notes": true,
  "feature:approval-bypass": false,
  "component:spf-request-create": true,
  "component:spf-request-fetch": true,
  "component:upload-product": true,
  "component:upload-supplier": true,
  "component:add-product-btn": true,
  "component:edit-product": true,
};

export function RoleAccessProvider({ children }: { children: React.ReactNode }) {
  const { userId: currentUserId } = useUser();
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState<any>(null);

  // Fetch current user data to check department and role
  useEffect(() => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    const fetchCurrentUserData = async () => {
      try {
        const res = await fetch(`/api/users?id=${encodeURIComponent(currentUserId)}`);
        if (res.ok) {
          const userData = await res.json();
          setCurrentUserData(userData);
        }
      } catch (error) {
        console.error("Error fetching current user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUserData();
  }, [currentUserId]);

  const getUserAccess = useCallback(async (userId: string): Promise<RoleAccess | null> => {
    try {
      const userAccessRef = doc(db, "roleAccess", userId);
      const userAccessDoc = await getDoc(userAccessRef);
      
      if (userAccessDoc.exists()) {
        return { ...defaultAccess, ...userAccessDoc.data().access };
      }
      
      return { ...defaultAccess };
    } catch (error) {
      console.error("Error getting user access:", error);
      return null;
    }
  }, []);

  const hasAccess = useCallback(async (key: AccessKey): Promise<boolean> => {
    // Engineering Managers and IT department always have full access
    if (currentUserData) {
      const isEngineeringManager = 
        currentUserData.Department === "Engineering" && 
        currentUserData.Role === "Manager";
      const isITDepartment = currentUserData.Department === "IT";
      
      if (isEngineeringManager || isITDepartment) {
        return true;
      }
    }
    
    // For other users, check Firebase access
    if (currentUserId) {
      try {
        const userAccess = await getUserAccess(currentUserId);
        return userAccess?.[key] ?? true; // Default to true if not set
      } catch (error) {
        console.error("Error checking access:", error);
        return true; // Default to true on error
      }
    }
    
    return true; // Default to true if no user ID
  }, [currentUserData, currentUserId]);

  const toggleAccess = useCallback(async (userId: string, key: AccessKey, value: boolean): Promise<void> => {
    try {
      const userAccessRef = doc(db, "roleAccess", userId);
      const userAccessDoc = await getDoc(userAccessRef);
      
      let currentAccess: RoleAccess = defaultAccess;
      
      if (userAccessDoc.exists()) {
        currentAccess = { ...defaultAccess, ...userAccessDoc.data().access };
      }
      
      const updatedAccess = { ...currentAccess, [key]: value };
      
      await setDoc(userAccessRef, {
        access: updatedAccess,
        lastUpdated: new Date(),
      }, { merge: true });
    } catch (error) {
      console.error("Error toggling access:", error);
      throw error;
    }
  }, []);

  const subscribeToUserAccess = useCallback((userId: string, callback: (access: RoleAccess) => void): () => void => {
    const userAccessRef = doc(db, "roleAccess", userId);
    
    const unsubscribe = onSnapshot(userAccessRef, (doc) => {
      if (doc.exists()) {
        const accessData = doc.data();
        callback({ ...defaultAccess, ...accessData.access });
      } else {
        callback({ ...defaultAccess });
      }
    }, (error) => {
      console.error("Error subscribing to user access:", error);
      callback({ ...defaultAccess });
    });

    return unsubscribe;
  }, []);

  const value: RoleAccessContextType = {
    hasAccess,
    toggleAccess,
    getUserAccess,
    subscribeToUserAccess,
    loading,
  };

  return (
    <RoleAccessContext.Provider value={value}>
      {children}
    </RoleAccessContext.Provider>
  );
}

export function useRoleAccess() {
  const context = useContext(RoleAccessContext);
  if (!context) {
    throw new Error("useRoleAccess must be used within RoleAccessProvider");
  }
  return context;
}
