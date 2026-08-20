"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const OWNERS = [
  "Michael Calacino",
  "Cole Maher",
  "Declan Lavan",
  "Jennifer Smith",
  "Lindsey Rogien",
  "Celine Delle Donne",
];

const slug = (name) => encodeURIComponent(name);

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  const linkStyle = (active) => ({
    display: "block",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    color: active ? "#fff" : "#c7ccd4",
    background: active ? "#2a303b" : "transparent",
    textDecoration: "none",
    fontWeight: active ? 600 : 400,
  });

  const isMaster = pathname === "/";

  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        borderRight: "1px solid #232830",
        padding: "24px 12px",
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "#101319",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.4, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 12px 12px" }}>
        Upsell Forecast
      </div>

      <a href="/" style={linkStyle(isMaster)}>Master Report</a>

      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            width: "100%", textAlign: "left", background: "transparent", border: "none",
            color: "#c7ccd4", fontSize: 13, padding: "8px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 10, opacity: 0.6 }}>{open ? "▼" : "▶"}</span>
          CS Owner View
        </button>

        {open && (
          <div style={{ paddingLeft: 12 }}>
            {OWNERS.map((o) => {
              const href = `/mes-deals/${slug(o)}`;
              const active = pathname === href;
              return (
                <a key={o} href={href} style={linkStyle(active)}>{o}</a>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
