import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

export type TechnicalSpecificationTemplateSpec = {
  specId: string;
  unit: string;
  isRanging: boolean;
  isSlashing: boolean;
  isDimension: boolean;
  isRating: boolean;
  value: string;
  rangeFrom: string;
  rangeTo: string;
  slashValues: string[];
  length: string;
  width: string;
  height: string;
  ipFirst: string;
  ipSecond: string;
};

export type TechnicalSpecificationTemplate = {
  id: string;
  title: string;
  specs: TechnicalSpecificationTemplateSpec[];
  sortOrder?: number;
  isDragMode?: boolean;
};

export type TechnicalSpecificationTemplateSource = "family" | "productType";

export function hasTechnicalSpecificationTemplateSchemaChanged(
  current: { id?: string; title: string; specs: object[]; sortOrder?: number }[],
  baseline: { id?: string; title: string; specs: object[]; sortOrder?: number }[],
): boolean {
  const normalize = (templates: typeof current) => JSON.stringify(templates.map((template) => ({
    id: template.id || "",
    title: template.title.trim(),
    sortOrder: template.sortOrder ?? 0,
    specs: template.specs.map((spec) => Object.fromEntries(
      Object.entries(spec).filter(([key]) => key !== "value"),
    )),
  })));

  return normalize(current) !== normalize(baseline);
}

type TemplateScope = {
  categoryTypeId: string;
  productFamilyId: string;
  productTypeId?: string;
};

const sortTemplates = (templates: TechnicalSpecificationTemplate[]) =>
  templates.sort((left, right) => (left.sortOrder ?? 999) - (right.sortOrder ?? 999));

const normalizeTemplateSpecs = (specs: unknown): TechnicalSpecificationTemplateSpec[] =>
  Array.isArray(specs)
    ? specs.map((item) => {
      const data = typeof item === "object" && item !== null
        ? item as Record<string, unknown>
        : {};
      return {
        specId: typeof data.specId === "string" ? data.specId : "",
        unit: typeof data.unit === "string" ? data.unit : "",
        isRanging: data.isRanging === true,
        isSlashing: data.isSlashing === true,
        isDimension: data.isDimension === true,
        isRating: data.isRating === true,
        value: typeof data.value === "string" ? data.value : "",
        rangeFrom: typeof data.rangeFrom === "string" ? data.rangeFrom : "",
        rangeTo: typeof data.rangeTo === "string" ? data.rangeTo : "",
        slashValues: Array.isArray(data.slashValues)
          ? data.slashValues.filter((value): value is string => typeof value === "string")
          : [""],
        length: typeof data.length === "string" ? data.length : "",
        width: typeof data.width === "string" ? data.width : "",
        height: typeof data.height === "string" ? data.height : "",
        ipFirst: typeof data.ipFirst === "string" ? data.ipFirst : "",
        ipSecond: typeof data.ipSecond === "string" ? data.ipSecond : "",
      };
    })
    : [];

export async function loadTechnicalSpecificationTemplates(
  scope: Required<TemplateScope>,
): Promise<{ source: TechnicalSpecificationTemplateSource; templates: TechnicalSpecificationTemplate[] }> {
  const typeSnapshot = await getDocs(query(
    collection(db, "technicalSpecifications"),
    where("productTypeId", "==", scope.productTypeId),
  ));
  const typeDocs = typeSnapshot.docs.filter((item) => {
    const data = item.data();
    return data.categoryTypeId === scope.categoryTypeId && data.productFamilyId === scope.productFamilyId;
  });

  const productTypeSnapshot = await getDoc(doc(db, "productTypes", scope.productTypeId));
  const hasTypeOverride = typeDocs.length > 0
    || productTypeSnapshot.data()?.hasTechnicalSpecificationsOverride === true;

  if (hasTypeOverride) {
    return {
      source: "productType",
      templates: sortTemplates(typeDocs
        .filter((item) => item.data().isActive !== false)
        .map((item) => {
          const data = item.data();
          return {
            id: item.id,
            title: data.title,
            specs: normalizeTemplateSpecs(data.specs),
            sortOrder: data.sortOrder ?? 999,
            isDragMode: data.isDragMode,
          };
        })),
    };
  }

  const familySnapshot = await getDocs(query(
    collection(db, "technicalSpecifications"),
    where("categoryTypeId", "==", scope.categoryTypeId),
    where("productFamilyId", "==", scope.productFamilyId),
    where("isActive", "==", true),
  ));

  return {
    source: "family",
    templates: sortTemplates(familySnapshot.docs
      .filter((item) => !item.data().productTypeId)
      .map((item) => {
        const data = item.data();
        return {
          id: item.id,
          title: data.title,
          specs: normalizeTemplateSpecs(data.specs),
          sortOrder: data.sortOrder ?? 999,
          isDragMode: data.isDragMode,
        };
      })),
  };
}

export async function saveTechnicalSpecificationTemplates<T extends {
  id?: string;
  title: string;
  specs: object[];
  sortOrder?: number;
  isDragMode?: boolean;
}>(
  scope: TemplateScope,
  templates: T[],
): Promise<(T & { id: string; sortOrder: number })[]> {
  const existingSnapshot = scope.productTypeId
    ? await getDocs(query(
      collection(db, "technicalSpecifications"),
      where("productTypeId", "==", scope.productTypeId),
    ))
    : await getDocs(query(
      collection(db, "technicalSpecifications"),
      where("categoryTypeId", "==", scope.categoryTypeId),
      where("productFamilyId", "==", scope.productFamilyId),
    ));
  const existingDocs = existingSnapshot.docs.filter((item) => {
    const data = item.data();
    return data.categoryTypeId === scope.categoryTypeId
      && data.productFamilyId === scope.productFamilyId
      && (scope.productTypeId ? data.productTypeId === scope.productTypeId : !data.productTypeId);
  });
  const batch = writeBatch(db);
  const retainedIds = new Set<string>();
  const savedTemplates = templates
    .filter((template) => template.title.trim())
    .map((template, index) => {
      const existing = existingDocs.find((item) => item.id === template.id)
        || existingDocs.find((item) => item.data().title === template.title);
      const reference = existing?.ref || doc(collection(db, "technicalSpecifications"));
      retainedIds.add(reference.id);
      batch.set(reference, {
        categoryTypeId: scope.categoryTypeId,
        productFamilyId: scope.productFamilyId,
        ...(scope.productTypeId ? { productTypeId: scope.productTypeId } : {}),
        title: template.title,
        specs: template.specs.map((spec) => Object.fromEntries(
          Object.entries(spec).filter(([key]) => key !== "value"),
        )),
        sortOrder: index + 1,
        isActive: true,
        updatedAt: serverTimestamp(),
      });
      return { ...template, id: reference.id, sortOrder: index + 1 };
    });

  existingDocs.forEach((item) => {
    if (!retainedIds.has(item.id)) batch.update(item.ref, { isActive: false, updatedAt: serverTimestamp() });
  });

  if (scope.productTypeId) {
    batch.update(doc(db, "productTypes", scope.productTypeId), {
      hasTechnicalSpecificationsOverride: true,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return savedTemplates;
}

export async function addMissingTechnicalSpecificationTemplateSpecs(
  scope: Required<TemplateScope>,
  excelColumns: { title: string; specId: string }[],
): Promise<{ source: TechnicalSpecificationTemplateSource; templates: TechnicalSpecificationTemplate[] }> {
  const loaded = await loadTechnicalSpecificationTemplates(scope);
  const templates = loaded.templates.map((template) => ({
    ...template,
    specs: template.specs.map((spec) => ({ ...spec })),
  }));
  let changed = false;

  for (const column of excelColumns) {
    const title = column.title.trim();
    const specId = column.specId.trim();
    if (!title || !specId) continue;

    let template = templates.find((item) => item.title === title);
    if (!template) {
      template = {
        id: "",
        title,
        specs: [],
        sortOrder: Math.max(0, ...templates.map((item) => item.sortOrder ?? 0)) + 1,
      };
      templates.push(template);
      changed = true;
    }

    if (!template.specs.some((spec) => spec.specId === specId)) {
      template.specs.push({
        specId,
        unit: "",
        isRanging: false,
        isSlashing: false,
        isDimension: false,
        isRating: false,
        value: "",
        rangeFrom: "",
        rangeTo: "",
        slashValues: [""],
        length: "",
        width: "",
        height: "",
        ipFirst: "",
        ipSecond: "",
      });
      changed = true;
    }
  }

  if (!changed) return loaded;

  const savedTemplates = await saveTechnicalSpecificationTemplates(scope, templates);
  return {
    source: "productType",
    templates: savedTemplates,
  };
}
