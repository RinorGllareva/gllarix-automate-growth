import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Extend Three.js materials
extend({ MeshDistortMaterial });

interface FloatingOrbProps {
  position: [number, number, number];
  color: string;
  scale?: number;
  speed?: number;
}

const FloatingOrb: React.FC<FloatingOrbProps> = ({ 
  position, 
  color, 
  scale = 1, 
  speed = 1 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    time.current += delta * speed;
    
    // Floating animation
    meshRef.current.position.y = position[1] + Math.sin(time.current) * 0.5;
    meshRef.current.position.x = position[0] + Math.cos(time.current * 0.7) * 0.3;
    
    // Rotation animation
    meshRef.current.rotation.x += delta * 0.2;
    meshRef.current.rotation.y += delta * 0.3;
  });

  return (
    <Sphere ref={meshRef} args={[1, 64, 64]} position={position} scale={scale}>
      <MeshDistortMaterial
        color={color}
        transparent
        opacity={0.6}
        roughness={0.1}
        metalness={0.8}
        distort={0.4}
        speed={2}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </Sphere>
  );
};

const ParticleField: React.FC = () => {
  const particlesRef = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const temp = new THREE.BufferGeometry();
    const positions = new Float32Array(1000 * 3);
    
    for (let i = 0; i < 1000; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    
    temp.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return temp;
  }, []);

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.x = state.clock.elapsedTime * 0.05;
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  return (
    <points ref={particlesRef} geometry={particles}>
      <pointsMaterial
        color="hsl(260, 85%, 65%)"
        size={0.1}
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

const ThreeScene: React.FC = () => {
  const orbPositions: [number, number, number][] = [
    [8, 2, -5],
    [-6, -3, -8],
    [12, 5, -10],
    [-10, 1, -6],
    [5, -4, -12],
  ];

  const orbColors = [
    'hsl(260, 85%, 65%)',
    'hsl(280, 80%, 70%)',
    'hsl(240, 70%, 55%)',
    'hsl(300, 70%, 60%)',
    'hsl(220, 60%, 50%)',
  ];

  return (
    <div className="absolute inset-0 w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} color="hsl(260, 85%, 65%)" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="hsl(280, 80%, 70%)" />
        
        <ParticleField />
        
        {orbPositions.map((position, index) => (
          <FloatingOrb
            key={index}
            position={position}
            color={orbColors[index]}
            scale={Math.random() * 0.5 + 0.5}
            speed={Math.random() * 0.5 + 0.5}
          />
        ))}
      </Canvas>
    </div>
  );
};

export default ThreeScene;