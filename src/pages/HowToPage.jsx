import React from "react";
import {
  BookOpen, Building2, Presentation, MailCheck, Workflow, ClipboardCheck, CheckCircle2, XCircle, ListChecks, Clock,
} from "lucide-react";
import { T } from "../theme.js";
import { Card, CardTitle } from "../components/ui.jsx";

const STEPS = [
  {
    icon: Building2,
    title: "Create a company with a contact",
    body: "Press N (or click New Company) and fill in the company name, city, industry, and deal type, then add the main contact (name and email) on the company's page. BD Consultants: an Owner or your region's Strategic Partner confirms a new company first (it shows \"Pending Review\"), and contacts, tasks, and emails unlock once it's confirmed. Strategic Partners and Owners skip that step.",
  },
  {
    icon: Presentation,
    title: "Send the master deck by email",
    body: "Open Decks, pick the master deck and the company, check the details, and click Generate deck. Then click Email it, choose the contact, read the message, and Send. You can send yourself a test first. Always send decks from here, not from your own email, so the CRM can track them.",
  },
  {
    icon: MailCheck,
    title: "The CRM logs the email and the reply",
    body: "The email you sent is added to the company's Communications Log, and so is the contact's reply within about 5 minutes (a reply also creates a follow-up task for you). If a reply doesn't show up, forward it to lemowellness@gmail.com. When you write back from Gmail, use Reply-All or CC lemowellness@gmail.com so the rest of the thread is logged too.",
  },
  {
    icon: Workflow,
    title: "Move through the pipeline",
    body: "Lead (we sent an inquiry), Contacted (we've got a response), Proposal (we've got a conversation), Negotiation (we've got interest). Drag the company on the Pipeline board, or change its stage on its page, as things happen. Keep it current all the way through Negotiation, where Owners take over to create the contract and speak with the company directly.",
  },
  {
    icon: ClipboardCheck,
    title: "Complete the Pre-Install Checklist",
    body: "When the company is confirmed, a Pre-Install Checklist task is created (due in two weeks). Fill it in while you talk to the company: installation date, site access, address, and delivery needs. Mark it complete, then submit it for installation. An Owner reviews it and approves it.",
  },
  {
    icon: CheckCircle2,
    title: "Installed",
    body: "Once an Owner approves the checklist, move the company to Installed. The CRM won't allow the move before that.",
  },
  {
    icon: Clock,
    title: "If nothing happens, move it to Stay in Contact",
    body: "If a company goes quiet or says \"not now,\" move it to Stay in Contact so it leaves your active pipeline and stops sending you \"contact them\" alerts. The CRM also moves deals there on its own when they've gone far too long with no contact. Check in with these companies every so often, and move them back if they warm up.",
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
          A quick walkthrough of the BD Consultant and Strategic Partner workflow, from creating a company to installation.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle icon={BookOpen}>Working a company from lead to install</CardTitle>
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
