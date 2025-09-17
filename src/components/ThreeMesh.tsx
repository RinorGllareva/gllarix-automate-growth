import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import * as THREE from 'three';

// Custom mesh material
const MeshMaterial = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const vertexShader = `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      vUv = uv;
      vPosition = position;
      
      vec3 pos = position;
      pos.z += sin(pos.x * 0.1 + time) * 0.5;
      pos.z += cos(pos.y * 0.1 + time * 0.8) * 0.3;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float time;
    varying vec2 vUv;
    varying vec3 vPosition;
    
    void main() {
      vec2 uv = vUv;
      
      // Create grid pattern
      vec2 grid = abs(fract(uv * 20.0) - 0.5);
      float line = smoothstep(0.0, 0.05, grid.x) * smoothstep(0.0, 0.05, grid.y);
      
      // Add some movement
      float wave = sin(uv.x * 10.0 + time) * sin(uv.y * 15.0 + time * 0.7) * 0.5 + 0.5;
      
      // Primary color (blue/purple)
      vec3 color = mix(
        vec3(0.4, 0.2, 0.8), // Purple
        vec3(0.2, 0.4, 1.0), // Blue
        wave
      );
      
      // Apply grid and fade out towards edges
      float alpha = (1.0 - line) * 0.6;
      alpha *= smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x);
      alpha *= smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.7, uv.y);
      
      gl_FragColor = vec4(color, alpha);
    }
  `;

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={{
        time: { value: 0 }
      }}
      transparent
      side={THREE.DoubleSide}
    />
  );
};

const AnimatedMesh: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    return new THREE.PlaneGeometry(15, 10, 40, 30);
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1 - 0.1;
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.05) * 0.05;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={[6, 0, -3]}
      rotation={[0.2, -0.3, 0]}
    >
      <MeshMaterial />
    </mesh>
  );
};

const ParticleField: React.FC = () => {
  const particlesRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const temp = new THREE.BufferGeometry();
    const positions = new Float32Array(200 * 3);
    
    for (let i = 0; i < 200; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    
    temp.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return temp;
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={particlesRef} geometry={particles}>
      <pointsMaterial
        color="hsl(260, 85%, 65%)"
        size={0.05}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

const ThreeMesh: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.2} />
        <pointLight position={[10, 10, 10]} intensity={0.5} color="hsl(260, 85%, 65%)" />
        
        <ParticleField />
        <AnimatedMesh />
      </Canvas>
    </div>
  );
};

export default ThreeMesh;