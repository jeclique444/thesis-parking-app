import { useEffect, useRef } from "react";

interface RadarProps {
  color?: string;
  backgroundColor?: string;
  speed?: number;
  scale?: number;
  ringCount?: number;
  spokeCount?: number;
  ringThickness?: number;
  spokeThickness?: number;
  sweepSpeed?: number;
  sweepWidth?: number;
  sweepLobes?: number;
  falloff?: number;
  brightness?: number;
  enableMouseInteraction?: boolean;
  mouseInfluence?: number;
}

export function Radar({
  color = "#0df103",
  backgroundColor = "#100228",
  speed = 0.9,
  scale = 1.3,
  ringCount = 10,
  spokeCount = 5,
  ringThickness = 0.05,
  spokeThickness = 0.01,
  sweepSpeed = 1.2,
  sweepWidth = 6,
  sweepLobes = 1,
  falloff = 1,
  brightness = 0.9,
  enableMouseInteraction = false,
  mouseInfluence = 0.15,
}: RadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let angle = 0;

    // Parse hex color to RGB
    const hexToRgb = (hex: string) => {
      const clean = hex.replace("#", "");
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
      };
    };

    const { r, g, b } = hexToRgb(color);
    const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      if (!enableMouseInteraction) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const baseRadius = Math.min(w, h) * 0.45 * scale;

      // Mouse offset
      let offsetX = 0;
      let offsetY = 0;
      if (enableMouseInteraction && mouseRef.current.active) {
        offsetX = (mouseRef.current.x - cx) * mouseInfluence * 0.1;
        offsetY = (mouseRef.current.y - cy) * mouseInfluence * 0.1;
      }

      // Background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);

      // Rings
      for (let i = 1; i <= ringCount; i++) {
        const ringRadius = (baseRadius / ringCount) * i;
        const ringAlpha = brightness * 0.3 * (1 - (i / ringCount) * (1 - falloff * 0.5));
        ctx.beginPath();
        ctx.arc(cx + offsetX, cy + offsetY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(ringAlpha);
        ctx.lineWidth = Math.max(1, ringThickness * baseRadius * 0.3);
        ctx.stroke();
      }

      // Spokes
      for (let i = 0; i < spokeCount; i++) {
        const spokeAngle = (Math.PI * 2 * i) / spokeCount;
        ctx.beginPath();
        ctx.moveTo(cx + offsetX, cy + offsetY);
        ctx.lineTo(
          cx + offsetX + Math.cos(spokeAngle) * baseRadius,
          cy + offsetY + Math.sin(spokeAngle) * baseRadius
        );
        ctx.strokeStyle = rgba(brightness * 0.25);
        ctx.lineWidth = Math.max(0.5, spokeThickness * baseRadius * 0.3);
        ctx.stroke();
      }

      // Sweep — supports multiple lobes
      ctx.save();
      ctx.translate(cx + offsetX, cy + offsetY);

      for (let lobe = 0; lobe < sweepLobes; lobe++) {
        const lobeOffset = (Math.PI * 2 * lobe) / sweepLobes;
        const sweepAngleRad = (sweepWidth * Math.PI) / 180;

        ctx.save();
        ctx.rotate(angle * speed + lobeOffset);

        // Clip sweep to radar circle
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
        ctx.clip();

        // Gradient sweep
        const gradient = ctx.createLinearGradient(0, 0, baseRadius, 0);
        gradient.addColorStop(0, rgba(brightness * 0.9));
        gradient.addColorStop(0.6, rgba(brightness * 0.35));
        gradient.addColorStop(1, rgba(0));

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, baseRadius, -sweepAngleRad / 2, sweepAngleRad / 2);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Trailing glow — fades behind the sweep
        const trailGradient = ctx.createConicalGradientPolyfill
          ? undefined
          : null;

        // Draw a soft trailing arc
        for (let t = 1; t <= 8; t++) {
          const trailAlpha = brightness * 0.12 * (1 - t / 8) * falloff;
          const trailAngle = sweepAngleRad + (t * Math.PI) / 24;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, baseRadius, -sweepAngleRad / 2, -sweepAngleRad / 2 + trailAngle);
          ctx.closePath();
          ctx.fillStyle = rgba(trailAlpha);
          ctx.fill();
        }

        ctx.restore();
      }

      ctx.restore();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx + offsetX, cy + offsetY, 4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(brightness);
      ctx.fill();

      // Outer boundary circle
      ctx.beginPath();
      ctx.arc(cx + offsetX, cy + offsetY, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(brightness * 0.5);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      angle += (sweepSpeed * Math.PI) / 180;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [
    color, backgroundColor, speed, scale, ringCount, spokeCount,
    ringThickness, spokeThickness, sweepSpeed, sweepWidth, sweepLobes,
    falloff, brightness, enableMouseInteraction, mouseInfluence,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
