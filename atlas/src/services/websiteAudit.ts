import type { ListType } from "@/config/leads";
import { hash01 } from "./usagePortal";

/**
 * Website audit (CRM_BUILD_PROMPT M8): contact form, booking widget, chat widget, HTTPS, mobile viewport, AI receptionist,
 * 3D / unit picker. The analyzer is pure and runs on the HTML a headless browser (Playwright worker) rendered.
 */

export interface PageSnapshot {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
  /** Optional PageSpeed Insights mobile performance score, 0–100. */
  pageSpeedMobile?: number | null;
}

export interface AuditFindings {
  reachable: boolean;
  https: boolean;
  mobileViewport: boolean;
  contactForm: boolean;
  bookingWidget: string | null;
  chatWidget: string | null;
  aiReceptionist: string | null;
  threeD: string | null;
  unitPicker: boolean;
  rendersGallery: boolean;
  pageSpeedMobile: number | null;
  /** Contact details published on the site (tel: and mailto: links). */
  phones: string[];
  emails: string[];
}

const BOOKING: [string, RegExp][] = [
  ["Calendly", /calendly\.com/i],
  ["Acuity", /acuityscheduling\.com/i],
  ["Housecall Pro", /housecallpro\.com/i],
  ["ServiceTitan", /servicetitan\.com|scheduler\.servicetitan/i],
  ["Jobber", /getjobber\.com|jobber\.com/i],
  ["Setmore", /setmore\.com/i],
  ["Square Appointments", /squareup\.com\/appointments/i],
  ["Book online button", />\s*(book|schedule)\s+(online|now|service|an appointment)\s*</i],
];
const CHAT: [string, RegExp][] = [
  ["Intercom", /widget\.intercom\.io|intercomcdn/i],
  ["Drift", /js\.driftt\.com|drift\.com\/include/i],
  ["Tawk.to", /embed\.tawk\.to/i],
  ["LiveChat", /cdn\.livechatinc\.com/i],
  ["Podium", /podium\.com\/podium-widget|connect\.podium\.com/i],
  ["Birdeye", /birdeye\.com\/embed/i],
  ["HubSpot chat", /js\.hs-scripts\.com|hubspot.*conversations/i],
  ["Tidio", /code\.tidio\.co/i],
  ["Crisp", /client\.crisp\.chat/i],
];
const AI_RECEPTIONIST: [string, RegExp][] = [
  ["Smith.ai", /smith\.ai/i],
  ["Goodcall", /goodcall\.com/i],
  ["Rosie", /heyrosie\.com/i],
  ["My AI Front Desk", /myaifrontdesk\.com/i],
  ["Numa", /numa\.com\/widget/i],
];
const THREE_D: [string, RegExp][] = [
  ["Matterport", /matterport\.com/i],
  ["Sketchfab", /sketchfab\.com/i],
  ["3DVista", /3dvista/i],
  ["Pixel streaming", /pixelstreaming|arcware|furioos/i],
  ["three.js", /three(\.min)?\.js/i],
];

const first = (html: string, list: [string, RegExp][]) => list.find(([, re]) => re.test(html))?.[0] ?? null;

export const auditSite = (page: PageSnapshot): AuditFindings => {
  const reachable = page.status >= 200 && page.status < 400 && page.html.length > 0;
  const html = reachable ? page.html : "";
  return {
    reachable,
    https: page.finalUrl.startsWith("https://"),
    mobileViewport: /<meta[^>]+name=["']viewport["'][^>]+width=device-width/i.test(html),
    contactForm: /<form[\s\S]*?(<input[^>]+(type=["']email["']|name=["'](email|phone)["'])|<textarea)/i.test(html),
    bookingWidget: first(html, BOOKING),
    chatWidget: first(html, CHAT),
    aiReceptionist: first(html, AI_RECEPTIONIST),
    threeD: first(html, THREE_D),
    unitPicker: /unit[-_ ]?(picker|selector|availability)|availability[-_ ]?(grid|table)|floor[-_ ]?plan[-_ ]?selector/i.test(html),
    rendersGallery: /<img[^>]+(render|cgi|visuali[sz]ation)/i.test(html),
    pageSpeedMobile: page.pageSpeedMobile ?? null,
    phones: [...new Set([...html.matchAll(/href=["']tel:([+\d\s().-]{7,})["']/gi)].map((m) => m[1].trim()))],
    emails: [...new Set([...html.matchAll(/href=["']mailto:([^"'?\s]+@[^"'?\s]+)["']/gi)].map((m) => m[1].toLowerCase()))],
  };
};

/** Signals from an audit, with the keys config/scoring.ts reads. Unreachable sites write only `website_unreachable`. */
export const auditSignals = (f: AuditFindings, listType: ListType): { key: string; value: boolean | number | string }[] => {
  if (!f.reachable) return [{ key: "website_unreachable", value: true }];
  const out: { key: string; value: boolean | number | string }[] = [
    { key: "no_https", value: !f.https },
    { key: "not_mobile_friendly", value: !f.mobileViewport },
    { key: "no_contact_form", value: !f.contactForm },
  ];
  if (f.pageSpeedMobile !== null) out.push({ key: "pagespeed_mobile", value: f.pageSpeedMobile });
  if (listType === "trades") {
    out.push({ key: "no_online_booking", value: !f.bookingWidget }, { key: "no_chat_widget", value: !f.chatWidget }, { key: "uses_ai_receptionist", value: !!f.aiReceptionist });
  } else {
    out.push(
      { key: "sales_office_phone_listed", value: f.phones.length > 0 },
      { key: "no_3d_unit_picker", value: !f.threeD && !f.unitPicker },
      { key: "static_renders_only", value: f.rendersGallery && !f.threeD },
      { key: "has_3d_vendor", value: !!f.threeD && f.threeD !== "three.js" },
    );
  }
  return out;
};

/** Short human summary for the activity timeline. */
export const auditSummary = (f: AuditFindings) =>
  !f.reachable
    ? "Website didn't load"
    : [
        f.https ? "HTTPS" : "no HTTPS",
        f.mobileViewport ? "mobile-ready" : "not mobile-ready",
        f.contactForm ? "contact form" : "no contact form",
        f.bookingWidget ? `booking: ${f.bookingWidget}` : "no online booking",
        f.chatWidget ? `chat: ${f.chatWidget}` : "no chat",
        f.aiReceptionist ? `AI receptionist: ${f.aiReceptionist}` : null,
        f.threeD ? `3D: ${f.threeD}` : f.unitPicker ? "unit picker" : null,
        f.pageSpeedMobile !== null ? `PageSpeed ${f.pageSpeedMobile}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

/** Demo stand-in for the Playwright worker: a deterministic page per domain. */
const FAKE_PHONE: Record<string, (n: number) => string> = {
  US: (n) => `+1 512 ${String(200 + (n % 700)).padStart(3, "0")} ${String(1000 + (n % 8999))}`,
  GB: (n) => `+44 20 7${String(100 + (n % 899))} ${String(1000 + (n % 8999))}`,
  CH: (n) => `+41 44 ${String(200 + (n % 700))} ${String(10 + (n % 89))} ${String(10 + ((n >> 3) % 89))}`,
  AE: (n) => `+971 4 ${String(200 + (n % 700))} ${String(1000 + (n % 8999))}`,
};

export const fakeSnapshot = (domain: string, listType: ListType, country = "US"): PageSnapshot => {
  const h = (k: string) => hash01(`${k}:${domain}`);
  if (h("down") < 0.04) return { url: `http://${domain}`, finalUrl: `http://${domain}`, status: 503, html: "" };
  const https = h("https") > 0.15;
  const parts = [
    "<html><head>",
    h("viewport") > 0.2 ? '<meta name="viewport" content="width=device-width, initial-scale=1">' : "",
    "</head><body>",
    h("form") > 0.35 ? '<form action="/contact"><input type="email" name="email"><textarea></textarea></form>' : "",
    h("tel") > 0.15 ? `<a href="tel:${(FAKE_PHONE[country] ?? FAKE_PHONE.US)(Math.floor(h("telNo") * 1e7))}">Call us</a>` : "",
    h("mail") > 0.25 ? `<a href="mailto:${h("mailbox") > 0.5 ? "info" : "sales"}@${domain}">Email us</a>` : "",
  ];
  if (listType === "trades") {
    if (h("booking") > 0.62) parts.push(h("bookingKind") > 0.5 ? '<script src="https://online-booking.housecallpro.com/script.js"></script>' : "<a href='/book'>Book online</a>");
    if (h("chat") > 0.7) parts.push('<script src="https://embed.tawk.to/abc/default"></script>');
    if (h("ai") > 0.93) parts.push('<script src="https://app.smith.ai/widget.js"></script>');
  } else {
    if (h("3d") > 0.78) parts.push(h("3dKind") > 0.5 ? '<iframe src="https://my.matterport.com/show/?m=x"></iframe>' : '<div class="unit-picker"></div>');
    if (h("renders") > 0.3) parts.push('<img src="/img/render-01.jpg" alt="render">');
  }
  parts.push("</body></html>");
  return { url: `http://${domain}`, finalUrl: `${https ? "https" : "http"}://${domain}/`, status: 200, html: parts.join(""), pageSpeedMobile: Math.round(25 + h("psi") * 70) };
};
