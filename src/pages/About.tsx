import { ArrowRight, Users, Target, Lightbulb, Award, Globe, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Canvas } from "@react-three/fiber";
import { Float, Text3D, OrbitControls, Sphere } from "@react-three/drei";
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useScrollAnimation, useCountUp } from "@/hooks/useScrollAnimation";

// 3D About Animation
const FloatingTeam3D = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      {[...Array(5)].map((_, i) => (
        <Float key={i} speed={2 + i * 0.5} rotationIntensity={0.2} floatIntensity={0.3}>
          <Sphere 
            args={[0.3, 16, 16]} 
            position={[
              Math.cos((i / 5) * Math.PI * 2) * 2,
              Math.sin((i / 5) * Math.PI * 2) * 1,
              Math.sin((i / 5) * Math.PI * 4) * 0.5
            ]}
          >
            <meshStandardMaterial 
              color={`hsl(${240 + i * 20}, 70%, 60%)`}
              transparent
              opacity={0.8}
              roughness={0.3}
              metalness={0.7}
            />
          </Sphere>
        </Float>
      ))}
    </group>
  );
};

// Mission 3D Component
const Mission3D = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.2;
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.6) * 0.1;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial 
          color="#8b5cf6"
          transparent
          opacity={0.7}
          roughness={0.2}
          metalness={0.9}
          envMapIntensity={1}
        />
      </mesh>
    </Float>
  );
};

const About = () => {
  const { ref: heroRef, isVisible: heroVisible } = useScrollAnimation(0.2);
  const { ref: statsRef, isVisible: statsVisible } = useScrollAnimation(0.3);
  const { ref: missionRef, isVisible: missionVisible } = useScrollAnimation(0.2);
  const { ref: teamRef, isVisible: teamVisible } = useScrollAnimation(0.2);

  // Count up animations
  const { count: businessesCount, setIsActive: setBusinessesActive } = useCountUp(500, 2000);
  const { count: hoursCount, setIsActive: setHoursActive } = useCountUp(30, 2000);
  const { count: accuracyCount, setIsActive: setAccuracyActive } = useCountUp(99, 2000);
  const { count: satisfactionCount, setIsActive: setSatisfactionActive } = useCountUp(98, 2000);

  // Trigger count animations when stats become visible
  useEffect(() => {
    if (statsVisible && !businessesCount && !hoursCount && !accuracyCount && !satisfactionCount) {
      setBusinessesActive(true);
      setHoursActive(true);
      setAccuracyActive(true);
      setSatisfactionActive(true);
    }
  }, [statsVisible, businessesCount, hoursCount, accuracyCount, satisfactionCount, setBusinessesActive, setHoursActive, setAccuracyActive, setSatisfactionActive]);

  const values = [
    {
      icon: Target,
      title: "Innovation First",
      description: "We're constantly pushing the boundaries of what's possible with AI automation.",
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: Users,
      title: "Customer Success",
      description: "Your success is our success. We're committed to delivering measurable results.",
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: Lightbulb,
      title: "Continuous Learning",
      description: "We adapt and evolve with technology to provide cutting-edge solutions.",
      color: "from-green-500 to-green-600"
    },
    {
      icon: Award,
      title: "Excellence",
      description: "We maintain the highest standards in everything we do, from code to customer service.",
      color: "from-orange-500 to-orange-600"
    }
  ];

  const team = [
    {
      name: "Sarah Chen",
      role: "CEO & Founder",
      description: "15+ years in AI and automation, former Google AI researcher",
      image: "/api/placeholder/150/150"
    },
    {
      name: "Marcus Rodriguez",
      role: "CTO",
      description: "Former Tesla AI engineer specializing in conversational AI",
      image: "/api/placeholder/150/150"
    },
    {
      name: "Emily Watson",
      role: "Head of Product",
      description: "Product strategy expert with experience at Microsoft and Amazon",
      image: "/api/placeholder/150/150"
    },
    {
      name: "David Kim",
      role: "Lead AI Engineer",
      description: "PhD in Machine Learning, former OpenAI research scientist",
      image: "/api/placeholder/150/150"
    }
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 3D Background */}
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 6], fov: 75 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <pointLight position={[-10, -10, -10]} color="#8b5cf6" />
            <FloatingTeam3D />
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.3} />
          </Canvas>
        </div>

        {/* Content */}
        <div 
          ref={heroRef}
          className={`relative z-10 container mx-auto px-6 text-center transition-all duration-1000 ${
            heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gradient">
              About Gllarix
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              We're building the future of business automation with AI agents that think, 
              learn, and adapt to your unique business needs.
            </p>
            <Button 
              size="lg"
              className="btn-hero"
              onClick={() => document.getElementById('our-story')?.scrollIntoView({ behavior: 'smooth' })}
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
          statsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { number: businessesCount, suffix: "+", label: "Businesses Automated" },
                { number: hoursCount, suffix: "+", label: "Hours Saved Weekly" },
                { number: accuracyCount, suffix: "%", label: "Accuracy Rate" },
                { number: satisfactionCount, suffix: "%", label: "Customer Satisfaction" }
              ].map((stat, index) => (
                <Card key={index} className="text-center p-8 hover:shadow-lg transition-shadow duration-300">
                  <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                    {stat.number}{stat.suffix}
                  </div>
                  <p className="text-muted-foreground font-medium">{stat.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section id="our-story" className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                  Our Story
                </h2>
                <div className="space-y-6 text-lg text-muted-foreground">
                  <p>
                    Founded in 2023, Gllarix emerged from a simple observation: businesses were 
                    spending countless hours on repetitive tasks that could be automated with AI.
                  </p>
                  <p>
                    Our founders, coming from backgrounds at Google, Tesla, and Microsoft, 
                    saw an opportunity to democratize AI automation for businesses of all sizes.
                  </p>
                  <p>
                    Today, we're proud to serve over 500 businesses worldwide, helping them 
                    save thousands of hours and increase their efficiency by up to 300%.
                  </p>
                </div>
                <Button className="mt-8 btn-hero">
                  Join Our Mission
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
              
              <div className="relative h-96">
                <Canvas camera={{ position: [0, 0, 4], fov: 75 }}>
                  {/* Ambient lighting for overall illumination */}
                  <ambientLight intensity={0.3} color="#ffffff" />
                  
                  {/* Key light - main bright light */}
                  <pointLight 
                    position={[4, 4, 2]} 
                    intensity={1.5} 
                    color="#ffffff"
                    castShadow
                  />
                  
                  {/* Fill light - softer secondary light */}
                  <pointLight 
                    position={[-3, 2, 4]} 
                    intensity={0.8} 
                    color="#8b5cf6"
                  />
                  
                  {/* Rim light - creates edge highlights */}
                  <pointLight 
                    position={[0, -4, -2]} 
                    intensity={1.2} 
                    color="#06b6d4"
                  />
                  
                  {/* Spotlight for dramatic effect */}
                  <spotLight
                    position={[0, 8, 0]}
                    angle={0.4}
                    penumbra={0.5}
                    intensity={2}
                    color="#ffffff"
                    target-position={[0, 0, 0]}
                  />
                  
                  {/* Hemisphere light for natural ambient */}
                  <hemisphereLight
                    args={["#ffffff", "#1e1e2e", 0.4]}
                  />
                  
                  <Mission3D />
                  <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1} />
                </Canvas>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section 
        ref={missionRef}
        className={`py-24 bg-muted/30 transition-all duration-1000 ${
          missionVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                Mission & Vision
              </h2>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-12">
              <Card className="p-8 hover:shadow-lg transition-shadow duration-300">
                <div className="bg-primary/10 p-4 rounded-xl w-fit mb-6">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Our Mission</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  To empower businesses of all sizes with intelligent AI automation that eliminates 
                  repetitive tasks, reduces human error, and unlocks human potential for more 
                  strategic and creative work.
                </p>
              </Card>
              
              <Card className="p-8 hover:shadow-lg transition-shadow duration-300">
                <div className="bg-primary/10 p-4 rounded-xl w-fit mb-6">
                  <Globe className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">Our Vision</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  A world where every business, regardless of size or industry, has access to 
                  intelligent AI agents that handle routine operations, allowing humans to focus 
                  on what they do best: innovate, create, and build relationships.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                Our Values
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                The principles that guide everything we do
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {values.map((value, index) => (
                <Card key={index} className="p-8 hover:shadow-lg transition-all duration-300 group cursor-pointer">
                  <div className={`bg-gradient-to-br ${value.color} p-4 rounded-xl w-fit mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}>
                    <value.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-foreground group-hover:text-primary transition-colors duration-300">
                    {value.title}
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section 
        ref={teamRef}
        className={`py-24 bg-muted/30 transition-all duration-1000 ${
          teamVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                Meet Our Team
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Industry experts dedicated to revolutionizing business automation
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {team.map((member, index) => (
                <Card 
                  key={index} 
                  className={`text-center p-6 hover:shadow-lg transition-all duration-700 ${
                    teamVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">{member.name}</h3>
                  <p className="text-primary font-semibold mb-3">{member.role}</p>
                  <p className="text-sm text-muted-foreground">{member.description}</p>
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
                Join hundreds of businesses already saving 30+ hours per week with Gllarix AI automation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="btn-hero">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
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