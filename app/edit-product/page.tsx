"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, ImagePlus, ChevronLeft, Trash2, Pencil } from "lucide-react";
import { useRef } from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

import { useUser } from "@/contexts/UserContext";
import { useNotificationTriggers } from "@/hooks/use-notification-triggers";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  doc,
  updateDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  orderBy,
  limit,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { logProductEvent, logProductUsageEvent, logProductFamilyEvent } from "@/lib/auditlogger"; // ✅ AUDIT

import AddProductSelectProductType from "@/components/add-product-edit-select-category-type";
import AddProductEditSelectProduct from "@/components/add-product-edit-select-product";
import AddProductDeleteProductType from "@/components/add-product-delete-select-category-type";
import AddProductDeleteProduct from "@/components/add-product-delete-select-product";
import AddProductDeleteTechnicalSpecification from "@/components/add-product-delete-technical-specification";
import RequestApprovalDialog from "@/components/request-approval-dialog";
import AddSupplier from "@/components/add-supplier";
import EditSupplier from "@/components/edit-supplier";
import {
  createApprovalRequest,
  getApprovalUserProfile,
  shouldRequireApproval,
} from "@/lib/for-approval";

type UserData = { Firstname: string; Lastname: string; Role: string; ReferenceID: string };
type SpecRow = {
  specId: string; unit: string;
  isRanging: boolean; isSlashing: boolean; isDimension: boolean; isRating: boolean;
  value: string; rangeFrom: string; rangeTo: string; slashValues: string[];
  length: string; width: string; height: string; ipFirst: string; ipSecond: string;
};
type TechnicalSpecification = { id: string; title: string; specs: SpecRow[]; sortOrder?: number };
type Classification = { id: string; name: string };
type SelectedClassification = { id: string; name: string } | null;
type CategoryType = { id: string; name: string };
type Supplier = { supplierId: string; company: string; supplierBrand?: string };
type Brand = { id: string; name: string };
type ProductFamily = { id: string; name: string; productUsageId: string };
type SelectedCategoryType = { id: string; name: string };
type MultiRow = {
  itemName: string;
  unitCost: number;
  length: number;
  width: number;
  height: number;
  qtyPerCarton: number;
  landed: number;
  srp: number;
};
const COUNTRY_NAMES: Record<string, string> = {
  AC: "Ascension Islands",
  CN: "China",
  VN: "Vietnam",
  TH: "Thailand",
  ID: "Indonesia",
  MY: "Malaysia",
  PH: "Philippines",
  SG: "Singapore",
  JP: "Japan",
  KR: "South Korea",
  TW: "Taiwan",
  HK: "Hong Kong",
  IN: "India",
  BD: "Bangladesh",
  PK: "Pakistan",
  LK: "Sri Lanka",
  MM: "Myanmar",
  KH: "Cambodia",
  LA: "Laos",
  BN: "Brunei",
  US: "United States",
  DE: "Germany",
  IT: "Italy",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  NL: "Netherlands",
  BE: "Belgium",
  AT: "Austria",
  CH: "Switzerland",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PL: "Poland",
  CZ: "Czech Republic",
  HU: "Hungary",
  RO: "Romania",
  BG: "Bulgaria",
  GR: "Greece",
  PT: "Portugal",
  IE: "Ireland",
  HR: "Croatia",
  SI: "Slovenia",
  SK: "Slovakia",
  LT: "Lithuania",
  LV: "Latvia",
  EE: "Estonia",
  UA: "Ukraine",
  BY: "Belarus",
  KZ: "Kazakhstan",
  UZ: "Uzbekistan",
  KG: "Kyrgyzstan",
  TJ: "Tajikistan",
  TM: "Turkmenistan",
  AZ: "Azerbaijan",
  GE: "Georgia",
  AM: "Armenia",
  TR: "Turkey",
  IL: "Israel",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  KW: "Kuwait",
  BH: "Bahrain",
  OM: "Oman",
  JO: "Jordan",
  LB: "Lebanon",
  SY: "Syria",
  IQ: "Iraq",
  IR: "Iran",
  AF: "Afghanistan",
  NP: "Nepal",
  BT: "Bhutan",
  MV: "Maldives",
  TL: "Timor-Leste",
  AU: "Australia",
  NZ: "New Zealand",
  FJ: "Fiji",
  PG: "Papua New Guinea",
  SB: "Solomon Islands",
  VU: "Vanuatu",
  WS: "Samoa",
  TO: "Tonga",
  KI: "Kiribati",
  NR: "Nauru",
  TV: "Tuvalu",
  FM: "Micronesia",
  MH: "Marshall Islands",
  PW: "Palau",
  MP: "Northern Mariana Islands",
  GU: "Guam",
  AS: "American Samoa",
  CK: "Cook Islands",
  NU: "Niue",
  PF: "French Polynesia",
  WF: "Wallis and Futuna",
  NC: "New Caledonia",
  CA: "Canada",
  MX: "Mexico",
  GT: "Guatemala",
  BZ: "Belize",
  SV: "El Salvador",
  HN: "Honduras",
  NI: "Nicaragua",
  CR: "Costa Rica",
  PA: "Panama",
  CO: "Colombia",
  VE: "Venezuela",
  GY: "Guyana",
  SR: "Suriname",
  GF: "French Guiana",
  EC: "Ecuador",
  PE: "Peru",
  BO: "Bolivia",
  CL: "Chile",
  AR: "Argentina",
  PY: "Paraguay",
  UY: "Uruguay",
  BR: "Brazil",
  CU: "Cuba",
  HT: "Haiti",
  DO: "Dominican Republic",
  JM: "Jamaica",
  TT: "Trinidad and Tobago",
  BB: "Barbados",
  GD: "Grenada",
  LC: "Saint Lucia",
  VC: "Saint Vincent and the Grenadines",
  AG: "Antigua and Barbuda",
  DM: "Dominica",
  KN: "Saint Kitts and Nevis",
  BS: "Bahamas",
  PR: "Puerto Rico",
  VI: "Virgin Islands",
  AI: "Anguilla",
  MS: "Montserrat",
  TC: "Turks and Caicos Islands",
  BM: "Bermuda",
  KY: "Cayman Islands",
  GL: "Greenland",
  IS: "Iceland",
  FO: "Faroe Islands",
  RU: "Russia",
};

const convertDriveToThumbnail = (url: string) => {
  if (!url.includes("drive.google.com")) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
  return url;
};

const emptySpecRow = (): SpecRow => ({
  specId: "", unit: "", isRanging: false, isSlashing: false, isDimension: false, isRating: false,
  value: "", rangeFrom: "", rangeTo: "", slashValues: [""], length: "", width: "", height: "", ipFirst: "", ipSecond: "",
});

export default function EditProductPage() {
  const router = useRouter();
  const { userId } = useUser();
  const { onProductUpdated } = useNotificationTriggers();

  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const productId = searchParams.get("id");

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedSupplierBrand, setSelectedSupplierBrand] = useState<Supplier | null>(null);
  const [selectedSupplierData, setSelectedSupplierData] = useState<any>(null);
  const [noSupplier, setNoSupplier] = useState(false);

  const [pricePoint, setPricePoint] = useState("");
  const [brandOrigin, setBrandOrigin] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [productClass, setProductClass] = useState("");
  const [productReferenceID, setProductReferenceID] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [packLength, setPackLength] = useState("");
  const [packWidth, setPackWidth] = useState("");
  const [packHeight, setPackHeight] = useState("");
  const [pcsPerCarton, setPcsPerCarton] = useState("");
  const [moq, setMoq] = useState("");
  const [warrantyNumber, setWarrantyNumber] = useState("");
  const [warrantyPeriod, setWarrantyPeriod] = useState<"days" | "months" | "years">("months");
  const [factoryAddress, setFactoryAddress] = useState("");
  const [portOfDischarge, setPortOfDischarge] = useState("");

  type CommercialType = "BASIC" | "LIGHT" | "POLE";
  const [commercialType, setCommercialType] = useState<CommercialType>("BASIC");
  const calculationType = commercialType === "POLE" ? "POLE" as const : "LIGHTS" as const;
  const [useArrayInput, setUseArrayInput] = useState(false);
  const [qtyPerContainer, setQtyPerContainer] = useState<number>(1);
  const [landedCost, setLandedCost] = useState<number>(0);
  const [srp, setSrp] = useState<number>(0);
  const [totalUnitCost, setTotalUnitCost] = useState<number>(0);
  const [multiRows, setMultiRows] = useState<MultiRow[]>([
    {
      itemName: "",
      unitCost: 0,
      length: 0,
      width: 0,
      height: 0,
      qtyPerCarton: 1,
      landed: 0,
      srp: 0,
    },
  ]);

  const [mainImage, setMainImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageLink, setImageLink] = useState("");

  const [dimensionalDrawing, setDimensionalDrawing] = useState<File | null>(null);
  const [dimensionalPreview, setDimensionalPreview] = useState<string | null>(null);
  const [dimensionalLink, setDimensionalLink] = useState("");

  const [illuminanceDrawing, setIlluminanceDrawing] = useState<File | null>(null);
  const [illuminancePreview, setIlluminancePreview] = useState<string | null>(null);
  const [illuminanceLink, setIlluminanceLink] = useState("");

  const [classificationType, setClassificationType] = useState<SelectedClassification>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [classificationTypes, setClassificationTypes] = useState<Classification[]>([]);
  const [newClassification, setNewClassification] = useState("");
  const [newCategoryType, setNewCategoryType] = useState("");
  const [categoryTypes, setCategoryTypes] = useState<CategoryType[]>([]);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [editSupplierOpen, setEditSupplierOpen] = useState(false);
  const [productFamilies, setProductFamilies] = useState<ProductFamily[]>([]);
  const [selectedProductFamily, setSelectedProductFamily] = useState<ProductFamily | null>(null);
  const [technicalSpecs, setTechnicalSpecs] = useState<TechnicalSpecification[]>([]);
  const [productFamilySearch, setProductFamilySearch] = useState("");
  const [newProductType, setNewProductType] = useState("");
  const [selectedCategoryTypes, setSelectedCategoryTypes] = useState<SelectedCategoryType[]>([]);
  const [classificationSearch, setClassificationSearch] = useState("");
  const [categoryTypeSearch, setCategoryTypeSearch] = useState("");
  const [requestApprovalOpen, setRequestApprovalOpen] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);

  const dragIndex = useRef<number | null>(null);
  const dragRow = useRef<{ specIndex: number; rowIndex: number } | null>(null);
  const hasInitializedImages = useRef(false);

  useEffect(() => {
    if (!userId) { router.push("/login"); return; }
    fetch(`/api/users?id=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(d => setUser({ Firstname: d.Firstname ?? "", Lastname: d.Lastname ?? "", Role: d.Role ?? "", ReferenceID: d.ReferenceID ?? "" }))
      .finally(() => setLoading(false));
  }, [userId, router]);

  useEffect(() => {
    const q = query(collection(db, "suppliers"), where("isActive", "==", true));
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ supplierId: d.id, company: d.data().company, supplierBrand: d.data().supplierBrand || d.data().supplierBrandName || "" }));
      setSuppliers(list.sort((a, b) => a.company.localeCompare(b.company)));
    });
  }, []);

  // Fetch supplier details when selected to get countries
  useEffect(() => {
    if (!selectedSupplier) {
      setSelectedSupplierData(null);
      return;
    }
    const fetchSupplierData = async () => {
      const snap = await getDocs(query(collection(db, "suppliers"), where("supplierId", "==", selectedSupplier.supplierId)));
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        setSelectedSupplierData({ ...data, id: doc.id });
        // Auto-populate countries from supplier
        if (data.countries && data.countries.length > 0) {
          setCountries(data.countries);
          // Set brandOrigin to first country
          setBrandOrigin(data.countries[0] === "CN" ? "CHINA" : "NON-CHINA");
        }
      }
    };
    fetchSupplierData();
  }, [selectedSupplier]);

  useEffect(() => {
    if (!productId) return;
    const ref = doc(db, "products", productId);
    const unsub = onSnapshot(ref, (snap) => {
      if (!snap.exists()) { toast.error("Product not found"); router.push("/products"); return; }
      const data: any = snap.data();
      setPricePoint(data.pricePoint || "");
      setBrandOrigin(data.brandOrigin || "");
      setCountries(data.countries || []);
      setProductClass(data.productClass || "");
      setProductReferenceID(data.productReferenceID || "");
      if (data.commercialDetails) {
        setUnitCost(data.commercialDetails.unitCost?.toString() || "");
        setFactoryAddress(data.commercialDetails.factoryAddress || "");
        setPortOfDischarge(data.commercialDetails.portOfDischarge || "");

        // Handle packaging - single dimension only
        setPackLength((data.commercialDetails.packaging?.length || "").replace(" cm", ""));
        setPackWidth((data.commercialDetails.packaging?.width || "").replace(" cm", ""));
        setPackHeight((data.commercialDetails.packaging?.height || "").replace(" cm", ""));
        setPcsPerCarton(data.commercialDetails.pcsPerCarton?.toString() || "");

        // Load new commercial details fields
        const commType = data.commercialDetails.commercialType || "BASIC";
        setCommercialType(commType as CommercialType);
        setMoq(data.commercialDetails.moq?.toString() || "");

        // Parse warranty (e.g., "12 months" -> number = 12, period = "months")
        const warrantyValue = data.commercialDetails.warranty || "";
        if (warrantyValue) {
          const warrantyParts = warrantyValue.split(" ");
          setWarrantyNumber(warrantyParts[0] || "");
          const period = warrantyParts[1] as "days" | "months" | "years";
          if (["days", "months", "years"].includes(period)) {
            setWarrantyPeriod(period);
          }
        } else {
          setWarrantyNumber("");
          setWarrantyPeriod("months");
        }

        // Load LIGHT-specific fields
        setUseArrayInput(data.commercialDetails.useArrayInput || false);
        setTotalUnitCost(data.commercialDetails.totalUnitCost || 0);
        if (data.commercialDetails.multiRows && data.commercialDetails.multiRows.length > 0) {
          setMultiRows(data.commercialDetails.multiRows.map((r: any) => ({
            itemName: r.itemName || "",
            unitCost: r.unitCost || 0,
            length: r.length || 0,
            width: r.width || 0,
            height: r.height || 0,
            qtyPerCarton: r.qtyPerCarton || 1,
            landed: r.landed || 0,
            srp: r.srp || 0,
          })));
        } else {
          setMultiRows([{
            itemName: "",
            unitCost: 0,
            length: 0,
            width: 0,
            height: 0,
            qtyPerCarton: 1,
            landed: 0,
            srp: 0,
          }]);
        }

        // Load POLE-specific fields
        setQtyPerContainer(data.commercialDetails.qtyPerContainer || 1);

        // Load calculated values
        setLandedCost(data.commercialDetails.landedCost || 0);
        setSrp(data.commercialDetails.srp || 0);
      }
      if (data.supplier) {
        const supplierObj = { supplierId: data.supplier.supplierId, company: data.supplier.company, supplierBrand: data.supplier.supplierBrand || "" };
        setSelectedSupplier(supplierObj);
        setSelectedSupplierBrand(supplierObj);
        setNoSupplier(false);
      } else {
        setNoSupplier(true);
        setPricePoint(data.pricePoint || "Economy");
        setBrandOrigin(data.brandOrigin || "China");
      }
      if (!hasInitializedImages.current) {
        if (data.mainImage?.url) { setImageLink(data.mainImage.url); setPreview(convertDriveToThumbnail(data.mainImage.url)); }
        else { setImageLink(""); setPreview(null); }
        if (data.dimensionalDrawing?.url) { setDimensionalLink(data.dimensionalDrawing.url); setDimensionalPreview(convertDriveToThumbnail(data.dimensionalDrawing.url)); }
        else { setDimensionalLink(""); setDimensionalPreview(null); }
        if (data.illuminanceDrawing?.url) { setIlluminanceLink(data.illuminanceDrawing.url); setIlluminancePreview(convertDriveToThumbnail(data.illuminanceDrawing.url)); }
        else { setIlluminanceLink(""); setIlluminancePreview(null); }
        hasInitializedImages.current = true;
      }
      if (Array.isArray(data.categoryTypes)) {
        setSelectedCategoryTypes(data.categoryTypes.map((c: any) => ({ id: c.productUsageId, name: c.categoryTypeName })));
      }
      if (Array.isArray(data.productFamilies) && data.productFamilies.length > 0) {
        const p = data.productFamilies[0];
        setSelectedProductFamily({ id: p.productFamilyId, name: p.productFamilyName, productUsageId: p.productUsageId });
      }
      if (Array.isArray(data.technicalSpecifications)) {
        setTechnicalSpecs(
          data.technicalSpecifications
            .map((spec: any) => ({ id: spec.technicalSpecificationId, title: spec.title, sortOrder: spec.sortOrder ?? 999, specs: spec.specs }))
            .sort((a: TechnicalSpecification, b: TechnicalSpecification) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999))
        );
      }
    });
    return () => unsub();
  }, [productId]);

  useEffect(() => {
    const q = query(collection(db, "brands"), where("isActive", "==", true));
    return onSnapshot(q, snap => setBrands(snap.docs.map(d => ({ id: d.id, name: d.data().name as string })).sort((a, b) => a.name.localeCompare(b.name))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, "categoryTypes"), where("isActive", "==", true));
    return onSnapshot(q, snap => setCategoryTypes(snap.docs.map(d => ({ id: d.id, name: d.data().name }))));
  }, []);

  useEffect(() => {
    if (selectedCategoryTypes.length === 0) { setProductFamilies([]); return; }
    const q = query(collection(db, "productFamilies"), where("categoryTypeId", "==", selectedCategoryTypes[0].id), where("isActive", "==", true));
    return onSnapshot(q, snap => setProductFamilies(snap.docs.map(d => ({ id: d.id, name: d.data().name, productUsageId: d.data().categoryTypeId }))));
  }, [selectedCategoryTypes]);

  const addTechnicalSpec = () => setTechnicalSpecs(p => [...p, { id: "", title: "", specs: [emptySpecRow()] }]);
  const removeTechnicalSpec = (i: number) => setTechnicalSpecs(p => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);
  const updateTitle = (i: number, v: string) => setTechnicalSpecs(p => p.map((x, idx) => idx === i ? { ...x, title: v } : x));
  const addSpecRow = (si: number) => setTechnicalSpecs(p => p.map((x, i) => i === si ? { ...x, specs: [...x.specs, emptySpecRow()] } : x));
  const removeSpecRow = (si: number, ri: number) => setTechnicalSpecs(p => p.map((x, i) => i === si ? { ...x, specs: x.specs.length > 1 ? x.specs.filter((_, r) => r !== ri) : x.specs } : x));
  const updateSpecField = (si: number, ri: number, field: keyof SpecRow, v: string) => {
    const copy = [...technicalSpecs];
    (copy[si].specs[ri] as any)[field] = v;
    setTechnicalSpecs(copy);
  };

  const handleDragStart = (i: number) => { dragIndex.current = i; };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (di: number) => {
    if (dragIndex.current === null) return;
    const copy = [...technicalSpecs];
    const dragged = copy[dragIndex.current];
    copy.splice(dragIndex.current, 1);
    copy.splice(di, 0, dragged);
    dragIndex.current = null;
    setTechnicalSpecs(copy);
  };
  const handleRowDragStart = (si: number, ri: number) => { dragRow.current = { specIndex: si, rowIndex: ri }; };
  const handleRowDrop = (si: number, dri: number) => {
    if (!dragRow.current || dragRow.current.specIndex !== si) return;
    const copy = [...technicalSpecs];
    const dragged = copy[si].specs[dragRow.current.rowIndex];
    copy[si].specs.splice(dragRow.current.rowIndex, 1);
    copy[si].specs.splice(dri, 0, dragged);
    dragRow.current = null;
    setTechnicalSpecs(copy);
  };

  const handleImageChange = (file: File | null) => {
    if (!file) return;
    setMainImage(file); setImageLink("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };
  const handleDimensionalChange = (file: File | null) => {
    if (!file) return;
    setDimensionalDrawing(file);
    if (dimensionalPreview) URL.revokeObjectURL(dimensionalPreview);
    setDimensionalPreview(URL.createObjectURL(file));
  };
  const handleIlluminanceChange = (file: File | null) => {
    if (!file) return;
    setIlluminanceDrawing(file);
    if (illuminancePreview) URL.revokeObjectURL(illuminancePreview);
    setIlluminancePreview(URL.createObjectURL(file));
  };

  const handleAddCategoryType = async () => {
    if (!newCategoryType.trim()) return;
    const newCatRef = await addDoc(collection(db, "categoryTypes"), { name: newCategoryType.trim(), isActive: true, createdAt: serverTimestamp(), whatHappened: "Product Usage Added", date_updated: serverTimestamp() });
    await logProductUsageEvent({
      whatHappened    : "Product Usage Added",
      productUsageId  : newCatRef.id,
      productUsageName: newCategoryType.trim(),
      referenceID     : user?.ReferenceID,
      userId          : userId ?? undefined,
    });
    setNewCategoryType("");
  };

  const handleAddProductType = async () => {
    if (!newProductType.trim() || selectedCategoryTypes.length !== 1) return;
    const newFamRef = await addDoc(collection(db, "productFamilies"), { name: newProductType.trim(), categoryTypeId: selectedCategoryTypes[0].id, isActive: true, createdAt: serverTimestamp(), whatHappened: "Product Family Added", date_updated: serverTimestamp() });
    await logProductFamilyEvent({
      whatHappened     : "Product Family Added",
      productFamilyId  : newFamRef.id,
      productFamilyName: newProductType.trim(),
      productUsageId   : selectedCategoryTypes[0].id,
      referenceID      : user?.ReferenceID,
      userId           : userId ?? undefined,
    });
    setNewProductType("");
  };

  const selectProductFamily = async (item: ProductFamily) => {
    setSelectedProductFamily(item);
    if (selectedCategoryTypes.length !== 1) return;
    const snap = await getDocs(query(collection(db, "technicalSpecifications"), where("categoryTypeId", "==", selectedCategoryTypes[0].id), where("productFamilyId", "==", item.id), where("isActive", "==", true)));
    const loaded = snap.docs
      .map(d => ({ id: d.id, title: d.data().title, sortOrder: d.data().sortOrder ?? 999, specs: (d.data().specs || []).map((r: any) => ({ ...r, value: "" })) }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    setTechnicalSpecs(loaded);
  };

  const syncTemplateChangesToFamily = async () => {
    if (!selectedProductFamily || selectedCategoryTypes.length !== 1) return;
    const categoryTypeId = selectedCategoryTypes[0].id;
    const productFamilyId = selectedProductFamily.id;
    const snap = await getDocs(query(collection(db, "technicalSpecifications"), where("categoryTypeId", "==", categoryTypeId), where("productFamilyId", "==", productFamilyId)));
    const batch = writeBatch(db);
    const updatedSpecs = [...technicalSpecs];
    snap.forEach(docSnap => {
      const exists = updatedSpecs.find(s => s.id === docSnap.id);
      if (!exists) batch.delete(docSnap.ref);
    });
    for (let i = 0; i < updatedSpecs.length; i++) {
      const spec = updatedSpecs[i];
      if (!spec.title.trim()) continue;
      let ref;
      if (spec.id) ref = doc(db, "technicalSpecifications", spec.id);
      else { ref = doc(collection(db, "technicalSpecifications")); updatedSpecs[i].id = ref.id; }
      batch.set(ref, { categoryTypeId, productFamilyId, title: spec.title, specs: spec.specs, sortOrder: i + 1, isActive: true, updatedAt: serverTimestamp() });
    }
    await batch.commit();
    setTechnicalSpecs(updatedSpecs);
  };

  const syncProductsUsingThisFamily = async () => {
    if (!selectedProductFamily) return;
    const q = query(collection(db, "products"), where("productFamilies", "array-contains", { productFamilyId: selectedProductFamily.id, productFamilyName: selectedProductFamily.name, productUsageId: selectedProductFamily.productUsageId }));
    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const CHUNK_SIZE = 200;
    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(productDoc => {
        const ref = doc(db, "products", productDoc.id);
        const data: any = productDoc.data();
        const existingSpecs = data.technicalSpecifications || [];
        const mergedSpecs = technicalSpecs.map((templateSpec, index) => {
          const existingSpec = existingSpecs.find((s: any) => s.technicalSpecificationId === templateSpec.id);
          return {
            technicalSpecificationId: templateSpec.id,
            title: templateSpec.title,
            sortOrder: index + 1,
            specs: templateSpec.specs.map((templateRow: SpecRow) => {
              const existingRow = existingSpec?.specs?.find((r: SpecRow) => r.specId === templateRow.specId);
              return { specId: templateRow.specId, value: productDoc.id === productId ? templateRow.value || "" : existingRow?.value || "" };
            }),
          };
        });
        batch.update(ref, { technicalSpecifications: mergedSpecs, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
  };

  const uploadToCloudinary = async (file: File) => {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload-product", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    if (!data.secure_url || !data.public_id) throw new Error("Invalid response");
    return data;
  };

  const uploadProductMedia = async (pid: string) => {
    try {
      if (mainImage) { const r = await uploadToCloudinary(mainImage); await updateDoc(doc(db, "products", pid), { mainImage: { name: mainImage.name, url: r.secure_url, publicId: r.public_id } }); }
      if (dimensionalDrawing) { const r = await uploadToCloudinary(dimensionalDrawing); await updateDoc(doc(db, "products", pid), { dimensionalDrawing: { name: dimensionalDrawing.name, url: r.secure_url, publicId: r.public_id } }); }
      if (illuminanceDrawing) { const r = await uploadToCloudinary(illuminanceDrawing); await updateDoc(doc(db, "products", pid), { illuminanceDrawing: { name: illuminanceDrawing.name, url: r.secure_url, publicId: r.public_id } }); }
      await updateDoc(doc(db, "products", pid), { mediaStatus: "done" });
    } catch { await updateDoc(doc(db, "products", pid), { mediaStatus: "failed" }); }
  };

  const updateMultiRow = (index: number, field: keyof MultiRow, value: string | number) => {
    setMultiRows(prev => prev.map((row, i) =>
      i === index
        ? {
            ...row,
            [field]: typeof value === "number"
              ? value
              : field === "itemName"
              ? value
              : Number(value) || 0,
          }
        : row,
    ));
  };

  const addMultiRow = (index: number) => {
    setMultiRows(prev => {
      const copy = [...prev];
      copy.splice(index + 1, 0, {
        itemName: "",
        unitCost: 0,
        length: 0,
        width: 0,
        height: 0,
        qtyPerCarton: 1,
        landed: 0,
        srp: 0,
      });
      // Redistribute total unit cost if it exists
      if (totalUnitCost > 0) {
        const distributedCost = totalUnitCost / copy.length;
        return copy.map(row => ({ ...row, unitCost: distributedCost }));
      }
      return copy;
    });
  };

  const removeMultiRow = (index: number) => {
    setMultiRows(prev => {
      const newRows = prev.length > 1 ? prev.filter((_, i) => i !== index) : prev;
      // Redistribute total unit cost if it exists
      if (totalUnitCost > 0 && newRows.length > 0) {
        const distributedCost = totalUnitCost / newRows.length;
        return newRows.map(row => ({ ...row, unitCost: distributedCost }));
      }
      return newRows;
    });
  };

  const distributeTotalUnitCost = (total: number, rows: MultiRow[]) => {
    if (total > 0 && rows.length > 0) {
      const distributedCost = total / rows.length;
      return rows.map(row => ({ ...row, unitCost: distributedCost }));
    }
    return rows;
  };

  const formatPHP = (value: number, decimals = 2) => {
    return value.toLocaleString("en-PH", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  useEffect(() => {
    if (commercialType === "POLE") {
      let lc = 0;
      if (Number(unitCost) > 0 && qtyPerContainer > 0) {
        lc = (Number(unitCost) * 65 + 520000 / qtyPerContainer) * 1.01;
      }
      setLandedCost(lc);
      setSrp(lc ? Math.ceil(lc / 0.45 / 100) * 100 : 0);
      return;
    }

    if (commercialType === "LIGHT" && useArrayInput) {
      let grandTotal = 0;
      const updated = multiRows.map((row) => {
        const cbm = (row.length * row.width * row.height) / 1_000_000;
        let landed = 0;
        let srp = 0;
        if (cbm > 0 && row.qtyPerCarton > 0) {
          const shippingPerItem = 520000 / ((65 / cbm) * row.qtyPerCarton);
          landed = (row.unitCost * 65 + shippingPerItem) * 1.01;
          srp = Math.ceil(landed / 0.35 / 10) * 10;
        }
        grandTotal += landed;
        return { ...row, landed, srp };
      });
      setMultiRows(updated);
      setLandedCost(grandTotal);
      setSrp(grandTotal ? Math.ceil(grandTotal / 0.35 / 100) * 100 : 0);
      return;
    }

    if (commercialType === "LIGHT" && !useArrayInput) {
      let lc = 0;
      const cbm = (Number(packLength) * Number(packWidth) * Number(packHeight)) / 1_000_000;
      if (cbm > 0 && Number(pcsPerCarton) > 0 && Number(unitCost) > 0) {
        const shippingPerItem = 520000 / ((65 / cbm) * Number(pcsPerCarton));
        lc = (Number(unitCost) * 65 + shippingPerItem) * 1.01;
      }
      setLandedCost(lc);
      setSrp(lc ? Math.ceil(lc / 0.35 / 10) * 10 : 0);
      return;
    }

    setLandedCost(0);
    setSrp(0);
  }, [commercialType, useArrayInput, qtyPerContainer, unitCost, packLength, packWidth, packHeight, pcsPerCarton, multiRows.map(r => `${r.unitCost}-${r.length}-${r.width}-${r.height}-${r.qtyPerCarton}`).join("|")]);

  /* ---------------- Save ---------------- */
const handleSaveProduct = async () => {
    if (saving) return;
    try {
      setSaving(true);
      if (!selectedSupplier && !noSupplier) { toast.error("Please select a supplier"); return; }
      if (!noSupplier && !pricePoint) { toast.error("Please select price point"); return; }
      if (!noSupplier && !brandOrigin) { toast.error("Please select brand origin"); return; }
      if (!productClass) { toast.error("Please select product class"); return; }

      const profile = userId ? await getApprovalUserProfile(userId) : null;
      const requiresApproval = shouldRequireApproval(profile);
      if (requiresApproval) {
        setRequestApprovalOpen(true);
        return;
      }

      const productRef = doc(db, "products", productId!);
      await syncTemplateChangesToFamily();

      // Prepare packaging data
      const packagingData = {
        length: packLength ? `${parseFloat(packLength)} cm` : null,
        width: packWidth ? `${parseFloat(packWidth)} cm` : null,
        height: packHeight ? `${parseFloat(packHeight)} cm` : null,
      };

      const pcsPerCartonValue = pcsPerCarton ? parseInt(pcsPerCarton) : null;

      await updateDoc(productRef, {
        mainImage: mainImage
          ? null
          : imageLink
          ? { name: "external-image", url: imageLink, publicId: null }
          : null,
        dimensionalDrawing: dimensionalDrawing
          ? null
          : dimensionalLink
          ? { name: "external-image", url: dimensionalLink, publicId: null }
          : null,
        illuminanceDrawing: illuminanceDrawing
          ? null
          : illuminanceLink
          ? { name: "external-image", url: illuminanceLink, publicId: null }
          : null,
        pricePoint: noSupplier ? "ECONOMY" : pricePoint,
        brandOrigin: noSupplier ? "CHINA" : brandOrigin,
        countries: countries,
        productClass,
        supplier: noSupplier ? null : { supplierId: selectedSupplier!.supplierId, company: selectedSupplier!.company, supplierBrand: selectedSupplierBrand?.supplierBrand || "" },
        productFamilies: selectedProductFamily ? [{ productFamilyId: selectedProductFamily.id, productFamilyName: selectedProductFamily.name, productUsageId: selectedProductFamily.productUsageId }] : [],
        categoryTypes: selectedCategoryTypes.map(c => ({ productUsageId: c.id, categoryTypeName: c.name })),
        commercialDetails: {
          commercialType,
          calculationType: commercialType === "LIGHT" ? "LIGHTS" : commercialType === "POLE" ? "POLE" : null,
          unitCost: unitCost ? parseFloat(unitCost) : null,
          packaging: packagingData,
          pcsPerCarton: pcsPerCartonValue,
          qtyPerContainer: commercialType === "POLE" ? qtyPerContainer : null,
          useArrayInput: commercialType === "LIGHT" ? useArrayInput : false,
          totalUnitCost: commercialType === "LIGHT" && useArrayInput ? totalUnitCost : null,
          multiRows: commercialType === "LIGHT" ? multiRows : [],
          landedCost: landedCost || null,
          srp: srp || null,
          moq: moq ? parseInt(moq) : null,
          warranty: warrantyNumber ? `${warrantyNumber} ${warrantyPeriod}` : null,
          factoryAddress: factoryAddress || "",
          portOfDischarge: portOfDischarge || "",
        },
        technicalSpecifications: technicalSpecs.filter(s => s.title.trim()).map((s, index) => ({
          technicalSpecificationId: s.id || "",
          title: s.title,
          sortOrder: index + 1,
          specs: s.specs.filter(r => r.specId.trim()).map(r => ({ specId: r.specId.trim(), value: r.value?.trim() || "" })),
        })),
        ...((mainImage || dimensionalDrawing || illuminanceDrawing) && { mediaStatus: "pending" }),
        createdBy: userId,
        referenceID: user?.ReferenceID || null,
        isActive: true,
        updatedAt: serverTimestamp(),
        whatHappened: "Product Edited",
        date_updated: serverTimestamp(),
      });

      await syncProductsUsingThisFamily();

      if (mainImage || dimensionalDrawing || illuminanceDrawing) {
        await uploadProductMedia(productId!);
      }

      // ✅ AUDIT LOG
      await logProductEvent({
        whatHappened: "Product Edited",
        productId: productId!,
        productClass,
        pricePoint: noSupplier ? "ECONOMY" : pricePoint,
        brandOrigin: noSupplier ? "CHINA" : brandOrigin,
        countries: countries,
        supplier: noSupplier ? null : {
          supplierId: selectedSupplier!.supplierId,
          company: selectedSupplier!.company,
          supplierBrand: selectedSupplierBrand?.supplierBrand || "",
        },
        categoryTypes: selectedCategoryTypes.map(c => ({ productUsageId: c.id, categoryTypeName: c.name })),
        productFamilies: selectedProductFamily
          ? [{ productFamilyId: selectedProductFamily.id, productFamilyName: selectedProductFamily.name }]
          : [],
        mainImage: imageLink ? { url: imageLink } : null,
        dimensionalDrawing: dimensionalLink ? { url: dimensionalLink } : null,
        illuminanceDrawing: illuminanceLink ? { url: illuminanceLink } : null,
        technicalSpecifications: technicalSpecs.filter(s => s.title.trim()).map(s => ({
          technicalSpecificationId: s.id || "",
          title: s.title,
          specs: s.specs.filter(r => r.specId.trim()).map(r => ({ specId: r.specId.trim(), value: r.value?.trim() || "" })),
        })),
        referenceID: user?.ReferenceID,
        userId: userId ?? undefined,
      });

      toast.success("Product saved successfully");

      if (userId) {
        onProductUpdated({
          userId,
          productName: productReferenceID || "Unknown Product",
          productId: productId!,
          url: "/products",
        });
      }

      router.push("/products");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save product");
    } finally { setSaving(false); }
  };

  const handleRequestApproval = async (message: string) => {
    try {
      if (!userId || !productId) return;
      setRequestingApproval(true);
      const profile = await getApprovalUserProfile(userId);
      if (!profile) {
        toast.error("User profile not loaded");
        return;
      }
      await createApprovalRequest({
        actionType: "product_edit",
        entityLabel: productId,
        requester: profile,
        message,
        summary: `Edit product: ${productId}`,
        payload: {
          productId,
          productClass,
          pricePoint: noSupplier ? "ECONOMY" : pricePoint,
          brandOrigin: noSupplier ? "CHINA" : brandOrigin,
          countries: countries,
          supplier: noSupplier ? null : {
            supplierId: selectedSupplier?.supplierId ?? null,
            company: selectedSupplier?.company ?? "",
            supplierBrand: selectedSupplierBrand?.supplierBrand || "",
          },
          categoryTypes: selectedCategoryTypes.map(c => ({ productUsageId: c.id, categoryTypeName: c.name })),
          productFamilies: selectedProductFamily
            ? [{ productFamilyId: selectedProductFamily.id, productFamilyName: selectedProductFamily.name }]
            : [],
          commercialDetails: {
            commercialType,
            calculationType: commercialType === "LIGHT" ? "LIGHTS" : commercialType === "POLE" ? "POLE" : null,
            unitCost: unitCost ? parseFloat(unitCost) : null,
            packaging: {
              length: packLength ? `${parseFloat(packLength)} cm` : null,
              width: packWidth ? `${parseFloat(packWidth)} cm` : null,
              height: packHeight ? `${parseFloat(packHeight)} cm` : null,
            },
            pcsPerCarton: pcsPerCarton ? parseInt(pcsPerCarton) : null,
            qtyPerContainer: commercialType === "POLE" ? qtyPerContainer : null,
            useArrayInput: commercialType === "LIGHT" ? useArrayInput : false,
            multiRows: commercialType === "LIGHT" ? multiRows : [],
            landedCost: landedCost || null,
            srp: srp || null,
            moq: moq ? parseInt(moq) : null,
            warranty: warrantyNumber ? `${warrantyNumber} ${warrantyPeriod}` : null,
            factoryAddress: factoryAddress || "",
            portOfDischarge: portOfDischarge || "",
          },
          mainImage: imageLink || null,
          dimensionalDrawing: dimensionalLink || null,
          illuminanceDrawing: illuminanceLink || null,
          technicalSpecifications: technicalSpecs.filter(s => s.title.trim()).map(s => ({
            technicalSpecificationId: s.id || "",
            title: s.title,
            specs: s.specs.filter(r => r.specId.trim()).map(r => ({ specId: r.specId.trim(), value: r.value?.trim() || "" })),
          })),
        },
      });
      await logProductEvent({
        whatHappened: "Product For Approval Requested",
        productId,
        productClass,
        pricePoint: noSupplier ? "ECONOMY" : pricePoint,
        brandOrigin: noSupplier ? "CHINA" : brandOrigin,
        countries: countries,
        referenceID: profile.referenceID,
        userId,
      });
      toast.success("Request sent for approval");
      setRequestApprovalOpen(false);
      router.push("/products");
    } catch (error) {
      console.error("Request approval failed:", error);
      toast.error("Failed to send approval request");
    } finally {
      setRequestingApproval(false);
    }
  };

  const filteredCategoryTypes = React.useMemo(() => categoryTypes.filter(i => i.name.toLowerCase().includes(categoryTypeSearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [categoryTypes, categoryTypeSearch]);
  const filteredProductFamilies = React.useMemo(() => productFamilies.filter(i => selectedCategoryTypes.map(c => c.id).includes(i.productUsageId) && i.name.toLowerCase().includes(productFamilySearch.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)), [productFamilies, productFamilySearch, selectedCategoryTypes]);

  if (loading) return null;

  const ImageUploadCard = ({ label, file, previewUrl, link, onFile, onLink }: { label: string; file: File | null; previewUrl: string | null; link: string; onFile: (f: File | null) => void; onLink: (l: string, p: string) => void }) => (
    <Card>
      <CardHeader><CardTitle className="text-center text-xs font-bold uppercase tracking-wide">{label}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label
          className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl h-40 cursor-pointer hover:border-blue-400 transition bg-gray-50"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) onFile(f); else toast.error("Only image files allowed"); }}
        >
          {previewUrl ? <img src={previewUrl} className="h-full w-full object-contain rounded-xl p-1" /> : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <ImagePlus className="h-8 w-8" />
              <span className="text-xs">Tap or drag image</span>
            </div>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={e => onFile(e.target.files?.[0] || null)} />
        </label>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Or paste image link</Label>
          <Input placeholder="https://..." value={link} onChange={e => { const orig = e.target.value; onLink(orig, convertDriveToThumbnail(orig)); }} className="text-xs" />
        </div>
      </CardContent>
    </Card>
  );

  return (
<>
<div className="h-screen overflow-hidden">
  <div className="h-full overflow-y-auto px-6 pb-35">

      <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => router.push("/products")} className="flex items-center gap-1 text-gray-600">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Products</span>
          </button>
          <h1 className="text-sm font-bold text-gray-900">Edit Product</h1>
          <Button size="sm" onClick={handleSaveProduct} disabled={saving} className="h-8 rounded-xl text-xs px-3">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="hidden md:block p-6 pb-0">
        <SidebarTrigger />
        <h1 className="text-2xl font-bold mt-4">
          Edit Product — {user?.Firstname} {user?.Lastname}
          <span className="ml-2 text-sm font-normal text-muted-foreground">({user?.Role})</span>
        </h1>
        <Separator className="mt-4" />
      </div>

      <div className="p-4 md:p-6 pb-28 md:pb-10 space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 md:gap-6">

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm text-center">PRODUCT IMAGES</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <label
                  className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl h-52 cursor-pointer hover:border-blue-400 transition bg-gray-50"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) handleImageChange(f); else toast.error("Only image files allowed"); }}
                >
                  {preview ? <img src={preview} className="h-full w-full object-contain p-2" /> : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <ImagePlus className="h-10 w-10" />
                      <span className="text-sm">Tap or drag main image here</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageChange(e.target.files?.[0] || null)} />
                </label>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Or paste image link</Label>
                  <Input placeholder="https://..." value={imageLink} onChange={e => { const orig = e.target.value; setImageLink(orig); setMainImage(null); setPreview(convertDriveToThumbnail(orig)); }} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ImageUploadCard label="Dimensional Drawing" file={dimensionalDrawing} previewUrl={dimensionalPreview} link={dimensionalLink} onFile={handleDimensionalChange} onLink={(orig, conv) => { setDimensionalLink(orig); setDimensionalDrawing(null); setDimensionalPreview(conv); }} />
                  <ImageUploadCard label="Illuminance Drawing" file={illuminanceDrawing} previewUrl={illuminancePreview} link={illuminanceLink} onFile={handleIlluminanceChange} onLink={(orig, conv) => { setIlluminanceLink(orig); setIlluminanceDrawing(null); setIlluminancePreview(conv); }} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm">Supplier & Classification</CardTitle>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAddSupplierOpen(true)}
                  >
                    Add Supplier
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!selectedSupplier}
                    onClick={() => setEditSupplierOpen(true)}
                  >
                    Edit Supplier
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={noSupplier} onChange={e => { setNoSupplier(e.target.checked); if (e.target.checked) { setSelectedSupplier(null); setSelectedSupplierBrand(null); setPricePoint("ECONOMY"); setBrandOrigin("CHINA"); setCountries([]); } }} className="rounded" />
                  No supplier for this product
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Supplier / Company</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" disabled={noSupplier} className="w-full justify-between text-sm h-10">
                          <span className="truncate">{selectedSupplier ? selectedSupplier.company : "Select supplier..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-72">
                        <Command>
                          <CommandInput placeholder="Search supplier..." />
                          <CommandEmpty>No supplier found.</CommandEmpty>
                          <CommandGroup>
                            {suppliers.map(s => (
                              <CommandItem key={s.supplierId} value={s.company} onSelect={() => { setSelectedSupplier(s); setSelectedSupplierBrand(s); }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedSupplier?.supplierId === s.supplierId ? "opacity-100" : "opacity-0")} />
                                <span className="truncate">{s.company}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Supplier Brand</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" disabled={noSupplier} className="w-full justify-between text-sm h-10">
                          <span className="truncate">{selectedSupplierBrand ? selectedSupplierBrand.supplierBrand || "No brand" : "Select brand..."}</span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-72">
                        <Command>
                          <CommandInput placeholder="Search brand..." />
                          <CommandEmpty>No brand found.</CommandEmpty>
                          <CommandGroup>
                            {suppliers.map(s => (
                              <CommandItem key={s.supplierId} value={s.supplierBrand} onSelect={() => { setSelectedSupplierBrand(s); setSelectedSupplier(s); }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedSupplierBrand?.supplierId === s.supplierId ? "opacity-100" : "opacity-0")} />
                                <span className="truncate">{s.supplierBrand || "No Brand"}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Price Point</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" disabled={noSupplier} className="w-full justify-between text-sm h-10 uppercase">
                          {noSupplier ? "ECONOMY" : pricePoint || "Select..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-56">
                        <Command>
                          <CommandGroup>
                            {["ECONOMY", "MID-END", "HIGH-END"].map(item => (
                              <CommandItem key={item} value={item} onSelect={() => setPricePoint(item)}>
                                <Check className={cn("mr-2 h-4 w-4", pricePoint === item ? "opacity-100" : "opacity-0")} />{item}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Brand Origin</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" disabled={noSupplier} className="w-full justify-between text-sm h-10 uppercase">
                          {noSupplier ? "CHINA" : brandOrigin || "Select..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-56">
                        <Command>
                          <CommandGroup>
                            {["CHINA", "NON-CHINA"].map(item => (
                              <CommandItem key={item} value={item} onSelect={() => setBrandOrigin(item)}>
                                <Check className={cn("mr-2 h-4 w-4", brandOrigin === item ? "opacity-100" : "opacity-0")} />{item}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs text-gray-500">Available Countries</Label>
                    {noSupplier ? (
                      <>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between text-sm h-10">
                              <span className="truncate">{countries.length > 0 ? `${countries.length} countries selected` : "Select countries..."}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-72 max-h-80 overflow-y-auto">
                            <Command>
                              <CommandInput placeholder="Search country..." />
                              <CommandEmpty>No country found.</CommandEmpty>
                              <CommandGroup>
                                {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                                  <CommandItem
                                    key={code}
                                    value={code}
                                    onSelect={() => {
                                      setCountries(prev =>
                                        prev.includes(code)
                                          ? prev.filter(c => c !== code)
                                          : [...prev, code]
                                      );
                                    }}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", countries.includes(code) ? "opacity-100" : "opacity-0")} />
                                    {name} ({code})
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {countries.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {countries.map(code => (
                              <span key={code} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded flex items-center gap-1">
                                {COUNTRY_NAMES[code] || code} ({code})
                                <button
                                  type="button"
                                  onClick={() => setCountries(prev => prev.filter(c => c !== code))}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="w-full">
                        {countries.length > 0 ? (
                          <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-gray-50">
                            {countries.map(code => (
                              <span key={code} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                {COUNTRY_NAMES[code] || code} ({code})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 p-2 border rounded-md bg-gray-50">
                            Auto-populated from supplier
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs text-gray-500">Product Class</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between text-sm h-10 uppercase">
                          {productClass || "Select product class..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="p-0 w-56">
                        <Command>
                          <CommandGroup>
                            {["STANDARD", "SPF"].map(item => (
                              <CommandItem key={item} value={item} onSelect={() => setProductClass(item)}>
                                <Check className={cn("mr-2 h-4 w-4", productClass === item ? "opacity-100" : "opacity-0")} />{item}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* COMMERCIAL DETAILS - UNIFIED SINGLE CARD */}
            <Card>
              <CardHeader><CardTitle className="text-sm text-center">COMMERCIAL DETAILS</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Commercial Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["BASIC", "LIGHT", "POLE"] as const).map((mode) => (
                      <Button
                        key={mode}
                        size="sm"
                        variant={commercialType === mode ? "secondary" : "outline"}
                        className="h-9 text-xs"
                        onClick={() => setCommercialType(mode)}
                      >
                        {mode.charAt(0) + mode.slice(1).toLowerCase()}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* BASIC-only fields */}
                {commercialType === "BASIC" && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Unit Cost (USD)</Label>
                      <Input type="number" step="0.01" placeholder="0.00" value={unitCost} onChange={e => setUnitCost(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Packaging (cm) — L × W × H</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input type="number" step="0.01" placeholder="Length" value={packLength} onChange={e => setPackLength(e.target.value)} />
                        <Input type="number" step="0.01" placeholder="Width" value={packWidth} onChange={e => setPackWidth(e.target.value)} />
                        <Input type="number" step="0.01" placeholder="Height" value={packHeight} onChange={e => setPackHeight(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">pcs / carton</Label>
                      <Input type="number" step="1" placeholder="0" value={pcsPerCarton} onChange={e => setPcsPerCarton(e.target.value)} />
                    </div>
                  </>
                )}

                {/* LIGHT/POLE specific fields */}
                {commercialType !== "BASIC" && (
                  <>
                    <Separator />
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Calculation Type</Label>
                      <Input readOnly value={commercialType === "LIGHT" ? "Lights" : "Pole"} className="bg-gray-50" />
                    </div>

                    {commercialType === "LIGHT" && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={useArrayInput}
                          onCheckedChange={(v) => {
                            const newValue = !!v;
                            setUseArrayInput(newValue);
                            setUnitCost("");
                            setPackLength("");
                            setPackWidth("");
                            setPackHeight("");
                            setPcsPerCarton("");
                            setTotalUnitCost(0);
                            setMultiRows([
                              {
                                itemName: "",
                                unitCost: 0,
                                length: 0,
                                width: 0,
                                height: 0,
                                qtyPerCarton: 1,
                                landed: 0,
                                srp: 0,
                              },
                            ]);
                          }}
                        />
                        <Label className="text-sm">Multiple Dimensions ?</Label>
                      </div>
                    )}

                    {commercialType === "LIGHT" && !useArrayInput && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left text-xs font-semibold text-gray-500 py-2 pr-2 whitespace-nowrap min-w-[130px]">Unit Cost (USD)</th>
                              <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[100px]">Length (cm)</th>
                              <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[100px]">Width (cm)</th>
                              <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[100px]">Height (cm)</th>
                              <th className="text-left text-xs font-semibold text-gray-500 py-2 pl-2 whitespace-nowrap min-w-[90px]">Qty/Box</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="py-1.5 pr-2">
                                <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="h-8 text-sm" />
                              </td>
                              <td className="py-1.5 px-2">
                                <Input type="number" placeholder="0" value={packLength} onChange={(e) => setPackLength(e.target.value)} className="h-8 text-sm" />
                              </td>
                              <td className="py-1.5 px-2">
                                <Input type="number" placeholder="0" value={packWidth} onChange={(e) => setPackWidth(e.target.value)} className="h-8 text-sm" />
                              </td>
                              <td className="py-1.5 px-2">
                                <Input type="number" placeholder="0" value={packHeight} onChange={(e) => setPackHeight(e.target.value)} className="h-8 text-sm" />
                              </td>
                              <td className="py-1.5 pl-2">
                                <Input type="number" placeholder="0" value={pcsPerCarton} onChange={(e) => setPcsPerCarton(e.target.value)} className="h-8 text-sm" />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {commercialType === "LIGHT" && useArrayInput && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="space-y-1 flex-1 max-w-50">
                            <Label className="text-xs text-gray-500">Total Unit Cost (USD)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={totalUnitCost || ""}
                              onChange={(e) => {
                                const newTotal = Number(e.target.value) || 0;
                                setTotalUnitCost(newTotal);
                                setMultiRows(prev => distributeTotalUnitCost(newTotal, prev));
                              }}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="text-xs text-gray-500 pt-5">
                            {multiRows.length > 0 && totalUnitCost > 0 && (
                              <span>Each row: {(totalUnitCost / multiRows.length).toFixed(2)} USD</span>
                            )}
                          </div>
                        </div>
                        <Label className="text-xs text-gray-500">Multiple Packaging Dimensions</Label>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 pr-2 whitespace-nowrap min-w-[120px]">Item Name</th>
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[110px]">Unit Cost (USD)</th>
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[100px]">Length (cm)</th>
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[100px]">Width (cm)</th>
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[100px]">Height (cm)</th>
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[80px]">Qty/Box</th>
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[110px]">Landed (PHP)</th>
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 px-2 whitespace-nowrap min-w-[100px]">SRP (PHP)</th>
                                <th className="text-left text-xs font-semibold text-gray-500 py-2 pl-2 whitespace-nowrap min-w-[70px]">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {multiRows.map((row, index) => (
                                <tr key={index} className="border-b border-gray-100">
                                  <td className="py-1.5 pr-2">
                                    <Input value={row.itemName} onChange={(e) => updateMultiRow(index, "itemName", e.target.value)} className="h-8 text-sm" />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input type="number" value={row.unitCost || ""} disabled className="h-8 text-sm bg-gray-50" />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input type="number" value={row.length || ""} onChange={(e) => updateMultiRow(index, "length", Number(e.target.value))} className="h-8 text-sm" />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input type="number" value={row.width || ""} onChange={(e) => updateMultiRow(index, "width", Number(e.target.value))} className="h-8 text-sm" />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input type="number" value={row.height || ""} onChange={(e) => updateMultiRow(index, "height", Number(e.target.value))} className="h-8 text-sm" />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input type="number" value={row.qtyPerCarton || ""} onChange={(e) => updateMultiRow(index, "qtyPerCarton", Number(e.target.value))} className="h-8 text-sm" />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input disabled value={formatPHP(row.landed, 2)} className="h-8 text-sm bg-gray-50" />
                                  </td>
                                  <td className="py-1.5 px-2">
                                    <Input disabled value={formatPHP(row.srp, 0)} className="h-8 text-sm bg-gray-50" />
                                  </td>
                                  <td className="py-1.5 pl-2">
                                    <div className="flex gap-1">
                                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => addMultiRow(index)}>
                                        <Plus className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button size="icon" variant="outline" className="h-8 w-8" disabled={multiRows.length === 1} onClick={() => removeMultiRow(index)}>
                                        <Minus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {commercialType === "POLE" && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Unit Cost (USD)</Label>
                          <Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Quantity Per Container</Label>
                          <Input type="number" min={1} value={qtyPerContainer} onChange={(e) => setQtyPerContainer(Number(e.target.value))} />
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Landed Cost (PHP)</Label>
                        <Input readOnly value={formatPHP(landedCost, 2)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">SRP (PHP)</Label>
                        <Input readOnly value={formatPHP(srp, 0)} />
                      </div>
                    </div>
                  </>
                )}

                {/* Common fields for all types */}
                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Minimum Order Quantity (MOQ)</Label>
                    <Input type="number" placeholder="0" value={moq} onChange={e => setMoq(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Warranty</Label>
                    <div className="flex gap-2">
                      <Input type="number" placeholder="0" value={warrantyNumber} onChange={e => setWarrantyNumber(e.target.value)} className="flex-1" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-28 justify-between text-sm h-10">
                            {warrantyPeriod || "Select..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-28">
                          <Command>
                            <CommandGroup>
                              {(["days", "months", "years"] as const).map((period) => (
                                <CommandItem key={period} value={period} onSelect={() => setWarrantyPeriod(period)}>
                                  <Check className={cn("mr-2 h-4 w-4", warrantyPeriod === period ? "opacity-100" : "opacity-0")} />
                                  {period.charAt(0).toUpperCase() + period.slice(1)}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Factory Address</Label>
                  <textarea className="w-full border rounded-xl p-2.5 text-sm bg-white resize-none" rows={3} placeholder="Enter factory address..." value={factoryAddress} onChange={e => setFactoryAddress(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Port of Discharge</Label>
                  <Input placeholder="e.g. Manila, PH" value={portOfDischarge} onChange={e => setPortOfDischarge(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Technical Specifications</Label>
                <Button size="sm" variant="outline" onClick={addTechnicalSpec} className="h-8 text-xs rounded-xl">+ Add Group</Button>
              </div>
              <div className="max-h-150 overflow-y-auto pr-1 space-y-3">
                {technicalSpecs.map((item, index) => (
                  <Card key={index} draggable onDragStart={() => handleDragStart(index)} onDragOver={handleDragOver} onDrop={() => handleDrop(index)} className="border-2 border-blue-200 bg-blue-50 cursor-move">
                    <CardContent className="p-3 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-orange-600 tracking-widest block text-center">Group Title</Label>
                        <div className="flex gap-2">
                          <Input className="border-orange-300 bg-white text-sm" placeholder="e.g. ELECTRICAL" value={item.title} onChange={e => updateTitle(index, e.target.value.toUpperCase())} />
                          {item.id && classificationType && selectedProductFamily && selectedCategoryTypes.length === 1 ? (
                            <AddProductDeleteTechnicalSpecification classificationId={classificationType.id} productUsageId={selectedCategoryTypes[0].id} productFamilyId={selectedProductFamily.id} technicalSpecificationId={item.id} title={item.title} referenceID={user?.ReferenceID || ""} />
                          ) : (
                            <Button size="icon" variant="outline" className="border-orange-400 text-orange-600 shrink-0" disabled={technicalSpecs.length === 1} onClick={() => removeTechnicalSpec(index)}><Minus className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </div>
                      {item.specs.map((row, rIndex) => (
                        <div key={rIndex} draggable onDragStart={() => handleRowDragStart(index, rIndex)} onDragOver={e => e.preventDefault()} onDrop={() => handleRowDrop(index, rIndex)} className="border-2 border-orange-200 rounded-xl p-3 bg-orange-50 space-y-2 cursor-move">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px] text-blue-600 font-bold uppercase">Specification</Label>
                              <Input className="border-blue-300 bg-white text-sm" placeholder="e.g. Wattage" value={row.specId ?? ""} onChange={e => updateSpecField(index, rIndex, "specId", e.target.value)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-orange-600 font-bold uppercase">Value</Label>
                              <Input className="border-orange-300 bg-white text-sm" placeholder="e.g. 40W" value={row.value ?? ""} onChange={e => updateSpecField(index, rIndex, "value", e.target.value)} />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" className="border-blue-400 text-blue-700 h-7 px-2.5 text-xs" onClick={() => addSpecRow(index)}><Plus className="h-3 w-3 mr-1" /> Row</Button>
                            <Button size="sm" variant="outline" className="border-orange-400 text-orange-700 h-7 px-2.5 text-xs" disabled={item.specs.length === 1} onClick={() => removeSpecRow(index, rIndex)}><Minus className="h-3 w-3 mr-1" /> Remove</Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto lg:pb-6">
            <Card>
              <CardHeader><CardTitle className="text-sm text-center">SELECT PRODUCT USAGE</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input value={categoryTypeSearch} onChange={e => setCategoryTypeSearch(e.target.value)} placeholder="Search usage..." className="h-9" />
                <div className="flex gap-2">
                  <Input value={newCategoryType} onChange={e => setNewCategoryType(e.target.value)} placeholder="Add new usage..." className="h-9" />
                  <Button size="icon" variant="outline" onClick={handleAddCategoryType} className="h-9 w-9 shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
                <Separator />
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {filteredCategoryTypes.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input type="radio" name="categoryType" checked={selectedCategoryTypes.length === 1 && selectedCategoryTypes[0].id === item.id} onChange={() => setSelectedCategoryTypes([{ id: item.id, name: item.name }])} className="shrink-0" />
                        <span className="text-sm truncate">{item.name}</span>
                      </label>
                      <div className="flex gap-1 shrink-0">
                        <AddProductSelectProductType item={item} />
                        <AddProductDeleteProductType item={item} referenceID={user?.ReferenceID || ""} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm text-center">SELECT PRODUCT FAMILY</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input value={productFamilySearch} onChange={e => setProductFamilySearch(e.target.value)} placeholder="Search family..." disabled={selectedCategoryTypes.length === 0} className="h-9" />
                <div className="flex gap-2">
                  <Input value={newProductType} onChange={e => setNewProductType(e.target.value)} placeholder={selectedCategoryTypes.length === 1 ? "Add product family..." : "Select a usage first"} disabled={selectedCategoryTypes.length !== 1} className="h-9" />
                  <Button size="icon" variant="outline" onClick={handleAddProductType} disabled={selectedCategoryTypes.length !== 1} className="h-9 w-9 shrink-0"><Plus className="h-4 w-4" /></Button>
                </div>
                <Separator />
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {filteredProductFamilies.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                        <input type="radio" name="productType" checked={selectedProductFamily?.id === item.id} onChange={() => selectProductFamily(item)} className="shrink-0" />
                        <span className="text-sm truncate">{item.name}</span>
                      </label>
                      <div className="flex gap-1 shrink-0">
                        <AddProductEditSelectProduct item={item} />
                        <AddProductDeleteProduct item={{ id: item.id, productName: item.name, productUsageId: item.productUsageId }} referenceID={user?.ReferenceID || ""} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="hidden md:flex gap-3 pt-2">
          <Button variant="secondary" onClick={() => router.push("/products")}>Cancel</Button>
          <Button onClick={handleSaveProduct} disabled={saving}>{saving ? "Saving..." : "Save Product"}</Button>
        </div>
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 px-4 py-3 flex gap-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={() => router.push("/products")}>Cancel</Button>
          <Button className="flex-1 rounded-2xl h-11 bg-gray-900 text-white" onClick={handleSaveProduct} disabled={saving}>{saving ? "Saving..." : "Save Product"}</Button>
        </div>
      </div>
    </div>
    </div>
    <RequestApprovalDialog
      open={requestApprovalOpen}
      onOpenChange={setRequestApprovalOpen}
      actionLabel="Edit Product"
      entityLabel={productId || "Product"}
      onConfirm={handleRequestApproval}
      loading={requestingApproval}
    />
    <AddSupplier open={addSupplierOpen} onOpenChange={setAddSupplierOpen} />
    {selectedSupplierData && <EditSupplier open={editSupplierOpen} onOpenChange={setEditSupplierOpen} supplier={selectedSupplierData} />}
</>
  );
}
