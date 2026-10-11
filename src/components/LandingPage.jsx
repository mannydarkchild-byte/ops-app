import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./AppShell.jsx";
import "../landing.css";

const NAV = [
  { href: "#about", label: "About Us" },
  { href: "#solutions", label: "Solutions" },
  { href: "#fleet", label: "Plant & Fleet" },
  { href: "#how", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
];

function PulseBoard() {
  const ref = useRef(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setOn(true);
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const blocks = [
    { kind: "run", label: "Productive Screening", flex: 180 },
    { kind: "stop", label: "Site Standing Time (Wait Trucks)", flex: 35 },
    { kind: "run", label: "Productive Screening", flex: 150 },
    { kind: "stop", label: "Site Standing Time (Quarry Blasting)", flex: 30 },
    { kind: "run", label: "Productive Screening", flex: 70 },
  ];

  return (
    <div className={on ? "ops-pulse is-on" : "ops-pulse"} ref={ref}>
      <div className="ops-pulse-scale">
        <span>06:00 (Shift Start)</span>
        <span>11:30 (Mid-Shift Check)</span>
        <span>17:00 (Shift End)</span>
      </div>
      <div className="ops-pulse-track" aria-hidden>
        {blocks.map((block, i) => (
          <div
            key={`${block.kind}-${i}`}
            className={`ops-pulse-block ops-pulse-${block.kind}`}
            style={{ flex: block.flex }}
            title={`${block.label}`}
          />
        ))}
      </div>
      <div className="ops-pulse-legend">
        <span><i className="ops-pulse-run" /> Productive Runtime</span>
        <span><i className="ops-pulse-stop" /> Client Site Standing Time</span>
      </div>
      <div className="ops-metrics">
        <p><strong>6h 40m</strong><span>Verified Runtime</span></p>
        <p><strong>1h 05m</strong><span>Attributed Standing Time</span></p>
        <p><strong style={{ color: "var(--gold)" }}>6.6h</strong><span>Hour-Meter Advance</span></p>
      </div>
    </div>
  );
}

function FleetSection() {
  const fleet = [
    {
      tag: "Processing Plant",
      title: "Crushing & Screening Plant",
      sub: "Mobile crushers, screens and feeder equipment",
      img: "/assets/powerscreen-warrior-2100-fel.jpg",
      alt: "Mobile screening plant being fed by a front end loader",
      desc: "Opencast scalping, aggregate screening, and heavy overburden processing. Tracks hopper feed starvation vs productive screening time.",
      specs: [
        "Hopper feed starvation vs productive screening hours",
        "Screen mesh wear & stoppage tracking",
        "Engine hour-meter vs feeder runtime reconciliation",
        "Pre-start hydraulic fluid, belt tracking & safety audit",
      ],
    },
    {
      tag: "Loading & Earthmoving",
      title: "Front End Loaders & Dozers",
      sub: "Loading, stockpiling, feeding and ground preparation",
      img: "/assets/front-end-loader-fel.jpg",
      alt: "Front End Loader handling crushed rock aggregate at quarry stockpile",
      desc: "Crusher hopper feeding, bench loading, aggregate stockpile management, and road truck dispatch.",
      specs: [
        "Crusher hopper loading & stockpile dispatch cycles",
        "Idle fuel burn vs productive working hours",
        "Bucket teeth & ground engaging tools (GET) wear",
        "Daily diesel refuelling & litres-per-hour consumption",
      ],
    },
    {
      tag: "Excavation & Haulage",
      title: "Excavators & Dump Trucks",
      sub: "Excavation, loading and material haulage",
      img: "/assets/bell-adt-mining.jpg",
      alt: "Articulated dump truck hauling rock in an opencast pit",
      desc: "Heavy earthmoving and blasted rock haulage from opencast pit benches across steep haul roads.",
      specs: [
        "Haul cycle delays & pit bench standing time",
        "Haul road maintenance & rain stoppages logged",
        "Diesel bowser reconciliation & shift consumption",
        "Pre-start retarder, brake test & tyre inspection",
      ],
    },
  ];

  return (
    <section className="ops-band" id="fleet">
      <div className="ops-wrap">
        <p className="ops-kicker">Plant &amp; Fleet</p>
        <h2>Built for the machines that build and mine South Africa.</h2>
        <p className="ops-lede">
          From dozers, front end loaders and excavators to crushers, screens and haul trucks, OPS captures the operating records your plant hire and processing contracts demand.
        </p>

        <div className="ops-fleet-grid">
          {fleet.map((item) => (
            <article key={item.title} className="ops-fleet-card">
              <div className="ops-fleet-photo">
                <img src={item.img} alt={item.alt} />
              </div>
              <div className="ops-fleet-body">
                <span className="ops-fleet-tag">{item.tag}</span>
                <h3>{item.title}</h3>
                <p className="ops-fleet-sub">{item.sub}</p>
                <p className="ops-fleet-desc">{item.desc}</p>
                <ul className="ops-fleet-specs">
                  {item.specs.map((spec) => (
                    <li key={spec}>{spec}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection() {
  const pillars = [
    {
      tag: "Ground Reality",
      title: "Built in the Dirt, Not a Lab",
      desc: "OPS was built by people who understand what it takes to keep crushing and screening plant running, how loaders feed production, and what happens when an opencast pit has no haul trucks. We set out to solve the real operational friction between plant contractors and site management.",
    },
    {
      tag: "Offline First",
      title: "Engineered for Remote Sites",
      desc: "In South Africa, quarries, borrow pits, and opencast benches frequently operate with zero Vodacom or MTN signal. OPS functions 100% offline on standard smartphones and synchronises automatically the moment connectivity is restored.",
    },
    {
      tag: "Fair Contracts",
      title: "Clear Contractual Standing Time",
      desc: "Under South African plant hire terms, mechanical breakdowns are deducted from shift billing, while client site delays (waiting for feed, weather, blasting) are Standing Time and paid in full. OPS provides certified proof so neither party is shortchanged.",
    },
  ];

  return (
    <section className="ops-band ops-band-alt" id="about">
      <div className="ops-wrap">
        <p className="ops-kicker">About Us</p>
        <h2>Built for the operational realities of South African plant and quarry sites.</h2>
        <p className="ops-lede">
          We founded OPS to eliminate paper logbooks, grease-stained timesheets, and month-end invoice cuts. We provide plant hire firms, crushing contractors, and opencast mining operators with one indisputable digital record of every machine shift.
        </p>

        <div className="ops-about-grid">
          {pillars.map((p) => (
            <article key={p.title} className="ops-about-card">
              <strong>{p.tag}</strong>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OperationsRoles() {
  const roles = [
    {
      tag: "Operator",
      title: "Records the shift",
      lead: "On the machine cab",
      desc: "Clock in, pre-start inspection walkaround, opening meter photo, running and stopped time logging, diesel bowser litres, and machine defect reporting.",
    },
    {
      tag: "Supervisor",
      title: "Verifies the shift",
      lead: "On site at shift end",
      desc: "Reviews opening and closing meter photos, verifies standing time vs breakdown attribution, and signs on glass before the shift closes.",
    },
    {
      tag: "Mechanic / Fitter",
      title: "Responds to problems",
      lead: "Field workshop & site repairs",
      desc: "Receives defect reports directly from pre-start checks, manages repair job cards, logs labour hours, and requisitions parts from site inventory.",
    },
    {
      tag: "Manager / Director",
      title: "Controls the operation",
      lead: "Operations & commercial billing",
      desc: "Live fleet visibility across sites, verified machine hours, standing time attribution, diesel burn rates, recorded shift costs, and export reports.",
    },
  ];

  return (
    <section className="ops-band" id="roles">
      <div className="ops-wrap">
        <p className="ops-kicker">Operations</p>
        <h2>Built for the people around the machine.</h2>
        <p className="ops-lede">
          OPS connects every operational link on site — from the operator in the cab to the supervisor on site, the mechanic in the workshop, and management in the office.
        </p>

        <div className="ops-roles-grid">
          {roles.map((role) => (
            <article key={role.tag} className="ops-role-card">
              <p className="ops-role-tag">{role.tag}</p>
              <h3>{role.title}</h3>
              <p className="ops-role-lead">{role.lead}</p>
              <p>{role.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RoiCalculator() {
  const [currency, setCurrency] = useState("ZAR");
  const [fleetSize, setFleetSize] = useState(8);
  const [hourlyRate, setHourlyRate] = useState(1850);
  const [disputedHours, setDisputedHours] = useState(6);

  const handleCurrencyChange = (newCur) => {
    setCurrency(newCur);
    if (newCur === "ZAR") {
      setHourlyRate(1850);
    } else {
      setHourlyRate(120);
    }
  };

  const symbol = currency === "ZAR" ? "R" : "$";
  const monthlyRevenueProtected = fleetSize * disputedHours * hourlyRate;
  const annualRevenueProtected = monthlyRevenueProtected * 12;
  const perMachineCost = currency === "ZAR" ? 980 : 59;
  const monthlySoftwareCost = fleetSize * perMachineCost;
  const monthlyNetBenefit = monthlyRevenueProtected - monthlySoftwareCost;
  const annualRoiMultiple = Math.max(1, Math.round(annualRevenueProtected / (monthlySoftwareCost * 12)));

  return (
    <section className="ops-band ops-band-alt" id="roi">
      <div className="ops-wrap">
        <div className="ops-pricing-header">
          <div>
            <p className="ops-kicker">Revenue Protection</p>
            <h2>Calculate the revenue protected across your fleet.</h2>
            <p className="ops-lede">
              Contested standing time and missing hour-meter logs cost plant hire and earthmoving contractors tens of thousands of Rands each month. See what OPS saves your business.
            </p>
          </div>
          <div className="ops-toggles">
            <div className="ops-toggle-pill" role="group" aria-label="Currency">
              <button
                type="button"
                className={`ops-toggle-btn ${currency === "ZAR" ? "is-active" : ""}`}
                onClick={() => handleCurrencyChange("ZAR")}
              >
                ZAR (Rands)
              </button>
              <button
                type="button"
                className={`ops-toggle-btn ${currency === "USD" ? "is-active" : ""}`}
                onClick={() => handleCurrencyChange("USD")}
              >
                USD ($)
              </button>
            </div>
          </div>
        </div>

        <div className="ops-roi-calc">
          <div className="ops-roi-controls">
            <div className="ops-roi-control">
              <div className="ops-roi-label">
                <span>Active machines in fleet</span>
                <strong>{fleetSize} {fleetSize === 1 ? "machine" : "machines"}</strong>
              </div>
              <input
                type="range"
                className="ops-roi-slider"
                min="1"
                max="50"
                value={fleetSize}
                onChange={(e) => setFleetSize(Number(e.target.value))}
              />
            </div>

            <div className="ops-roi-control">
              <div className="ops-roi-label">
                <span>Average machine hourly rate</span>
                <strong>{symbol}{hourlyRate.toLocaleString()} / hour</strong>
              </div>
              <input
                type="range"
                className="ops-roi-slider"
                min={currency === "ZAR" ? 600 : 50}
                max={currency === "ZAR" ? 4500 : 350}
                step={currency === "ZAR" ? 50 : 5}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(Number(e.target.value))}
              />
            </div>

            <div className="ops-roi-control">
              <div className="ops-roi-label">
                <span>Contested / unverified standing hours saved per machine / month</span>
                <strong>{disputedHours} hours / month</strong>
              </div>
              <input
                type="range"
                className="ops-roi-slider"
                min="1"
                max="25"
                value={disputedHours}
                onChange={(e) => setDisputedHours(Number(e.target.value))}
              />
            </div>

            <p style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.5 }}>
              Industry benchmark: Between 4 and 8 hours of contested standing time per machine per month are eliminated through opening and closing hour-meter photos and supervisor sign-off on site.
            </p>
          </div>

          <div className="ops-roi-results">
            <div className="ops-roi-stat-hero">
              <span>Estimated Annual Revenue Protected</span>
              <strong>{symbol}{annualRevenueProtected.toLocaleString()}</strong>
            </div>

            <div className="ops-roi-breakdown">
              <div className="ops-roi-row">
                <span>Monthly revenue saved</span>
                <strong>{symbol}{monthlyRevenueProtected.toLocaleString()} / mo</strong>
              </div>
              <div className="ops-roi-row">
                <span>Estimated OPS investment</span>
                <strong>{symbol}{monthlySoftwareCost.toLocaleString()} / mo</strong>
              </div>
              <div className="ops-roi-row">
                <span>Net monthly cashflow gain</span>
                <strong style={{ color: "var(--green)" }}>+{symbol}{monthlyNetBenefit.toLocaleString()} / mo</strong>
              </div>
              <div className="ops-roi-row">
                <span>Estimated ROI multiplier</span>
                <strong>{annualRoiMultiple}x return on investment</strong>
              </div>
            </div>

            <a href="#contact" className="ops-btn ops-btn-gold" style={{ textAlign: "center" }}>
              Protect Your Fleet Revenue
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const [currency, setCurrency] = useState("ZAR");
  const [annual, setAnnual] = useState(true);
  const symbol = currency === "ZAR" ? "R" : "$";

  const tiers = [
    {
      name: "Starter Fleet",
      desc: "For small plant hire fleets and owner-operators needing verified shifts, meter photos, and pre-starts.",
      price: annual
        ? (currency === "ZAR" ? 1250 : 75)
        : (currency === "ZAR" ? 1450 : 89),
      unit: "machine / month",
      featured: false,
      features: [
        "1 to 5 machines",
        "Pre-start machine safety checklist",
        "Opening & closing hour-meter photos",
        "100% Offline-first (works with zero pit signal)",
        "Daily shift start/stop timeline",
        "Supervisor digital sign-off on site",
        "Daily PDF shift certificates",
      ],
      cta: "Start 30-Day Pilot",
    },
    {
      name: "Professional Fleet",
      desc: "Our standard operational tier for plant hire, contract crushing, and earthmoving fleets.",
      price: annual
        ? (currency === "ZAR" ? 980 : 59)
        : (currency === "ZAR" ? 1150 : 69),
      unit: "machine / month",
      featured: true,
      tag: "Most Popular",
      features: [
        "6 to 25 machines",
        "Everything in Starter Fleet",
        "Contractual standing time attribution (Contractor vs Site)",
        "Diesel fuel logs & burn reconciliation (L/hr)",
        "Mechanic app & machine repair job cards",
        "Site storeroom parts inventory deduction",
        "Daily WhatsApp shift summaries to management",
        "Shift data exports & timesheet calculations",
      ],
      cta: "Deploy Pro Fleet",
    },
    {
      name: "Enterprise Fleet",
      desc: "For multi-site opencast mining contractors and large-scale plant hire operations.",
      price: annual
        ? (currency === "ZAR" ? 750 : 39)
        : (currency === "ZAR" ? 890 : 49),
      unit: "machine / month",
      featured: false,
      features: [
        "25+ machines across multiple sites",
        "Everything in Professional Fleet",
        "Multi-site tenant segregation",
        "Expense and diesel reconciliation",
        "Custom contractor branding",
        "Custom contractual downtime billing rules",
        "Dedicated onboarding manager",
        "Guaranteed 99.9% uptime SLA",
      ],
      cta: "Request Enterprise Proposal",
    },
  ];

  return (
    <section className="ops-band" id="pricing">
      <div className="ops-wrap">
        <div className="ops-pricing-header">
          <div>
            <p className="ops-kicker">Simple Commercial Pricing</p>
            <h2>Per-machine pricing. Unlimited user seats.</h2>
            <p className="ops-lede">
              Zero per-seat penalties. Machine operators, field mechanics, site supervisors, and management are all included. Pay only for the active machines you run. Quoted in South African Rand (ZAR), excl. VAT.
            </p>
          </div>

          <div className="ops-toggles">
            <div className="ops-toggle-pill" role="group" aria-label="Currency">
              <button
                type="button"
                className={`ops-toggle-btn ${currency === "ZAR" ? "is-active" : ""}`}
                onClick={() => setCurrency("ZAR")}
              >
                ZAR (Rands)
              </button>
              <button
                type="button"
                className={`ops-toggle-btn ${currency === "USD" ? "is-active" : ""}`}
                onClick={() => setCurrency("USD")}
              >
                USD ($)
              </button>
            </div>

            <div className="ops-toggle-pill" role="group" aria-label="Billing frequency">
              <button
                type="button"
                className={`ops-toggle-btn ${!annual ? "is-active" : ""}`}
                onClick={() => setAnnual(false)}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`ops-toggle-btn ${annual ? "is-active" : ""}`}
                onClick={() => setAnnual(true)}
              >
                Annual <span className="ops-save-badge">Save 15%</span>
              </button>
            </div>
          </div>
        </div>

        <div className="ops-pricing-grid">
          {tiers.map((tier) => (
            <div key={tier.name} className={`ops-price-card ${tier.featured ? "is-featured" : ""}`}>
              {tier.tag && <span className="ops-featured-tag">{tier.tag}</span>}
              <h3 className="ops-price-title">{tier.name}</h3>
              <p className="ops-price-desc">{tier.desc}</p>
              <div className="ops-price-figure">
                <strong>{symbol}{tier.price.toLocaleString()}</strong>
                <span>/ {tier.unit}</span>
              </div>
              <ul className="ops-price-features">
                {tier.features.map((feat) => (
                  <li key={feat}>
                    <span className="ops-price-check">✓</span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <a href="#contact" className={`ops-btn ${tier.featured ? "ops-btn-gold" : "ops-btn-ghost"}`} style={{ textAlign: "center" }}>
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="ops-pilot-box" id="pilot">
          <div className="ops-pilot-info">
            <h3>The 30-Day Risk-Free Field Pilot</h3>
            <p>
              Heavy machinery requires proof on the site, not in a presentation. Deploy OPS on 1 site and up to 3 machines for 30 consecutive days. If OPS doesn&apos;t eliminate standing time disputes and bring order to your shift records, you pay nothing for software usage.
            </p>
          </div>
          <a href="#contact" className="ops-btn ops-btn-gold">
            Apply for Field Pilot
          </a>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const faqs = [
    {
      q: "What happens when machines operate in deep pits with zero cellular reception?",
      a: "OPS was engineered from day one as an offline-first Progressive Web App (PWA) using local IndexedDB storage. Operators complete pre-starts, log hour-meter photos, track stoppages, and supervisors sign shifts completely offline. Everything synchronises automatically to the cloud the moment the device reaches Wi-Fi or cellular signal.",
    },
    {
      q: "How does OPS handle contractor breakdowns vs client site standing time?",
      a: "Under standard South African plant hire agreements, mechanical breakdowns owned by the contractor are deducted from billable shift hours. Stoppages caused by the client site (waiting for material feed, waiting for haul trucks, site blasting, or site rain) are categorised as Standing Time — no hours are deducted, and the shift remains payable in full.",
    },
    {
      q: "Can machine operators use this on rugged Android phones with dirty hands or gloves?",
      a: "Yes. The Operator cab interface features high-contrast industrial buttons, oversized touch targets, voice-to-text recording, and quick photo capture. It requires minimal training and takes less than 10 minutes to onboard an operator.",
    },
    {
      q: "How does OPS track diesel fuel and prevent shrinkage?",
      a: "Every diesel refuel captures the machine's current hour-meter reading, litres pumped from the bowser, and optional dip readings. OPS calculates your litres-per-hour fuel burn against OEM benchmarks, immediately highlighting abnormal fuel consumption.",
    },
    {
      q: "Does OPS work across our specific machinery (dozers, loaders, excavators, screens and haulers)?",
      a: "Yes. OPS supports configurable checklists, inspection workflows, and operating records for dozers, front end loaders, excavators, graders, crushers, screens, articulated dump trucks, and other mobile or fixed plant.",
    },
    {
      q: "Do we need expensive proprietary telematics hardware to use OPS?",
      a: "No. OPS runs in any modern web browser on standard Android and iOS smartphones, rugged field tablets, and desktop computers. There is no proprietary hardware to purchase or wire into machine harnesses.",
    },
  ];

  return (
    <section className="ops-band ops-band-alt" id="faq">
      <div className="ops-wrap">
        <p className="ops-kicker">Operational Questions</p>
        <h2>Frequently asked questions.</h2>
        <div className="ops-faqs">
          {faqs.map((faq) => (
            <div key={faq.q} className="ops-faq-item">
              <h3>{faq.q}</h3>
              <p>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    machines: "",
    interest: "30-Day Risk-Free Field Pilot",
    message: "",
  });

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const requestDemo = (e) => {
    e.preventDefault();
    const body = [
      `Name: ${form.name}`,
      `Company: ${form.company}`,
      `Email: ${form.email}`,
      form.phone ? `Phone / WhatsApp: ${form.phone}` : "",
      form.machines ? `Fleet size / Machines: ${form.machines}` : "",
      `Interest: ${form.interest}`,
      "",
      form.message || `I am requesting information regarding OPS (${form.interest}) for our fleet.`,
    ].filter(Boolean).join("\n");
    const inbox = import.meta.env.VITE_DEMO_EMAIL || "";
    const href = `mailto:${inbox}?subject=${encodeURIComponent(`OPS ${form.interest} — ${form.company}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
    window.location.href = href;
  };

  return (
    <div className="ops-site">
      {/* Sticky Header Navigation — Standard South African Structure */}
      <header className={compact ? "ops-nav is-compact" : "ops-nav"}>
        <a className="ops-nav-brand" href="#top" onClick={closeMenu}>
          <LogoMark size="sm" />
          <span className="ops-nav-brand-text">OPS</span>
        </a>
        <nav className={menuOpen ? "is-open" : ""} aria-label="Page navigation">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>{item.label}</a>
          ))}
          <a className="ops-nav-mobile-cta" href="#contact" onClick={closeMenu}>Request Demo</a>
        </nav>
        <div className="ops-nav-actions">
          <a href="#contact" className="ops-btn ops-btn-gold">Request Demo</a>
          <button type="button" className="ops-btn ops-btn-ghost" onClick={onLogin}>Log In</button>
          <button
            type="button"
            className="ops-nav-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="ops-nav-menu-icon" />
          </button>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="ops-hero">
          <div className="ops-wrap ops-split">
            <div className="ops-hero-copy">
              <div className="ops-hero-badge">
                <span className="ops-hero-badge-dot" />
                South African Equipment Operations &amp; Shift Verification
              </div>
              <h1>Equipment operations for the people on the machine and the people who answer for it.</h1>
              <p className="ops-lede">
                Know exactly what your machine did today. OPS gives plant hire firms, contract crushing operators, and opencast mining contractors one verified record of every shift — with hour-meter photos, standing time attribution, and supervisor sign-off on site.
              </p>
              <div className="ops-hero-actions">
                <a className="ops-btn ops-btn-gold" href="#contact">Request 30-Day Field Pilot</a>
                <a className="ops-btn ops-btn-ghost" href="#how">See How It Works</a>
              </div>
              <div className="ops-hero-trust">
                <div className="ops-hero-trust-item">
                  <span style={{ color: "var(--gold)" }}>✓</span>
                  <strong>100% Offline</strong> (Zero pit signal needed)
                </div>
                <div className="ops-hero-trust-item">
                  <span style={{ color: "var(--gold)" }}>✓</span>
                  <strong>Signed on Site</strong> (Supervisor verification)
                </div>
                <div className="ops-hero-trust-item">
                  <span style={{ color: "var(--gold)" }}>✓</span>
                  <strong>Standing Time</strong> (Contractor vs site delay)
                </div>
              </div>
            </div>

            {/* Clean Real Photo — ZERO Overlays */}
            <div className="ops-media-column">
              <div className="ops-clean-photo">
                <img
                  src="/assets/powerscreen-warrior-2100-fel.jpg"
                  alt="Mobile screening plant loaded by a front end loader in a quarry operation"
                />
              </div>

              {/* Clean Telemetry Card Placed Underneath Photo */}
              <div className="ops-photo-caption-card">
                <div className="ops-caption-header">
                  <strong>Screening Plant &amp; Front End Loader · Day Shift</strong>
                  <span className="ops-caption-status">● Shift Verified</span>
                </div>
                <div className="ops-caption-grid">
                  <div className="ops-caption-stat">
                    <span>Hour Meter</span>
                    <strong>7.2 hrs</strong>
                  </div>
                  <div className="ops-caption-stat">
                    <span>Running</span>
                    <strong>7h 15m</strong>
                  </div>
                  <div className="ops-caption-stat">
                    <span>Standing Time</span>
                    <strong style={{ color: "var(--gold)" }}>1h 15m</strong>
                  </div>
                  <div className="ops-caption-stat">
                    <span>Diesel</span>
                    <strong>340 L</strong>
                  </div>
                </div>
                <div className="ops-caption-footer">
                  <span>✓ Verified and signed on site by client supervisor</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4-Pillar Value Strip */}
        <section className="ops-strip" aria-label="Core Capabilities">
          <div className="ops-strip-item">
            <strong>Verified Machine Hours</strong>
            <span>Opening and closing hour-meter photos permanently locked to each shift.</span>
          </div>
          <div className="ops-strip-item">
            <strong>Standing Time Attribution</strong>
            <span>Separates mechanical breakdowns from client site delays (no trucks, blasting, rain).</span>
          </div>
          <div className="ops-strip-item">
            <strong>Digital Sign-Off on Site</strong>
            <span>Client supervisor reviews meter photos and signs on glass at end of shift.</span>
          </div>
          <div className="ops-strip-item">
            <strong>100% Offline-First</strong>
            <span>Functions seamlessly in deep pits with zero signal; syncs automatically when online.</span>
          </div>
        </section>

        {/* Solutions Section */}
        <section className="ops-band" id="solutions">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Solutions</p>
              <h2>One machine. One shift. One verified record.</h2>
              <p className="ops-lede">
                OPS tells you what happened to your machine, when it happened, why it stopped, who was responsible, what was repaired, what parts were required, and what was spent.
              </p>
              <div className="ops-chain-steps">
                {["Machine", "Shift", "Hour Meter", "Running / Stopped", "Standing Time", "Problem", "Repair Job Card", "Parts", "Diesel", "Sign-Off", "Daily Report"].map((step, idx) => (
                  <span key={step} className="ops-chain-pill">
                    <strong>{String(idx + 1).padStart(2, "0")}</strong> {step}
                  </span>
                ))}
              </div>
            </div>

            {/* Clean Front End Loader Image + Clean Record Card */}
            <div className="ops-media-column">
              <div className="ops-clean-photo">
                <img
                  src="/assets/front-end-loader-fel.jpg"
                  alt="Front End Loader feeding aggregate into plant hopper"
                />
              </div>

              <div className="ops-record-card">
                <div className="ops-record-header">
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Shift Cost &amp; Hours Snapshot</span>
                  <span style={{ color: "var(--green)", fontSize: "0.82rem", fontWeight: 600 }}>● Complete Shift</span>
                </div>
                <dl className="ops-record-grid">
                  <dt>Machine</dt><dd>Front End Loader (FEL)</dd>
                  <dt>Opening SMR</dt><dd>4,120.4 hrs</dd>
                  <dt>Closing SMR</dt><dd>4,127.6 hrs</dd>
                  <dt>Productive Run</dt><dd>7h 15m</dd>
                  <dt>Site Standing Time</dt><dd>1h 15m (Waiting Trucks)</dd>
                  <dt>Diesel Refuel</dt><dd>310 Litres</dd>
                  <dt>Pre-Start Status</dt><dd style={{ color: "var(--green)" }}>Passed (0 Defects)</dd>
                  <dt>Verification</dt><dd style={{ color: "var(--gold)" }}>Signed on site</dd>
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="ops-band ops-band-alt" id="how">
          <div className="ops-wrap">
            <p className="ops-kicker">How It Works</p>
            <h2>From pre-start walkaround to verified shift certificate.</h2>
            <p className="ops-lede">
              A 5-step operational chain connecting the cab operator, field workshop, site supervisor, and management.
            </p>
            <ol className="ops-steps">
              <li className="ops-step-card">
                <span className="ops-step-num">01</span>
                <h3>Pre-Start Walkaround</h3>
                <p>Operator completes guided safety checklist with photo defect capture and voice notes before engine start.</p>
              </li>
              <li className="ops-step-card">
                <span className="ops-step-num">02</span>
                <h3>Hour-Meter Photo</h3>
                <p>Opening gauge photo taken on site, timestamped and permanently locked to the shift.</p>
              </li>
              <li className="ops-step-card">
                <span className="ops-step-num">03</span>
                <h3>Shift &amp; Standing Time</h3>
                <p>One-touch logging of productive runtime vs standing time with clear contractual attribution.</p>
              </li>
              <li className="ops-step-card">
                <span className="ops-step-num">04</span>
                <h3>Closing &amp; Diesel</h3>
                <p>Closing hour-meter photograph and diesel bowser refuel litres logged with tank dip readings.</p>
              </li>
              <li className="ops-step-card">
                <span className="ops-step-num">05</span>
                <h3>Sign-Off on Site</h3>
                <p>Client supervisor inspects shift totals and signs on glass. Shift certificate generated instantly.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* Yellow Metal Fleet Showcase */}
        <FleetSection />

        {/* Supervisor On-Site Verification */}
        <section className="ops-band" id="verification">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">On-Site Verification</p>
              <h2>The shift is not complete until it is verified on site.</h2>
              <p className="ops-lede">
                Paper timesheets get lost, grease-stained, or contested weeks later. OPS requires the client supervisor to review meter photos, check downtime reasons, and sign on glass at the end of the shift. If anything is incorrect, they send it back to the operator to correct.
              </p>
              <div style={{ marginTop: "1.75rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.85rem", padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.85rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
                  <strong style={{ color: "var(--ink)" }}>Daily Shift Verification</strong>
                  <span style={{ color: "var(--green)", fontWeight: 700, fontSize: "0.82rem" }}>READY FOR SIGNATURE</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.88rem" }}>
                  <div><span style={{ color: "var(--muted)" }}>Opening Meter:</span> <strong>3,428.4h</strong></div>
                  <div><span style={{ color: "var(--muted)" }}>Closing Meter:</span> <strong>3,435.6h</strong></div>
                  <div><span style={{ color: "var(--muted)" }}>Running Time:</span> <strong>7h 15m</strong></div>
                  <div><span style={{ color: "var(--muted)" }}>Site Standing Time:</span> <strong>1h 15m (Wait Trucks)</strong></div>
                  <div><span style={{ color: "var(--muted)" }}>Diesel Fuel:</span> <strong>340 Litres</strong></div>
                  <div><span style={{ color: "var(--muted)" }}>Fuel Burn:</span> <strong>47.2 L/hr (Normal)</strong></div>
                </div>
                <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: "var(--gold)" }}>
                  ✓ Client Site Delay (Standing Time) · Shift payable in full with zero contractor downtime deduction
                </p>
              </div>
            </div>

            {/* Clean Supervisor Image */}
            <div className="ops-clean-photo">
              <img
                src="/assets/supervisor-tablet.jpg"
                alt="Supervisor in hardhat using rugged tablet on site"
              />
            </div>
          </div>
        </section>

        {/* About Us Section */}
        <AboutSection />

        {/* 4 Roles Around the Machine */}
        <OperationsRoles />

        {/* Live Machine Shift Pulse */}
        <section className="ops-band ops-band-alt" id="pulse">
          <div className="ops-wrap">
            <p className="ops-kicker">Live Machine Pulse</p>
            <h2>See the machine&apos;s shift at a single glance.</h2>
            <p className="ops-lede">
              Every rise and fall shows what happened to the machine. Green when productive. Red when stopped. Clear contractual attribution ensures standing time is identified immediately.
            </p>
            <PulseBoard />
          </div>
        </section>

        {/* ROI Calculator */}
        <RoiCalculator />

        {/* Transparent Pricing */}
        <PricingSection />

        {/* FAQ Section */}
        <FaqSection />

        {/* Contact & Field Pilot Request */}
        <section className="ops-band" id="contact">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Get In Touch</p>
              <h2>Request a Demo, Field Pilot, or Quotation.</h2>
              <p className="ops-lede">
                Bring us one machine and one shift. We&apos;ll show you how OPS eliminates disputed hours, connects your operators to mechanics, and delivers one verified shift record — from the pit to your boardroom.
              </p>
              <div style={{ marginTop: "2rem", display: "grid", gap: "0.75rem" }}>
                <p style={{ color: "var(--gold)", fontWeight: 600 }}>✓ 30-Day Risk-Free Field Pilot available</p>
                <p style={{ color: "var(--muted)", fontSize: "0.92rem" }}>✓ 48-hour setup on your active site</p>
                <p style={{ color: "var(--muted)", fontSize: "0.92rem" }}>✓ Works 100% offline on standard smartphones and tablets</p>
                <p style={{ color: "var(--muted)", fontSize: "0.92rem" }}>✓ Clear downtime attribution between contractor and client</p>
              </div>
            </div>

            {sent ? (
              <div className="ops-form-sent">
                <h3>Request Prepared</h3>
                <p>Your default email client has been prepared with your request details.</p>
                <button type="button" className="ops-btn ops-btn-ghost" onClick={() => setSent(false)}>Edit Request</button>
              </div>
            ) : (
              <form className="ops-form" onSubmit={requestDemo}>
                <label>Name<input required name="name" autoComplete="name" value={form.name} onChange={setField("name")} placeholder="Your name" /></label>
                <label>Company<input required name="company" autoComplete="organization" value={form.company} onChange={setField("company")} placeholder="Company / Fleet name" /></label>
                <label>Work Email<input required type="email" name="email" autoComplete="email" value={form.email} onChange={setField("email")} placeholder="work@company.com" /></label>
                <label>Phone / WhatsApp<input name="phone" autoComplete="tel" value={form.phone} onChange={setField("phone")} placeholder="+27 ..." /></label>
                <label className="ops-form-wide">Fleet Size / Machine Types<input name="machines" value={form.machines} onChange={setField("machines")} placeholder="e.g. 10 machines (screens, wheel loaders, ADTs, excavators)" /></label>

                <label className="ops-form-wide">
                  What are you looking for?
                  <select
                    name="interest"
                    value={form.interest}
                    onChange={setField("interest")}
                  >
                    <option value="30-Day Risk-Free Field Pilot">30-Day Risk-Free Field Pilot (Recommended)</option>
                    <option value="15-Minute Live Field Demo">15-Minute Live Field Demo</option>
                    <option value="Commercial Pricing Proposal & SLA">Commercial Pricing Proposal &amp; SLA (ZAR)</option>
                  </select>
                </label>

                <label className="ops-form-wide">
                  Notes or operational challenges
                  <textarea
                    name="message"
                    rows={3}
                    value={form.message}
                    onChange={setField("message")}
                    placeholder="Tell us about your fleet setup, sites, or current challenges with shift verification and standing time..."
                  />
                </label>

                <button className="ops-btn ops-btn-gold ops-form-wide" type="submit">
                  {form.interest === "30-Day Risk-Free Field Pilot"
                    ? "Apply for 30-Day Field Pilot"
                    : form.interest === "15-Minute Live Field Demo"
                    ? "Book 15-Minute Live Demo"
                    : "Request Commercial Proposal"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="ops-foot">
        <div className="ops-foot-brand">
          <span className="ops-brand" style={{ fontSize: "1.35rem" }}>OPS</span>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
            Heavy equipment operations &amp; shift verification platform.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
          <a href="#contact">Get a Proposal</a>
          <button type="button" className="ops-btn ops-btn-gold" style={{ padding: "0.45rem 1.1rem", fontSize: "0.85rem" }} onClick={onLogin}>Log In</button>
        </nav>
      </footer>
    </div>
  );
}
