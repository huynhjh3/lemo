import React from "react";
import {
  BookOpen, Building2, ClipboardCheck, Workflow, CheckCircle2,
} from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";

const STEPS = [
  {
    icon: Building2,
    title: "Create a company",
    body: "Add a new company and fill in whatever details you already have. You're automatically set as its rep.",
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
