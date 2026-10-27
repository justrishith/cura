"use client";
// MemoryGraph — an Obsidian-style memory constellation you can explore through.
// Nodes: Maria at the center; each check-in hangs off her; the kinds of things
// Cura did (symptoms, tips, family alerts, the doctor call) hang off the
// check-ins that produced them. Pseudo-3D on a plain <canvas>: fibonacci-sphere
// placement, auto-drift + pointer-drag rotation, perspective depth, tap to
// inspect. No dependencies; static-but-draggable under prefers-reduced-motion.
import { useEffect, useMemo, useRef, useState } from "react";

export interface GraphCheckin {
  id: string;
  grade: string;
  startedAt: string;
  actions: Array<{ id: string; tool: string }>;
}

interface GraphNode {
  kind: "patient" | "checkin" | "tool";
  label: string;
  detail: string;
  color: string;
  radius: number;
  x: number;
  y: number;
  z: number;
}

interface ProjectedNode extends GraphNode {
  sx: number;
  sy: number;
  scale: number;
}

const TOOL_META: Record<string, { label: string; color: string }> = {
  log_symptom: { label: "Symptoms", color: "#9a3b26" },
  suggest_health_tip: { label: "Tips & rituals", color: "#b08a6e" },
  notify_caregiver: { label: "Family alerts", color: "#694737" },
  schedule_telephone_call: { label: "The doctor call", color: "#35422d" },
  schedule_appointment: { label: "Booked visits", color: "#35422d" },
  log_medication: { label: "Medication", color: "#35422d" },
};

const MOSS = "#35422d";
const CLAY = "#694737";
const HAIR = "#d9cfb8";

function buildGraph(patientName: string, checkins: GraphCheckin[]) {
  const nodes: GraphNode[] = [];
  const edges: Array<[number, number]> = [];

  nodes.push({ kind: "patient", label: patientName, detail: "the person this memory is about", color: MOSS, radius: 2.0, x: 0, y: 0, z: 0 });

  const recent = checkins.slice(0, 12);
  recent.forEach((c, ci) => {
    const when = new Date(c.startedAt);
    const gradeColor = c.grade === "high" ? "#9a3b26" : c.grade === "crisis" ? "#7a2a1d" : CLAY;
    const rel = relativeDay(when);
    const ciIndex = nodes.length;
    nodes.push({
      kind: "checkin",
      label: rel,
      detail: `${c.grade.toUpperCase()} check-in — ${c.actions.length === 0 ? "a quiet day, just the conversation" : c.actions.length === 1 ? "one tracked moment" : `${c.actions.length} things Cura did`}`,
      color: gradeColor,
      radius: 0.72 + Math.min(c.actions.length, 3) * 0.22,
      x: 0, y: 0, z: 0,
    });
    edges.push([0, ciIndex]); // checkin ← Maria
    for (const a of c.actions) {
      const meta = TOOL_META[a.tool] ?? { label: a.tool, color: MOSS };
      const existing = nodes.findIndex((n) => n.kind === "tool" && n.label === meta.label);
      const ti = existing >= 0 ? existing : (nodes.push({ kind: "tool", label: meta.label, detail: `connected whenever ${rel} mattered`, color: meta.color, radius: 1.15, x: 0, y: 0, z: 0 }) - 1);
      edges.push([ciIndex, ti]);
    }
  });

  // Fibonacci sphere: even, natural spread for any node count.
  const n = nodes.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  nodes.forEach((node, i) => {
    const y = n > 1 ? 1 - (i / (n - 1)) * 2 : 0;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    node.x = Math.cos(theta) * r;
    node.y = y;
    node.z = Math.sin(theta) * r;
  });
  return { nodes, edges };
}

function relativeDay(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const h = d.getHours();
  if (days <= 0) return `today ${h % 12 || 12}${h < 12 ? "a" : "p"}`;
  const wd = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${wd} ${h < 12 ? "am" : "pm"}`;
}

export function MemoryGraph({ patientName, checkins }: { patientName: string; checkins: GraphCheckin[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { nodes, edges } = useMemo(() => buildGraph(patientName, checkins), [patientName, checkins]);
  const yawRef = useRef(0.5);
  const pitchRef = useRef(-0.22);
  const spinningRef = useRef(true);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const hoverRef = useRef<number | null>(null);
  const projCacheRef = useRef<ProjectedNode[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(true);

  useEffect(() => { spinningRef.current = spinning; }, [spinning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drag = dragRef; const yaw = yawRef; const pitch = pitchRef;
    let raf = 0;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(draw); return; }
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (spinningRef.current && !drag.current) yaw.current += 0.0032;
      const cyaw = Math.cos(yaw.current), syaw = Math.sin(yaw.current);
      const cpit = Math.cos(pitch.current), spit = Math.sin(pitch.current);
      const cx = w / 2, cyy = h / 2;
      const R = Math.min(w, h) * 0.34;
      const F = 2.4;

      const proj: ProjectedNode[] = nodes.map((n) => {
        const x1 = n.x * cyaw + n.z * syaw;
        const z1 = -n.x * syaw + n.z * cyaw;
        const y1 = n.y * cpit - z1 * spit;
        const z2 = n.y * spit + z1 * cpit;
        const scale = F / (F + z2);
        return { ...n, sx: cx + x1 * R * scale, sy: cyy + y1 * R * scale, scale };
      });
      projCacheRef.current = proj;
      const order = proj.map((_, i) => i).sort((a, b) => proj[a].scale - proj[b].scale); // far first

      // edges (drawn first, behind everything)
      ctx.lineWidth = 1;
      for (const [aIdx, bIdx] of edges) {
        const a = proj[aIdx], b = proj[bIdx];
        if (!a || !b) continue;
        const depth = Math.min(a.scale, b.scale);
        ctx.strokeStyle = HAIR;
        ctx.globalAlpha = Math.max(0.06, (depth - 0.5) * 0.7);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }

      // nodes, far to near
      for (const i of order) {
        const p = proj[i];
        const r = p.radius * 6.5 * p.scale;
        const isActive = i === selected || i === hoverRef.current;
        ctx.globalAlpha = 0.25 + 0.6 * p.scale;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
        if (isActive) {
          ctx.globalAlpha = 0.95;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        // labels: big entities always; check-ins only when near/front
        if (p.kind !== "checkin" || p.scale > 1.06 || isActive) {
          ctx.globalAlpha = Math.min(1, 0.35 + p.scale * 0.5);
          ctx.fillStyle = p.color;
          ctx.font = `600 ${Math.max(9.5, 11 * p.scale)}px "Instrument Sans", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(p.label, p.sx, p.sy - r - 5);
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges]);

  function pickAt(clientX: number, clientY: number): number | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let best: number | null = null;
    let bestD = 26 * 26;
    projCacheRef.current.forEach((p, i) => {
      const d = (p.sx - (clientX - rect.left)) ** 2 + (p.sy - (clientY - rect.top)) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  return (
    <section aria-label="Explore the memory" className="a-drop d-4 r-sheet border border-hairline bg-paper p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-clay">Explore the memory</h2>
        <button
          type="button"
          onClick={() => setSpinning((s) => !s)}
          className="rounded-full border border-hairline bg-sand px-3 py-1 text-[11px] font-semibold text-inkmuted transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
        >
          {spinning ? "Pause drift" : "Resume drift"}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        aria-label="3D web of the week's check-ins and the actions Cura took in each. Drag to turn; tap a light to inspect it."
        className="mt-3 h-72 w-full cursor-grab touch-none rounded-2xl bg-sand active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
        onPointerDown={(e) => { dragRef.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          if (dragRef.current) {
            yawRef.current += (e.clientX - dragRef.current.x) * 0.006;
            pitchRef.current = Math.max(-1.2, Math.min(1.2, pitchRef.current + (e.clientY - dragRef.current.y) * 0.006));
            dragRef.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.style.cursor = "grabbing";
          } else {
            hoverRef.current = pickAt(e.clientX, e.clientY);
            e.currentTarget.style.cursor = hoverRef.current == null ? "grab" : "pointer";
          }
        }}
        onPointerUp={() => { dragRef.current = null; }}
        onPointerLeave={() => { dragRef.current = null; hoverRef.current = null; }}
        onClick={(e) => {
          const hit = pickAt(e.clientX, e.clientY);
          setSelected((cur) => (hit == null ? null : hit === cur ? null : hit));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") yawRef.current -= 0.15;
          if (e.key === "ArrowRight") yawRef.current += 0.15;
          if (e.key === "Escape") setSelected(null);
        }}
      />
      <p className="mt-2 min-h-[2.7rem] text-[13px] leading-relaxed text-inkmuted">
        {selected != null ? (
          <>
            <span className="font-semibold" style={{ color: nodes[selected].color }}>{nodes[selected].label}</span>
            {" — "}
            {nodes[selected].detail}
          </>
        ) : (
          "Drag to turn her week. Every light is a moment with Cura — the red ones are the days worth catching early. Tap a light to see what it holds."
        )}
      </p>
      <p className="sr-only">Graph contents: {nodes.map((n) => n.label).join(", ")}.</p>
    </section>
  );
}

export default MemoryGraph;
