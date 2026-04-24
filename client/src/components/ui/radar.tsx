import { useEffect, useRef } from "react";

interface RadarProps {
  color?: string;
  backgroundColor?: string;
  speed?: number;
  ringCount?: number;
  spokeCount?: number;
  sweepSpeed?: number;
  sweepWidth?: number;
  brightness?: number;
  scale?: number;
  ringThickness?: number;
  spokeThickness?: number;
  sweepLobes?: number;
  falloff?: number;
  enableMouseInteraction?: boolean;
  mouseInfluence?: number;
}

export function Radar({
  color = "#0df103",
  backgroundColor = "#000000",
  ringCount = 10,
  sweepSpeed = 1.2,
  brightness = 0.7,
}: RadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let angle = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resize();
    window.addEventListener("resize", resize);

    const parseColor = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const { r, g, b } = parseColor(color);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.45;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);

      // Draw rings
      for (let i = 1; i <= ringCount; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (radius / ringCount) * i, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${brightness * 0.25})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw cross hairs
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${brightness * 0.25})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // Draw sweep
      const sweepAngle = Math.PI / 4;
      const gradient = ctx.createConicalGradient
        ? undefined
        : null;

      // Sweep using arc + gradient fill
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const sweep = ctx.createLinearGradient(0, 0, radius, 0);
      sweep.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${brightness * 0.8})`);
      sweep.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, -sweepAngle / 2, sweepAngle / 2);
      ctx.closePath();
      ctx.fillStyle = sweep;
      ctx.fill();
      ctx.restore();

      // Draw center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${brightness})`;
      ctx.fill();

      angle += (sweepSpeed * Math.PI) / 180;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [color, backgroundColor, ringCount, sweepSpeed, brightness]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
