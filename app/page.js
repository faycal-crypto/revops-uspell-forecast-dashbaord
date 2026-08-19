export default function Home() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 40 }}>
      <h1 style={{ fontSize: 22 }}>CS Upsell Forecast Dashboard</h1>
      <p style={{ opacity: 0.7 }}>Étape 1 — squelette déployé. ✅</p>
      <p style={{ opacity: 0.7 }}>
        Test API :{" "}
        <a href="/api/health" style={{ color: "#6ea8fe" }}>
          /api/health
        </a>
      </p>
    </main>
  );
}
