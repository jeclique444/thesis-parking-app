import React, { useEffect, useRef } from "react";

export interface RadarProps {
  speed?: number;
  scale?: number;
  ringCount?: number;
  spokeCount?: number;
  ringThickness?: number;
  spokeThickness?: number;
  sweepSpeed?: number;
  sweepWidth?: number;
  sweepLobes?: number;
  color?: string;
  backgroundColor?: string;
  falloff?: number;
  brightness?: number;
  enableMouseInteraction?: boolean;
  mouseInfluence?: number;
}

export const Radar: React.FC<RadarProps> = ({
  speed = 1,
  scale = 1,
  ringCount = 10,
  spokeCount = 5,
  ringThickness = 0.05,
  spokeThickness = 0.01,
  sweepSpeed = 1,
  sweepWidth = 6,
  sweepLobes = 1,
  color = "#F59E0B",
  backgroundColor = "transparent",
  falloff = 1,
  brightness = 1,
  enableMouseInteraction = true,
  mouseInfluence = 0.2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<number>(0);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);

    const handleMouseMove = (e: MouseEvent) => {
      if (!enableMouseInteraction) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      mouseRef.current = {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
        active: true,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    if (enableMouseInteraction) {
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseleave", handleMouseLeave);
    }

    const draw = () => {
      if (!ctx || !canvas) return;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      
      // Calculate the size of the radar based on the canvas size
      const maxRadius = Math.min(w, h) / 2 * scale;
      const baseRadius = maxRadius * 0.9;

      // 1. Clear the canvas for transparency
      ctx.clearRect(0, 0, w, h);

      // 2. Draw background only if it is not transparent
      if (backgroundColor && backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, w, h);
      }

      time += 0.01 * speed;
      const sweepAngle = (time * sweepSpeed) % (Math.PI * 2);

      // Setup drawing style
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalCompositeOperation = "lighter";

      // Mouse influence
      let targetX = cx;
      let targetY = cy;
      if (mouseRef.current.active && enableMouseInteraction) {
        const dx = mouseRef.current.x - cx;
        const dy = mouseRef.current.y - cy;
        targetX = cx + dx * mouseInfluence;
        targetY = cy + dy * mouseInfluence;
      }

      // Draw Rings
      for (let i = 1; i <= ringCount; i++) {
        const r = (baseRadius / ringCount) * i;
        ctx.beginPath();
        ctx.arc(targetX, targetY, r, 0, Math.PI * 2);
        ctx.lineWidth = maxRadius * ringThickness * (i / ringCount);
        ctx.globalAlpha = (0.1 + (i / ringCount) * 0.2) * brightness;
        ctx.stroke();
      }

      // Draw Spokes
      for (let i = 0; i < spokeCount; i++) {
        const angle = (Math.PI * 2 * i) / spokeCount;
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(
          targetX + Math.cos(angle) * baseRadius,
          targetY + Math.sin(angle) * baseRadius
        );
        ctx.lineWidth = maxRadius * spokeThickness;
        ctx.globalAlpha = 0.2 * brightness;
        ctx.stroke();
      }

      // Draw Sweep
      for (let l = 0; l < sweepLobes; l++) {
        const offset = (Math.PI * 2 * l) / sweepLobes;
        const lobeAngle = (sweepAngle + offset) % (Math.PI * 2);

        // We use a gradient to create the sweeping tail
        for (let a = 0; a < sweepWidth; a++) {
          const tailAngle = lobeAngle - (a * 0.05);
          const alpha = Math.pow(1 - a / sweepWidth, falloff) * 0.5 * brightness;
          
          if (alpha <= 0) continue;

          ctx.beginPath();
          ctx.moveTo(targetX, targetY);
          ctx.lineTo(
            targetX + Math.cos(tailAngle) * baseRadius,
            targetY + Math.sin(tailAngle) * baseRadius
          );
          ctx.lineWidth = 2; // Thin lines to build up the gradient
          ctx.globalAlpha = alpha;
          ctx.stroke();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      if (enableMouseInteraction) {
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseleave", handleMouseLeave);
      }
    };
  }, [
    speed,
    scale,
    ringCount,
    spokeCount,
    ringThickness,
    spokeThickness,
    sweepSpeed,
    sweepWidth,
    sweepLobes,
    color,
    backgroundColor,
    falloff,
    brightness,
    enableMouseInteraction,
    mouseInfluence,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ pointerEvents: enableMouseInteraction ? "auto" : "none" }}
    />
  );
};