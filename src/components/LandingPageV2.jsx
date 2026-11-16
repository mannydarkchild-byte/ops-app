import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  HardHat,
  MapPin,
  Menu,
  PenLine,
  Share,
  ShieldCheck,
  WifiOff,
  X,
} from "lucide-react";
import { LogoMark } from "./AppShell.jsx";
import { OwnerDowntimeChart } from "./PulseCharts.jsx";
import { MeterPhoto } from "./ui/MeterPhoto.jsx";
import { SignaturePad } from "./ui/SignaturePad.jsx";
import { Button } from "./ui/Button.jsx";
import "../landing-v2.css";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "Workflow" },
  { href: "#field", label: "Built for site" },
  { href: "#pilot", label: "Site trial" },
];

const INSTALLED_KEY = "ops-pwa-installed";

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || window.matchMedia("(display-mode: minimal-ui)").matches
    || window.navigator.standalone === true
  );
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function isChromiumBrowser() {
  return /chrome|crios|edg|edgios|chromium/i.test(navigator.userAgent) && !isIosDevice();
}

function rememberInstalled() {
  try { localStorage.setItem(INSTALLED_KEY, "1"); } catch {}
}

function wasInstalledHere() {
  try { return localStorage.getItem(INSTALLED_KEY) === "1"; } catch { return false; }
}

async function lookupRelatedInstall() {
  if (typeof navigator.getInstalledRelatedApps !== "function") return false;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    return Array.isArray(apps) && apps.length > 0;
  } catch {
    return false;
  }
}

function usePwaInstall() {
  const promptRef = useRef(null);
  const [canNative, setCanNative] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneApp() || wasInstalledHere());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tabVisible, setTabVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneApp() || wasInstalledHere()) {
      rememberInstalled();
      setInstalled(true);
      return undefined;
    }

    let cancelled = false;
    lookupRelatedInstall().then((found) => {
      if (cancelled || !found) return;
      rememberInstalled();
      setInstalled(true);
    });

    const onPrompt = (event) => {
      event.preventDefault();
      promptRef.current = event;
      setCanNative(true);
    };
    const onInstalled = () => {
      rememberInstalled();
      promptRef.current = null;
      setCanNative(false);
      setInstalled(true);
      setSheetOpen(false);
      setTabVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (installed) {
      setTabVisible(false);
      return undefined;
    }
    const dismissed = sessionStorage.getItem("ops-install-dismissed") === "1";
    const timer = window.setTimeout(() => {
      if (dismissed || isStandaloneApp() || wasInstalledHere()) return;
      if (promptRef.current || isIosDevice() || !isChromiumBrowser()) setTabVisible(true);
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [installed, canNative]);

  const closeSheet = () => setSheetOpen(false);
  const dismissTab = () => {
    setTabVisible(false);
    sessionStorage.setItem("ops-install-dismissed", "1");
  };
  const install = async () => {
    if (promptRef.current) {
      promptRef.current.prompt();
      const choice = await promptRef.current.userChoice;
      promptRef.current = null;
      setCanNative(false);
      if (choice.outcome === "accepted") {
        rememberInstalled();
        setInstalled(true);
        setSheetOpen(false);
        setTabVisible(false);
      }
      return;
    }
    setSheetOpen(true);
  };

  const showInstall = !installed && (canNative || isIosDevice() || !isChromiumBrowser());

  return {
    installed: !showInstall,
    canNative,
    ios: isIosDevice(),
    sheetOpen,
    tabVisible: showInstall && tabVisible,
    closeSheet,
    dismissTab,
    install,
  };
}

function ShiftCard() {
  return (
    <div className="opsv2-shift-card">
      <div className="opsv2-shift-head">
        <div>
          <span>DAY SHIFT · MLK-04</span>
          <strong>Powerscreen Warrior 2100</strong>
        </div>
        <span className="opsv2-verified"><Check size={12} strokeWidth={3} /> Verified</span>
      </div>
      <div className="opsv2-meter-row">
        <div><span>Opening</span><strong>5,032.4</strong></div>
        <ArrowRight size={18} />
        <div><span>Closing</span><strong>5,039.6</strong></div>
        <div className="opsv2-hours"><span>Meter advance</span><strong>7.2 h</strong></div>
      </div>
      <div className="opsv2-shift-bar" aria-label="Shift timeline">
        <i className="is-run" style={{ flex: 5 }} />
        <i className="is-wait" style={{ flex: 1.4 }} />
        <i className="is-run" style={{ flex: 3.5 }} />
      </div>
      <div className="opsv2-shift-foot">
        <span><MapPin size={13} /> Captured on site</span>
        <span><PenLine size={13} /> Supervisor signed</span>
      </div>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="opsv2-product-stage" id="product">
      <div className="opsv2-real-copy">
        <span className="opsv2-live-label"><i /> Live OPS preview</span>
        <h3>The actual shift report your client reviews.</h3>
        <p>This is the real OPS supervisor sign-off screen, using sample shift data—not a marketing mockup.</p>
        <div className="opsv2-real-points">
          <span><Camera size={18} /> Opening and closing meter evidence</span>
          <span><Clock3 size={18} /> Productive and standing-time totals</span>
          <span><PenLine size={18} /> Client approval or dispute</span>
        </div>
        <a href="/?sign=preview" target="_blank" rel="noreferrer" className="opsv2-sample-link">
          Open the live sample <ArrowRight size={16} />
        </a>
      </div>
      <div className="opsv2-real-screen">
        <div className="opsv2-browser-bar"><i /><i /><i /><span>OPS · Daily shift report</span></div>
        <div className="opsv2-iframe-crop">
          <iframe
            title="Live OPS daily shift report preview"
            src="/?sign=preview"
            loading="lazy"
            tabIndex={-1}
          />
        </div>
      </div>
    </div>
  );
}

function OpsPhone({ screen, children }) {
  return (
    <div className="opsv2-app-phone" aria-label={`${screen} OPS app screen`}>
      <div className="opsv2-phone-hardware"><i /></div>
      <div className="opsv2-phone-status"><span>08:42</span><span>4G · 82%</span></div>
      <div className="opsv2-phone-appbar">
        <strong>OPS</strong>
        <span>{screen}</span>
      </div>
      <div className="opsv2-phone-content">{children}</div>
      <div className="opsv2-phone-home"><i /></div>
    </div>
  );
}

function MeterEvidencePhone() {
  return (
    <OpsPhone screen="Operator">
      <div className="opsv2-screen-title">
        <span>START SHIFT</span>
        <strong>Opening hour meter</strong>
        <small>Powerscreen Warrior 2100 · W2100</small>
      </div>
      <div className="opsv2-screen-static">
        <MeterPhoto
          label="Hour meter reading (hours)"
          value="5032.4"
          onValue={() => {}}
          photo={null}
          onPhoto={() => {}}
          required
        />
      </div>
    </OpsPhone>
  );
}

function PulsePhone() {
  const downtime = [
    { owner: "Client site", role: "site", minutes: 70 },
    { owner: "Contractor", role: "contractor", minutes: 25 },
    { owner: "Wear items", role: "wear", minutes: 15 },
  ];

  return (
    <OpsPhone screen="Machine pulse">
      <div className="opsv2-screen-title">
        <span>TODAY · W2100</span>
        <strong>Powerscreen Warrior 2100</strong>
        <small>Day shift · 06:00–17:00</small>
      </div>
      <div className="opsv2-pulse-status">
        <div><span>Productive</span><strong>6h 02m</strong></div>
        <div><span>Stopped</span><strong>1h 50m</strong></div>
      </div>
      <div className="opsv2-pulse-track" aria-label="Machine running and stopped timeline">
        <i className="run" style={{ flex: 4 }} />
        <i className="site" style={{ flex: 1.4 }} />
        <i className="run" style={{ flex: 2.4 }} />
        <i className="contractor" style={{ flex: 0.7 }} />
        <i className="run" style={{ flex: 1.5 }} />
      </div>
      <div className="opsv2-chart-card">
        <p>Downtime by responsible party</p>
        <OwnerDowntimeChart rows={downtime} />
      </div>
    </OpsPhone>
  );
}

function SignOffPhone() {
  return (
    <OpsPhone screen="Supervisor sign-off">
      <div className="opsv2-screen-title">
        <span>DAILY SHIFT REPORT</span>
        <strong>Ready to approve</strong>
        <small>W2100 · 18 October 2026</small>
      </div>
      <div className="opsv2-approval-summary">
        <p><span>Meter advance</span><strong>7.2 h</strong></p>
        <p><span>Productive time</span><strong>6h 02m</strong></p>
        <p><span>Site standing time</span><strong>1h 10m</strong></p>
      </div>
      <div className="opsv2-screen-static opsv2-signature-screen">
        <SignaturePad label="Site supervisor signature — sign below" height={112} onChange={() => {}} />
        <Button size="lg" variant="teal" className="w-full">Agree and sign</Button>
      </div>
    </OpsPhone>
  );
}

function LandingPageV2({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "" });
  const install = usePwaInstall();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const submitPilot = (event) => {
    event.preventDefault();
    const inbox = import.meta.env.VITE_DEMO_EMAIL || "";
    const body = [
      `Name: ${form.name}`,
      `Company: ${form.company}`,
      `Email: ${form.email}`,
      form.phone ? `Phone / WhatsApp: ${form.phone}` : "",
      "",
      "I would like to discuss an OPS site trial.",
    ].filter(Boolean).join("\n");
    window.location.href = `mailto:${inbox}?subject=${encodeURIComponent(`OPS site trial — ${form.company}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  return (
    <div className={`opsv2${install.tabVisible && !install.installed ? " has-install-tab" : ""}`}>
      <header className={`opsv2-nav ${scrolled ? "is-scrolled" : ""}`}>
        <a href="#top" className="opsv2-brand" aria-label="OPS home">
          <LogoMark size="sm" />
          <span>OPS</span>
        </a>
        <nav className={menuOpen ? "is-open" : ""} aria-label="Main navigation">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
          ))}
          {!install.installed && (
            <button type="button" className="opsv2-nav-install" onClick={() => { setMenuOpen(false); install.install(); }}>
              Install app
            </button>
          )}
        </nav>
        <div className="opsv2-nav-actions">
          {!install.installed && (
            <button type="button" className="opsv2-install" onClick={install.install}>
              <Download size={15} /> Install app
            </button>
          )}
          <button type="button" className="opsv2-login" onClick={onLogin}>Log in</button>
          <a href="#pilot" className="opsv2-button opsv2-button-small">Request site trial <ArrowRight size={15} /></a>
          <button
            type="button"
            className="opsv2-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="opsv2-hero">
          <img
            className="opsv2-hero-image"
            src="/assets/powerscreen-warrior-2100-hero.jpg"
            alt="Powerscreen Warrior 2100 mobile screening plant operating in a quarry"
            fetchPriority="high"
            decoding="async"
          />
          <div className="opsv2-hero-shade" />
          <div className="opsv2-wrap opsv2-hero-inner">
            <div className="opsv2-eyebrow"><i /> Equipment Operations & Shift Verification</div>
            <h1>Every machine hour.<br /><em>Proven on site.</em></h1>
            <p>Replace paper shift cards with verified machine hours, photo evidence, clear downtime accountability and supervisor sign-off — even when there is no signal.</p>
            <div className="opsv2-hero-actions">
              <a href="#pilot" className="opsv2-button">Request a site trial <ArrowRight size={17} /></a>
              <a href="#workflow" className="opsv2-text-link">See the workflow <ChevronRight size={17} /></a>
            </div>
            <div className="opsv2-proof-line">
              <span><WifiOff size={16} /> Works offline</span>
              <span><Camera size={16} /> Photo evidence</span>
              <span><PenLine size={16} /> Signed on site</span>
            </div>
          </div>
          <div className="opsv2-hero-card"><ShiftCard /></div>
        </section>

        <section className="opsv2-intro" id="workflow">
          <div className="opsv2-wrap">
            <div className="opsv2-section-head">
              <div>
                <span className="opsv2-kicker">One shift. One record.</span>
                <h2>Proof from the machine to the invoice.</h2>
              </div>
              <p>OPS captures the few records that settle the questions that matter: where the machine was, how long it ran, why it stopped and who approved the shift.</p>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section className="opsv2-story" id="field">
          <div className="opsv2-story-copy">
            <span className="opsv2-kicker">Built for real site conditions</span>
            <h2>No signal should not mean no record.</h2>
            <p>Operators complete the shift in the pit. OPS stores it safely on the device, then synchronises when connectivity returns.</p>
            <ul>
              <li><WifiOff /><div><strong>Offline from the start</strong><span>Photos, inspections and stoppages keep working.</span></div></li>
              <li><MapPin /><div><strong>Location captured with evidence</strong><span>Coordinates travel with the live meter photo.</span></div></li>
              <li><ShieldCheck /><div><strong>Reviewed before close</strong><span>The client supervisor signs the final shift record.</span></div></li>
            </ul>
          </div>
          <div className="opsv2-story-mark">
            <WifiOff size={54} />
            <strong>100%</strong>
            <span>of the core shift workflow remains available without mobile signal.</span>
          </div>
        </section>

        <section className="opsv2-outcome">
          <div className="opsv2-wrap opsv2-outcome-grid">
            <div className="opsv2-outcome-head">
              <span className="opsv2-kicker">The daily outcome</span>
              <h2>A shift record both sides can trust.</h2>
            </div>
            <div className="opsv2-outcome-phones">
              <article className="opsv2-outcome-card">
                <MeterEvidencePhone />
                <div className="opsv2-outcome-copy">
                  <strong>Meter evidence</strong>
                  <span>Opening and closing readings linked to a compulsory photo.</span>
                </div>
              </article>
              <article className="opsv2-outcome-card">
                <PulsePhone />
                <div className="opsv2-outcome-copy">
                  <strong>Downtime responsibility</strong>
                  <span>The machine pulse separates site standing time from contractor downtime.</span>
                </div>
              </article>
              <article className="opsv2-outcome-card">
                <SignOffPhone />
                <div className="opsv2-outcome-copy">
                  <strong>Same-day approval</strong>
                  <span>The site supervisor reviews the shift and signs on the phone screen.</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="opsv2-pilot" id="pilot">
          <div className="opsv2-wrap opsv2-pilot-grid">
            <div className="opsv2-pilot-copy">
              <span className="opsv2-kicker">Start on site</span>
              <h2>Prove OPS on your own machines.</h2>
              <p>Start with one site and a small group of machines. We will map your shift process, train your team and assess every captured record.</p>
              <ol className="opsv2-pilot-steps">
                <li>
                  <span className="opsv2-step-icon" aria-hidden="true"><MapPin size={22} strokeWidth={1.75} /></span>
                  <div>
                    <b>01</b>
                    <strong>Choose a site</strong>
                    <span>Pick one quarry or plant and a small group of machines for the trial.</span>
                  </div>
                </li>
                <li>
                  <span className="opsv2-step-icon" aria-hidden="true"><HardHat size={22} strokeWidth={1.75} /></span>
                  <div>
                    <b>02</b>
                    <strong>Train operators</strong>
                    <span>Walk the team through meter photos, downtime and closing the shift on the phone.</span>
                  </div>
                </li>
                <li>
                  <span className="opsv2-step-icon" aria-hidden="true"><ClipboardCheck size={22} strokeWidth={1.75} /></span>
                  <div>
                    <b>03</b>
                    <strong>Review real shifts</strong>
                    <span>The site supervisor checks the records and signs off while still on site.</span>
                  </div>
                </li>
              </ol>
            </div>
            {sent ? (
              <div className="opsv2-form opsv2-form-sent">
                <ShieldCheck size={34} />
                <h3>Your request is ready.</h3>
                <p>Your email app has been opened with the pilot details.</p>
                <button type="button" className="opsv2-text-link" onClick={() => setSent(false)}>Edit details</button>
              </div>
            ) : (
              <form className="opsv2-form" onSubmit={submitPilot}>
                <div className="opsv2-form-head"><span>SITE TRIAL</span><strong>Tell us about your operation.</strong></div>
                <label>Name<input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></label>
                <label>Company<input required autoComplete="organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company name" /></label>
                <label>Work email<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.co.za" /></label>
                <label>Phone / WhatsApp<input autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+27 ..." /></label>
                <button className="opsv2-button" type="submit">Request site trial <ArrowRight size={17} /></button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="opsv2-footer">
        <div className="opsv2-wrap">
          <div className="opsv2-brand"><LogoMark size="sm" /><span>OPS</span></div>
          <p>Equipment operations and shift verification.</p>
          <div className="opsv2-footer-actions">
            {!install.installed && (
              <button type="button" onClick={install.install}>Install app <Download size={14} /></button>
            )}
            <button type="button" onClick={onLogin}>Customer login <ArrowRight size={14} /></button>
          </div>
        </div>
      </footer>

      {!install.installed && install.tabVisible && (
        <div className="opsv2-install-tab">
          <button type="button" className="opsv2-install-tab-main" onClick={install.install}>
            <span className="opsv2-step-icon" aria-hidden="true"><Download size={18} /></span>
            <span>
              <strong>Install OPS</strong>
              <em>Put the app on this phone for offline site work.</em>
            </span>
          </button>
          <button type="button" className="opsv2-install-tab-close" onClick={install.dismissTab} aria-label="Dismiss install prompt">
            <X size={16} />
          </button>
        </div>
      )}

      {install.sheetOpen && (
        <div className="opsv2-install-sheet" role="dialog" aria-modal="true" aria-labelledby="ops-install-title">
          <button type="button" className="opsv2-install-backdrop" onClick={install.closeSheet} aria-label="Close install guide" />
          <div className="opsv2-install-card">
            <button type="button" className="opsv2-install-card-close" onClick={install.closeSheet} aria-label="Close">
              <X size={18} />
            </button>
            <span className="opsv2-step-icon" aria-hidden="true"><Download size={22} /></span>
            <h3 id="ops-install-title">Install OPS on this phone</h3>
            <p>Add OPS to the home screen. Operators can then open it like a normal app, even when there is no signal.</p>
            {install.canNative ? (
              <button type="button" className="opsv2-button" onClick={install.install}>
                Install app <Download size={16} />
              </button>
            ) : install.ios ? (
              <ol className="opsv2-install-steps">
                <li><Share size={16} /> Tap the <b>Share</b> button in Safari.</li>
                <li><Download size={16} /> Choose <b>Add to Home Screen</b>.</li>
                <li><Check size={16} /> Open <b>OPS</b> from the home screen.</li>
              </ol>
            ) : (
              <ol className="opsv2-install-steps">
                <li>Open the browser menu on this page.</li>
                <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
                <li>Open <b>OPS</b> from the home screen.</li>
              </ol>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { LandingPageV2 as LandingPage };
