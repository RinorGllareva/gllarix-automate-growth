
# Create Terms of Service & Privacy Policy Pages + Fix Build Error

## Overview
Three things to deliver:
1. Fix the build error in the edge function (`replyTo` → `reply_to`)
2. Create `src/pages/Terms.tsx` — full Terms of Service page at `/terms`
3. Create `src/pages/Privacy.tsx` — full Privacy Policy page at `/privacy`
4. Register both new routes in `src/App.tsx`
5. Update all footer links so `/privacy` and `/terms` point correctly (the footer already uses `/privacy` and `/terms` so those are fine, but the Cookie Policy link at `/cookies` will also get a page)

---

## 1. Fix Build Error

**File:** `supabase/functions/send-contact-email/index.ts`

Line 45: Change `replyTo: email` → `reply_to: email`

This is the only thing causing the TypeScript build error. The Resend SDK `CreateEmailOptions` type uses `reply_to` (snake_case), not `replyTo`.

---

## 2. Terms of Service Page (`/terms`)

**File:** `src/pages/Terms.tsx`

Full professional Terms of Service page matching the site's dark design system (black background, purple primary color, same Navigation and Footer). Content covers all standard legal sections for an AI SaaS company:

- Effective date: February 19, 2026
- Acceptance of Terms
- Description of Services (AI Voice Agents, Business Automation)
- User Accounts and Responsibilities
- Acceptable Use Policy
- Payment and Billing
- Intellectual Property
- Limitation of Liability
- Indemnification
- Termination
- Governing Law (Kosovo jurisdiction)
- Changes to Terms
- Contact Information (hello@gllarix.com)

**Layout:**
- Navigation at top
- Hero section: pill badge "Legal", large heading "Terms of Service", last updated date
- Scrollable content in a max-w-4xl centered container with dark card background (`bg-white/5 border border-white/10 rounded-2xl`)
- Each section has a numbered heading (1., 2., etc.) in white, body text in `text-gray-400`
- Smooth prose layout with proper spacing
- Footer at bottom

---

## 3. Privacy Policy Page (`/privacy`)

**File:** `src/pages/Privacy.tsx`

Full GDPR-compliant Privacy Policy page matching the same design. Content covers:

- Effective date: February 19, 2026
- Introduction and Data Controller info (Gllarix, Prishtinë, Kosovo)
- Information We Collect (personal data, usage data, cookies)
- How We Use Your Information (service delivery, communication, analytics)
- Legal Basis for Processing (GDPR Article 6)
- Data Sharing and Third Parties (Resend for email, no selling of data)
- Data Retention
- Your Rights (GDPR rights: access, erasure, portability, objection)
- Cookies Policy
- International Transfers
- Children's Privacy
- Changes to This Policy
- Contact (hello@gllarix.com, DPO contact)

**Layout:** Same dark design as Terms page.

---

## 4. Route Registration

**File:** `src/App.tsx`

Add two new imports and two new `<Route>` entries:
```
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

<Route path="/terms" element={<Terms />} />
<Route path="/privacy" element={<Privacy />} />
```

---

## 5. Footer Link Alignment

**File:** `src/components/Footer.tsx`

The footer already uses `/privacy` and `/terms` in both the footer sections grid and the bottom bar — these are already correct. The only change needed is updating the Cookie Policy link from `/cookies` to `/privacy#cookies` so it scrolls to the cookies section of the Privacy page (since we won't create a separate cookies page). This is optional but cleaner than having a broken link.

---

## Technical Notes

- Both pages use the exact same design language as `BookMeeting.tsx` and `Contact.tsx`
- No new dependencies needed — pure React + Tailwind + existing components
- Both pages include `<Navigation />` and `<Footer />` for consistency
- The `sitemap.xml` already has `/terms` but is missing `/privacy` — that's a static file not worth modifying now
- The build error fix is critical and must be applied first before the other changes
