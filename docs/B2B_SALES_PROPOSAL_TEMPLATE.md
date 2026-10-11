# COMMERCIAL PROPOSAL & SERVICE LEVEL AGREEMENT (SLA)
## OPS: Digital Equipment Operations & Shift Verification Platform

**Prepared for:** [Client Company Name / Mining & Plant Hire Contractor]  
**Attention:** [Managing Director / Operations Director / Fleet Manager]  
**Prepared by:** OPS Commercial Operations  
**Date:** [Date, e.g. October 2026]  
**Document Ref:** OPS-PROP-[CLIENT_CODE]-2026-V1  
**Validity:** 30 Days from date of issue  

---

## 1. Executive Summary

In heavy plant hire, contract crushing and screening, earthmoving, and open-cast mining operations, profitability hinges on a single metric: **verified billable machine hours**.

Yet every month, equipment owners and contractors lose an estimated **4% to 12% of total invoice value** due to:
- Disputed end-of-month downtime between contractor and client site.
- Inability to prove whether an idle machine stopped due to mechanical breakdown or client-caused operational delay (e.g. wet feed, no haul trucks, lack of loader, blast delays).
- Lost, grease-stained, or illegible paper timesheets and forged hour meter logs.
- Preventable catastrophic component failures caused by pencil-whipped or missed pre-start inspections.
- Unmonitored diesel consumption and unaccounted storeroom parts.

**OPS** is an offline-first, tamper-proof equipment operations platform engineered specifically for the harsh conditions of mining, quarrying, and plant rental. 

By capturing verified machine hour meter photographs at shift start and end, enforcing digital pre-start inspections, attributing downtime to contractual owners (Contractor vs Hire Firm vs Client Site), and securing daily digital supervisor sign-off on the machine, OPS **eliminates billing disputes before month-end invoices are ever generated**.

This proposal outlines a turnkey commercial deployment of OPS for **[Client Company Name]**, starting with a **30-Day Risk-Free Field Pilot** on an active site.

---

## 2. The Operational Challenge: Why Paper & WhatsApp Fail

Modern heavy machinery represents millions in capital expenditure, yet field operations are often managed through 1980s methods:

```
[Field Operator]                [Site Office]                   [Head Office / Billing]
Greasy paper logbook     -->    Spreadsheet re-entry     -->    Month-end invoice
Disputed meter times     -->    Lost shift records       -->    Client refuses payment
No proof of why stopped  -->    WhatsApp messages lost   -->    Write-offs & delayed cash
```

### The 4 Major Financial Leaks in Plant & Mining Operations:

| Operational Breakdown | Business Impact | The OPS Solution |
| :--- | :--- | :--- |
| **Disputed Downtime & Lost Hours** | Clients claim machines broke down; contractors absorb 10–30 hours of deductions per machine per month. | **Contractual Downtime Attribution:** Every stop requires an assigned owner (Contractor, Wear, or Site) and is signed off daily by the site supervisor on-site. |
| **Unverified Hour Meter Readings** | Operators write estimates or round numbers on paper, leading to invoice audits and distrust. | **Timestamped Meter Photos:** The opening and closing physical hour meter photos are permanently embedded in the digital shift record. |
| **Remote Site Connectivity Blackouts** | Cloud apps fail in deep pits and remote quarries with zero cellular reception. | **100% Offline-First Architecture:** Local IndexedDB PWA allows complete shift logging and sign-off without signal; syncs automatically upon reconnecting. |
| **Pencil-Whipped Pre-Starts & Breakdowns** | Operators skip physical inspections, missing bearing knocks or oil leaks until catastrophic seizure. | **Digital Pre-Start Checklist:** Tailored checklists per machine type (crushers, screens, excavators) with photo capture and voice defect reporting. |

---

## 3. The OPS Platform Solution

OPS connects the four critical roles around every piece of heavy machinery into one verified chain of custody:

```
1. OPERATOR           2. SUPERVISOR           3. MECHANIC           4. MANAGEMENT
   Clock in              Live site oversight     Defect triage         Productivity pulse
   Pre-start safety      Verify meter photos     Repair work orders    Verified billables
   Meter photo proof     Contractual downtime    Parts inventory       Fuel burn audit
   Run/Stop tracking     Digital signature       Inspection wizard     Excel & PDF exports
```

### Key Modules & Capabilities:

#### A. Operator Shift Execution (Offline PWA)
- **Zero-Friction Interface:** Big industrial touch targets, voice-to-text logging, and high-contrast night/sunlight readability.
- **Physical Meter Photo Audit:** Mandatory photographic capture of the analog/digital hour meter at shift opening and closing.
- **Dynamic Pre-Start Checklists:** Specific walkaround checks for screens, crushers, excavators, ADTs, and loaders.
- **Precision Downtime Capture:** One-tap stop logging with categorized contractual attribution:
  - *Contractor Mechanical:* Engine, hydraulic, electrical, gearbox (deducted from billing).
  - *Consumables & Wear:* Belts, skirting, screen mesh, impact bars (per hire agreement).
  - *Client Site Delays:* Waiting for trucks, wet feed, oversize rock, rain, blasting (contractor is paid full shift rate).

#### B. Supervisor Shift Verification & Digital Sign-Off
- **Field Verification Screen:** Daily shift reconciliation showing total clock time vs machine hours vs billable hours.
- **Tamper-Proof Sign-Off:** Digital on-screen signature pad signed by the client's site representative or quarry supervisor daily.
- **Correction Loop:** Supervisor can reject incorrect meter readings or disputed stop reasons back to the operator with notes for immediate field correction.

#### C. Maintenance & Storeroom Integration
- **Closed-Loop Defect Reporting:** Problems reported by operators instantly generate work tickets for site mechanics.
- **Mechanic Inspection Wizard:** Structured technical evaluations for preventive maintenance and scheduled services.
- **Inventory & Parts Tracking:** Bearings, hoses, filters, and rollers deducted directly from storeroom stock as repairs are executed.

#### D. Executive Control & Automated Dispatch
- **Productivity Pulse:** Visual timeline of runtime vs stopped time across every machine on every site.
- **Automated WhatsApp Dispatch Reports:** Instant end-of-shift executive summaries dispatched to WhatsApp groups for management.
- **Commercial Reports & Timesheets:** One-click generation of PDF shift certificates and Excel billing exports formatted for accounting systems (Xero, Sage, QuickBooks, SAP).

---

## 4. Implementation & 14-Day Field Rollout Plan

OPS is designed for zero operational disruption. Deployment requires no hardware modifications, no telematics splicing, and minimal training.

```
[Day 1 - 3]                   [Day 4 - 7]                   [Day 8 - 14]
Setup & Configuration   -->   Supervisor & Pilot Training   -->   Parallel Run & Verification
- Site & machine profiles     - Supervisor & mechanic app   - Live shifts on pilot fleet
- Custom pre-start items      - Operator 15-min walkaround   - Daily WhatsApp reports
- Contractual stop rules      - Offline verification test   - Sign-off validation audit
```

### Detailed Deployment Milestones:

- **Phase 1: Configuration & Machine Onboarding (Days 1–3)**
  - Load [Client Company] sites, machines, serial numbers, and opening hour meters.
  - Configure contractual stop reason rules and downtime ownership matrices according to your client SLAs.
  - Set up user profiles and role-based permissions (Operators, Mechanics, Supervisors, Managers).

- **Phase 2: Field Training & Tooling (Days 4–7)**
  - 15-minute hands-on training for operators on mobile devices.
  - Supervisor onboarding on verification, digital sign-off, and correction workflows.
  - Setup of automated WhatsApp dispatch groups for daily shift notifications.

- **Phase 3: Pilot Parallel Run (Days 8–14)**
  - Execute live shifts alongside existing paper logs.
  - Validate offline sync from pit to office.
  - Verify first automated PDF shift certificates and billing export accuracy.

- **Phase 4: Full Fleet Rollout & Sign-Off (Day 15+)**
  - Transition entire fleet to paperless digital verification.

---

## 5. Commercial Investment & Pricing Schedule

OPS operates on a simple, transparent **per-machine subscription model**. There are **no per-seat penalties**; operators, mechanics, supervisors, and administrative users are all unlimited.

### Commercial Subscription Options:

| Fleet Plan | Machines Included | Monthly Billing | Annual Billing (15% Discount) |
| :--- | :--- | :--- | :--- |
| **Starter Fleet** | 1 to 5 Machines | R1,450 / $89 per machine / mo | **R1,250 / $75** per machine / mo |
| **Professional Fleet** *(Recommended)* | 6 to 25 Machines | R1,150 / $69 per machine / mo | **R980 / $59** per machine / mo |
| **Enterprise Fleet** | 25+ Machines / Multi-Site | R890 / $49 per machine / mo | **R750 / $39** per machine / mo |

### Recommended Scope for [Client Company Name]:

- **Fleet Size:** [e.g. 10 Active Machines]
- **Recommended Tier:** **Professional Fleet**
- **Contract Term:** 12-Month Annual Agreement (following 30-Day Pilot)
- **Monthly Investment:** [e.g. 10 machines × R980 = R9,800 / month / $590 / month]
- **One-Time Implementation & Onboarding:** [e.g. R6,500 / $450] *(Waived with annual commitment)*

### What is Included in Your Subscription:
- Unlimited operator, mechanic, supervisor, and managerial user accounts.
- Offline-first PWA for unlimited mobile devices (Android / iOS / Tablets).
- Automated daily WhatsApp executive shift dispatch.
- PDF Shift Certificate generator with embedded meter photos and digital signatures.
- Storeroom parts inventory & maintenance work order module.
- 99.9% Cloud SLA uptime guarantee with automated daily cloud backups.
- Ongoing software updates, security patches, and priority WhatsApp/email technical support.

---

## 6. The 30-Day Risk-Free Field Pilot Agreement

We believe software for heavy industry must prove itself in the dirt, not in a conference room. We offer **[Client Company Name]** our **30-Day Risk-Free Field Pilot**:

1. **Scope:** Deploy OPS on **one active site** across **up to three (3) machines** for 30 consecutive calendar days.
2. **Implementation:** OPS technical staff configures your site, machines, and checklists within 48 hours.
3. **Success Criteria:**
   - 100% of pilot shifts captured with verified meter photos and digital pre-starts.
   - Zero disputed downtime hours on pilot machines at month-end invoicing.
   - Daily automated WhatsApp shift reports delivered to management by 18:00.
4. **Guarantee:** If [Client Company Name] is not 100% satisfied that OPS has recovered more than its subscription cost in protected billable hours and administrative time, **you owe nothing for the software usage**.

---

## 7. Return on Investment (ROI) Analysis for [Client Company Name]

Based on industry benchmarks across plant hire and quarrying operations:

```
PROPOSED FLEET: 10 Machines
AVERAGE BILLING RATE: R1,850 / $120 per hour
ESTIMATED DISPUTED HOURS ELIMINATED: 6 hours per machine / month

Monthly Revenue Protected: 10 machines × 6 hours × R1,850 = R111,000 / month ($7,200 / mo)
Annual Revenue Protected:  R1,332,000 / year ($86,400 / yr)
Annual OPS Investment:     R117,600 / year ($7,080 / yr)

NET ANNUAL CASH GAIN:      +R1,214,400 / year ($79,320 / yr)
ESTIMATED ROI MULTIPLIER:  11.3x Return on Investment
```

*In addition to direct billing recovery, OPS prevents an estimated R50,000–R250,000 in catastrophic repair costs annually through verified pre-start defect detection.*

---

## 8. Data Security, Offline Architecture & Governance

- **Local-First Reliability:** Data is persisted locally in device IndexedDB storage before any network call. If a device runs out of battery or is rebooted in a dead zone, no shift data is lost.
- **Tamper-Proof Audit Trail:** Shift entries, meter photos, and digital signatures are immutable once verified by the supervisor. Any shift correction is recorded in the system audit log.
- **Enterprise Cloud Security:** Hosted on secure Supabase infrastructure with encrypted TLS in transit and AES-256 encryption at rest.
- **Data Ownership:** [Client Company Name] retains full and exclusive ownership of all operational, machine, and financial data. Complete raw data can be exported at any time in Excel, CSV, or PDF format.

---

## 9. Acceptance & Authorization

To approve this proposal and initiate the **30-Day Risk-Free Field Pilot**, please sign below and return a copy via email to **operations@ops-app.com** [or your company email]:

### Approved on behalf of [Client Company Name]:

**Authorized Signature:** ______________________________________  
**Name:** ____________________________________________________  
**Title:** ___________________________________________________  
**Date:** ____________________________________________________  

### Accepted on behalf of OPS Operations:

**Authorized Signature:** ______________________________________  
**Name:** ____________________________________________________  
**Title:** Commercial Director  
**Date:** ____________________________________________________  

---
*OPS Platform — One machine. One shift. One verified record.*
