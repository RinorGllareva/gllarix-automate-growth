import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { IntroPhase } from "@/contexts/IntroContext";
import { GEO } from "./gllarixMark";

const CONFIG = {
  speed: 1.9, // overall pace: 1 = original 7.8 s, 1.9 ≈ 4.1 s
  handoffAt: 6.5, // s (timeline): lockup starts flying into the nav
  handoffLength: 1.35, // s (timeline): flight + hero reveal
  skipSpeed: 3.5, // "Skip" fast-forwards instead of cutting
  veilStart: 1, // veil over the live hero while the mark assembles…
  veilMin: 0.8, // …easing to this so the hero background glimmers through
};

const NAV_ICON_SELECTOR = "[data-gllarix-nav-icon] svg";

interface GlassIntroProps {
  onPhase: (phase: IntroPhase) => void;
  onComplete: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const [ix, iy, iw, ih] = GEO.ibox;
const [wx, wy, ww, wh] = GEO.wbox;

// lockup proportions measured from the official horizontal logo
const ICON_AR = iw / ih;
const GAP = (wx - (ix + iw)) / ih;
const WORD_H = wh / ih;
const WORD_W = ww / ih;
const WORD_DY = (wy - iy) / ih;
const LOCKUP_W = ICON_AR + GAP + WORD_W;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const eOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const eInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const eInOutQuart = (x: number) =>
  x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  w: lerp(a.w, b.w, k),
  h: lerp(a.h, b.h, k),
});
const place = (el: HTMLElement, r: Rect) => {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.w}px`;
  el.style.height = `${r.h}px`;
};

// Colours are authored as-is (no sRGB→linear conversion) to keep the original grade.
const lin = (hex: number) =>
  new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

// The scene renders into the composer's target, where three no longer tone-maps,
// so the glass applies ACES itself (same curve as THREE.ACESFilmicToneMapping).
const ACES_GLSL = `
vec3 gxRRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 gxACES(vec3 c){
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= 1.0 / 0.6; c = I * c; c = gxRRT(c); c = O * c; return clamp(c, 0.0, 1.0);
}`;

const GlassIntro = ({ onPhase, onComplete }: GlassIntroProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const flyIconRef = useRef<HTMLDivElement>(null);
  const flyWordRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onPhase, onComplete });
  callbacks.current = { onPhase, onComplete };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const veil = veilRef.current!;
    const flyIcon = flyIconRef.current!;
    const flyWord = flyWordRef.current!;
    const skipBtn = skipRef.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    let phase: IntroPhase = "playing";
    const setPhase = (next: IntroPhase) => {
      if (phase === next) return;
      phase = next;
      if (next === "done") callbacks.current.onComplete();
      else callbacks.current.onPhase(next);
    };

    let renderer: THREE.WebGLRenderer;
    try {
      if (reduced) throw new Error("reduced motion");
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      // no WebGL / reduced motion: land directly on the hero
      const timer = window.setTimeout(() => setPhase("done"), 250);
      veil.style.transition = "opacity .25s ease";
      veil.style.opacity = "0";
      callbacks.current.onPhase("docked");
      return () => {
        window.clearTimeout(timer);
        document.documentElement.style.overflow = previousOverflow;
      };
    }

    const small = Math.min(innerWidth, innerHeight) < 700;
    const DPR = Math.min(devicePixelRatio || 1, small ? 2 : 1.75);
    renderer.setPixelRatio(DPR);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
    scene.add(camera);
    let baseDist = 8.5;

    /* ---------- studio environment for the glass (tinted to the hero palette) ---------- */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = (() => {
      const env = new THREE.Scene();
      env.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(40, 32, 16),
          new THREE.MeshBasicMaterial({ color: lin(0x020206), side: THREE.BackSide }),
        ),
      );
      const box = (w: number, h: number, x: number, y: number, z: number, c: number, k: number) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ color: lin(c).multiplyScalar(k), side: THREE.DoubleSide }),
        );
        m.position.set(x, y, z);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      box(24, 2.5, 0, 16, 10, 0xeef3ff, 6); // top strip — the main highlight
      box(2.5, 22, -18, 0, 10, 0x9fb8d0, 3.5); // left: steel
      box(2.5, 20, 18, -2, 4, 0x9d8ae8, 3); // right: violet
      box(5, 5, 7, 8, 16, 0xffffff, 7); // hot spot
      box(28, 3, 0, -16, 8, 0x6f7fa8, 1.4); // soft floor bounce
      const target = pmrem.fromScene(env, 0.02);
      env.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      return target;
    })();
    scene.environment = envTarget.texture;
    pmrem.dispose();

    // legacy-light intensities scaled for three's physical lighting
    const key = new THREE.DirectionalLight(lin(0xe8eeff), 1.1 * Math.PI);
    key.position.set(-3, 5, 6);
    scene.add(key);
    const GLINT_MAX = 5 * Math.PI * 2.2;
    const glint = new THREE.PointLight(0xffffff, 0, 9, 1.6);
    scene.add(glint);

    /* ---------- glass logo (6 pieces from the real mark) ---------- */
    const logo = new THREE.Group();
    scene.add(logo);
    const DEPTH = 0.2;
    const BEVEL_T = 0.055;
    const BEVEL_S = 0.024;
    const wipe = { value: -9 };
    const WIPE_DIR = new THREE.Vector2(1, -1).normalize();

    const glassBase = new THREE.MeshPhysicalMaterial({
      color: lin(0xf2f5ff),
      metalness: 0,
      roughness: 0.06,
      transmission: 1,
      thickness: 0.8,
      ior: 1.52,
      attenuationColor: lin(0x8f9fd6),
      attenuationDistance: 2.4,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      specularIntensity: 1,
      iridescence: 0.3,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [200, 480],
      envMapIntensity: 2.4,
      transparent: true,
      opacity: 0,
    });
    const patchGlass = (m: THREE.MeshPhysicalMaterial) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uWipe = wipe;
        sh.uniforms.uWipeDir = { value: WIPE_DIR };
        sh.vertexShader =
          "varying vec3 vGW;\n" +
          sh.vertexShader.replace(
            "#include <worldpos_vertex>",
            "#include <worldpos_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.)).xyz;",
          );
        sh.fragmentShader =
          "varying vec3 vGW; uniform float uWipe; uniform vec2 uWipeDir;\n" +
          ACES_GLSL +
          "\n" +
          sh.fragmentShader
            .replace(
              "#include <opaque_fragment>",
              "#include <opaque_fragment>\n float dW = dot(vGW.xy, uWipeDir);\n gl_FragColor.a *= 1. - smoothstep(uWipe + .02, uWipe - .16, dW);",
            )
            .replace("#include <tonemapping_fragment>", "gl_FragColor.rgb = gxACES(gl_FragColor.rgb);");
      };
      m.customProgramCacheKey = () => "gllarix-glass";
    };

    const flatMat = new THREE.ShaderMaterial({
      uniforms: { uWipe: wipe, uWipeDir: { value: WIPE_DIR } },
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xy; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uWipe; uniform vec2 uWipeDir; varying vec2 vW;
        void main(){ float d = dot(vW, uWipeDir);
          float a = smoothstep(uWipe + .02, uWipe - .16, d);
          float edge = exp(-pow((d - uWipe) / .03, 2.));
          gl_FragColor = vec4(vec3(1.), clamp(a + edge * .85, 0., 1.)); }`,
    });

    const rimBase = new THREE.ShaderMaterial({
      uniforms: {
        uWipe: wipe,
        uWipeDir: { value: WIPE_DIR },
        uOpacity: { value: 0 },
        uRim: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN, vV; varying vec2 vW;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          vW = (modelMatrix * vec4(position,1.)).xy; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uWipe, uOpacity, uRim; uniform vec2 uWipeDir; varying vec3 vN, vV; varying vec2 vW;
        void main(){ float fr = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.2);
          float keep = 1. - smoothstep(uWipe + .02, uWipe - .16, dot(vW, uWipeDir));
          vec3 c = mix(vec3(.62,.72,.95), vec3(.95,.97,1.), fr) * fr * .55 * uRim;
          gl_FragColor = vec4(c * uOpacity * keep, 1.); }`,
    });

    // The canvas is transparent (the hero shows through the veil), but three fills the
    // glass's transmission buffer with half-white whenever the clear alpha is < 1. This
    // backdrop draws dark into that buffer only, so the glass refracts darkness instead.
    const backdropMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.0022, 0.0018, 0.0055),
      depthWrite: false,
    });
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backdropMat);
    backdrop.position.z = -50;
    backdrop.renderOrder = -1;
    camera.add(backdrop);

    const disposables: { dispose: () => void }[] = [
      glassBase,
      flatMat,
      rimBase,
      envTarget,
      backdropMat,
      backdrop.geometry,
    ];

    const pieces = GEO.pieces.map((pts, i) => {
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: DEPTH,
        bevelEnabled: true,
        bevelThickness: BEVEL_T,
        bevelSize: BEVEL_S,
        bevelOffset: -BEVEL_S,
        bevelSegments: 5,
        curveSegments: 1,
      });
      geo.translate(-cx, -cy, -DEPTH / 2);
      geo.computeVertexNormals();
      const mat = glassBase.clone();
      patchGlass(mat);
      const glass = new THREE.Mesh(geo, mat);
      const flatGeo = new THREE.ShapeGeometry(shape);
      flatGeo.translate(-cx, -cy, 0);
      const flat = new THREE.Mesh(flatGeo, flatMat);
      flat.renderOrder = 2;
      const rimMat = rimBase.clone();
      rimMat.uniforms.uWipe = wipe;
      rimMat.uniforms.uWipeDir = rimBase.uniforms.uWipeDir;
      const rim = new THREE.Mesh(geo, rimMat);
      rim.renderOrder = 1;
      const g = new THREE.Group();
      g.add(glass, rim, flat);
      logo.add(g);
      disposables.push(geo, flatGeo, mat, rimMat);
      return {
        g,
        flat,
        mat,
        rimMat,
        cx,
        cy,
        ang: Math.atan2(cy, cx),
        tx: (i % 2 ? 1 : -1) * (0.35 + 0.1 * i),
        ty: ((i % 3) - 1) * 0.45,
        order: 0,
      };
    });
    // assemble clockwise from 12 o'clock, like an aperture closing
    const clockAngle = (a: number) => (Math.PI / 2 - a + Math.PI * 4) % (Math.PI * 2);
    pieces
      .slice()
      .sort((a, b) => clockAngle(a.ang) - clockAngle(b.ang))
      .forEach((p, o) => {
        p.order = o;
      });

    /* ---------- post: gentle bloom + grade ---------- */
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.5, 0.82);
    composer.addPass(bloom);
    const grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
        vec3 srgb(vec3 c){ c = max(c, 0.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
        void main(){ vec4 s = texture2D(tDiffuse, vUv);
          vec3 c = srgb(s.rgb);
          float a = clamp(max(s.a, max(c.r, max(c.g, c.b))), 0., 1.);
          float g = fract(sin(dot(gl_FragCoord.xy + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
          c += (g - .5) * .022 * a;
          gl_FragColor = vec4(clamp(c, 0., a), a); }`,
    });
    composer.addPass(grade);

    backdrop.onBeforeRender = (r) => {
      const target = r.getRenderTarget();
      backdropMat.colorWrite =
        target !== composer.renderTarget1 && target !== composer.renderTarget2;
    };

    /* ---------- layout ---------- */
    let R0: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let R1: Rect = R0;
    const tmp = new THREE.Vector3();
    const project = (x: number, y: number, z: number) => {
      tmp.set(x, y, z).project(camera);
      return { x: ((tmp.x + 1) / 2) * innerWidth, y: ((1 - tmp.y) / 2) * innerHeight };
    };
    // R2: the nav logo in the hero — measured live, since the page may still be loading
    const navRect = (): Rect => {
      const n = document.querySelector(NAV_ICON_SELECTOR)?.getBoundingClientRect();
      if (!n || !n.width) return { x: 24, y: 24, w: 46, h: 46 / ICON_AR };
      return { x: n.left, y: n.top, w: n.width, h: n.width / ICON_AR };
    };
    const layout = () => {
      const w = innerWidth;
      const h = innerHeight;
      const aspect = w / h;
      renderer.setPixelRatio(DPR);
      renderer.setSize(w, h, false);
      composer.setPixelRatio(DPR);
      composer.setSize(w, h);
      camera.aspect = aspect;
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      baseDist = Math.max(2 / (2 * tanH * 0.44), (ICON_AR * 2) / (2 * tanH * aspect * 0.7));
      const backdropH = 2 * 50 * tanH;
      backdrop.scale.set(backdropH * aspect * 1.02, backdropH * 1.02, 1);
      camera.position.set(0, 0, baseDist);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      // R0: where the flat 3D mark sits on screen once the camera is square-on
      const a = project(-ICON_AR, 1, 0);
      const b = project(ICON_AR, -1, 0);
      R0 = { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
      // R1: icon slot of the centred horizontal lockup
      const H = Math.min(h * 0.14, (w * 0.8) / LOCKUP_W, 132);
      R1 = { x: w / 2 - (LOCKUP_W * H) / 2, y: h / 2 - H / 2, w: ICON_AR * H, h: H };
    };
    window.addEventListener("resize", layout);
    layout();

    /* ---------- timeline ---------- */
    const H0 = CONFIG.handoffAt;
    const HL = CONFIG.handoffLength;
    let docked = false;
    let done = false;

    const update = (t: number) => {
      const hand = span(t, H0, H0 + HL);

      const veilIn = lerp(CONFIG.veilStart, CONFIG.veilMin, eOutCubic(span(t, 0, 1.6)));
      veil.style.opacity = String(lerp(veilIn, 0, eInOutCubic(hand)));

      // camera: slow dolly, always square-on so the flat state projects 1:1
      camera.position.z = lerp(baseDist * 1.1, baseDist, eOutCubic(span(t, 0, 3.9)));

      // whole mark settles from a slight three-quarter angle to exactly frontal
      const settle = eOutCubic(span(t, 0.2, 3.9));
      logo.rotation.set(-0.14 * (1 - settle), 0.42 * (1 - settle), 0);

      const zs = lerp(1, 0.025, eInOutCubic(span(t, 3.9, 4.8)));
      wipe.value = lerp(-1.8, 1.8, eInOutCubic(span(t, 4.0, 5.0)));

      const APER = 0.9;
      pieces.forEach((p) => {
        const t0 = 0.35 + p.order * 0.11;
        const k = span(t, t0, t0 + 2.3);
        const e = 1 - Math.pow(1 - k, 4);
        const r = 1 - e;
        const a = APER * r;
        const sc = 1 + 0.55 * r;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        p.g.position.set((p.cx * ca - p.cy * sa) * sc, (p.cx * sa + p.cy * ca) * sc, -2.4 * r);
        p.g.rotation.set(p.ty * r, p.tx * r, a);
        p.g.scale.set(1, 1, zs);
        p.mat.opacity = eOutCubic(clamp01(k * 2.2));
        p.rimMat.uniforms.uOpacity.value = p.mat.opacity;
        p.rimMat.uniforms.uRim.value = 0.6 + 0.9 * zs;
        p.flat.position.z = DEPTH / 2 + BEVEL_T + 0.004 / zs;
      });

      // one light sweep across the finished glass
      const sw = span(t, 2.9, 3.9);
      glint.position.set(lerp(-2.6, 2.6, eInOutCubic(sw)), lerp(2.2, -2.2, eInOutCubic(sw)), 2.2);
      glint.intensity = Math.sin(Math.PI * sw) * GLINT_MAX;

      bloom.strength = 0.3 * (1 - span(t, 4.0, 4.8));
      grade.uniforms.uTime.value = t;

      // 3D → HTML swap once the mark is flat white (pixel-aligned, invisible)
      const swapped = t >= 5.05;
      logo.visible = !swapped;
      flyIcon.style.visibility = swapped && !docked ? "visible" : "hidden";

      if (swapped) {
        let r = lerpRect(R0, R1, eInOutCubic(span(t, 5.15, 6.1)));
        if (t >= H0) r = lerpRect(r, navRect(), eInOutQuart(span(t, H0, H0 + HL * 0.82)));
        place(flyIcon, r);
        const kw = eOutCubic(span(t, 5.5, 6.3));
        const wo = 1 - span(t, H0, H0 + 0.35);
        place(flyWord, {
          x: r.x + r.h * (ICON_AR + GAP),
          y: r.y + r.h * WORD_DY,
          w: r.h * WORD_W,
          h: r.h * WORD_H,
        });
        flyWord.style.clipPath = `inset(0 ${((1 - kw) * 100).toFixed(2)}% 0 0)`;
        flyWord.style.opacity = wo.toFixed(3);
        flyWord.style.visibility = kw > 0 && wo > 0 ? "visible" : "hidden";
      } else {
        flyWord.style.visibility = "hidden";
      }

      if (t >= H0 + 0.3 && phase === "playing") {
        setPhase("revealing");
        skipBtn.classList.add("opacity-0", "pointer-events-none");
      }
      if (!docked && t >= H0 + HL * 0.82) {
        docked = true;
        setPhase("docked");
        flyIcon.style.visibility = "hidden";
      }
      if (!done && t >= H0 + HL) {
        done = true;
        setPhase("done");
      }
    };

    /* ---------- loop ---------- */
    let t = 0;
    let last = 0;
    let speed = 1;
    let raf = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      t += dt * speed * CONFIG.speed;
      update(t);
      if (done) return;
      composer.render();
      raf = requestAnimationFrame(frame);
    };

    const skip = () => {
      if (!done && speed === 1) {
        speed = CONFIG.skipSpeed;
        skipBtn.classList.add("opacity-0", "pointer-events-none");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (!done && ["Escape", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        skip();
      }
    };
    skipBtn.addEventListener("click", skip);
    window.addEventListener("keydown", onKey);
    skipBtn.focus({ preventScroll: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", layout);
      window.removeEventListener("keydown", onKey);
      skipBtn.removeEventListener("click", skip);
      document.documentElement.style.overflow = previousOverflow;
      disposables.forEach((d) => d.dispose());
      composer.dispose();
      bloom.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" role="status" aria-label="Gllarix is loading">
      <div ref={veilRef} className="absolute inset-0 bg-[#030208]" />
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />
      <div ref={flyIconRef} className="invisible absolute left-0 top-0 will-change-[left,top,width,height]" aria-hidden="true">
        <svg viewBox={`${ix} ${iy} ${iw} ${ih}`} preserveAspectRatio="none" className="block h-full w-full">
          <path fill="#fff" d={GEO.iconD} />
        </svg>
      </div>
      <div ref={flyWordRef} className="invisible absolute left-0 top-0 will-change-[left,top,width,height]" aria-hidden="true">
        <svg viewBox={`${wx} ${wy} ${ww} ${wh}`} preserveAspectRatio="none" className="block h-full w-full">
          <path fill="#fff" fillRule="evenodd" d={GEO.wordD} />
        </svg>
      </div>
      <button
        ref={skipRef}
        type="button"
        className="pointer-events-auto absolute bottom-[calc(24px+env(safe-area-inset-bottom,0px))] right-[calc(24px+env(safe-area-inset-right,0px))] rounded border border-white/15 bg-[#030208]/40 px-4 py-3 text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-white/65 transition-[color,border-color,opacity] duration-300 hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#dbfcff]"
      >
        Skip intro
      </button>
    </div>
  );
};

export default GlassIntro;
