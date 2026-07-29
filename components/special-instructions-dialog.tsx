"use client";

import React, { useState, useCallback } from "react";
import CardDetails from "@/components/spf/dialog/card-details";
import { type SPFRequest } from "@/components/spf-request-create";

interface SpecialInstructionsDialogProps {
  open: boolean;
  onClose: () => void;
  instructions: string;
  customerName: string;
  spfNumber: string;
  status?: string;
  rowData?: SPFRequest;
  onCreate?: () => void;
  onRevise?: () => void;
}

// ─── Accordion section wrapper ─────────────────────────────────────────────
// A self-contained collapsible panel with a chevron toggle. Calls
// `onFirstOpen` the first time it is expanded so the parent can track
// whether the user has actually seen the content at least once. Once
// opened, staying "viewed" persists even if the user collapses it again —
// the read requirement is about having opened it, not keeping it open.

interface AccordionSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ title, open, onToggle, children }: AccordionSectionProps) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium text-gray-800">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

export default function SpecialInstructionsDialog({
  open,
  onClose,
  instructions,
  customerName,
  spfNumber,
  status,
  rowData,
  onCreate,
  onRevise,
}: SpecialInstructionsDialogProps) {
  // ─── Accordion open/viewed state ─────────────────────────────────────────
  const [companyOpen, setCompanyOpen] = useState(false);
  const [spfOpen, setSpfOpen] = useState(false);
  const [companyViewed, setCompanyViewed] = useState(false);
  const [spfViewed, setSpfViewed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const bothViewed = companyViewed && spfViewed;

  const toggleCompany = useCallback(() => {
    setCompanyOpen((prev) => !prev);
    setCompanyViewed(true);
  }, []);

  const toggleSpf = useCallback(() => {
    setSpfOpen((prev) => !prev);
    setSpfViewed(true);
  }, []);

  // Reset all gating state whenever the dialog is closed, so a fresh open
  // always re-requires reading both sections again.
  const handleClose = useCallback(() => {
    setCompanyOpen(false);
    setSpfOpen(false);
    setCompanyViewed(false);
    setSpfViewed(false);
    setAcknowledged(false);
    onClose();
  }, [onClose]);

  if (!open) return null;

  const canProceed = acknowledged && bothViewed;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white p-6 border-b shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Special Instructions</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><span className="font-medium text-gray-700">SPF Number:</span> {spfNumber}</p>
                <p><span className="font-medium text-gray-700">Customer:</span> {customerName}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Person icon and Full Instructions text outside speech balloon */}
          <div className="flex items-center gap-3 mb-3 text-indigo-700">
            <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Full Instructions</span>
          </div>

          {/* Speech balloon pointing to icon */}
          <div className="relative bg-linear-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-4 mb-6">
            {/* Speech balloon tail pointing to icon above */}
            <div className="absolute -top-2 left-6 w-4 h-4 bg-indigo-50 border-l-2 border-t-2 border-indigo-200 transform rotate-45"></div>

            {/* Instructions text */}
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {instructions}
            </p>
          </div>

          {/* Company Details and SPF Details — stacked accordions, required to open */}
          {rowData && (
            <div className="flex flex-col gap-3 mb-6">
              <AccordionSection title="Company Details" open={companyOpen} onToggle={toggleCompany}>
                <CardDetails
                  title="Company Details"
                  fields={[
                    { label: "Customer Name", value: rowData.customer_name },
                    { label: "Contact Person", value: rowData.contact_person },
                    { label: "Contact Number", value: rowData.contact_number },
                    { label: "Registered Address", value: rowData.registered_address, pre: true },
                    { label: "Delivery Address", value: rowData.delivery_address },
                    { label: "Billing Address", value: rowData.billing_address },
                    { label: "Collection Address", value: rowData.collection_address },
                    { label: "TIN", value: rowData.tin_no },
                  ]}
                />
              </AccordionSection>

              <AccordionSection title="SPF Details" open={spfOpen} onToggle={toggleSpf}>
                <CardDetails
                  title="SPF Details"
                  fields={[
                    { label: "Item Qty", value: rowData.item_qty },
                    { label: "Project Name", value: rowData.project_name },
                    { label: "Project Location", value: rowData.project_location },
                    { label: "Project Status", value: rowData.project_status },
                    { label: "Delivery Lead Time Requirement", value: rowData.delivery_lead_time_requirement },
                    { label: "Available Project Plans", value: rowData.available_project_plans },
                    { label: "Bill of Quantity (BOQ)", value: rowData.bill_of_quantity },
                    { label: "Consultant", value: rowData.consultant },
                    { label: "Other Bidders", value: rowData.other_bidders },
                    { label: "Owner", value: rowData.owner },
                    { label: "Buyer", value: rowData.buyer },
                    { label: "Scope", value: rowData.scope },
                    { label: "Other Client Instruction", value: rowData.other_client_instruction },
                    { label: "Win Rate Probability Percentage", value: rowData.win_rate_probability_percentage },
                    { label: "Payment Terms", value: rowData.payment_terms },
                    { label: "Warranty", value: rowData.warranty },
                    { label: "Delivery Date", value: rowData.delivery_date },
                    { label: "Prepared By", value: rowData.prepared_by },
                    { label: "Approved By", value: rowData.approved_by },
                  ]}
                />
              </AccordionSection>

              {!bothViewed && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Please open both Company Details and SPF Details before continuing.
                </p>
              )}
            </div>
          )}

          {/* Acknowledgement checkbox — only enabled once both sections have been opened */}
          {rowData && (
            <label
              className={`flex items-start gap-2.5 select-none ${
                bothViewed ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              }`}
            >
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={!bothViewed}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-gray-700">
                I have read the Company and SPF Details
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex gap-2">
            {!status && onCreate && (
              <button
                onClick={onCreate}
                disabled={!canProceed}
                title={!canProceed ? "Open both details sections and check the acknowledgement box first" : undefined}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
              >
                Create
              </button>
            )}
            {status && onRevise && (
              <button
                onClick={onRevise}
                disabled={!canProceed}
                title={!canProceed ? "Open both details sections and check the acknowledgement box first" : undefined}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-orange-600"
              >
                Revise
              </button>
            )}
          </div>
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}