import React from "react";
import { Wifi, LogOut, DollarSign, Users, MapPin, Mail, Phone, Building2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../theme.js";
import { Card, CardTitle, DeviceStatus } from "../components/ui.jsx";
import { fmtMoney } from "../lib/helpers.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useCrmData } from "../hooks/useCrmData.js";

export default function PartnerPortal() {
  const { profile, signOut } = useAuth();
  const data = useCrmData();
  const company = data.companies[0];

  return (
    <div style={{ fontFamily: T.fontBody, background: T.bg, minHeight: "100vh" }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: T.amber }}>
            <Wifi size={16} color={T.bg} />
          </div>
          <span style={{ fontFamily: T.fontDisplay, fontWeight: 700, letterSpacing: 1, color: T.text, fontSize: 17 }}>LEMO</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: T.textDim }}>{profile?.name}</span>
          <button onClick={signOut} title="Sign out" style={{ color: T.textFaint }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6 flex flex-col gap-4">
        {data.loading && !company ? (
          <p className="text-sm" style={{ color: T.textFaint }}>Loading…</p>
        ) : !company ? (
          <p className="text-sm" style={{ color: T.textFaint }}>
            No company is linked to your account yet — contact your Lemo representative.
          </p>
        ) : (
          <>
            <div>
              <h1 style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 600, color: T.text }}>{company.name}</h1>
              <div className="text-sm mt-1" style={{ color: T.textDim }}>{company.industry} · {company.city}</div>
            </div>

            <Card>
              <CardTitle icon={DollarSign}>Revenue</CardTitle>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={company.revenueHistory}>
                    <CartesianGrid vertical={false} stroke={T.borderSoft} />
                    <XAxis dataKey="month" tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={{ stroke: T.border }} tickLine={false} />
                    <YAxis tick={{ fill: T.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: T.text }} formatter={(v) => fmtMoney(v)} />
                    <Bar dataKey="value" fill={T.teal} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardTitle icon={Users}>Contacts</CardTitle>
              {company.contacts.length === 0 ? (
                <p className="text-xs" style={{ color: T.textFaint }}>No contacts on file yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {company.contacts.map((p) => (
                    <div key={p.id} className="rounded-lg p-3" style={{ background: T.surface2 }}>
                      <div className="text-sm font-medium mb-1" style={{ color: T.text }}>{p.name}</div>
                      <div className="text-xs mb-2" style={{ color: T.textFaint }}>{p.role}</div>
                      <div className="flex flex-col gap-1 text-xs" style={{ color: T.textDim }}>
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 hover:underline">
                            <Mail size={11} /> {p.email}
                          </a>
                        )}
                        {p.phone && (
                          <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 hover:underline">
                            <Phone size={11} /> {p.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardTitle icon={MapPin}>Locations & Devices</CardTitle>
              {company.outlets.length === 0 ? (
                <p className="text-xs" style={{ color: T.textFaint }}>No outlets on file yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {company.outlets.map((o) => (
                    <div key={o.id} className="rounded-lg p-3" style={{ background: T.surface2 }}>
                      <div className="text-sm font-medium mb-0.5" style={{ color: T.text }}>{o.name}</div>
                      <div className="text-xs mb-2" style={{ color: T.textFaint }}>{o.address}</div>
                      {o.devices.length === 0 ? (
                        <div className="text-xs" style={{ color: T.textFaint }}>No devices installed yet.</div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {o.devices.map((d) => (
                            <div key={d.id} className="flex items-center justify-between text-xs py-1" style={{ borderTop: `1px solid ${T.border}`, color: T.textDim }}>
                              <span>{d.type} <span style={{ color: T.textFaint, fontFamily: T.fontMono }}>· {d.serial}</span></span>
                              <DeviceStatus status={d.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardTitle icon={Building2}>Contact Lemo</CardTitle>
              <a href="mailto:hello@lemo.space" className="text-sm hover:underline" style={{ color: T.amber }}>
                hello@lemo.space
              </a>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
