"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Hero canvas: an endless dusk road rendered in a single fragment shader (Three.js).
 * One responsibility: give the headline a sense of forward motion.
 * - DPR capped at 1.5, paused offscreen / when tab hidden.
 * - Pointer gently steers the vanishing point (additive; touch and keyboard users lose nothing).
 * - Static poster under reduced motion, missing WebGL or context loss.
 */
const frag = /* glsl */ `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
varying vec2 vUv;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }

void main(){
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  float horizon = 0.40 + uPointer.y * 0.015;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);

  // Sky: deep night overhead, warm dusk at the horizon.
  float h = clamp((uv.y - horizon) / (1.0 - horizon), 0.0, 1.0);
  vec3 skyTop = vec3(0.035, 0.040, 0.050);
  vec3 skyMid = vec3(0.090, 0.085, 0.100);
  vec3 dusk   = vec3(0.86, 0.47, 0.26);
  vec3 sky = mix(skyMid, skyTop, smoothstep(0.0, 0.7, h));
  sky = mix(sky, dusk, pow(1.0 - h, 9.0) * 0.85);
  float sunX = 0.30 * aspect * smoothstep(0.9, 1.6, aspect) + 0.05 + uPointer.x * 0.04;
  float sd = length(vec2(p.x - sunX, (uv.y - horizon) * 1.6));
  sky += vec3(1.0, 0.62, 0.36) * exp(-sd * 9.0) * 0.55;
  sky += vec3(1.0, 0.55, 0.30) * exp(-sd * 2.5) * 0.10;

  // Distant hills silhouette.
  float hill = horizon + 0.018 + 0.022 * noise(vec2(p.x * 2.2 + 3.0, 1.0)) + 0.012 * noise(vec2(p.x * 6.0, 2.0));
  float hillMask = smoothstep(hill + 0.002, hill - 0.002, uv.y) * step(horizon, uv.y);
  sky = mix(sky, vec3(0.05, 0.045, 0.055), hillMask);

  vec3 col = sky;

  if (uv.y < horizon) {
    float y = horizon - uv.y;
    float z = 0.11 / y;                         // depth
    float vpx = 0.24 * aspect * smoothstep(0.9, 1.6, aspect) + uPointer.x * 0.06;
    float curve = 0.035 * sin(uTime * 0.07) + uPointer.x * 0.02;
    float xw = (p.x - vpx) * z - curve * z * z; // road-space x
    float travel = z + uTime * 2.4;

    vec3 ground = mix(vec3(0.045, 0.05, 0.045), vec3(0.09, 0.08, 0.075), smoothstep(0.0, 0.25, 1.0 / z));
    ground *= 0.8 + 0.4 * noise(vec2(xw * 3.0, travel * 0.6));
    float roadW = 0.55;
    float road = smoothstep(roadW + 0.02, roadW, abs(xw));
    vec3 asphalt = vec3(0.075, 0.078, 0.085) * (0.85 + 0.3 * noise(vec2(xw * 40.0, travel * 12.0)));
    col = mix(ground, asphalt, road);

    // Edge lines (solid) and centre line (dashed, moving).
    float lw = 0.012 + 0.002 * z;
    float edge = smoothstep(lw, 0.0, abs(abs(xw) - roadW * 0.9));
    float ft = fract(travel * 0.5);
    float dash = smoothstep(0.50, 0.53, ft) * (1.0 - smoothstep(0.97, 1.0, ft));
    float centre = smoothstep(lw, 0.0, abs(xw)) * dash;
    vec3 paint = vec3(0.92, 0.90, 0.85);
    float near = 1.0 - smoothstep(0.18, 0.40, y) * 0.55; // soften paint closest to the camera
    col = mix(col, paint, (edge * 0.75 + centre * 0.9) * road * near);

    // Warm reflection of the dusk sky on the tarmac.
    col += dusk * 0.10 * exp(-y * 9.0) * road;

    // Atmospheric fade into the horizon.
    float fog = exp(-y * 14.0);
    col = mix(col, mix(skyMid, dusk, 0.35), fog * 0.85);
  }

  // Vignette and fine grain.
  float vig = smoothstep(1.25, 0.25, length((uv - vec2(0.5, 0.45)) * vec2(aspect * 0.8, 1.0)));
  col *= mix(0.55, 1.0, vig);
  col += (hash(uv * uRes + fract(uTime)) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}`;

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function HeroRoad() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let teardown = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
      } catch {
        return; // keep poster
      }
      const canvas = renderer.domElement;
      canvas.setAttribute("aria-hidden", "true");
      canvas.className = "absolute inset-0 h-full w-full";
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const uniforms = {
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 8 },
        uPointer: { value: new THREE.Vector2(0, 0) },
      };
      const geometry = new THREE.PlaneGeometry(2, 2);
      const material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, depthTest: false });
      scene.add(new THREE.Mesh(geometry, material));
      host.appendChild(canvas);

      const target = new THREE.Vector2(0, 0);
      const resize = () => {
        const { width, height } = host.getBoundingClientRect();
        renderer.setSize(width, height, false);
        renderer.getDrawingBufferSize(uniforms.uRes.value);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      let raf = 0;
      let visible = true;
      let last = performance.now();
      const frame = (now: number) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        uniforms.uTime.value += dt;
        uniforms.uPointer.value.lerp(target, 0.04);
        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      };
      const start = () => { if (!raf && visible && !document.hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); } };
      const stop = () => { cancelAnimationFrame(raf); raf = 0; };

      let pending = false;
      const onPointer = (e: PointerEvent) => {
        if (e.pointerType !== "mouse" || pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          target.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
        });
      };
      const onLeave = () => target.set(0, 0);
      const onVis = () => (document.hidden ? stop() : start());
      const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); else stop(); });
      io.observe(host);
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("blur", onLeave);
      document.addEventListener("visibilitychange", onVis);
      const onLost = (e: Event) => { e.preventDefault(); stop(); canvas.style.opacity = "0"; setLive(false); };
      canvas.addEventListener("webglcontextlost", onLost);

      renderer.render(scene, camera); // first frame (also the only frame under reduced motion)
      setLive(true);
      start();

      teardown = () => {
        stop();
        io.disconnect();
        ro.disconnect();
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("blur", onLeave);
        document.removeEventListener("visibilitychange", onVis);
        canvas.removeEventListener("webglcontextlost", onLost);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })();

    return () => { disposed = true; teardown(); };
  }, []);

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden bg-night" aria-hidden="true">
      {/* Static poster (rendered from this same shader); visible until WebGL is live. */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${live ? "opacity-0" : "opacity-100"}`}
        style={{ backgroundImage: "url(/images/hero-poster.jpg), linear-gradient(180deg,#0a0b0d 0%,#17161a 45%,#c27247 60%,#121314 61%,#0b0c0e 100%)" }}
      />
    </div>
  );
}
