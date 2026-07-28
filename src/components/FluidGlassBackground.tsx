import { useEffect, useRef, useState } from "react";
import LiquidGlassBackground from "./LiquidGlassBackground";

const vertexShaderSource = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform vec2 uTextureSize;
  uniform float uTime;
  uniform vec3 uTintA;
  uniform vec3 uTintB;
  uniform float uTintStrength;
  uniform float uFlowStrength;
  varying vec2 vUv;

  float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  vec2 coverUv(vec2 uv) {
    float screenAspect = uResolution.x / uResolution.y;
    float textureAspect = uTextureSize.x / uTextureSize.y;
    vec2 scale = vec2(1.0);

    if (screenAspect > textureAspect) {
      scale.y = textureAspect / screenAspect;
    } else {
      scale.x = screenAspect / textureAspect;
    }

    return (uv - 0.5) * scale + 0.5;
  }

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float time = uTime * 0.16;

    float broadWave = sin(centered.y * 3.1 + time + sin(centered.x * 2.2 - time * 0.7));
    float crossWave = cos(centered.x * 3.8 - time * 0.82 + sin(centered.y * 2.6 + time * 0.5));
    float detailWave = sin((centered.x + centered.y) * 5.2 + time * 0.55);

    vec2 flow = vec2(
      broadWave * 0.014 + detailWave * 0.004,
      crossWave * 0.012 - detailWave * 0.003
    ) * uFlowStrength;

    vec2 uv = coverUv(vUv + flow);
    vec2 texel = 1.0 / uTextureSize;

    float left = luminance(texture2D(uTexture, uv - vec2(texel.x * 5.0, 0.0)).rgb);
    float right = luminance(texture2D(uTexture, uv + vec2(texel.x * 5.0, 0.0)).rgb);
    float down = luminance(texture2D(uTexture, uv - vec2(0.0, texel.y * 5.0)).rgb);
    float up = luminance(texture2D(uTexture, uv + vec2(0.0, texel.y * 5.0)).rgb);
    vec2 normal = vec2(right - left, up - down);

    vec2 refractedUv = clamp(uv + normal * 0.055, 0.001, 0.999);
    float chromaticOffset = 0.0025;
    vec3 color;
    color.r = texture2D(uTexture, refractedUv + normal * chromaticOffset).r;
    color.g = texture2D(uTexture, refractedUv).g;
    color.b = texture2D(uTexture, refractedUv - normal * chromaticOffset).b;

    float edge = smoothstep(0.025, 0.22, length(normal));
    float movingGlint = pow(
      max(0.0, sin((centered.x - centered.y) * 4.0 + time * 1.25)),
      18.0
    );
    float tintFlow = 0.5 + 0.5 * sin(
      centered.x * 1.8 - centered.y * 1.25 + time * 0.42
    );
    vec3 liquidTint = mix(uTintA, uTintB, tintFlow);
    float surfaceLight = smoothstep(0.04, 0.72, luminance(color));

    color *= vec3(0.72, 0.76, 0.82);
    color += edge * vec3(0.24, 0.28, 0.34);
    color += liquidTint * surfaceLight * uTintStrength;
    color += edge * liquidTint * (0.2 + uTintStrength * 0.24);
    color += movingGlint * edge * (vec3(0.1, 0.11, 0.16) + liquidTint * 0.42);
    color *= 0.74;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const createShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type);

  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

interface FluidGlassBackgroundProps {
  variant?: "hero" | "footer" | "sections" | "secondary";
  palette?: "cyan" | "amber" | "cobalt" | "violet" | "pearl";
}

const FluidGlassBackground = ({
  variant = "hero",
  palette = "violet",
}: FluidGlassBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (
      !canvas ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      return;
    }

    const vertexShader = createShader(
      gl,
      gl.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) {
      return;
    }

    const program = gl.createProgram();

    if (!program) {
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const positionBuffer = gl.createBuffer();
    const texture = gl.createTexture();

    if (!positionBuffer || !texture) {
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const textureSizeLocation = gl.getUniformLocation(program, "uTextureSize");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const textureLocation = gl.getUniformLocation(program, "uTexture");
    const tintALocation = gl.getUniformLocation(program, "uTintA");
    const tintBLocation = gl.getUniformLocation(program, "uTintB");
    const tintStrengthLocation = gl.getUniformLocation(
      program,
      "uTintStrength",
    );
    const flowStrengthLocation = gl.getUniformLocation(
      program,
      "uFlowStrength",
    );
    const variantTints = {
      hero: {
        a: [0.04, 0.38, 0.48],
        b: [0.42, 0.16, 0.58],
      },
      sections: {
        a: [0.03, 0.32, 0.38],
        b: [0.24, 0.12, 0.62],
      },
      footer: {
        a: [0.34, 0.12, 0.5],
        b: [0.03, 0.32, 0.38],
      },
      secondary: {
        a: [0.04, 0.38, 0.48],
        b: [0.42, 0.16, 0.58],
      },
    } as const;
    const secondaryTints = {
      cyan: {
        a: [0.02, 0.5, 0.62],
        b: [0.15, 0.28, 0.72],
      },
      amber: {
        a: [0.1, 0.28, 0.72],
        b: [0.46, 0.12, 0.68],
      },
      cobalt: {
        a: [0.03, 0.26, 0.72],
        b: [0.02, 0.52, 0.62],
      },
      violet: {
        a: [0.46, 0.12, 0.7],
        b: [0.02, 0.42, 0.58],
      },
      pearl: {
        a: [0.34, 0.44, 0.58],
        b: [0.3, 0.22, 0.68],
      },
    } as const;
    const tint =
      variant === "secondary" ? secondaryTints[palette] : variantTints[variant];

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(textureLocation, 0);
    gl.uniform3f(tintALocation, tint.a[0], tint.a[1], tint.a[2]);
    gl.uniform3f(tintBLocation, tint.b[0], tint.b[1], tint.b[2]);
    gl.uniform1f(tintStrengthLocation, variant === "secondary" ? 0.34 : 0.05);
    gl.uniform1f(flowStrengthLocation, variant === "secondary" ? 1.55 : 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    let animationFrame = 0;
    let lastFrameTime = 0;
    let isVisible = true;
    let disposed = false;

    const resize = () => {
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        window.innerWidth < 768 ? 1.15 : 1.35,
      );
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const image = new Image();

    const render = (now: number) => {
      if (disposed) {
        return;
      }

      animationFrame = window.requestAnimationFrame(render);

      if (
        !isVisible ||
        document.hidden ||
        now - lastFrameTime < 1000 / 30
      ) {
        return;
      }

      lastFrameTime = now;
      resize();
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(
        timeLocation,
        now * (variant === "secondary" ? 0.00072 : 0.001) +
          (variant === "footer" ? 18 : variant === "sections" ? 9 : 0),
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!canvas.dataset.ready) {
        canvas.dataset.ready = "true";
        setIsReady(true);
      }
    };

    image.onload = () => {
      if (disposed) {
        return;
      }

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB,
        gl.RGB,
        gl.UNSIGNED_BYTE,
        image,
      );
      gl.uniform2f(textureSizeLocation, image.naturalWidth, image.naturalHeight);
      animationFrame = window.requestAnimationFrame(render);
    };

    image.src =
      variant === "secondary"
        ? "/metal-fluid-cyan.webp"
        : "/liquid-glass-background.jpg";

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    intersectionObserver.observe(canvas);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      intersectionObserver.disconnect();
      gl.deleteTexture(texture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [palette, variant]);

  return (
    <div
      className={`fluid-glass-live fluid-glass-live--${variant}`}
      aria-hidden="true"
    >
      <LiquidGlassBackground variant={variant} />
      <canvas
        ref={canvasRef}
        className={`fluid-glass-live__canvas ${isReady ? "is-ready" : ""}`}
      />
      <div className="fluid-glass-live__veil" />
    </div>
  );
};

export default FluidGlassBackground;
