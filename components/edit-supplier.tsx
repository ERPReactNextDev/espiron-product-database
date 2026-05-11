"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Plus, Minus, ChevronsUpDown, Check } from "lucide-react";
import {
  getCountries,
  getCountryCallingCode,
  CountryCode,
} from "libphonenumber-js";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

import { useUser } from "@/contexts/UserContext";
import { useNotificationTriggers } from "@/hooks/use-notification-triggers";

import { db } from "@/lib/firebase";
import {
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";

import { logSupplierEvent } from "@/lib/auditlogger"; // ✅ AUDIT
import RequestApprovalDialog from "@/components/request-approval-dialog";

/* ─────────────────────────────────────────────
   Country display helpers
───────────────────────────────────────────── */
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

type CountryOption = {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
};

const ALL_COUNTRIES: CountryOption[] = getCountries()
  .map((code) => {
    try {
      return {
        code,
        name: regionNames.of(code) ?? code,
        dialCode: `+${getCountryCallingCode(code)}`,
        flag: code
          .toUpperCase()
          .replace(/./g, (c) =>
            String.fromCodePoint(127397 + c.charCodeAt(0)),
          ),
      };
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .sort((a, b) => a!.name.localeCompare(b!.name)) as CountryOption[];

/* ─────────────────────────────────────────────
   CountryCombobox
───────────────────────────────────────────── */
type CountryComboboxProps = {
  value: CountryCode;
  onChange: (code: CountryCode, dialCode: string) => void;
};

function CountryCombobox({ value, onChange }: CountryComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = ALL_COUNTRIES.find((c) => c.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-40 justify-between font-normal shrink-0"
        >
          <span className="flex items-center gap-2 truncate">
            <span className="text-base leading-none">{selected?.flag}</span>
            <span className="text-xs text-muted-foreground truncate">
              {selected?.name}
            </span>
          </span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-70 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country…" className="h-9" />
            <CommandList
              className="max-h-60 overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {ALL_COUNTRIES.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.dialCode} ${country.code}`}
                  onSelect={() => {
                    onChange(country.code, country.dialCode);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <span className="text-base">{country.flag}</span>
                  <span className="flex-1 truncate text-sm">{country.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {country.dialCode}
                  </span>
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      value === country.code ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────────────────────────
   PhoneField
───────────────────────────────────────────── */
type PhoneFieldProps = {
  value: string;
  onChange: (val: string) => void;
  defaultCountry?: CountryCode;
};

function PhoneField({
  value,
  onChange,
  defaultCountry = "CN",
}: PhoneFieldProps) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const [localNumber, setLocalNumber] = useState("");

  useEffect(() => {
    if (!value) return;
    const matched = ALL_COUNTRIES.find(
      (c) => value.startsWith(c.dialCode) && c.dialCode.length > 1,
    );
    if (matched) {
      setCountry(matched.code);
      setLocalNumber(value.slice(matched.dialCode.length).trim());
    } else {
      setLocalNumber(value.replace(/^\+/, ""));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCountryChange = (code: CountryCode, dialCode: string) => {
    setCountry(code);
    const digits = localNumber.replace(/\D/g, "");
    onChange(`${dialCode}${digits}`);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d\s\-().]/g, "");
    setLocalNumber(raw);
    const dialCode = `+${getCountryCallingCode(country)}`;
    const digits = raw.replace(/\D/g, "");
    onChange(digits ? `${dialCode}${digits}` : "");
  };

  const dialCode = `+${getCountryCallingCode(country)}`;

  return (
    <div className="flex gap-2 items-center w-full">
      <CountryCombobox value={country} onChange={handleCountryChange} />
      <div className="relative flex-1">
        <Input
          value={localNumber}
          onChange={handleNumberChange}
          placeholder="XXX XXXX XXXX"
          inputMode="tel"
        />
      </div>
    </div>
  );
}

import {
  createApprovalRequest,
  getApprovalUserProfile,
  shouldRequireApproval,
} from "@/lib/for-approval";

/* ---------------- Types ---------------- */
type UserDetails = {
  Firstname: string;
  Lastname: string;
  Role: string;
  Email: string;
  ReferenceID: string;
};

type EditSupplierProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: any;
};

type BranchData = {
  address: string;
  country: CountryCode;
  contacts: { name: string; phone: string; type: "phone" | "other" }[];
  emails: string[];
};

/* ---------------- Component ---------------- */
function EditSupplier({ open, onOpenChange, supplier }: EditSupplierProps) {
  const { userId } = useUser();
  const { onSupplierUpdated } = useNotificationTriggers();
  const [user, setUser] = useState<UserDetails | null>(null);

  const [companyError, setCompanyError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isDuplicateCompany, setIsDuplicateCompany] = useState(false);

  const [company, setCompany] = useState("");
  const [supplierBrand, setSupplierBrand] = useState("");
  const [hasMultipleBranches, setHasMultipleBranches] = useState(false);

  // Single branch fields
  const [singleAddress, setSingleAddress] = useState("");
  const [singleCountry, setSingleCountry] = useState<CountryCode>("CN");
  const [singleEmails, setSingleEmails] = useState<string[]>([""]);
  const [singleContactNames, setSingleContactNames] = useState<string[]>([""]);
  const [singleContactNumbers, setSingleContactNumbers] = useState<string[]>([""]);
  const [singleContactTypes, setSingleContactTypes] = useState<("phone" | "other")[]>(["phone"]);

  // Multiple branches fields
  const [branches, setBranches] = useState<BranchData[]>([
    {
      address: "",
      country: "CN",
      contacts: [{ name: "", phone: "", type: "phone" }],
      emails: [""],
    },
  ]);

  const [website, setWebsite] = useState<string[]>([""]);

  const [forteProducts, setForteProducts] = useState<string[]>([""]);
  const [products, setProducts] = useState<string[]>([""]);
  const [certificates, setCertificates] = useState<string[]>([""]);
  const [requestApprovalOpen, setRequestApprovalOpen] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);

  useEffect(() => {
    if (!company.trim()) {
      setCompanyError("");
      setIsDuplicateCompany(false);
      return;
    }

    const checkDuplicateCompany = async () => {
      const snap = await getDocs(collection(db, "suppliers"));
      const exists = snap.docs.some((d) => {
        if (d.id === supplier?.id) return false;
        const data = d.data();
        return (
          data.isActive !== false &&
          data.company?.toLowerCase() === company.toLowerCase()
        );
      });
      if (exists) {
        setCompanyError("Company already exists");
        setIsDuplicateCompany(true);
      } else {
        setCompanyError("");
        setIsDuplicateCompany(false);
      }
    };

    checkDuplicateCompany();
  }, [company, supplier?.id]);

  // Email validation - check both single and multiple branch emails
  useEffect(() => {
    let allEmails: string[] = [];
    if (hasMultipleBranches) {
      allEmails = branches.flatMap((b) => b.emails);
    } else {
      allEmails = singleEmails;
    }
    const invalid = allEmails.some((e) => e && !e.includes("@"));
    setEmailError(invalid ? "One or more emails are invalid" : "");
  }, [singleEmails, branches, hasMultipleBranches]);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users?id=${encodeURIComponent(userId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      })
      .then((data) => {
        setUser({
          Firstname: data.Firstname ?? "",
          Lastname: data.Lastname ?? "",
          Role: data.Role ?? "",
          Email: data.Email ?? "",
          ReferenceID: data.ReferenceID ?? "",
        });
      })
      .catch((err) => console.error("EditSupplier user fetch error:", err));
  }, [userId]);

  useEffect(() => {
    if (!supplier) return;

    setCompany(supplier.company || "");
    setSupplierBrand(supplier.supplierBrand || "");
    setHasMultipleBranches(supplier.hasMultipleBranches || false);

    // Load data based on branch mode
    if (supplier.hasMultipleBranches) {
      if (supplier.branches?.length > 0) {
        setBranches(
          supplier.branches.map((b: any) => ({
            address: b.address || "",
            country: b.country || "CN",
            contacts:
              b.contacts?.length > 0
                ? b.contacts.map((c: any) => ({
                    name: c.name || "",
                    phone: c.phone || "",
                    type: c.type || "phone",
                  }))
                : [{ name: "", phone: "", type: "phone" }],
            emails: b.emails?.length > 0 ? b.emails : [""],
          }))
        );
      } else {
        setBranches([
          { address: "", country: "CN", contacts: [{ name: "", phone: "", type: "phone" }], emails: [""] },
        ]);
      }
    } else {
      setSingleAddress(supplier.address || "");
      setSingleCountry(supplier.country || "CN");
      setSingleEmails(supplier.emails?.length > 0 ? supplier.emails : [""]);

      if (supplier.contacts?.length > 0) {
        setSingleContactNames(supplier.contacts.map((c: any) => c.name || ""));
        setSingleContactNumbers(supplier.contacts.map((c: any) => c.phone ? c.phone.replace(/[^\d+]/g, "") : ""));
        setSingleContactTypes(supplier.contacts.map((c: any) => c.phone && c.phone.startsWith("+") ? "phone" : "other"));
      } else {
        setSingleContactNames([""]);
        setSingleContactNumbers([""]);
        setSingleContactTypes(["phone"]);
      }
    }

    setWebsite(supplier.website?.length > 0 ? supplier.website : [""]);
    setForteProducts(supplier.forteProducts?.length > 0 ? supplier.forteProducts : [""]);
    setProducts(supplier.products?.length > 0 ? supplier.products : [""]);
    setCertificates(supplier.certificates?.length > 0 ? supplier.certificates : [""]);
  }, [supplier]);

  /* ---------------- Helpers ---------------- */
  const updateList = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => setter((prev) => prev.map((item, i) => (i === index ? value : item)));

  const addRowAfter = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) =>
    setter((prev) => {
      const copy = [...prev];
      copy.splice(index + 1, 0, "");
      return copy;
    });

  const removeRow = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
  ) =>
    setter((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);

  // Single branch helpers
  const updateSingleEmail = (index: number, value: string) => {
    setSingleEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  };

  const addSingleEmail = () => setSingleEmails((prev) => [...prev, ""]);
  const removeSingleEmail = (index: number) =>
    setSingleEmails((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const updateSingleContactName = (index: number, value: string) => {
    setSingleContactNames((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const updateSingleContactNumber = (index: number, value: string) => {
    setSingleContactNumbers((prev) => prev.map((n, i) => (i === index ? value : n)));
  };

  const updateSingleContactType = (index: number, value: "phone" | "other") => {
    setSingleContactTypes((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  const addSingleContact = () => {
    setSingleContactNames((prev) => [...prev, ""]);
    setSingleContactNumbers((prev) => [...prev, ""]);
    setSingleContactTypes((prev) => [...prev, "phone"]);
  };

  const removeSingleContact = (index: number) => {
    if (singleContactNames.length === 1) return;
    setSingleContactNames((prev) => prev.filter((_, i) => i !== index));
    setSingleContactNumbers((prev) => prev.filter((_, i) => i !== index));
    setSingleContactTypes((prev) => prev.filter((_, i) => i !== index));
  };

  // Branch helpers
  const updateBranch = (index: number, field: keyof BranchData, value: any) => {
    setBranches((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  };

  const updateBranchEmail = (branchIndex: number, emailIndex: number, value: string) => {
    setBranches((prev) =>
      prev.map((b, i) =>
        i === branchIndex
          ? { ...b, emails: b.emails.map((e, j) => (j === emailIndex ? value : e)) }
          : b
      )
    );
  };

  const addBranchEmail = (branchIndex: number) => {
    setBranches((prev) =>
      prev.map((b, i) => (i === branchIndex ? { ...b, emails: [...b.emails, ""] } : b))
    );
  };

  const removeBranchEmail = (branchIndex: number, emailIndex: number) => {
    setBranches((prev) =>
      prev.map((b, i) =>
        i === branchIndex
          ? { ...b, emails: b.emails.length > 1 ? b.emails.filter((_, j) => j !== emailIndex) : b.emails }
          : b
      )
    );
  };

  const updateBranchContact = (
    branchIndex: number,
    contactIndex: number,
    field: "name" | "phone" | "type",
    value: string
  ) => {
    setBranches((prev) =>
      prev.map((b, i) =>
        i === branchIndex
          ? {
              ...b,
              contacts: b.contacts.map((c, j) =>
                j === contactIndex ? { ...c, [field]: value } : c
              ),
            }
          : b
      )
    );
  };

  const addBranchContact = (branchIndex: number) => {
    setBranches((prev) =>
      prev.map((b, i) =>
        i === branchIndex
          ? { ...b, contacts: [...b.contacts, { name: "", phone: "", type: "phone" }] }
          : b
      )
    );
  };

  const removeBranchContact = (branchIndex: number, contactIndex: number) => {
    setBranches((prev) =>
      prev.map((b, i) =>
        i === branchIndex
          ? {
              ...b,
              contacts:
                b.contacts.length > 1
                  ? b.contacts.filter((_, j) => j !== contactIndex)
                  : b.contacts,
            }
          : b
      )
    );
  };

  const addBranch = () => {
    setBranches((prev) => [
      ...prev,
      { address: "", country: "CN", contacts: [{ name: "", phone: "", type: "phone" }], emails: [""] },
    ]);
  };

  const removeBranch = (index: number) => {
    if (branches.length === 1) return;
    setBranches((prev) => prev.filter((_, i) => i !== index));
  };

  /* ---------------- Save ---------------- */
  const handleSaveSupplier = async () => {
    try {
      if (!company.trim()) { toast.error("Company is required"); return; }
      if (isDuplicateCompany) { toast.error("Company already exists"); return; }
      if (emailError) { toast.error("Please fix invalid email(s)"); return; }

      const profile = userId ? await getApprovalUserProfile(userId) : null;
      const requiresApproval = shouldRequireApproval(profile);
      if (requiresApproval) {
        setRequestApprovalOpen(true);
        return;
      }

      // Build update data based on branch mode
      let updateData: any;

      if (hasMultipleBranches) {
        updateData = {
          supplierId: supplier.id,
          supplierbrandId: supplier.id,
          company: company.trim(),
          supplierBrand: supplierBrand.trim(),
          hasMultipleBranches: true,
          branches: branches.map((b) => ({
            address: b.address,
            country: b.country,
            contacts: b.contacts
              .filter((c) => c.name || c.phone)
              .map((c) => ({
                name: c.name,
                phone: c.phone.replace(/[^\d+]/g, ""),
                type: c.type,
              })),
            emails: b.emails.filter(Boolean),
          })),
          addresses: branches.map((b) => b.address ? `${b.address} (${b.country})` : `(${b.country})`),
          countries: branches.map((b) => b.country),
          website: website.filter(Boolean),
          forteProducts: forteProducts.filter(Boolean),
          products: products.filter(Boolean),
          certificates: certificates.filter(Boolean),
          referenceID: user?.ReferenceID || supplier.referenceID || null,
          whatHappened: "Supplier Edited",
          date_updated: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      } else {
        const singleContacts = singleContactNames
          .map((name, index) => ({
            name,
            phone: singleContactNumbers[index]?.replace(/[^\d+]/g, "") || "",
            type: singleContactTypes[index] || "phone",
          }))
          .filter((c) => c.name || c.phone);

        updateData = {
          supplierId: supplier.id,
          supplierbrandId: supplier.id,
          company: company.trim(),
          supplierBrand: supplierBrand.trim(),
          hasMultipleBranches: false,
          address: singleAddress,
          country: singleCountry,
          addresses: singleAddress ? [`${singleAddress} (${singleCountry})`] : [`(${singleCountry})`],
          countries: [singleCountry],
          emails: singleEmails.filter(Boolean),
          website: website.filter(Boolean),
          contacts: singleContacts,
          forteProducts: forteProducts.filter(Boolean),
          products: products.filter(Boolean),
          certificates: certificates.filter(Boolean),
          referenceID: user?.ReferenceID || supplier.referenceID || null,
          whatHappened: "Supplier Edited",
          date_updated: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
      }

      /* 1️⃣ UPDATE SUPPLIER */
      await updateDoc(doc(db, "suppliers", supplier.id), updateData);

      /* 2️⃣ UPDATE SUPPLIER NAME IN PRODUCTS */
      const q = query(collection(db, "products"), where("supplier.supplierId", "==", supplier.id));
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.map((p) => {
          const data = p.data();
          if (!data.supplier) return Promise.resolve();
          return updateDoc(p.ref, {
            supplier: { ...data.supplier, company: company.trim(), supplierBrand: supplierBrand.trim() },
          });
        }),
      );

      // ✅ AUDIT LOG
      await logSupplierEvent({
        whatHappened  : "Supplier Edited",
        supplierId    : supplier.id,
        supplierbrandId: supplier.id,
        company       : company.trim(),
        supplierBrand : supplierBrand.trim(),
        referenceID   : user?.ReferenceID,
        userId        : userId ?? undefined,
      });

      toast.success("Supplier updated everywhere", { description: company });

      if (userId && supplier?.supplierId) {
        onSupplierUpdated({
          userId,
          supplierName: company,
          supplierId: supplier.supplierId,
          url: `/suppliers`,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Failed to save supplier");
    }
  };

  const handleRequestApproval = async (message: string) => {
    try {
      if (!userId) return;
      setRequestingApproval(true);
      const profile = await getApprovalUserProfile(userId);
      if (!profile) {
        toast.error("User profile not loaded");
        return;
      }

      let payload: any;
      if (hasMultipleBranches) {
        payload = {
          supplierId: supplier?.id ?? null,
          company: company.trim(),
          supplierBrand: supplierBrand.trim(),
          hasMultipleBranches: true,
          branches: branches.map((b) => ({
            address: b.address,
            country: b.country,
            contacts: b.contacts
              .filter((c) => c.name || c.phone)
              .map((c) => ({
                name: c.name,
                phone: c.phone.replace(/[^\d+]/g, ""),
                type: c.type,
              })),
            emails: b.emails.filter(Boolean),
          })),
          website: website.filter(Boolean),
          forteProducts: forteProducts.filter(Boolean),
          products: products.filter(Boolean),
          certificates: certificates.filter(Boolean),
        };
      } else {
        const singleContacts = singleContactNames
          .map((name, index) => ({
            name,
            phone: singleContactNumbers[index]?.replace(/[^\d+]/g, "") || "",
            type: singleContactTypes[index] || "phone",
          }))
          .filter((c) => c.name || c.phone);

        payload = {
          supplierId: supplier?.id ?? null,
          company: company.trim(),
          supplierBrand: supplierBrand.trim(),
          hasMultipleBranches: false,
          address: singleAddress,
          country: singleCountry,
          emails: singleEmails.filter(Boolean),
          contacts: singleContacts,
          website: website.filter(Boolean),
          forteProducts: forteProducts.filter(Boolean),
          products: products.filter(Boolean),
          certificates: certificates.filter(Boolean),
        };
      }

      await createApprovalRequest({
        actionType: "supplier_edit",
        entityLabel: company.trim() || supplier?.company || "Supplier",
        requester: profile,
        message,
        summary: `Edit supplier: ${company.trim() || supplier?.company || ""}`,
        payload,
      });
      await logSupplierEvent({
        whatHappened: "Supplier For Approval Requested",
        supplierId: supplier?.id,
        supplierbrandId: supplier?.id,
        company: company.trim(),
        supplierBrand: supplierBrand.trim(),
        referenceID: profile.referenceID,
        userId,
      });
      toast.success("Request sent for approval");
      setRequestApprovalOpen(false);
      onOpenChange(false);
    } catch (error) {
      console.error("Request approval failed:", error);
      toast.error("Failed to send approval request");
    } finally {
      setRequestingApproval(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-xl overflow-y-auto px-6"
        onWheel={(e) => {
          const target = e.target as HTMLElement;
          const insidePopover = target.closest('[data-radix-popper-content-wrapper]');
          if (insidePopover) e.stopPropagation();
        }}
      >
        <SheetHeader>
          <SheetTitle>Edit Supplier</SheetTitle>
          <SheetDescription>Enter supplier information</SheetDescription>
        </SheetHeader>

        <Separator className="my-4" />

        {user && (
          <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/40">
            <div><span className="font-medium">Welcome:</span> {user.Firstname} {user.Lastname}</div>
            <div><span className="font-medium">Role:</span> {user.Role}</div>
            <div><span className="font-medium">Email:</span> {user.Email}</div>
          </div>
        )}

        <div className="space-y-6 mt-4">
          {/* Company + Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" />
              {companyError && <p className="text-sm text-red-600">{companyError}</p>}
            </div>
            <div className="space-y-1">
              <Label>Supplier Brand</Label>
              <Input value={supplierBrand} onChange={(e) => setSupplierBrand(e.target.value)} placeholder="Brand name" />
            </div>
          </div>

          {/* Multiple Branches Checkbox */}
          <div className="flex items-center space-x-2 py-2">
            <input
              type="checkbox"
              id="edit-multiple-branches"
              checked={hasMultipleBranches}
              onChange={(e) => setHasMultipleBranches(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="edit-multiple-branches" className="cursor-pointer">
              Multiple Branches?
            </Label>
          </div>

          {/* Single Branch Mode */}
          {!hasMultipleBranches && (
            <>
              <div className="space-y-3">
                <Label>Address</Label>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                  <Textarea
                    value={singleAddress}
                    onChange={(e) => setSingleAddress(e.target.value)}
                    placeholder="Full address"
                    className="min-h-20"
                  />
                  <div className="pt-1">
                    <CountryCombobox
                      value={singleCountry}
                      onChange={(code) => setSingleCountry(code)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Emails</Label>
                {singleEmails.map((mail, index) => (
                  <div key={index} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                    <Input type="email" value={mail} placeholder="company@email.com" onChange={(e) => updateSingleEmail(index, e.target.value)} />
                    <div className="flex gap-1">
                      <Button type="button" size="icon" variant="outline" onClick={addSingleEmail}><Plus className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="outline" disabled={singleEmails.length === 1} onClick={() => removeSingleEmail(index)}><Minus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
                {emailError && <p className="text-sm text-red-600">{emailError}</p>}
              </div>

              <div className="space-y-3">
                <Label>Contacts</Label>
                {singleContactNames.map((_, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input placeholder="Contact Name" value={singleContactNames[index]} onChange={(e) => updateSingleContactName(index, e.target.value)} />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-25 justify-between font-normal">
                          {singleContactTypes[index] === "phone" ? "Phone" : "Others"}
                          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-30 p-0" align="start">
                        <Command>
                          <CommandList>
                            <CommandGroup>
                              <CommandItem onSelect={() => updateSingleContactType(index, "phone")} className="cursor-pointer">
                                <Check className={cn("mr-2 h-4 w-4", singleContactTypes[index] === "phone" ? "opacity-100" : "opacity-0")} />
                                Phone
                              </CommandItem>
                              <CommandItem onSelect={() => updateSingleContactType(index, "other")} className="cursor-pointer">
                                <Check className={cn("mr-2 h-4 w-4", singleContactTypes[index] === "other" ? "opacity-100" : "opacity-0")} />
                                Others
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <div className="flex gap-1 justify-end">
                      <Button type="button" size="icon" variant="outline" onClick={addSingleContact}><Plus className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="outline" disabled={singleContactNames.length === 1} onClick={() => removeSingleContact(index)}><Minus className="h-4 w-4" /></Button>
                    </div>
                    <div className="col-span-3">
                      {singleContactTypes[index] === "phone" ? (
                        <PhoneField value={singleContactNumbers[index]} onChange={(val) => updateSingleContactNumber(index, val)} defaultCountry={singleCountry} />
                      ) : (
                        <Input placeholder="WeChat / TikTok / etc" value={singleContactNumbers[index]} onChange={(e) => updateSingleContactNumber(index, e.target.value)} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Multiple Branches Mode */}
          {hasMultipleBranches && (
            <div className="space-y-6">
              {branches.map((branch, branchIndex) => (
                <div key={branchIndex} className="space-y-4 rounded-md border p-4 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Branch {branchIndex + 1}</h4>
                    <div className="flex gap-1">
                      <Button type="button" size="icon" variant="outline" onClick={addBranch}><Plus className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="outline" disabled={branches.length === 1} onClick={() => removeBranch(branchIndex)}><Minus className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  {/* Address + Country */}
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                      <Textarea
                        value={branch.address}
                        onChange={(e) => updateBranch(branchIndex, "address", e.target.value)}
                        placeholder="Full address"
                        className="min-h-20"
                      />
                      <div className="pt-1">
                        <CountryCombobox
                          value={branch.country}
                          onChange={(code) => updateBranch(branchIndex, "country", code)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Branch Emails */}
                  <div className="space-y-2">
                    <Label>Emails</Label>
                    {branch.emails.map((email, emailIndex) => (
                      <div key={emailIndex} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                        <Input type="email" value={email} placeholder="company@email.com" onChange={(e) => updateBranchEmail(branchIndex, emailIndex, e.target.value)} />
                        <div className="flex gap-1">
                          <Button type="button" size="icon" variant="outline" onClick={() => addBranchEmail(branchIndex)}><Plus className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="outline" disabled={branch.emails.length === 1} onClick={() => removeBranchEmail(branchIndex, emailIndex)}><Minus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Branch Contacts */}
                  <div className="space-y-2">
                    <Label>Contacts</Label>
                    {branch.contacts.map((contact, contactIndex) => (
                      <div key={contactIndex} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <Input placeholder="Contact Name" value={contact.name} onChange={(e) => updateBranchContact(branchIndex, contactIndex, "name", e.target.value)} />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-25 justify-between font-normal">
                              {contact.type === "phone" ? "Phone" : "Others"}
                              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-30 p-0" align="start">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  <CommandItem onSelect={() => updateBranchContact(branchIndex, contactIndex, "type", "phone")} className="cursor-pointer">
                                    <Check className={cn("mr-2 h-4 w-4", contact.type === "phone" ? "opacity-100" : "opacity-0")} />
                                    Phone
                                  </CommandItem>
                                  <CommandItem onSelect={() => updateBranchContact(branchIndex, contactIndex, "type", "other")} className="cursor-pointer">
                                    <Check className={cn("mr-2 h-4 w-4", contact.type === "other" ? "opacity-100" : "opacity-0")} />
                                    Others
                                  </CommandItem>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <div className="flex gap-1 justify-end">
                          <Button type="button" size="icon" variant="outline" onClick={() => addBranchContact(branchIndex)}><Plus className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="outline" disabled={branch.contacts.length === 1} onClick={() => removeBranchContact(branchIndex, contactIndex)}><Minus className="h-4 w-4" /></Button>
                        </div>
                        <div className="col-span-3">
                          {contact.type === "phone" ? (
                            <PhoneField value={contact.phone} onChange={(val) => updateBranchContact(branchIndex, contactIndex, "phone", val)} defaultCountry={branch.country} />
                          ) : (
                            <Input placeholder="WeChat / TikTok / etc" value={contact.phone} onChange={(e) => updateBranchContact(branchIndex, contactIndex, "phone", e.target.value)} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Website */}
          <div className="space-y-3">
            <Label>Website (optional)</Label>
            {website.map((site, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <Input value={site} placeholder="https://example.com" onChange={(e) => updateList(setWebsite, index, e.target.value)} />
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" onClick={() => addRowAfter(setWebsite, index)}><Plus className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" disabled={website.length === 1} onClick={() => removeRow(setWebsite, index)}><Minus className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>

          {/* Forte Products */}
          <div className="space-y-3">
            <Label>Forte Products (optional)</Label>
            {forteProducts.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <Input value={item} placeholder="Forte product" onChange={(e) => updateList(setForteProducts, index, e.target.value)} />
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" onClick={() => addRowAfter(setForteProducts, index)}><Plus className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" disabled={forteProducts.length === 1} onClick={() => removeRow(setForteProducts, index)}><Minus className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>

          {/* Products */}
          <div className="space-y-3">
            <Label>Products (optional)</Label>
            {products.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <Input value={item} placeholder="Product" onChange={(e) => updateList(setProducts, index, e.target.value)} />
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" onClick={() => addRowAfter(setProducts, index)}><Plus className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" disabled={products.length === 1} onClick={() => removeRow(setProducts, index)}><Minus className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>

          {/* Certificates */}
          <div className="space-y-3">
            <Label>Certificates (optional)</Label>
            {certificates.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_auto] gap-2 items-center">
                <Input value={item} placeholder="Certificate" onChange={(e) => updateList(setCertificates, index, e.target.value)} />
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="outline" onClick={() => addRowAfter(setCertificates, index)}><Plus className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="outline" disabled={certificates.length === 1} onClick={() => removeRow(setCertificates, index)}><Minus className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSaveSupplier} disabled={!company.trim() || isDuplicateCompany || !!emailError}>
            Save Supplier
          </Button>
        </SheetFooter>
      </SheetContent>
      <RequestApprovalDialog
        open={requestApprovalOpen}
        onOpenChange={setRequestApprovalOpen}
        actionLabel="Edit Supplier"
        entityLabel={company.trim() || supplier?.company || "Supplier"}
        onConfirm={handleRequestApproval}
        loading={requestingApproval}
      />
    </Sheet>
  );
}

export default EditSupplier;
