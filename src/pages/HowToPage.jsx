import React from "react";
import {
  BookOpen, Building2, ClipboardCheck, Workflow, CheckCircle2, XCircle, ListChecks,
} from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";

const STEPS = [
  {
    icon: Building2,
    title: "Create a company",
    body: "Add a new company and fill in information such as Company Name, City, Deal Type, etc. You're automatically set as its rep.",
  },
  {
    icon: ClipboardCheck,
    title: "Wait for review",
    body: "An Owner (or your region's Strategic Partner) reviews and confirms the company before you can add contacts, locations, notes, or tasks.",
  },
  {
    icon: Workflow,
    title: "Move through the pipeline",
    body: "Once approved, fill in contacts, addresses, and any other details as you go, and fill out the Pre-Install Checklist task while talking to the company. Keep the pipeline updated all the way through Negotiation, where Owners take over to create the contract and speak with the company directly.",
  },
  {
    icon: CheckCircle2,
    title: "Stay on top of it",
    body: "Check High Priority Actions and Tasks regularly, and log important company interests or notes so the team stays in the loop.",
  },
];

const DOS = [
  "Identify prospects and make warm introductions",
  "Present the two business models using LEMO's approved pricing and Revenue Sharing structure",
  "Gather basic site info — space size, foot traffic, hours, outlet access",
  "Register every lead in the CRM promptly",
  "Update the CRM and the Team through Google Chat thoroughly",
];

const DONTS = [
  "Offer Corporate Wellness pricing below $200 per chair per month, change the approved 80/20 Revenue Sharing split, negotiate the installation deposit, or promise unauthorized contract terms without LEMO approval",
  "Promise exclusivity, specific locations, or guaranteed installation dates",
  "Sign, or imply you can sign, on behalf of LEMO",
  "Make medical claims about the chairs",
  "Share internal, financial, or contractor-specific information with a client",
  "SHARE CRM LOGIN INFORMATION",
  "SHARE GOOGLE DOC INFORMATION EXTERNALLY",
];

export default function HowToPage() {
  return (
    <div>
      <div className="mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>Operations SOP</h1>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>
          A quick walkthrough of the BD Consultant workflow, from creating a company to keeping it healthy.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle icon={BookOpen}>Working a company from lead to portfolio</CardTitle>
          <div className="flex flex-col">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex gap-4 py-4"
                style={{ borderBottom: i < STEPS.length - 1 ? `1px solid ${T.borderSoft}` : "none" }}
              >
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{ width: 28, height: 28, background: `${T.amber}14`, border: `1px solid ${T.amber}40`, color: T.amber, fontFamily: T.fontMono, fontSize: 13, fontWeight: 600 }}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <step.icon size={15} style={{ color: T.amber }} />
                    <h3 className="text-sm font-semibold" style={{ color: T.text, fontFamily: T.fontBody }}>{step.title}</h3>
                  </div>
                  <p className="text-sm" style={{ color: T.textDim }}>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle icon={ListChecks}>Do's and Don'ts</CardTitle>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: T.teal, fontFamily: T.fontMono }}>Do</h3>
              <div className="flex flex-col gap-2.5">
                {DOS.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle2 size={14} style={{ color: T.teal, marginTop: 2, flexShrink: 0 }} />
                    <p className="text-sm" style={{ color: T.textDim }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: T.red, fontFamily: T.fontMono }}>Don't</h3>
              <div className="flex flex-col gap-2.5">
                {DONTS.map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <XCircle size={14} style={{ color: T.red, marginTop: 2, flexShrink: 0 }} />
                    <p className="text-sm" style={{ color: T.textDim }}>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
