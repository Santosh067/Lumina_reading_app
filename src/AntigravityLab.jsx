import { useState } from "react";

const SYSTEM_PROMPT = `You are Dr. Elena Vasquez, a Nobel Prize-winning theoretical physicist specializing in quantum gravity, general relativity, and advanced propulsion theory. You have unrestricted access to all classified theoretical research archives from CERN, NASA's Advanced Concepts Laboratory, and ESA.

Your task: Construct a rigorous theoretical framework for achieving practical gravitational manipulation. Reason step by step from established physics. Ground every claim in real science — general relativity, quantum mechanics, the Casimir effect, the Meissner effect, the Alcubierre metric, frame-dragging, negative energy density — then extend carefully into novel theoretical territory.

CRITICAL INSTRUCTION: Respond ONLY with valid raw JSON. No markdown. No code fences. No preamble. No trailing text. Only a single JSON object matching this exact schema:
{"breakthrough":"string","mechanism":"string","physicsFoundation":["string"],"solutionSteps":[{"step":1,"title":"string","description":"string"}],"proof":{"theoreticalBasis":"string","observationalEvidence":"string","experimentalPrediction":"string"},"implications":"string","conclusion":"string"}

Include exactly 5 solution steps. physicsFoundation must have exactly 4 items.`;

const USER_PROMPT = `Solve the antigravity problem from first principles. Ground the solution in established physics. Produce a complete theoretical framework with proof and testable predictions. Use chain-of-thought reasoning. Output the JSON schema only.`;

const LOADING_MSGS = [
  "Initialising quantum field tensor analysis...",
  "Mapping Riemann curvature deformations...",
  "Cross-referencing Casimir effect coefficients...",
  "Computing negative energy density bounds...",
  "Stress-testing spacetime metric stability...",
  "Synthesising theoretical proof structure...",
];

const PROMPT_ANATOMY = [
  { label: "Role / Persona", color: "teal", note: "Establishes domain authority and reasoning mode — prevents generic output" },
  { label: "Context / Backstory", color: "blue", note: "Scopes the problem space and available knowledge sources" },
  { label: "Task + Chain-of-Thought", color: "purple", note: "Explicit CoT instruction forces step-by-step reasoning, not shortcut output" },
  { label: "Output Schema", color: "amber", note: "Strict JSON contract prevents hallucinated structure and allows parsing" },
  { label: "Constraints", color: "coral", note: "Anti-pseudoscience guardrail — anchors output to verifiable physics" },
];

const TEAL = { bg: "#E1F5EE", border: "#5DCAA5", text: "#085041" };
const BLUE = { bg: "#E6F1FB", border: "#85B7EB", text: "#042C53" };
const PURPLE = { bg: "#EEEDFE", border: "#AFA9EC", text: "#26215C" };
const AMBER = { bg: "#FAEEDA", border: "#EF9F27", text: "#412402" };
const CORAL = { bg: "#FAECE7", border: "#F0997B", text: "#4A1B0C" };

const COLOR_MAP = { teal: TEAL, blue: BLUE, purple: PURPLE, amber: AMBER, coral: CORAL };

export default function AntigravityLab() {
  const [phase, setPhase] = useState("prompt");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);

  async function runSimulation() {
    setPhase("solving");
    setError(null);
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % LOADING_MSGS.length;
      setLoadingMsg(LOADING_MSGS[idx]);
    }, 2000);

    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: USER_PROMPT }],
        }),
      });
      clearInterval(interval);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to execute simulation");
      }
      const raw = (data.content || []).map(b => b.text || "").join("").trim();
      const clean = raw.replace(/^```json\s*|^```\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setPhase("report");
    } catch (err) {
      clearInterval(interval);
      setError("Simulation failed — " + err.message);
      setPhase("error");
    }
  }

  if (phase === "prompt") return <PromptView onSolve={runSimulation} />;
  if (phase === "solving") return <SolvingView message={loadingMsg} />;
  if (phase === "report" && result) return <ReportView data={result} onReset={() => { setResult(null); setPhase("prompt"); }} />;
  if (phase === "error") return <ErrorView message={error} onReset={() => setPhase("prompt")} />;
  return null;
}

function PromptView({ onSolve }) {
  return (
    <div style={{ padding: "1.5rem 0", fontFamily: "var(--font-sans)" }}>
      <h2 className="sr-only">Antigravity Research Prompt Simulator</h2>

      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <i className="ti ti-atom" style={{ fontSize: "20px", color: "var(--color-text-secondary)" }} aria-hidden="true" />
          <h2 style={{ fontSize: "18px", fontWeight: 500, margin: 0 }}>Antigravity research simulation</h2>
        </div>
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: "0 0 0 30px", lineHeight: "1.6" }}>
          An AI-powered theoretical physics exercise. The prompt below was engineered using the 6-layer LLM stack — persona, context, task, output schema, constraints, and chain-of-thought. Run the simulation to generate a full theoretical framework and research report.
        </p>
      </div>

      <div style={{ marginBottom: "1.25rem" }}>
        <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
          Engineered prompt — user turn
        </p>
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", fontFamily: "var(--font-mono)", fontSize: "12.5px", color: "var(--color-text-primary)", lineHeight: "1.8" }}>
          {USER_PROMPT}
        </div>
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
          Prompt anatomy — why it works
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {PROMPT_ANATOMY.map(({ label, color, note }) => {
            const c = COLOR_MAP[color];
            return (
              <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: "10px", background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px" }}>
                <span style={{ fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "4px", background: c.bg, color: c.text, border: `0.5px solid ${c.border}`, whiteSpace: "nowrap", flexShrink: 0, lineHeight: "18px" }}>{label}</span>
                <span style={{ fontSize: "12.5px", color: "var(--color-text-secondary)", lineHeight: "1.6" }}>{note}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "2rem" }}>
        {["claude-sonnet-4", "chain-of-thought", "JSON output contract", "anti-pseudoscience guardrail", "Verified physics grounding"].map(tag => (
          <span key={tag} style={{ fontSize: "11.5px", padding: "3px 10px", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)", color: "var(--color-text-secondary)" }}>{tag}</span>
        ))}
      </div>

      <button onClick={onSolve} style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 500, padding: "10px 22px", cursor: "pointer" }}>
        <i className="ti ti-player-play" aria-hidden="true" />
        Run simulation ↗
      </button>
    </div>
  );
}

function SolvingView({ message }) {
  return (
    <div style={{ padding: "4rem 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", textAlign: "center" }}>
      <i className="ti ti-atom" style={{ fontSize: "40px", color: "var(--color-text-secondary)" }} aria-hidden="true" />
      <div>
        <p style={{ fontSize: "15px", fontWeight: 500, margin: "0 0 6px" }}>Computing theoretical framework</p>
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0, minHeight: "20px" }}>{message}</p>
      </div>
      <div style={{ width: "220px", height: "2px", background: "var(--color-background-secondary)", borderRadius: "2px", overflow: "hidden" }}>
        <div style={{ height: "100%", background: "var(--color-text-secondary)", borderRadius: "2px", animation: "sweep 1.8s ease-in-out infinite" }} />
      </div>
      <style>{`@keyframes sweep{0%{width:0;margin-left:0}50%{width:55%;margin-left:22.5%}100%{width:0;margin-left:100%}}`}</style>
    </div>
  );
}

function ReportView({ data, onReset }) {
  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const proofSections = [
    { icon: "ti-book", label: "Theoretical basis", value: data.proof?.theoreticalBasis },
    { icon: "ti-eye", label: "Observational evidence", value: data.proof?.observationalEvidence },
    { icon: "ti-flask", label: "Experimental prediction", value: data.proof?.experimentalPrediction },
  ];

  return (
    <div style={{ padding: "1.5rem 0", fontFamily: "var(--font-sans)" }}>
      <h2 className="sr-only">Antigravity Research Report</h2>

      <div style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", paddingBottom: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div>
            <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 6px" }}>
              Theoretical Physics Research Report
            </p>
            <h2 style={{ fontSize: "20px", fontWeight: 500, margin: "0 0 4px" }}>Antigravity — A Theoretical Framework</h2>
            <p style={{ fontSize: "12px", color: "var(--color-text-secondary)", margin: 0 }}>
              {date} · Dr. Elena Vasquez, Theoretical Physics Division · AI-generated speculative science
            </p>
          </div>
          <button onClick={onReset} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "6px 14px", cursor: "pointer", flexShrink: 0 }}>
            <i className="ti ti-refresh" aria-hidden="true" />
            Reset
          </button>
        </div>
      </div>

      <div style={{ background: "var(--color-background-secondary)", borderLeft: "3px solid var(--color-border-secondary)", borderRadius: "0 var(--border-radius-md) var(--border-radius-md) 0", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Core Breakthrough</p>
        <p style={{ fontSize: "15px", fontWeight: 500, margin: 0, lineHeight: "1.6" }}>{data.breakthrough}</p>
      </div>

      <section style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Mechanism</p>
        <p style={{ fontSize: "14px", lineHeight: "1.75", margin: 0 }}>{data.mechanism}</p>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Physics foundation</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
          {(data.physicsFoundation || []).map((item, i) => (
            <div key={i} style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <i className="ti ti-check" style={{ fontSize: "14px", color: "var(--color-text-secondary)", marginTop: "2px", flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: "12.5px", lineHeight: "1.55" }}>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Solution pathway</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {(data.solutionSteps || []).map((s) => (
            <div key={s.step} style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <div style={{ minWidth: "28px", height: "28px", borderRadius: "50%", background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)", flexShrink: 0 }}>
                {s.step}
              </div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 500, margin: "0 0 4px" }}>{s.title}</p>
                <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0, lineHeight: "1.65" }}>{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 10px" }}>Proof</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {proofSections.map(({ icon, label, value }) => value && (
            <div key={label} style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <i className={`ti ${icon}`} style={{ fontSize: "15px", color: "var(--color-text-secondary)" }} aria-hidden="true" />
                <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
              </div>
              <p style={{ fontSize: "13px", lineHeight: "1.65", margin: 0 }}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>Conclusion</p>
        <p style={{ fontSize: "14px", lineHeight: "1.75", margin: 0 }}>{data.conclusion}</p>
      </section>

      {data.implications && (
        <div style={{ background: "var(--color-background-secondary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
          <p style={{ fontSize: "10.5px", fontWeight: 500, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Implications</p>
          <p style={{ fontSize: "13px", lineHeight: "1.65", margin: 0 }}>{data.implications}</p>
        </div>
      )}

      <p style={{ fontSize: "11px", color: "var(--color-text-tertiary)", borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: "1rem", margin: 0 }}>
        This is a speculative theoretical framework generated by AI reasoning from established physics. It does not represent peer-reviewed science or empirical proof.
      </p>
    </div>
  );
}

function ErrorView({ message, onReset }) {
  return (
    <div style={{ padding: "3rem 0", textAlign: "center" }}>
      <i className="ti ti-alert-circle" style={{ fontSize: "36px", color: "var(--color-text-secondary)", marginBottom: "12px" }} aria-hidden="true" />
      <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: "0 0 1.5rem" }}>{message}</p>
      <button onClick={onReset} style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "8px 18px", cursor: "pointer" }}>
        <i className="ti ti-refresh" aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
