import React, { useState } from "react";
import { T } from "./theme.js";
import { useAuth } from "./context/AuthContext.jsx";
import { useCrmData } from "./hooks/useCrmData.js";
import { useAppSettings } from "./hooks/useAppSettings.js";
import Sidebar from "./components/Sidebar.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import AcceptInvitePage from "./pages/AcceptInvitePage.jsx";
import OverviewPage from "./pages/OverviewPage.jsx";
import CompaniesPage from "./pages/CompaniesPage.jsx";
import CompanyProfile from "./pages/CompanyProfile.jsx";
import RevenuePage from "./pages/RevenuePage.jsx";
import UsagePage from "./pages/UsagePage.jsx";
import PipelinePage from "./pages/PipelinePage.jsx";
import UploadPage from "./pages/UploadPage.jsx";
import TeamPage from "./pages/TeamPage.jsx";
import HowToPage from "./pages/HowToPage.jsx";
import PartnerPortal from "./pages/PartnerPortal.jsx";

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Poppins:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      select { appearance: none; }
      button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
        outline: 2px solid ${T.amber}; outline-offset: 1px;
      }
      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
      }
    `}</style>
  );
}

function Crm() {
  const [page, setPage] = useState("overview");
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const { profile } = useAuth();
  const data = useCrmData();

  const goToCompany = (id) => { setSelectedCompanyId(id); setPage("companies"); };
  const selectedCompany = data.companies.find((c) => c.id === selectedCompanyId);
  const firstName = profile?.name?.split(" ")[0];

  // data.companies/tasks/recentActivity are already scoped correctly per
  // role by RLS itself (e.g. a bd_consultant's query only ever returns
  // their own companies) — no client-side re-filtering needed here anymore.

  return (
    <div style={{ fontFamily: T.fontBody, background: T.bg, height: "100vh", overflow: "hidden" }}>
      <div className="flex" style={{ height: "100%" }}>
        <Sidebar page={page} setPage={setPage} setSelectedCompanyId={setSelectedCompanyId} />
        <div className="flex-1 p-6 overflow-x-hidden overflow-y-auto" style={{ minHeight: 0 }}>
          {data.loading && data.companies.length === 0 ? (
            <p className="text-sm" style={{ color: T.textFaint }}>Loading…</p>
          ) : (
            <>
              {page === "overview" && (
                <OverviewPage
                  companies={data.companies}
                  tasks={data.tasks}
                  recentActivity={data.recentActivity}
                  goToCompany={goToCompany}
                  firstName={firstName}
                  profile={profile}
                />
              )}
              {page === "companies" && !selectedCompany && (
                <CompaniesPage
                  companies={data.companies}
                  profiles={data.profiles}
                  goToCompany={goToCompany}
                  createCompany={data.createCompany}
                />
              )}
              {page === "companies" && selectedCompany && (
                <CompanyProfile
                  company={selectedCompany}
                  back={() => setSelectedCompanyId(null)}
                  tasks={data.tasks}
                  profiles={data.profiles}
                  updateCompany={data.updateCompany}
                  deleteCompany={data.deleteCompany}
                  createContact={data.createContact}
                  updateContact={data.updateContact}
                  deleteContact={data.deleteContact}
                  createOutlet={data.createOutlet}
                  updateOutlet={data.updateOutlet}
                  deleteOutlet={data.deleteOutlet}
                  createDevice={data.createDevice}
                  updateDevice={data.updateDevice}
                  deleteDevice={data.deleteDevice}
                  upsertPreInstallChecklist={data.upsertPreInstallChecklist}
                  completePreInstallChecklist={data.completePreInstallChecklist}
                  addNote={data.addNote}
                  updateNote={data.updateNote}
                  deleteNote={data.deleteNote}
                  deleteActivity={data.deleteActivity}
                  addRevenueEntry={data.addRevenueEntry}
                  createTask={data.createTask}
                  completeTask={data.completeTask}
                  updateTask={data.updateTask}
                  deleteTask={data.deleteTask}
                />
              )}
              {page === "revenue" && <RevenuePage companies={data.companies} goToUsage={() => setPage("usage")} />}
              {page === "usage" && <UsagePage companies={data.companies} goToCompany={goToCompany} back={() => setPage("revenue")} />}
              {page === "pipeline" && <PipelinePage companies={data.companies} goToCompany={goToCompany} updateCompany={data.updateCompany} />}
              {page === "upload" && <UploadPage companies={data.companies} uploadCsvRevenue={data.uploadCsvRevenue} />}
              {page === "how-to" && <HowToPage />}
              {page === "team" && (
                <TeamPage
                  profiles={data.profiles} companies={data.companies}
                  createUser={data.createUser} deleteUser={data.deleteUser}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { loading, session, profile, isInviteFlow } = useAuth();
  const { settings, loading: settingsLoading } = useAppSettings();

  let body;
  if (loading || settingsLoading) {
    body = (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "100vh", background: T.bg, color: T.textFaint, fontFamily: T.fontBody }}
      >
        Loading…
      </div>
    );
  } else if (session && isInviteFlow) {
    body = <AcceptInvitePage />;
  } else if (settings?.maintenance_mode && !profile?.is_master_admin) {
    body = (
      <div
        className="flex items-center justify-center text-center px-6"
        style={{ minHeight: "100vh", background: T.bg, color: T.textDim, fontFamily: T.fontBody }}
      >
        <div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 20, color: T.text, marginBottom: 8 }}>
            LemoCRM is temporarily unavailable
          </div>
          <p className="text-sm">{settings.maintenance_message || "We'll be back shortly — thanks for your patience."}</p>
        </div>
      </div>
    );
  } else if (!session) {
    body = <LoginPage />;
  } else if (!profile) {
    body = (
      <div
        className="flex items-center justify-center text-center px-6"
        style={{ minHeight: "100vh", background: T.bg, color: T.textDim, fontFamily: T.fontBody }}
      >
        Your account isn't fully set up yet — contact your admin to finish setup.
      </div>
    );
  } else if (profile.role === "partner") {
    body = <PartnerPortal />;
  } else {
    body = <Crm />;
  }

  return (
    <>
      <GlobalStyles />
      {body}
    </>
  );
}
