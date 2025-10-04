import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const FloatingShape = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    time.current += delta;
    meshRef.current.rotation.x = time.current * 0.3;
    meshRef.current.rotation.y = time.current * 0.5;
    meshRef.current.position.y = Math.sin(time.current * 2) * 0.2;
  });

  return (
    <mesh ref={meshRef}>
      <torusKnotGeometry args={[1, 0.3, 128, 16]} />
      <meshStandardMaterial
        color="#9b87f5"
        metalness={0.6}
        roughness={0.2}
        emissive="#7E69AB"
        emissiveIntensity={0.2}
      />
    </mesh>
  );
};

const ParticleField = () => {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#D6BCFA" transparent opacity={0.6} />
    </points>
  );
};

export const NotFound3D = () => {
  return (
    <div className="w-full h-64 sm:h-80 md:h-96">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9b87f5" />
        <FloatingShape />
        <ParticleField />
      </Canvas>
    </div>
  );
};
