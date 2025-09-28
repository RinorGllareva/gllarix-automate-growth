import {
  ArrowRight,
  Users,
  Target,
  Lightbulb,
  Award,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Sphere } from "@react-three/drei";
import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useScrollAnimation, useCountUp } from "@/hooks/useScrollAnimation";

// 🌟 Floating spheres around a circle
const FloatingTeam3D = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  const colors = [
    "#ffffffff",
    "#ffffffff",
    "#ffffffff",
    "#ffffffff",
    "#ffffffff",
  ];

  return (
    <group ref={groupRef} scale={1.2}>
      {[...Array(5)].map((_, i) => (
        <Float
          key={i}
          speed={2 + i * 0.5}
          rotationIntensity={0.2}
          floatIntensity={0.3}
        >
          <Sphere
            args={[0.35, 24, 24]} // bigger + smoother
            position={[
              Math.cos((i / 5) * Math.PI * 2) * 2.2,
              Math.sin((i / 5) * Math.PI * 2) * 1.2,
              Math.sin((i / 5) * Math.PI * 4) * 0.6,
            ]}
          >
            <meshStandardMaterial
              color={colors[i % colors.length]}
              transparent
              opacity={0.9}
              roughness={0.2}
              metalness={0.95}
              envMapIntensity={2}
            />
          </Sphere>
        </Float>
      ))}
    </group>
  );
};

// 🌟 Floating octahedron with wobble
const Mission3D = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.8) * 0.25;
      meshRef.current.rotation.z =
        Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <mesh ref={meshRef} scale={1.3}>
        <octahedronGeometry args={[1.8, 0]} />
        <meshStandardMaterial
          color="#6d33f5"
          transparent
          opacity={0.85}
          roughness={0.15}
          metalness={1}
          envMapIntensity={1.8}
        />
      </mesh>
    </Float>
  );
};

// 🌟 Global lighting for all Canvas scenes
const SceneLights = () => (
  <>
    {/* Base ambient light */}
    <ambientLight intensity={5} />

    {/* Main directional light (white, top-right) */}
    <directionalLight intensity={5} position={[5, 5, 5]} castShadow />

    {/* Accent point light (purple, bottom-left) */}
    <pointLight intensity={5} position={[-5, -3, -5]} color="#6d33f5" />

    {/* Extra point light (blue, top-left) */}
    <pointLight intensity={5} position={[-6, 6, 3]} color="#3b82f6" />

    {/* Extra point light (pink, bottom-right) */}
    <pointLight intensity={5} position={[6, -4, 2]} color="#ec4899" />

    {/* Soft fill directional light (white, behind camera) */}
    <directionalLight intensity={5} position={[0, 0, 8]} />

    {/* --- New Lights Below --- */}

    {/* Golden accent (warm glow from bottom center) */}
    <pointLight intensity={5} position={[0, -5, 2]} color="#fbbf24" />

    {/* Cool teal (side fill from left) */}
    <pointLight intensity={5} position={[-8, 2, 4]} color="#14b8a6" />

    {/* Magenta top-back rim light */}
    <pointLight intensity={5} position={[2, 8, -3]} color="#d946ef" />

    {/* Red accent (low back-right) */}
    <spotLight
      intensity={5}
      position={[5, -2, -5]}
      angle={0.4}
      color="#ef4444"
      castShadow
    />

    {/* Cyan fill (soft bounce from right) */}
    <directionalLight intensity={0.4} position={[7, 3, 5]} color="#22d3ee" />

    {/* White spotlight (focused, from above) */}
    <spotLight
      intensity={5}
      position={[0, 10, 0]}
      angle={0.3}
      color="#ffffff"
      castShadow
    />
  </>
);

const About = () => {
  const { ref: heroRef, isVisible: heroVisible } = useScrollAnimation(0.2);
  const { ref: statsRef, isVisible: statsVisible } = useScrollAnimation(0.3);
  const { ref: missionRef, isVisible: missionVisible } =
    useScrollAnimation(0.2);
  const { ref: teamRef, isVisible: teamVisible } = useScrollAnimation(0.2);

  // Count up animations
  const { count: businessesCount, setIsActive: setBusinessesActive } =
    useCountUp(500, 2000);
  const { count: hoursCount, setIsActive: setHoursActive } = useCountUp(
    30,
    2000
  );
  const { count: accuracyCount, setIsActive: setAccuracyActive } = useCountUp(
    99,
    2000
  );
  const { count: satisfactionCount, setIsActive: setSatisfactionActive } =
    useCountUp(98, 2000);

  useEffect(() => {
    if (
      statsVisible &&
      !businessesCount &&
      !hoursCount &&
      !accuracyCount &&
      !satisfactionCount
    ) {
      setBusinessesActive(true);
      setHoursActive(true);
      setAccuracyActive(true);
      setSatisfactionActive(true);
    }
  }, [
    statsVisible,
    businessesCount,
    hoursCount,
    accuracyCount,
    satisfactionCount,
    setBusinessesActive,
    setHoursActive,
    setAccuracyActive,
    setSatisfactionActive,
  ]);

  const values = [
    {
      icon: Target,
      title: "Innovation First",
      description:
        "We're constantly pushing the boundaries of what's possible with AI automation.",
      gradient: "from-primary via-primary/80 to-accent",
      accent: "primary",
    },
    {
      icon: Users,
      title: "Customer Success",
      description:
        "Your success is our success. We're committed to delivering measurable results.",
      gradient: "from-accent via-accent/80 to-secondary",
      accent: "accent",
    },
    {
      icon: Lightbulb,
      title: "Continuous Learning",
      description:
        "We adapt and evolve with technology to provide cutting-edge solutions.",
      gradient: "from-secondary via-secondary/80 to-primary",
      accent: "secondary",
    },
    {
      icon: Award,
      title: "Excellence",
      description:
        "We maintain the highest standards in everything we do, from code to customer service.",
      gradient: "from-primary via-accent/60 to-secondary",
      accent: "primary",
    },
  ];

  const team = [
    {
      name: "Sarah Chen",
      role: "CEO & Founder",
      description:
        "15+ years in AI and automation, former Google AI researcher",
      image: "/api/placeholder/150/150",
    },
    {
      name: "Marcus Rodriguez",
      role: "CTO",
      description: "Former Tesla AI engineer specializing in conversational AI",
      image: "/api/placeholder/150/150",
    },
    {
      name: "Emily Watson",
      role: "Head of Product",
      description:
        "Product strategy expert with experience at Microsoft and Amazon",
      image: "/api/placeholder/150/150",
    },
    {
      name: "David Kim",
      role: "Lead AI Engineer",
      description: "PhD in Machine Learning, former OpenAI research scientist",
      image: "/api/placeholder/150/150",
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 6], fov: 75 }}>
            <SceneLights />
            <FloatingTeam3D />
            <OrbitControls
              enableZoom={false}
              autoRotate
              autoRotateSpeed={0.3}
            />
          </Canvas>
        </div>

        <div
          ref={heroRef}
          className={`relative z-10 container mx-auto px-6 text-center transition-all duration-1000 ${
            heroVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gradient">
              About Gllarix
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              We're building the future of business automation with AI agents
              that think, learn, and adapt to your unique business needs.
            </p>
            <Button
              size="lg"
              className="btn-hero"
              onClick={() =>
                document
                  .getElementById("our-story")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Our Story
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section
        ref={statsRef}
        className={`py-24 bg-muted/30 transition-all duration-1000 ${
          statsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  number: businessesCount,
                  suffix: "+",
                  label: "Businesses Automated",
                },
                {
                  number: hoursCount,
                  suffix: "+",
                  label: "Hours Saved Weekly",
                },
                { number: accuracyCount, suffix: "%", label: "Accuracy Rate" },
                {
                  number: satisfactionCount,
                  suffix: "%",
                  label: "Customer Satisfaction",
                },
              ].map((stat, index) => (
                <Card
                  key={index}
                  className="text-center p-8 hover:shadow-lg transition-shadow duration-300"
                >
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                    {stat.number}
                    {stat.suffix}
                  </div>
                  <p className="text-muted-foreground font-medium">
                    {stat.label}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section id="our-story" className="py-24 bg-gradient-to-br from-background via-muted/20 to-background relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <span className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse"></span>
                    Our Journey
                  </div>
                  <h2 className="text-4xl md:text-6xl font-bold text-gradient leading-tight">
                    Our Story
                  </h2>
                </div>
                
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-card/70 transition-all duration-300">
                    <div className="flex items-start space-x-4">
                      <div className="w-3 h-3 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-lg text-foreground leading-relaxed">
                        Founded in 2023, Gllarix emerged from a simple observation:
                        businesses were spending countless hours on repetitive tasks
                        that could be automated with AI.
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-card/70 transition-all duration-300">
                    <div className="flex items-start space-x-4">
                      <div className="w-3 h-3 bg-accent rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-lg text-foreground leading-relaxed">
                        Our founders, coming from backgrounds at Google, Tesla, and
                        Microsoft, saw an opportunity to democratize AI automation
                        for businesses of all sizes.
                      </p>
                    </div>
                  </div>
                  
                  <div className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 hover:bg-card/70 transition-all duration-300">
                    <div className="flex items-start space-x-4">
                      <div className="w-3 h-3 bg-secondary rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-lg text-foreground leading-relaxed">
                        Today, we're proud to serve over 500 businesses worldwide,
                        helping them save thousands of hours and increase their
                        efficiency by up to 300%.
                      </p>
                    </div>
                  </div>
                </div>
                
                <Button className="btn-hero group">
                  Join Our Mission
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              <div className="relative">
                {/* 3D Canvas Container with enhanced styling */}
                <div className="relative h-96 w-full rounded-3xl overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-accent/5 backdrop-blur-sm border border-border/30">
                  {/* Decorative elements */}
                  <div className="absolute top-4 left-4 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                  <div className="absolute top-4 right-4 w-2 h-2 bg-accent rounded-full animate-pulse delay-75"></div>
                  <div className="absolute bottom-4 left-4 w-2 h-2 bg-secondary rounded-full animate-pulse delay-150"></div>
                  <div className="absolute bottom-4 right-4 w-3 h-3 bg-primary/50 rounded-full animate-pulse delay-300"></div>
                  
                  {/* Canvas */}
                  <Canvas camera={{ position: [0, 0, 4], fov: 75 }}>
                    <SceneLights />
                    <Mission3D />
                    <OrbitControls
                      enableZoom={false}
                      autoRotate
                      autoRotateSpeed={1}
                    />
                  </Canvas>
                  
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-transparent pointer-events-none"></div>
                </div>
                
                {/* Floating elements around 3D model */}
                <div className="absolute -top-6 -left-6 w-12 h-12 bg-primary/20 rounded-xl rotate-12 animate-float"></div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-accent/30 rounded-lg -rotate-12 animate-float delay-1000"></div>
                <div className="absolute top-1/2 -left-8 w-6 h-6 bg-secondary/25 rounded-full animate-float delay-500"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section
        ref={missionRef}
        className={`py-24 relative overflow-hidden bg-gradient-to-br from-muted/20 via-background to-muted/10 transition-all duration-1000 ${
          missionVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-8"
        }`}
      >
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <span className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse"></span>
                Our Purpose
              </div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">
                Mission & Vision
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Driving the future of intelligent automation
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12">
              {/* Mission Card */}
              <div className="group relative">
                <Card className="p-10 h-full hover:shadow-2xl transition-all duration-500 border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/30 hover:scale-[1.02] transform">
                  {/* Animated Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Icon Container */}
                  <div className="relative mb-8">
                    <div className="bg-gradient-to-br from-primary/20 to-primary/10 p-6 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300">
                      <Target className="h-10 w-10 text-primary" />
                    </div>
                    {/* Floating dots */}
                    <div className="absolute -top-2 -right-2 w-3 h-3 bg-primary/30 rounded-full animate-bounce"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-accent/40 rounded-full animate-bounce delay-300"></div>
                  </div>
                  
                  <div className="relative">
                    <h3 className="text-3xl font-bold mb-6 text-foreground group-hover:text-primary transition-colors duration-300">
                      Our Mission
                    </h3>
                    <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent rounded-full mb-6 group-hover:w-32 transition-all duration-500"></div>
                    <p className="text-lg text-foreground leading-relaxed">
                      To empower businesses of all sizes with intelligent AI
                      automation that eliminates repetitive tasks, reduces human
                      error, and unlocks human potential for more strategic and
                      creative work.
                    </p>
                    
                    {/* Interactive elements */}
                    <div className="mt-8 flex items-center space-x-4 opacity-0 group-hover:opacity-100 transition-all duration-500">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-150"></div>
                        <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-300"></div>
                      </div>
                      <span className="text-sm text-muted-foreground">Empowering Innovation</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Vision Card */}
              <div className="group relative">
                <Card className="p-10 h-full hover:shadow-2xl transition-all duration-500 border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-accent/30 hover:scale-[1.02] transform">
                  {/* Animated Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-secondary/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Icon Container */}
                  <div className="relative mb-8">
                    <div className="bg-gradient-to-br from-accent/20 to-accent/10 p-6 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300">
                      <Globe className="h-10 w-10 text-accent" />
                    </div>
                    {/* Floating dots */}
                    <div className="absolute -top-2 -right-2 w-3 h-3 bg-accent/30 rounded-full animate-bounce delay-150"></div>
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary/40 rounded-full animate-bounce delay-500"></div>
                  </div>
                  
                  <div className="relative">
                    <h3 className="text-3xl font-bold mb-6 text-foreground group-hover:text-accent transition-colors duration-300">
                      Our Vision
                    </h3>
                    <div className="w-20 h-1 bg-gradient-to-r from-accent to-secondary rounded-full mb-6 group-hover:w-32 transition-all duration-500"></div>
                    <p className="text-lg text-foreground leading-relaxed">
                      A world where every business, regardless of size or industry,
                      has access to intelligent AI agents that handle routine
                      operations, allowing humans to focus on what they do best:
                      innovate, create, and build relationships.
                    </p>
                    
                    {/* Interactive elements */}
                    <div className="mt-8 flex items-center space-x-4 opacity-0 group-hover:opacity-100 transition-all duration-500">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-150"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-300"></div>
                      </div>
                      <span className="text-sm text-muted-foreground">Shaping Tomorrow</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
            
            {/* Connection line between cards */}
            <div className="hidden lg:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-0.5 bg-gradient-to-r from-primary via-accent to-secondary opacity-30"></div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-br from-background via-muted/10 to-background">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-72 h-72 bg-primary/3 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-accent/3 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-secondary/3 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                <span className="w-2 h-2 bg-accent rounded-full mr-2 animate-pulse"></span>
                Core Principles
              </div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">
                Our Values
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                The principles that guide everything we do
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {values.map((value, index) => (
                <div key={index} className="group relative">
                  <Card className="p-10 h-full hover:shadow-2xl transition-all duration-700 border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/20 hover:scale-[1.03] transform cursor-pointer overflow-hidden">
                    {/* Animated Background Gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${value.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-700`}></div>
                    
                    {/* Floating Background Elements */}
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110"></div>
                    <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-gradient-to-br from-accent/5 to-secondary/5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-125"></div>
                    
                    {/* Icon Container */}
                    <div className="relative mb-8">
                      <div className={`bg-gradient-to-br ${value.gradient} p-6 rounded-2xl w-fit shadow-lg group-hover:shadow-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                        <value.icon className="h-10 w-10 text-white" />
                      </div>
                      
                      {/* Orbiting Elements */}
                      <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:animate-bounce"></div>
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-accent/50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:animate-bounce delay-200"></div>
                      <div className="absolute top-1/2 -right-3 w-2 h-2 bg-secondary/60 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-600 group-hover:animate-bounce delay-400"></div>
                    </div>
                    
                    <div className="relative">
                      <h3 className={`text-3xl font-bold mb-6 text-foreground group-hover:text-${value.accent} transition-colors duration-500`}>
                        {value.title}
                      </h3>
                      
                      {/* Animated Underline */}
                      <div className={`w-16 h-1 bg-gradient-to-r ${value.gradient} rounded-full mb-6 group-hover:w-24 transition-all duration-500`}></div>
                      
                      <p className="text-lg text-foreground leading-relaxed group-hover:text-foreground/90 transition-colors duration-300">
                        {value.description}
                      </p>
                      
                      {/* Interactive Progress Indicators */}
                      <div className="mt-8 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500">
                        <div className="flex space-x-2">
                          <div className={`w-3 h-3 bg-${value.accent} rounded-full animate-pulse`}></div>
                          <div className={`w-2 h-2 bg-${value.accent}/60 rounded-full animate-pulse delay-150`}></div>
                          <div className={`w-2 h-2 bg-${value.accent}/40 rounded-full animate-pulse delay-300`}></div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground">Core Value #{index + 1}</span>
                        </div>
                      </div>
                      
                      {/* Hover Arrow */}
                      <div className="absolute top-4 right-4 w-6 h-6 text-primary/30 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                        <ArrowRight className="w-full h-full" />
                      </div>
                    </div>
                  </Card>
                  
                  {/* Connecting Lines Between Cards */}
                  {index < values.length - 1 && (
                    <div className="hidden md:block absolute -bottom-4 left-1/2 w-0.5 h-8 bg-gradient-to-b from-primary/20 to-transparent transform -translate-x-1/2"></div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Central Connection Hub */}
            <div className="hidden md:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full opacity-20 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section
        ref={teamRef}
        className={`py-24 bg-muted/30 transition-all duration-1000 ${
          teamVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                Meet Our Team
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Industry experts dedicated to revolutionizing business
                automation
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <Card
                  key={index}
                  className={`text-center p-6 hover:shadow-lg transition-all duration-700 ${
                    teamVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-8"
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">
                    {member.name}
                  </h3>
                  <p className="text-primary font-semibold mb-3">
                    {member.role}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <Card className="p-12 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                Ready to Transform Your Business?
              </h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join hundreds of businesses already saving 30+ hours per week
                with Gllarix AI automation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="btn-hero">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  Schedule Demo
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
};

export default About;
