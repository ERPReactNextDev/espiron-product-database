import { NextRequest, NextResponse } from "next/server";
import { db, dbBackup } from "@/lib/firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  getDoc,
} from "firebase/firestore";
import { getUserById } from "@/lib/supabase-admin";

async function verifyITAccess(
  sessionCookie: string | undefined
): Promise<{ valid: boolean; userId?: string; error?: string }> {
  if (!sessionCookie) return { valid: false, error: "No session found" };
  try {
    const user = await getUserById(sessionCookie);
    if (!user) return { valid: false, error: "User not found" };
    if (user.Department !== "IT")
      return { valid: false, error: "Access denied. IT department only." };
    return { valid: true, userId: user.UserId || user.id.toString() };
  } catch {
    return { valid: false, error: "Authentication error" };
  }
}

// Get all collection names from a database
async function getAllCollections(dbInstance: any): Promise<string[]> {
  const collections: string[] = [];
  
  // Common collection names in your database
  const knownCollections = [
    "activity_logs",
    "apiKeys",
    "auditLogs_productFamilies",
    "auditLogs_productUsages",
    "auditLogs_products",
    "auditLogs_spfVersions",
    "auditLogs_suppliers",
    "categoryTypes",
    "fcm_tokens",
    "forApprovals",
    "global_notifications",
    "notes",
    "productFamilies",
    "products",
    "roleAccess",
    "suppliers",
    "technicalSpecifications",
    "sisterCompanies",
    "classificationTypes",
    "brands",
    "users",
    "logs",
    "spfRequests",
    "spfPools",
    "notifications",
    "emailAccounts",
  ];
  
  for (const collectionName of knownCollections) {
    try {
      const testQuery = query(collection(dbInstance, collectionName));
      const snapshot = await getDocs(testQuery);
      if (!snapshot.empty) {
        collections.push(collectionName);
      }
    } catch (error) {
      // Collection might not exist, skip it
      continue;
    }
  }
  
  return collections;
}

// Delete all documents in a collection
async function clearCollection(dbInstance: any, collectionName: string) {
  const snapshot = await getDocs(collection(dbInstance, collectionName));
  const deletePromises = snapshot.docs.map((docSnapshot) =>
    deleteDoc(doc(dbInstance, collectionName, docSnapshot.id))
  );
  await Promise.all(deletePromises);
}

// Copy all documents from source to destination collection
async function copyCollection(
  sourceDb: any,
  destDb: any,
  collectionName: string
) {
  const snapshot = await getDocs(collection(sourceDb, collectionName));
  
  for (const docSnapshot of snapshot.docs) {
    const data = docSnapshot.data();
    await setDoc(doc(destDb, collectionName, docSnapshot.id), data);
  }
}

export async function POST(req: NextRequest) {
  const cookies = req.cookies;
  const session = cookies.get("session")?.value;

  const auth = await verifyITAccess(session);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  try {
    // Get all collections from live database
    const collections = await getAllCollections(db);
    
    const results: {
      collection: string;
      status: string;
      documentsCopied: number;
    }[] = [];

    // Prioritize suppliers first, then products, then the rest
    const prioritizedCollections = collections.sort((a, b) => {
      if (a === "suppliers") return -1;
      if (b === "suppliers") return 1;
      if (a === "products") return -1;
      if (b === "products") return 1;
      return 0;
    });

    // Process each collection
    for (const collectionName of prioritizedCollections) {
      try {
        // Step 1: Clear the backup collection
        await clearCollection(dbBackup, collectionName);
        
        // Step 2: Copy all documents from live to backup
        await copyCollection(db, dbBackup, collectionName);
        
        // Get count of copied documents
        const backupSnapshot = await getDocs(collection(dbBackup, collectionName));
        
        results.push({
          collection: collectionName,
          status: "success",
          documentsCopied: backupSnapshot.size,
        });
      } catch (error: any) {
        console.error(`Error processing collection ${collectionName}:`, error);
        
        // Check for quota exceeded error
        const errorMessage = error?.message || String(error);
        if (errorMessage.includes('quota') || errorMessage.includes('Quota') || 
            errorMessage.includes('exceeded') || errorMessage.includes('limit')) {
          return NextResponse.json({
            error: `Quota exceeded on backup Firebase project. Cannot migrate ${collectionName}. Please check your Firebase quota limits.`,
            failedCollection: collectionName,
            results,
          }, { status: 429 });
        }
        
        results.push({
          collection: collectionName,
          status: "error",
          documentsCopied: 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Database migration completed successfully",
      results,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: "Internal server error during migration" },
      { status: 500 }
    );
  }
}
