import React from "react";
import {
  BookOpen, Building2, ClipboardCheck, ListPlus, Workflow, ClipboardList, ListChecks, CheckCircle2,
} from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";

const STEPS = [
  {
    icon: Building2,
    title: "Create a company",
    body: "From Companies, add a new company and fill in whatever details you already have (name, deal type, industry, address, etc.). You're automatically set as its rep — there's no need to (and no way to) assign anyone else.",
  },
  {
    icon: ClipboardCheck,
    title: "Wait for review",
    body: "New companies start Pending Review. The Owner (or your region's Strategic Partner, once a region is set) reviews it and clicks Confirm review. Until then you can still edit the company's own fields, but adding contacts, locations, notes, or tasks is locked. The moment it's confirmed, a Pre-Install Checklist task is automatically created for you — you don't need to create one yourself.",
  },
  {
    icon: ListPlus,
    title: "Add the rest of the details",
    body: "Once review is confirmed, build out the account: Contacts, Locations, Notes, and anything else you know about the deal.",
  },
  {
    icon: Workflow,
    title: "Keep the pipeline current through Negotiation",
    body: "Update stage, deal terms, and any other details as things move forward — all the way through Negotiation. From there, Owners take over: they create the contract and speak with the company directly. Log any important company interests or notes as you go (Notes on the company, or team chat) so everyone stays in the loop.",
  },
  {
    icon: ClipboardList,
    title: "Fill out the Pre-Install Checklist",
    body: "Find the Pre-Install Checklist task in Tasks (also flagged as a High Priority Action on Overview) and expand it to fill in schedule and site logistics while you're talking to the company — no Location or chair needs to exist yet. Mark it complete once everything's filled in, then Submit for Installation to hand it to an Owner as a work order.",
  },
  {
    icon: ListChecks,
    title: "Keep up with tasks",
    body: "Check High Priority Actions on Overview and the company's Tasks section regularly for anything due or assigned to you — by yourself, an Owner, or your Strategic Partner.",
  },
  {
    icon: CheckCircle2,
    title: "Stay on top of your portfolio",
    body: "Mark tasks complete as you finish them, and check in on Pipeline and your companies' health status to keep your book of business moving forward.",
  },
];

export default function HowToPage() {
  return (
    <div>
      <div className="mb-5">
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 600, color: T.text }}>How To</h1>
        <p className="text-sm mt-1" style={{ color: T.textDim }}>
          A quick walkthrough of the BD Consultant workflow, from creating a company to keeping it healthy.
        </p>
      </div>

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
    </div>
  );
}
