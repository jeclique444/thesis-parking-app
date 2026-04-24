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
  const angleRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const hexToRgb = (hex: string) => {
      const clean = hex.replace("#", "");
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
      };
    };

    const { r, g, b } = hexToRgb(color);
    const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;

    const resize = () => {
      // Scale up the canvas resolution for retina/high-DPI screens
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      mouseRef.current = {
        // Multiply mouse coordinates by dpr so the interaction lines up perfectly
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
        active: true,
      };
    };
    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    // ✅ Attach to window so mouse is tracked even if cursor briefly leaves canvas
    window.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;

      // 1. FIXED FOR TRANSPARENCY:
      // Clear the entire canvas every frame so previous drawings disappear
      ctx.clearRect(0, 0, w, h);

      // 2. Only draw a solid background color if one was provided AND it's not "transparent"
      if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, w, h);
      }

      // ✅ Smooth mouse offset with clamping so it never goes wild
      let offsetX = 0;
      let offsetY = 0;
      if (enableMouseInteraction && mouseRef.current.active) {
        const rawX = (mouseRef.current.x - cx) * mouseInfluence;
        const rawY = (mouseRef.current.y - cy) * mouseInfluence;
        // Clamp so the center never moves more than 8% of the canvas
        const maxOffset = Math.min(w, h) * 0.08;
        offsetX = Math.max(-maxOffset, Math.min(maxOffset, rawX));
        offsetY = Math.max(-maxOffset, Math.min(maxOffset, rawY));
      }

      const ox = cx + offsetX;
      const oy = cy + offsetY;

      // Background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, w, h);

      // Rings
      for (let i = 1; i <= ringCount; i++) {
        const ringRadius = (baseRadius / ringCount) * i;
        const depthFade = 1 - (i / ringCount) * (1 - falloff * 0.4);
        ctx.beginPath();
        ctx.arc(ox, oy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(brightness * 0.3 * depthFade);
        ctx.lineWidth = Math.max(0.5, ringThickness * baseRadius * 0.25);
        ctx.stroke();
      }

      // Spokes
      for (let i = 0; i < spokeCount; i++) {
        const spokeAngle = (Math.PI * 2 * i) / spokeCount;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(
          ox + Math.cos(spokeAngle) * baseRadius,
          oy + Math.sin(spokeAngle) * baseRadius
        );
        ctx.strokeStyle = rgba(brightness * 0.2);
        ctx.lineWidth = Math.max(0.5, spokeThickness * baseRadius * 0.25);
        ctx.stroke();
      }

      // Sweep lobes
      for (let lobe = 0; lobe < sweepLobes; lobe++) {
        const lobeOffset = (Math.PI * 2 * lobe) / sweepLobes;
        const sweepAngleRad = (sweepWidth * Math.PI) / 180;

        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(angleRef.current * speed + lobeOffset);

        // Clip to radar circle so sweep doesn't bleed outside
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
        ctx.clip();

        // Main sweep beam
        const gradient = ctx.createLinearGradient(0, 0, baseRadius, 0);
        gradient.addColorStop(0, rgba(brightness));
        gradient.addColorStop(0.5, rgba(brightness * 0.4));
        gradient.addColorStop(1, rgba(0));

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, baseRadius, -sweepAngleRad / 2, sweepAngleRad / 2);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Trailing ghost fade behind sweep
        const trailSteps = 10;
        for (let t = 1; t <= trailSteps; t++) {
          const trailAlpha = brightness * 0.1 * (1 - t / trailSteps) * falloff;
          const trailSpread = sweepAngleRad + (t * Math.PI) / 20;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, baseRadius, -sweepAngleRad / 2, -sweepAngleRad / 2 + trailSpread);
          ctx.closePath();
          ctx.fillStyle = rgba(trailAlpha);
          ctx.fill();
        }

        ctx.restore();
      }

      // Outer boundary ring
      ctx.beginPath();
      ctx.arc(ox, oy, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(brightness * 0.55);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(brightness);
      ctx.fill();

      angleRef.current += (sweepSpeed * Math.PI) / 180;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
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
      style={{ display: "block", cursor: enableMouseInteraction ? "crosshair" : "default" }}
    />
  );
}
