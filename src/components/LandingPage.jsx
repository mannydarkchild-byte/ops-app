import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./AppShell.jsx";
import "../landing.css";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#operations", label: "Operations" },
  { href: "#reports", label: "Reports" },
];

function Phone({ children, label }) {
  return (
    <div className="ops-phone" role="img" aria-label={label}>
      <div className="ops-phone-bezel">
        <div className="ops-phone-speaker" aria-hidden />
        <div className="ops-phone-screen">{children}</div>
      </div>
    </div>
  );
}

function FieldBar({ title, status, tone = "ok" }) {
  return (
    <div className="ops-fieldbar">
      <span className="ops-fieldbar-brand">OPS</span>
      <strong>{title}</strong>
      <em className={`ops-tone ops-tone-${tone}`}>{status}</em>
    </div>
  );
}

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
    { kind: "run", label: "Running", flex: 180 },
    { kind: "stop", label: "Stopped", flex: 35 },
    { kind: "run", label: "Running", flex: 150 },
    { kind: "stop", label: "Stopped", flex: 30 },
    { kind: "run", label: "Running", flex: 70 },
  ];

  return (
    <div className={on ? "ops-pulse is-on" : "ops-pulse"} ref={ref}>
      <div className="ops-pulse-scale">
        <span>06:00</span>
        <span>14:00</span>
      </div>
      <svg className="ops-pulse-line" viewBox="0 0 800 120" aria-hidden>
        <path d="M8 28 H312 V96 H371 V28 H624 V96 H675 V28 H792" />
      </svg>
      <div className="ops-pulse-track" aria-hidden>
        {blocks.map((block, i) => (
          <div key={`${block.kind}-${i}`} className={`ops-pulse-block ops-pulse-${block.kind}`} style={{ flex: block.flex }} />
        ))}
      </div>
      <p className="ops-pulse-legend"><i className="ops-pulse-run" /> Running <i className="ops-pulse-stop" /> Stopped</p>
      <div className="ops-metrics">
        <p><strong>6h 40m</strong><span>Running</span></p>
        <p><strong>1h 05m</strong><span>Stopped</span></p>
      </div>
    </div>
  );
}

export function LandingPage({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", message: "" });

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
      form.phone ? `Phone: ${form.phone}` : "",
      "",
      form.message || "I would like a demo of OPS.",
    ].filter(Boolean).join("\n");
    const inbox = import.meta.env.VITE_DEMO_EMAIL || "";
    const href = `mailto:${inbox}?subject=${encodeURIComponent(`OPS demo — ${form.company}`)}&body=${encodeURIComponent(body)}`;
    setSent(true);
    window.location.href = href;
  };

  return (
    <div className="ops-site">
      <header className={compact ? "ops-nav is-compact" : "ops-nav"}>
        <a className="ops-nav-brand" href="#top" onClick={closeMenu}>
          <LogoMark size="bar" />
          <span className="ops-brand">OPS</span>
        </a>
        <nav className={menuOpen ? "is-open" : ""} aria-label="Page">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>{item.label}</a>
          ))}
          <button type="button" className="ops-nav-login" onClick={() => { closeMenu(); onLogin(); }}>Log in</button>
        </nav>
        <div className="ops-nav-actions">
          <button type="button" className="ops-nav-login ops-nav-login-desk" onClick={onLogin}>Log in</button>
          <a className="ops-btn ops-btn-gold" href="#contact">Request a demo</a>
          <button
            type="button"
            className="ops-nav-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={menuOpen ? "ops-nav-menu-icon is-open" : "ops-nav-menu-icon"} />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="ops-hero">
          <div className="ops-hero-copy">
            <p className="ops-kicker">Equipment operations</p>
            <h1>Know exactly what your machine did today.</h1>
            <p className="ops-lede">
              OPS gives you one verified record of every machine shift — from pre-start and hour meter readings to running time, downtime, diesel, problems, expenses and sign-off.
            </p>
            <div className="ops-hero-actions">
              <a className="ops-btn ops-btn-gold" href="#contact">Request a demo</a>
              <a className="ops-btn ops-btn-ghost" href="#how">See how it works</a>
            </div>
          </div>
          <div className="ops-hero-stage">
            <img className="ops-hero-mark" src="/logo.png" alt="OPS badge for the Powerscreen Warrior 2100" />
            <Phone label="Warrior 2100 running, with meter readings and a pulse line">
              <FieldBar title="Warrior 2100" status="Running" />
              <div className="ops-screen-body">
                <p className="ops-screen-kicker">Machine running</p>
                <p className="ops-big">6h 40m</p>
                <p className="ops-big-label">Running</p>
                <dl className="ops-readout">
                  <div><dt>Opening meter</dt><dd>1,284.6h</dd></div>
                  <div><dt>Current meter</dt><dd>1,291.2h</dd></div>
                  <div><dt>Stopped</dt><dd>1h 05m</dd></div>
                </dl>
                <svg className="ops-mini-pulse" viewBox="0 0 280 48" aria-hidden>
                  <path d="M4 12 H90 V38 H120 V12 H200 V38 H230 V12 H276" />
                </svg>
              </div>
            </Phone>
          </div>
        </section>

        <section className="ops-strip" aria-label="What OPS holds onto">
          {[
            ["Verified machine hours", "Opening and closing meter, on the shift."],
            ["Downtime accountability", "A reason, a duration, and an owner."],
            ["Digital shift sign-off", "The supervisor signs, or sends it back."],
            ["Works offline", "The phone keeps the shift, then syncs."],
          ].map(([title, text]) => (
            <p key={title}><strong>{title}</strong><span>{text}</span></p>
          ))}
        </section>

        <section className="ops-band ops-band-light" id="product">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">The record</p>
              <h2>One machine. One shift. One verified record.</h2>
              <p className="ops-lede">
                OPS tells you what happened to your machine, when it happened, why it happened, who was responsible, what was done about it, what parts were required and what was spent.
              </p>
              <ol className="ops-chain">
                {["Machine", "Shift", "Hours", "Running / stopped", "Downtime", "Problem", "Repair", "Parts", "Inventory", "Expense", "Sign-off", "Report"].map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="ops-panel">
              <p className="ops-panel-kicker">Warrior 2100 · this shift</p>
              <dl className="ops-facts">
                <div><dt>Machine</dt><dd>Warrior 2100</dd></div>
                <div><dt>Status</dt><dd className="ops-tone ops-tone-ok">Running</dd></div>
                <div><dt>Operator</dt><dd>On the machine</dd></div>
                <div><dt>Opening meter</dt><dd>1,284.6h</dd></div>
                <div><dt>Running</dt><dd>6h 40m</dd></div>
                <div><dt>Stopped</dt><dd>1h 05m</dd></div>
                <div><dt>Downtime</dt><dd>Breakdown · maintenance</dd></div>
                <div><dt>Verification</dt><dd className="ops-tone ops-tone-wait">Waiting for sign-off</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <section className="ops-band" id="how">
          <div className="ops-wrap">
            <p className="ops-kicker">How it works</p>
            <h2>From pre-start to sign-off.</h2>
            <ol className="ops-steps">
              {[
                ["01", "Pre-start", "Operator completes the machine inspection."],
                ["02", "Start", "Operator photographs the hour meter and starts the machine."],
                ["03", "Operate", "Running, stopped time, diesel and problems are recorded."],
                ["04", "Finish", "Closing meter is captured and the shift is submitted."],
                ["05", "Verify", "Supervisor reviews and signs the shift."],
              ].map(([n, title, text]) => (
                <li key={n}>
                  <span>{n}</span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ops-band ops-band-light">
          <div className="ops-wrap">
            <p className="ops-kicker">Operator</p>
            <h2>The shift starts on the machine.</h2>
            <p className="ops-lede">Clock in, pre-start, meter photo, start, stop, diesel, a problem, then finish the shift. Two screens from that day.</p>
            <div className="ops-phones">
              <Phone label="Start machine after the hour meter photo">
                <FieldBar title="Warrior 2100" status="Pre-start done" tone="wait" />
                <div className="ops-screen-body">
                  <p className="ops-screen-kicker">Step 3 of 5</p>
                  <h3>Start machine</h3>
                  <p className="ops-screen-note">Photo the hour meter, then start the machine.</p>
                  <div className="ops-meter-photo">Hour meter photo</div>
                  <p className="ops-read">Opening meter <strong>1,284.6h</strong></p>
                  <p className="ops-screen-action">Start machine</p>
                </div>
              </Phone>
              <Phone label="Machine running, with a stop reason ready">
                <FieldBar title="Warrior 2100" status="Running" />
                <div className="ops-screen-body">
                  <p className="ops-screen-kicker">Step 4 of 5</p>
                  <h3>Machine running</h3>
                  <dl className="ops-readout">
                    <div><dt>Time running</dt><dd>6h 40m</dd></div>
                    <div><dt>Time stopped</dt><dd>1h 05m</dd></div>
                  </dl>
                  <p className="ops-screen-note">Stop the machine if it goes down. Finish shift when the day is done.</p>
                  <p className="ops-screen-action ops-screen-action-stop">Stop machine</p>
                  <p className="ops-screen-quiet">Diesel · Report a problem · Finish shift</p>
                </div>
              </Phone>
            </div>
          </div>
        </section>

        <section className="ops-band">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Hour meter</p>
              <h2>The hour meter is the source of truth.</h2>
              <p className="ops-lede">
                The operator photographs the machine hour meter at the beginning and end of the shift. The photographs stay on the shift record. Clock time does not replace the meter.
              </p>
            </div>
            <div className="ops-meter-board">
              <p><span>Opening</span><strong>1,284.6h</strong></p>
              <p><span>Closing</span><strong>1,291.2h</strong></p>
              <p><span>Meter difference</span><strong>6.6h</strong></p>
            </div>
          </div>
        </section>

        <section className="ops-band ops-band-light" id="pulse">
          <div className="ops-wrap">
            <p className="ops-kicker">Pulse</p>
            <h2>See the machine&apos;s day at a glance.</h2>
            <p className="ops-lede">Every rise and fall represents what happened to the machine. Up while it is running. Down while it is stopped.</p>
            <PulseBoard />
          </div>
        </section>

        <section className="ops-band">
          <div className="ops-wrap">
            <p className="ops-kicker">Downtime</p>
            <h2>Don&apos;t just know that the machine stopped. Know why.</h2>
            <div className="ops-stops">
              {[
                ["Breakdown", "35m", "Maintenance", "live"],
                ["Waiting", "30m", "Site", "live"],
                ["No diesel", "—", "Berlington", "idle"],
                ["Weather", "—", "Site", "idle"],
              ].map(([reason, duration, owner, state]) => (
                <article key={reason} className={state === "idle" ? "is-idle" : ""}>
                  <h3>{reason}</h3>
                  <p className="ops-stop-time">{duration}</p>
                  <p>Owner · {owner}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="ops-band ops-band-light">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Maintenance</p>
              <h2>Problems don&apos;t disappear into WhatsApp.</h2>
              <p className="ops-lede">A problem stays on the machine. The supervisor can send it to a mechanic. The repair can ask for parts.</p>
              <ol className="ops-chain">
                {["Problem reported", "Repair job", "Mechanic", "Parts required", "Resolution"].map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="ops-stack">
              <article className="ops-panel">
                <p className="ops-panel-kicker">Problem reported</p>
                <h3>Fines belt</h3>
                <p>Bearing noise reported</p>
                <p><span className="ops-tone ops-tone-bad">Open</span> · Assigned to mechanic</p>
              </article>
              <article className="ops-panel">
                <p className="ops-panel-kicker">Repair job</p>
                <h3>Inspect fines belt bearing</h3>
                <p><span className="ops-tone ops-tone-wait">In progress</span></p>
              </article>
            </div>
          </div>
        </section>

        <section className="ops-band">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Inventory</p>
              <h2>Know what is available before the machine needs it.</h2>
              <p className="ops-lede">Parts sit with the repair, not in a separate stock system. A bearing used on the job comes off the count.</p>
            </div>
            <div className="ops-scroll">
              <div className="ops-desk">
                <header>Parts inventory · Warrior 2100</header>
                <table>
                  <tbody>
                    {[
                      ["Bearing", "12 in stock"],
                      ["Conveyor roller", "4 in stock"],
                      ["Hydraulic hose", "8 in stock"],
                      ["Engine oil filter", "15 in stock"],
                    ].map(([name, qty]) => (
                      <tr key={name}><td>{name}</td><td>{qty}</td></tr>
                    ))}
                  </tbody>
                </table>
                <footer>
                  <span>Parts required · Bearing · qty 1</span>
                  <span>Stock before 12 · after 11</span>
                </footer>
              </div>
            </div>
          </div>
        </section>

        <section className="ops-band ops-band-light">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Expenses</p>
              <h2>Know what the machine is costing you.</h2>
              <p className="ops-lede">
                Fuel, parts, transport and the rest are recorded against the machine. These are recorded operating costs. OPS does not calculate profit.
              </p>
            </div>
            <div className="ops-cost">
              <p className="ops-panel-kicker">Example · Warrior 2100</p>
              {[
                ["Fuel", "R1,850"],
                ["Parts", "R720"],
                ["Transport", "R1,200"],
                ["Other", "R350"],
              ].map(([name, amount]) => (
                <p key={name}><span>{name}</span><strong>{amount}</strong></p>
              ))}
              <p className="ops-cost-total"><span>Total recorded cost</span><strong>R4,120</strong></p>
            </div>
          </div>
        </section>

        <section className="ops-band ops-band-chain">
          <div className="ops-wrap">
            <p className="ops-kicker">Connected</p>
            <h2>From downtime to cost.</h2>
            <p className="ops-lede">A machine problem can become a repair, a parts request and an expense. OPS keeps those events connected to the machine.</p>
            <ol className="ops-chain ops-chain-strong">
              {["Problem", "Repair", "Parts", "Inventory", "Expense", "Machine history"].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="ops-band" id="management">
          <div className="ops-wrap">
            <p className="ops-kicker">Management</p>
            <h2>Management sees the whole operation.</h2>
            <p className="ops-lede">Management doesn&apos;t need another spreadsheet. They need the story behind the hours.</p>
            <div className="ops-scroll">
              <div className="ops-laptop">
                <div className="ops-laptop-screen">
                  <header>
                    <span className="ops-brand">OPS</span>
                    <strong>Warrior 2100</strong>
                    <em className="ops-tone ops-tone-ok">Running</em>
                  </header>
                  <div className="ops-laptop-metrics">
                    <p><span>Running</span><strong>6h 40m</strong></p>
                    <p><span>Stopped</span><strong>1h 05m</strong></p>
                    <p><span>Meter</span><strong>6.6h</strong></p>
                    <p><span>Diesel</span><strong>Logged</strong></p>
                    <p><span>Problems</span><strong>1 open</strong></p>
                    <p><span>Recorded cost</span><strong>R4,120</strong></p>
                  </div>
                  <div className="ops-laptop-line" aria-hidden />
                </div>
                <div className="ops-laptop-base" aria-hidden />
              </div>
            </div>
          </div>
        </section>

        <section className="ops-band ops-band-light">
          <div className="ops-wrap">
            <p className="ops-kicker">This shift</p>
            <h2>A cost snapshot, not a profit claim.</h2>
            <div className="ops-command">
              <p className="ops-command-name">Warrior 2100</p>
              {[
                ["Machine hours", "6.6h"],
                ["Running", "6h 40m"],
                ["Stopped", "1h 05m"],
                ["Fuel", "R1,850"],
                ["Parts", "R720"],
                ["Transport", "R1,200"],
                ["Other", "R350"],
              ].map(([label, value]) => (
                <p key={label}><span>{label}</span><strong>{value}</strong></p>
              ))}
              <p className="ops-command-total"><span>Total recorded cost</span><strong>R4,120</strong></p>
            </div>
          </div>
        </section>

        <section className="ops-band">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">History</p>
              <h2>Build a history around every machine.</h2>
              <p className="ops-lede">Shifts, hours, downtime, diesel, problems, repairs, parts, expenses and inspections stay on that machine.</p>
            </div>
            <ul className="ops-history">
              {[
                ["Shifts", "Signed and sent back"],
                ["Hours", "Meter photos on each shift"],
                ["Downtime", "Reason, duration, owner"],
                ["Diesel", "Litres against the machine"],
                ["Problems", "Open until resolved"],
                ["Repairs", "Jobs sent to the mechanic"],
                ["Parts", "Taken from inventory"],
                ["Expenses", "Recorded against the machine"],
                ["Inspections", "Pre-start and mechanic checks"],
              ].map(([title, text]) => (
                <li key={title}><strong>{title}</strong><span>{text}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="ops-band ops-band-light">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Supervisor</p>
              <h2>The shift isn&apos;t complete until it is verified.</h2>
              <p className="ops-lede">The supervisor signs the shift, or sends it back to the operator to correct. Nothing is treated as signed until they do.</p>
            </div>
            <Phone label="Supervisor sign-off for a finished shift">
              <FieldBar title="Shift to sign" status="Waiting" tone="wait" />
              <div className="ops-screen-body">
                <p className="ops-screen-kicker">Warrior 2100</p>
                <h3>1,284.6h → 1,291.2h</h3>
                <p className="ops-big">6.6h</p>
                <p className="ops-big-label">Machine hours</p>
                <ul className="ops-checks">
                  <li>Pre-start complete</li>
                  <li>Stops recorded</li>
                  <li>Diesel recorded</li>
                </ul>
                <p className="ops-screen-action ops-screen-action-sign">Sign off</p>
                <p className="ops-screen-quiet">Send back</p>
              </div>
            </Phone>
          </div>
        </section>

        <section className="ops-band" id="reports">
          <div className="ops-wrap">
            <p className="ops-kicker">Reports</p>
            <h2>From the shift to the report.</h2>
            <p className="ops-lede">Field record, then a verified shift, then the report a manager can open.</p>
            <div className="ops-reports">
              {[
                ["Daily shift report", "Run, stops, diesel and pre-start on the signed shift."],
                ["Timesheets", "Who was on site, and for how long."],
                ["Operations reports", "Hours, downtime and diesel for the period."],
                ["Machine history", "The record that stays on the machine."],
              ].map(([title, text]) => (
                <article key={title}><h3>{title}</h3><p>{text}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="ops-band ops-band-light">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Offline</p>
              <h2>Your operation doesn&apos;t always have signal.</h2>
              <p className="ops-lede">OPS keeps recording the work when connectivity is unavailable and synchronises when the connection returns.</p>
            </div>
            <div className="ops-offline">
              <p className="ops-tone ops-tone-wait">Offline — working from this phone</p>
              <p>Clock in, pre-start, meter, stops, diesel and problems stay on the device.</p>
              <p>They sync when the phone has a signal again.</p>
            </div>
          </div>
        </section>

        <section className="ops-band" id="operations">
          <div className="ops-wrap">
            <p className="ops-kicker">Operations</p>
            <h2>Built for the people around a machine.</h2>
            <div className="ops-roles">
              {[
                ["Operator", "Records the shift.", "Clock in, pre-start, meter, running and stopped time, diesel, problems, finish shift."],
                ["Supervisor", "Verifies the shift.", "Sees who is on the machine, signs the shift, or sends it back."],
                ["Mechanic", "Responds to problems.", "Takes the repair, inspects the machine, and asks for parts."],
                ["Manager", "Controls the operation.", "Hours, downtime, diesel, inventory, expenses and reports."],
              ].map(([title, lead, text]) => (
                <article key={title}>
                  <h3>{title}</h3>
                  <p className="ops-role-lead">{lead}</p>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <ol className="ops-people">
              <li><strong>Operator</strong> records what happens.</li>
              <li><strong>Supervisor</strong> verifies the record.</li>
              <li><strong>Mechanic</strong> responds to problems.</li>
              <li><strong>Manager</strong> sees the operation.</li>
            </ol>
          </div>
        </section>

        <section className="ops-band ops-band-cta" id="contact">
          <div className="ops-wrap ops-split">
            <div>
              <p className="ops-kicker">Demo</p>
              <h2>See OPS on your operation.</h2>
              <p className="ops-lede">
                Bring us one machine and one shift. We&apos;ll show you how OPS can capture the machine&apos;s hours, downtime, inspections, problems, parts, expenses and sign-off from the field to management.
              </p>
            </div>
            {sent ? (
              <div className="ops-form ops-form-sent">
                <h3>Your email app should open with this request.</h3>
                <p>If it did not, send the same details to the OPS team from {form.email}.</p>
                <button type="button" className="ops-btn ops-btn-ghost" onClick={() => setSent(false)}>Edit the request</button>
              </div>
            ) : (
              <form className="ops-form" onSubmit={requestDemo}>
                <label>Name<input required name="name" autoComplete="name" value={form.name} onChange={setField("name")} /></label>
                <label>Company<input required name="company" autoComplete="organization" value={form.company} onChange={setField("company")} /></label>
                <label>Email<input required type="email" name="email" autoComplete="email" value={form.email} onChange={setField("email")} /></label>
                <label>Phone<input name="phone" autoComplete="tel" value={form.phone} onChange={setField("phone")} /></label>
                <label className="ops-form-wide">What should we show you?<textarea name="message" rows={4} value={form.message} onChange={setField("message")} /></label>
                <button className="ops-btn ops-btn-gold ops-form-wide" type="submit">Request an OPS demo</button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="ops-foot">
        <div>
          <span className="ops-brand">OPS</span>
          <p>Equipment operations for the people on the machine — and the people accountable for it.</p>
        </div>
        <nav aria-label="Footer">
          {NAV.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}
          <a href="#contact">Request a demo</a>
          <button type="button" onClick={onLogin}>Log in</button>
        </nav>
      </footer>
    </div>
  );
}
