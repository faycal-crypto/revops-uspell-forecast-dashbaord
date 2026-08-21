"use client";

import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// value/onChange use "YYYY-MM-DD" strings to match the rest of the app.
function toDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toStr(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const inputStyle = {
  background: "#1a1d24",
  color: "#e6e6e6",
  border: "1px solid #2c313a",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  width: 120,
};

export default function DateRange({ from, to, onFrom, onTo }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 13, opacity: 0.6 }}>From</span>
      <DatePicker
        selected={toDate(from)}
        onChange={(d) => onFrom(toStr(d))}
        dateFormat="MM/dd/yyyy"
        customInput={<input style={inputStyle} />}
      />
      <span style={{ fontSize: 13, opacity: 0.6 }}>To</span>
      <DatePicker
        selected={toDate(to)}
        onChange={(d) => onTo(toStr(d))}
        dateFormat="MM/dd/yyyy"
        customInput={<input style={inputStyle} />}
      />
    </div>
  );
}
