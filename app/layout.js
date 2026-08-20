import Sidebar from "./components/Sidebar";

export const metadata = {
  title: "CS Upsell Forecast",
  description: "RevOps Upsell Forecast Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f1115", color: "#e6e6e6" }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar />
          <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        </div>
      </body>
    </html>
  );
}
