import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import crypto from "crypto";

function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function validateApiKey(
  apiKey: string
): Promise<{ valid: boolean; permissions?: string[]; keyId?: string; error?: string }> {
  if (!apiKey || !apiKey.startsWith("esp_")) {
    return { valid: false, error: "Invalid API key format" };
  }

  const hashedKey = hashApiKey(apiKey);
  const keysQuery = query(
    collection(db, "apiKeys"),
    where("hashedKey", "==", hashedKey),
    where("isActive", "==", true)
  );
  const snapshot = await getDocs(keysQuery);

  if (snapshot.empty) {
    return { valid: false, error: "Invalid or revoked API key" };
  }

  const keyDoc = snapshot.docs[0];
  const keyData = keyDoc.data();

  await updateDoc(doc(db, "apiKeys", keyDoc.id), {
    lastUsedAt: Timestamp.now(),
    usageCount: (keyData.usageCount || 0) + 1,
  });

  return { valid: true, permissions: keyData.permissions || [], keyId: keyData.keyId };
}

function hasPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required) || permissions.includes("admin");
}

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? "";

  if (!apiKey) {
    return NextResponse.json(
      { error: "API key required. Include X-API-Key header." },
      { status: 401 }
    );
  }

  const validation = await validateApiKey(apiKey);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 401 });
  }

  const { permissions } = validation;
  const { searchParams } = req.nextUrl;
  const endpoint = searchParams.get("endpoint");

  try {
    switch (endpoint) {
      case "products": {
        if (!hasPermission(permissions!, "products:read")) {
          return NextResponse.json(
            { error: "Permission denied: products:read required" },
            { status: 403 }
          );
        }

        const isActive = searchParams.get("isActive") ?? "true";
        const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "50", 10), 100);

        const productsQuery = query(
          collection(db, "products"),
          where("isActive", "==", isActive === "true"),
          orderBy("productReferenceID"),
          limit(pageSize)
        );

        const snapshot = await getDocs(productsQuery);
        const products = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            productReferenceID: data.productReferenceID,
            referenceID: data.referenceID,
            productClass: data.productClass,
            brandOrigin: data.brandOrigin,
            pricePoint: data.pricePoint,
            categoryTypes: data.categoryTypes,
            productFamilies: data.productFamilies,
            mainImage: data.mainImage,
            technicalSpecifications: data.technicalSpecifications,
            commercialDetails: data.commercialDetails,
            isActive: data.isActive,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            date_updated: data.date_updated?.toDate?.()?.toISOString() || null,
          };
        });

        return NextResponse.json({
          data: products,
          count: products.length,
          pageInfo: {
            hasMore: products.length === pageSize,
            nextPageToken:
              snapshot.docs.length > 0
                ? snapshot.docs[snapshot.docs.length - 1].id
                : null,
          },
        });
      }

      case "suppliers": {
        if (!hasPermission(permissions!, "suppliers:read")) {
          return NextResponse.json(
            { error: "Permission denied: suppliers:read required" },
            { status: 403 }
          );
        }

        const isActive = searchParams.get("isActive") ?? "true";
        const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "50", 10), 100);

        const suppliersQuery = query(
          collection(db, "suppliers"),
          where("isActive", "==", isActive === "true"),
          orderBy("supplierId"),
          limit(pageSize)
        );

        const snapshot = await getDocs(suppliersQuery);
        const suppliers = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            supplierId: data.supplierId,
            referenceID: data.referenceID,
            company: data.company,
            supplierBrand: data.supplierBrand,
            addresses: data.addresses,
            emails: data.emails,
            contacts: data.contacts,
            certificates: data.certificates,
            products: data.products,
            forteProducts: data.forteProducts,
            website: data.website,
            isActive: data.isActive,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
            date_updated: data.date_updated?.toDate?.()?.toISOString() || null,
          };
        });

        return NextResponse.json({
          data: suppliers,
          count: suppliers.length,
          pageInfo: {
            hasMore: suppliers.length === pageSize,
            nextPageToken:
              snapshot.docs.length > 0
                ? snapshot.docs[snapshot.docs.length - 1].id
                : null,
          },
        });
      }

      case "product-detail": {
        if (!hasPermission(permissions!, "products:read")) {
          return NextResponse.json(
            { error: "Permission denied: products:read required" },
            { status: 403 }
          );
        }
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

        const productDoc = await getDoc(doc(db, "products", id));
        if (!productDoc.exists())
          return NextResponse.json({ error: "Product not found" }, { status: 404 });

        const data = productDoc.data();
        return NextResponse.json({
          id: productDoc.id,
          productReferenceID: data.productReferenceID,
          referenceID: data.referenceID,
          productClass: data.productClass,
          brandOrigin: data.brandOrigin,
          pricePoint: data.pricePoint,
          categoryTypes: data.categoryTypes,
          productFamilies: data.productFamilies,
          mainImage: data.mainImage,
          dimensionalDrawing: data.dimensionalDrawing,
          illuminanceDrawing: data.illuminanceDrawing,
          technicalSpecifications: data.technicalSpecifications,
          commercialDetails: data.commercialDetails,
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          date_updated: data.date_updated?.toDate?.()?.toISOString() || null,
        });
      }

      case "supplier-detail": {
        if (!hasPermission(permissions!, "suppliers:read")) {
          return NextResponse.json(
            { error: "Permission denied: suppliers:read required" },
            { status: 403 }
          );
        }
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ error: "Supplier ID required" }, { status: 400 });

        const supplierDoc = await getDoc(doc(db, "suppliers", id));
        if (!supplierDoc.exists())
          return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

        const data = supplierDoc.data();
        return NextResponse.json({
          id: supplierDoc.id,
          supplierId: data.supplierId,
          referenceID: data.referenceID,
          company: data.company,
          supplierBrand: data.supplierBrand,
          addresses: data.addresses,
          emails: data.emails,
          contacts: data.contacts,
          certificates: data.certificates,
          products: data.products,
          forteProducts: data.forteProducts,
          website: data.website,
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          date_updated: data.date_updated?.toDate?.()?.toISOString() || null,
        });
      }

      default:
        return NextResponse.json(
          {
            error: "Invalid endpoint",
            availableEndpoints: ["products", "suppliers", "product-detail", "supplier-detail"],
          },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Public API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error?.message || String(error),
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
