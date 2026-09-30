import { useState } from "react";
import { LogoMark } from "./AppShell.jsx";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#operators", label: "For operators" },
  { href: "#supervisors", label: "For supervisors" },
  { href: "#managers", label: "For managers" },
  { href: "#contact", label: "Contact" },
];

const ROLES = [
  {
    id: "operators",
    title: "Operators",
    lead: "The people on the machine. Their phone is where the day starts.",
    points: [
      "Clock in and clock out",
      "Choose the supervisor on duty",
      "Complete the pre-start check",
      "Photo the hour meter and start the machine",
      "Stop and restart, with a reason",
      "Log diesel and report a problem",
      "Finish the shift for sign-off",
    ],
  },
  {
    id: "supervisors",
    title: "Supervisors",
    lead: "They see who is on site, what the machine is doing, and what still needs a signature.",
    points: [
      "Live view of the machine and who is clocked in",
      "Sign off a shift, or send it back",
      "Follow problems and send work to a mechanic",
      "Timesheets and signed daily reports",
      "The same productivity line the rest of the site sees",
    ],
  },
  {
    id: "mechanics",
    title: "Mechanics",
    lead: "Problems and inspections reach the person who works on the machine.",
    points: [
      "Repair jobs sent from a problem",
      "A guided machine inspection",
      "Ask for parts from the job",
      "See the same running and stopped time",
    ],
  },
  {
    id: "managers",
    title: "Managers",
    lead: "One place for hours, downtime, diesel, expenses, and the reports that follow.",
    points: [
      "Hours, runtime, downtime, diesel, and expenses",
      "Productivity for the machine, today or this cycle",
      "Problems, parts, and who owns the downtime",
      "Operations reports and timesheets",
    ],
  },
  {
    id: "admin",
    title: "Admin",
    lead: "The organisation: who can sign in, which machines exist, and what the checklists say.",
    points: [
      "People, roles, and which machine an operator uses",
      "Sites and machines",
      "Pre-start and mechanic inspection lists",
      "Stop reasons and who owns the downtime",
    ],
  },
];

const PROBLEMS = [
  ["Is it running?", "The machine shows running, stopped, or idle, with the reason and who is on it."],
  ["Was the pre-start done?", "The check is completed on the phone before the machine can start."],
  ["What were the hours?", "Opening and closing meter photos sit on the shift, with the hours between them."],
  ["How long was it down?", "Every stop has a reason, a duration, and an owner."],
  ["What happened on the shift?", "The signed report carries the run, the stops, the diesel, and the pre-start."],
  ["Who still needs to sign?", "A shift waits for the supervisor. Nothing is treated as signed until they do."],
];

const FEATURES = [
  ["Machine status", "Running, stopped, or idle, on the machine you actually operate."],
  ["Operator day", "Clock in, supervisor, pre-start, start, stop, finish shift, clock out."],
  ["Pre-start checks", "The site’s own checklist, one item at a time, saved with the shift."],
  ["Hour meters", "A photo and a reading at the start and the end. Hours come from the meter."],
  ["Downtime", "Stop reasons, how long, and whether it sits with Darkchild, Berlington, or the site."],
  ["Diesel", "Litres, meter, and tank, logged against the machine."],
  ["Problems", "Reported from the field, then followed by the supervisor and the mechanic."],
  ["Sign-off", "The supervisor signs the shift. Sent-back shifts go back to the operator."],
  ["Reports", "A daily shift report, plus operations and timesheet reports for the period."],
  ["Pulse", "One line for the machine: up while it runs, down while it is stopped."],
  ["Parts and expenses", "Parts requests, and expenses the manager can enter or import."],
  ["Works offline", "The phone keeps working on site, then syncs when it has a signal."],
];

function Phone({ kicker, title, children }) {
  return (
    <figure className="ops-phone">
      <figcaption>
        <span>{kicker}</span>
        <strong>{title}</strong>
      </figcaption>
      <div className="ops-phone-screen">{children}</div>
    </figure>
  );
}

export function LandingPage({ onLogin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", email: "", phone: "", message: "" });

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
      <header className="ops-nav">
        <a className="ops-nav-brand" href="#top">
          <LogoMark size="sm" />
          <span className="ops-brand">OPS</span>
        </a>
        <nav className={menuOpen ? "is-open" : ""} aria-label="Page">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>{item.label}</a>
          ))}
        </nav>
        <div className="ops-nav-actions">
          <button type="button" className="ops-nav-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? "Close" : "Menu"}
          </button>
          <button type="button" className="ops-btn ops-btn-gold" onClick={onLogin}>Log in</button>
        </div>
      </header>

      <main id="top">
        <section className="ops-hero">
          <div className="ops-hero-copy">
            <p className="ops-kicker">Equipment operations</p>
            <h1>Know whether the machine is working.</h1>
            <p className="ops-lede">
              OPS is the shared record for the people who run, supervise, repair, and manage a machine. One shift. One hour meter. One story of the day.
            </p>
            <div className="ops-hero-actions">
              <a className="ops-btn ops-btn-gold" href="#contact">Request a demo</a>
              <a className="ops-btn ops-btn-ghost" href="#how">See how it works</a>
            </div>
          </div>
          <Phone kicker="On the machine" title="Machine running">
            <div className="ops-ui">
              <p className="ops-ui-step">Step 4 of 5</p>
              <p className="ops-ui-title">Machine running</p>
              <p className="ops-ui-status ops-ui-ok">Running</p>
              <div className="ops-ui-meters">
                <div><span>Opening meter</span><strong>1,284.6h</strong></div>
                <div><span>Time running</span><strong>3h 12m</strong></div>
              </div>
              <p className="ops-ui-line">The line climbs while it runs and falls while it is stopped.</p>
              <div className="ops-ui-chart" aria-hidden>
                <span />
              </div>
            </div>
          </Phone>
        </section>

        <section id="product" className="ops-section">
          <p className="ops-kicker">The product</p>
          <h2>Built for the crew around a machine, not for a desk full of spreadsheets.</h2>
          <p className="ops-section-lead">
            Operators record the day as it happens. Supervisors sign it. Mechanics get the problems. Managers see the hours, the downtime, and the cost.
          </p>
        </section>

        <section id="how" className="ops-section">
          <p className="ops-kicker">How it works</p>
          <h2>The same shift, passed along the line.</h2>
          <ol className="ops-flow">
            {[
              ["Operator", "Clocks in, checks the machine, starts it, and records stops, diesel, and problems."],
              ["Supervisor", "Watches the live machine, then signs the shift or sends it back."],
              ["Mechanic", "Receives the repair, inspects the machine, and asks for parts."],
              ["Manager", "Reads the hours, downtime, diesel, expenses, and the reports."],
            ].map(([title, text], i) => (
              <li key={title}>
                <span>{i + 1}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ops-section" id="roles">
          <p className="ops-kicker">Who it is for</p>
          <h2>Five roles. One operation.</h2>
          <div className="ops-roles">
            {ROLES.map((role) => (
              <article key={role.id} id={role.id}>
                <h3>{role.title}</h3>
                <p>{role.lead}</p>
                <ul>
                  {role.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section className="ops-section">
          <p className="ops-kicker">The questions a site already asks</p>
          <h2>The answers live on the shift, not in someone’s notebook.</h2>
          <div className="ops-questions">
            {PROBLEMS.map(([q, a]) => (
              <article key={q}>
                <h3>{q}</h3>
                <p>{a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ops-section" id="features">
          <p className="ops-kicker">What is already in the product</p>
          <h2>The work the app already does.</h2>
          <div className="ops-features">
            {FEATURES.map(([title, text]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="ops-section" id="demo">
          <p className="ops-kicker">The same day, three screens</p>
          <h2>From the operator’s phone to the people who sign and manage it.</h2>
          <div className="ops-demo">
            <Phone kicker="Operator" title="Start the machine">
              <div className="ops-ui">
                <p className="ops-ui-step">Step 3 of 5</p>
                <p className="ops-ui-title">Start machine</p>
                <p className="ops-ui-muted">Photo the hour meter, then start.</p>
                <div className="ops-ui-photo">Meter photo</div>
                <p className="ops-ui-fab">Start machine</p>
              </div>
            </Phone>
            <Phone kicker="Supervisor" title="Sign off">
              <div className="ops-ui">
                <p className="ops-ui-step">Waiting</p>
                <p className="ops-ui-title">Shift to sign</p>
                <p className="ops-ui-muted">1,284.6h → 1,291.2h · 6.6h</p>
                <p className="ops-ui-status ops-ui-wait">Needs a signature</p>
                <p className="ops-ui-fab ops-ui-fab-green">Sign off</p>
              </div>
            </Phone>
            <Phone kicker="Manager" title="The machine today">
              <div className="ops-ui">
                <p className="ops-ui-step">Pulse</p>
                <p className="ops-ui-title">Running time minus stop time</p>
                <div className="ops-ui-meters">
                  <div><span>Time running</span><strong>6h 40m</strong></div>
                  <div><span>Time stopped</span><strong>1h 05m</strong></div>
                </div>
                <div className="ops-ui-chart" aria-hidden><span /></div>
                <p className="ops-ui-muted">Downtime by owner, on the same screen.</p>
              </div>
            </Phone>
          </div>
        </section>

        <section className="ops-section ops-cta" id="contact">
          <div>
            <p className="ops-kicker">Request a demo</p>
            <h2>See it on your own machine and crew.</h2>
            <p className="ops-section-lead">
              Tell us the operation. We will open a demo around the roles you actually use: operator, supervisor, mechanic, manager.
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
              <button className="ops-btn ops-btn-gold ops-form-wide" type="submit">Request a demo</button>
            </form>
          )}
        </section>
      </main>

      <footer className="ops-foot">
        <span className="ops-brand">OPS</span>
        <p>Equipment operations for the people on the machine and the people who answer for it.</p>
        <button type="button" onClick={onLogin}>Log in</button>
      </footer>
    </div>
  );
}
