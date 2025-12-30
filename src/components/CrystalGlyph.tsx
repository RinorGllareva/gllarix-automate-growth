import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Create a crystalline "G" shape geometry
const createGGeometry = () => {
  const shape = new THREE.Shape();
  
  // Outer G shape - arc
  const outerRadius = 2;
  const innerRadius = 1.3;
  
  // Start from bottom right, go counter-clockwise
  shape.absarc(0, 0, outerRadius, -0.3, Math.PI + 0.5, false);
  shape.lineTo(innerRadius * Math.cos(Math.PI + 0.5), innerRadius * Math.sin(Math.PI + 0.5));
  shape.absarc(0, 0, innerRadius, Math.PI + 0.5, -0.3, true);
  shape.closePath();
  
  const extrudeSettings = {
    depth: 0.8,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.15,
    bevelSegments: 12,
  };
  
  return new THREE.ExtrudeGeometry(shape, extrudeSettings);
};

const createBarGeometry = () => {
  const barShape = new THREE.Shape();
  const barWidth = 0.7;
  
  barShape.moveTo(-0.2, -barWidth / 2);
  barShape.lineTo(1.8, -barWidth / 2);
  barShape.lineTo(1.8, barWidth / 2);
  barShape.lineTo(-0.2, barWidth / 2);
  barShape.closePath();
  
  const extrudeSettings = {
    depth: 0.8,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: 0.15,
    bevelSegments: 12,
  };
  
  return new THREE.ExtrudeGeometry(barShape, extrudeSettings);
};

const CrystalG: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  const mainGeo = useMemo(() => createGGeometry(), []);
  const barGeo = useMemo(() => createBarGeometry(), []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25) * 0.3 + 0.2;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.15) * 0.08;
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.04;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.15;
    }
  });

  // Crystalline glass-like material
  const crystalMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e8e8f8'),
      metalness: 0.1,
      roughness: 0.02,
      transmission: 0.95,
      thickness: 1.5,
      ior: 2.33, // Diamond-like refraction
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.9,
    });
  }, []);

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={1.1}>
      {/* Main G arc */}
      <mesh geometry={mainGeo} material={crystalMaterial} castShadow />
      
      {/* Horizontal bar */}
      <mesh geometry={barGeo} material={crystalMaterial} castShadow />
    </group>
  );
};

// Diamond-like particle system around the glyph
const CrystalParticles: React.FC = () => {
  const particlesRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const count = 60;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 2.5;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * 2;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    return geometry;
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.03;
    }
  });

  return (
    <points ref={particlesRef} geometry={particles}>
      <pointsMaterial
        color="#a78bfa"
        size={0.06}
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
};

// Light rays / glow effect
const LightRays: React.FC = () => {
  const raysRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (raysRef.current) {
      raysRef.current.rotation.z = state.clock.elapsedTime * 0.02;
    }
  });
  
  return (
    <group ref={raysRef}>
      {[...Array(6)].map((_, i) => (
        <mesh 
          key={i} 
          position={[0, 0, -1]} 
          rotation={[0, 0, (i * Math.PI * 2) / 6]}
        >
          <planeGeometry args={[0.03, 5]} />
          <meshBasicMaterial 
            color="#8b5cf6" 
            transparent 
            opacity={0.15} 
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};

const CrystalGlyph: React.FC = () => {
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[55vw] h-[90vh] pointer-events-none z-10 hidden lg:block">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 40 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-3, -3, -3]} intensity={0.4} color="#a78bfa" />
        <pointLight position={[2, 2, 4]} intensity={0.6} color="#8b5cf6" />
        <pointLight position={[-2, -2, 4]} intensity={0.4} color="#c4b5fd" />
        
        <CrystalG />
        <CrystalParticles />
        <LightRays />
      </Canvas>
    </div>
  );
};

export default CrystalGlyph;
