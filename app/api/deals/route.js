import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HS = "https://api.hubapi.com";
const PIPELINE = "3955090";
const STAGE_UPSELL = "100309148";
const STAGE_WON = "13452120";

const PROPS = [
  "amount",
  "number_of_locations__this_deal_",
  "platform_revenue_per_location",
  "dealstage",
  "hubspot_owner_id",
  "closedate",
  "dealname",
];

async function hsFetch(path, options = {}) {
  const res = await fetch(`${HS}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.HUBSPOT_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function fetchDeals() {
  const all = [];
  let after = undefined;

  do {
    const body = {
      filterGroups: [
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: PIPELINE },
            { propertyName: "dealstage", operator: "EQ", value: STAGE_UPSELL },
          ],
        },
        {
          filters: [
            { propertyName: "pipeline", operator: "EQ", value: PIPELINE },
            { propertyName: "dealstage", operator: "EQ", value: STAGE_WON },
          ],
        },
      ],
      properties: PROPS,
      limit: 100,
      ...(after ? { after } : {}),
    };
    const data = await hsFetch(`/crm/v3/objects/deals/search`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    all.push(...(data.results || []));
    after = data.paging?.next?.after;
  } while (after);

  return all;
}

async function fetchOwners() {
  const map = {};
  let after = undefined;
  do {
    const qs = new URLSearchParams({ limit: "100", ...(after ? { after } : {}) });
    const data = await hsFetch(`/crm/v3/owners?${qs.toString()}`);
    for (const o of data.results || []) {
      const name = [o.firstName, o.lastName].filter(Boolean).join(" ").trim();
      map[o.id] = name || o.email || o.id;
    }
    after = data.paging?.next?.after;
  } while (after);
  return map;
}

export async function GET() {
  try {
    const [deals, owners] = await Promise.all([fetchDeals(), fetchOwners()]);

    const shaped = deals.map((d) => {
      const p = d.properties || {};
      return {
        id: d.id,
        dealname: p.dealname || "",
        owner_id: p.hubspot_owner_id || "",
        owner_name: owners[p.hubspot_owner_id] || "(unknown)",
        dealstage: p.dealstage || "",
        stage_label: p.dealstage === STAGE_WON ? "Closed Won" : "Upsell (Forecast)",
        amount: p.amount ? Number(p.amount) : 0,
        locations: p.number_of_locations__this_deal_
          ? Number(p.number_of_locations__this_deal_)
          : null,
        rev_per_location: p.platform_revenue_per_location
          ? Number(p.platform_revenue_per_location)
          : null,
        closedate: p.closedate || null,
      };
    });

    return NextResponse.json({
      ok: true,
      count: shaped.length,
      upsell_count: shaped.filter((d) => d.dealstage === STAGE_UPSELL).length,
      won_count: shaped.filter((d) => d.dealstage === STAGE_WON).length,
      deals: shaped,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e.message || e) }, { status: 500 });
  }
}
