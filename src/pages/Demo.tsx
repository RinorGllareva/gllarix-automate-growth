import { ArrowRight, Play, FileText, Download, ExternalLink, BookOpen, Video, Code, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Canvas } from "@react-three/fiber";
import { Float, Text3D, OrbitControls } from "@react-three/drei";
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import Navigation from "@/components/Navigation";

// 3D Demo Animation
const FloatingDemo3D = () => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[1, 1.5, 2, 8]} />
          <meshStandardMaterial 
            color="#6366f1" 
            transparent 
            opacity={0.8}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
      </Float>
      
      {/* Floating elements around the cylinder */}
      {[...Array(6)].map((_, i) => (
        <Float key={i} speed={1.5 + i * 0.3} rotationIntensity={0.2} floatIntensity={0.3}>
          <mesh 
            position={[
              Math.cos((i / 6) * Math.PI * 2) * 3,
              Math.sin((i / 6) * Math.PI * 2) * 2,
              Math.sin((i / 6) * Math.PI * 4) * 1
            ]}
          >
            <boxGeometry args={[0.3, 0.3, 0.3]} />
            <meshStandardMaterial 
              color={`hsl(${240 + i * 30}, 70%, 60%)`}
              transparent
              opacity={0.7}
            />
          </mesh>
        </Float>
      ))}
    </group>
  );
};

const Demo = () => {
  const { ref: heroRef, isVisible: heroVisible } = useScrollAnimation(0.2);
  const { ref: videosRef, isVisible: videosVisible } = useScrollAnimation(0.2);
  const { ref: docsRef, isVisible: docsVisible } = useScrollAnimation(0.2);
  
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  const demoVideos = [
    {
      id: "real-estate",
      title: "Real Estate AI Agent Demo",
      description: "Watch how our AI agent handles property inquiries, schedules tours, and qualifies leads automatically.",
      thumbnail: "/api/placeholder/400/225",
      duration: "3:45",
      category: "Industry Demo",
      features: ["Lead Qualification", "Tour Scheduling", "Follow-up Calls"]
    },
    {
      id: "healthcare",
      title: "Healthcare Appointment Booking",
      description: "See how patients can book appointments, get reminders, and receive prescription notifications.",
      thumbnail: "/api/placeholder/400/225", 
      duration: "4:12",
      category: "Industry Demo",
      features: ["Appointment Booking", "Insurance Verification", "Patient Reminders"]
    },
    {
      id: "solar",
      title: "Solar Lead Qualification System",
      description: "Discover how our AI qualifies solar leads and schedules site assessments efficiently.",
      thumbnail: "/api/placeholder/400/225",
      duration: "5:23",
      category: "Industry Demo", 
      features: ["Lead Qualification", "Site Assessment", "ROI Calculations"]
    },
    {
      id: "crm-integration",
      title: "CRM Integration Setup",
      description: "Learn how to connect Gllarix with your existing CRM in under 5 minutes.",
      thumbnail: "/api/placeholder/400/225",
      duration: "4:56",
      category: "Setup Guide",
      features: ["Quick Setup", "Data Sync", "Custom Fields"]
    },
    {
      id: "voice-agent",
      title: "AI Voice Agent Training",
      description: "Understand how to train your AI agent with your business-specific conversation flows.",
      thumbnail: "/api/placeholder/400/225",
      duration: "6:18",
      category: "Training",
      features: ["Voice Training", "Custom Scripts", "Response Optimization"]
    },
    {
      id: "analytics",
      title: "Analytics & Reporting Dashboard",
      description: "Explore comprehensive analytics to track performance and optimize your AI agents.",
      thumbnail: "/api/placeholder/400/225",
      duration: "3:34",
      category: "Analytics",
      features: ["Performance Metrics", "Call Analytics", "ROI Tracking"]
    }
  ];

  const documentation = [
    {
      title: "Getting Started Guide",
      description: "Complete setup guide to get your AI agent running in minutes",
      icon: BookOpen,
      pages: 12,
      category: "Setup",
      link: "#"
    },
    {
      title: "API Documentation",
      description: "Comprehensive API reference for developers and integrations",
      icon: Code,
      pages: 45,
      category: "Developer",
      link: "#"
    },
    {
      title: "Integration Guides",
      description: "Step-by-step guides for popular CRM and tool integrations",
      icon: ExternalLink,
      pages: 28,
      category: "Integrations",
      link: "#"
    },
    {
      title: "Best Practices",
      description: "Industry-specific best practices and optimization tips",
      icon: Lightbulb,
      pages: 22,
      category: "Optimization",
      link: "#"
    },
    {
      title: "Troubleshooting",
      description: "Common issues and solutions for smooth operations",
      icon: FileText,
      pages: 18,
      category: "Support",
      link: "#"
    },
    {
      title: "Advanced Features",
      description: "Unlock powerful advanced features and customizations",
      icon: Code,
      pages: 35,
      category: "Advanced",
      link: "#"
    }
  ];

  return (
    <main className="min-h-screen bg-background">
      <Navigation></Navigation>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 3D Background */}
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 8], fov: 75 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <FloatingDemo3D />
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.4} />
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
              Demos & Documentation
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Explore interactive demos, watch implementation guides, and access comprehensive 
              documentation to get the most out of Gllarix AI automation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg"
                className="btn-hero"
                onClick={() => document.getElementById('demo-videos')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Watch Demos
                <Play className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => document.getElementById('documentation')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Documentation
                <FileText className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Videos Section */}
      <section 
        id="demo-videos"
        ref={videosRef}
        className={`py-24 bg-muted/30 transition-all duration-1000 ${
          videosVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                Interactive Demos
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                See Gllarix in action with real-world scenarios and industry-specific use cases
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {demoVideos.map((video, index) => (
                <Card 
                  key={video.id}
                  className={`overflow-hidden hover:shadow-lg transition-all duration-700 cursor-pointer group ${
                    videosVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                  onClick={() => setSelectedVideo(video.id)}
                >
                  <div className="relative">
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <div className="bg-primary/20 rounded-full p-4 group-hover:bg-primary/30 transition-colors duration-300">
                        <Play className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <div className="absolute top-4 left-4 bg-primary/90 text-primary-foreground px-2 py-1 rounded text-xs font-medium">
                      {video.category}
                    </div>
                    <div className="absolute bottom-4 right-4 bg-black/70 text-white px-2 py-1 rounded text-xs">
                      {video.duration}
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-bold mb-3 text-foreground group-hover:text-primary transition-colors duration-300">
                      {video.title}
                    </h3>
                    <p className="text-muted-foreground mb-4 text-sm">
                      {video.description}
                    </p>
                    
                    <div className="space-y-2">
                      {video.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Documentation Section */}
      <section 
        id="documentation"
        ref={docsRef}
        className={`py-24 bg-background transition-all duration-1000 ${
          docsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                Documentation & Guides
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Comprehensive resources to help you implement, optimize, and scale your AI automation
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {documentation.map((doc, index) => (
                <Card 
                  key={index}
                  className={`p-6 hover:shadow-lg transition-all duration-700 group cursor-pointer ${
                    docsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="bg-primary/10 p-3 rounded-lg group-hover:bg-primary/20 transition-colors duration-300">
                      <doc.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-accent/20 text-accent-foreground px-2 py-1 rounded text-xs font-medium w-fit mb-2">
                        {doc.category}
                      </div>
                      <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                        {doc.title}
                      </h3>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground mb-4">
                    {doc.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {doc.pages} pages
                    </span>
                    <div className="flex items-center gap-2 text-primary font-medium text-sm group-hover:gap-3 transition-all duration-300">
                      Read More
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Quick Access */}
            <div className="mt-16">
              <Card className="p-8 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-4 text-foreground">
                    Need Quick Access?
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                    Download our complete documentation package or access our developer portal 
                    for API references and integration guides.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button className="btn-hero">
                      <Download className="mr-2 h-4 w-4" />
                      Download PDF Bundle
                    </Button>
                    <Button variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                      <Code className="mr-2 h-4 w-4" />
                      Developer Portal
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Book a personalized demo to see how Gllarix can transform your specific business processes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="btn-hero">
                Schedule Live Demo
                <Video className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Video Modal */}
      {selectedVideo && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedVideo(null)}
        >
          <div 
            className="bg-background rounded-lg max-w-4xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-foreground">
                {demoVideos.find(v => v.id === selectedVideo)?.title}
              </h3>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedVideo(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </Button>
            </div>
            <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Play className="h-16 w-16 text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Demo video would play here</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This is a placeholder for the actual video player
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Demo;