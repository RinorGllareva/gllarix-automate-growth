import { ArrowRight, Mail, Phone, MapPin, MessageSquare, Send, Clock, CheckCircle, Zap, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls, Sphere } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

// Enhanced 3D Scene with Multiple Elements
const ContactScene3D = () => {
  const groupRef = useRef<THREE.Group>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
    if (sphereRef.current) {
      sphereRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.3;
      sphereRef.current.rotation.x = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Central Sphere */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh ref={sphereRef}>
          <icosahedronGeometry args={[1.2, 0]} />
          <meshStandardMaterial 
            color="#6366f1"
            transparent
            opacity={0.8}
            roughness={0.2}
            metalness={0.9}
            envMapIntensity={2}
          />
        </mesh>
      </Float>
      
      {/* Orbiting Elements */}
      {[...Array(6)].map((_, i) => (
        <Float
          key={i}
          speed={1.5 + i * 0.3}
          rotationIntensity={0.1}
          floatIntensity={0.2}
        >
          <Sphere
            args={[0.15, 16, 16]}
            position={[
              Math.cos((i / 6) * Math.PI * 2) * 3,
              Math.sin((i / 6) * Math.PI * 2) * 1.5,
              Math.cos((i / 6) * Math.PI * 4) * 0.8,
            ]}
          >
            <meshStandardMaterial
              color={i % 2 === 0 ? "#8b5cf6" : "#06b6d4"}
              transparent
              opacity={0.7}
              roughness={0.3}
              metalness={0.8}
            />
          </Sphere>
        </Float>
      ))}
    </group>
  );
};

// Enhanced Lighting Setup
const SceneLights = () => (
  <>
    <ambientLight intensity={0.6} />
    <directionalLight intensity={1.2} position={[5, 5, 5]} castShadow />
    <pointLight intensity={0.8} position={[-5, -3, -5]} color="#6366f1" />
    <pointLight intensity={0.6} position={[3, 3, 3]} color="#8b5cf6" />
    <spotLight
      intensity={1}
      position={[0, 8, 0]}
      angle={0.3}
      penumbra={0.5}
      color="#06b6d4"
    />
  </>
);

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    setIsSubmitted(true);
    // Reset form after 3 seconds
    setTimeout(() => {
      setFormData({ name: '', email: '', company: '', message: '' });
      setIsSubmitted(false);
    }, 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Enhanced Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-accent/10"></div>
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-10 w-64 h-64 bg-secondary/8 rounded-full blur-3xl animate-pulse delay-500"></div>
        
        {/* 3D Background */}
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 6], fov: 75 }}>
            <SceneLights />
            <ContactScene3D />
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.3} />
          </Canvas>
        </div>

        {/* Floating Elements */}
        <div className="absolute top-32 left-32 w-8 h-8 bg-primary/30 rounded-full animate-float"></div>
        <div className="absolute top-48 right-48 w-6 h-6 bg-accent/40 rounded-lg rotate-45 animate-float delay-1000"></div>
        <div className="absolute bottom-40 left-24 w-10 h-10 bg-secondary/25 rounded-xl rotate-12 animate-float delay-500"></div>
        <div className="absolute bottom-32 right-32 w-7 h-7 bg-primary/35 rounded-full animate-float delay-1500"></div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 text-center">
          <div className="max-w-5xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse"></span>
              Let's Connect
            </div>
            
            <h1 className="text-5xl md:text-8xl font-bold mb-8 text-gradient leading-tight">
              Get in Touch
            </h1>
            
            <div className="w-32 h-1 bg-gradient-to-r from-primary via-accent to-secondary rounded-full mx-auto mb-8"></div>
            
            <p className="text-xl md:text-2xl text-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              Ready to transform your business with AI? Let's discuss how Gllarix can automate your workflows and boost productivity.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6 mb-16">
              <Button 
                size="lg"
                className="btn-hero group"
                onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Start Conversation
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-2 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 backdrop-blur-sm"
                onClick={() => document.getElementById('contact-info')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Contact Info
                <MessageSquare className="ml-2 h-5 w-5" />
              </Button>
            </div>
            
            {/* Trust Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
              <div className="flex items-center justify-center space-x-3 text-sm text-muted-foreground">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span>Quick Response</span>
              </div>
              <div className="flex items-center justify-center space-x-3 text-sm text-muted-foreground">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-200"></div>
                <span>Free Consultation</span>
              </div>
              <div className="flex items-center justify-center space-x-3 text-sm text-muted-foreground">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse delay-400"></div>
                <span>24/7 Support</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="w-8 h-12 border-2 border-primary/40 rounded-full flex justify-center backdrop-blur-sm bg-background/20">
            <div className="w-1.5 h-4 bg-primary rounded-full mt-3 animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* Enhanced Contact Form Section */}
      <section id="contact-form" className="py-32 relative overflow-hidden bg-gradient-to-br from-muted/20 via-background to-muted/10">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-10 w-64 h-64 bg-secondary/5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                <span className="w-2 h-2 bg-accent rounded-full mr-2 animate-pulse"></span>
                Ready to Start?
              </div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">
                Let's Build Something Amazing
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Tell us about your project and let's discuss how we can help transform your business
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-20 items-start">
              {/* Enhanced Form */}
              <div className="group relative">
                <Card className="p-10 bg-card/60 backdrop-blur-xl border border-border/50 hover:border-primary/30 shadow-2xl hover:shadow-3xl transition-all duration-700 overflow-hidden">
                  {/* Card Background Effects */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-accent/3 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                  <div className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-125"></div>
                  
                  <div className="relative">
                    <h3 className="text-3xl font-bold mb-8 text-foreground group-hover:text-primary transition-colors duration-500">
                      Send us a Message
                    </h3>
                    
                    {isSubmitted ? (
                      <div className="text-center py-16">
                        <div className="w-20 h-20 bg-green-500 rounded-full mx-auto mb-6 flex items-center justify-center animate-scale-in">
                          <CheckCircle className="w-10 h-10 text-white" />
                        </div>
                        <h4 className="text-2xl font-bold text-foreground mb-4">Message Sent Successfully!</h4>
                        <p className="text-muted-foreground">We'll get back to you within 24 hours.</p>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="group/field">
                            <label className="block text-sm font-semibold text-foreground mb-3 group-hover/field:text-primary transition-colors">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              name="name"
                              required
                              value={formData.name}
                              onChange={handleChange}
                              className="w-full px-6 py-4 bg-background/80 backdrop-blur-sm border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-300 hover:border-primary/50"
                              placeholder="John Doe"
                            />
                          </div>
                          <div className="group/field">
                            <label className="block text-sm font-semibold text-foreground mb-3 group-hover/field:text-primary transition-colors">
                              Email *
                            </label>
                            <input
                              type="email"
                              name="email"
                              required
                              value={formData.email}
                              onChange={handleChange}
                              className="w-full px-6 py-4 bg-background/80 backdrop-blur-sm border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-300 hover:border-primary/50"
                              placeholder="john@company.com"
                            />
                          </div>
                        </div>
                        
                        <div className="group/field">
                          <label className="block text-sm font-semibold text-foreground mb-3 group-hover/field:text-primary transition-colors">
                            Company
                          </label>
                          <input
                            type="text"
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            className="w-full px-6 py-4 bg-background/80 backdrop-blur-sm border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all duration-300 hover:border-primary/50"
                            placeholder="Your Company"
                          />
                        </div>
                        
                        <div className="group/field">
                          <label className="block text-sm font-semibold text-foreground mb-3 group-hover/field:text-primary transition-colors">
                            Message *
                          </label>
                          <textarea
                            name="message"
                            required
                            rows={6}
                            value={formData.message}
                            onChange={handleChange}
                            className="w-full px-6 py-4 bg-background/80 backdrop-blur-sm border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-vertical transition-all duration-300 hover:border-primary/50"
                            placeholder="Tell us about your project and how we can help transform your business..."
                          ></textarea>
                        </div>
                        
                        <Button 
                          type="submit" 
                          size="lg" 
                          className="w-full btn-hero group/btn relative overflow-hidden"
                          disabled={isSubmitting}
                        >
                          <span className="relative z-10 flex items-center justify-center">
                            {isSubmitting ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-3"></div>
                                Sending Message...
                              </>
                            ) : (
                              <>
                                Send Message
                                <Send className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
                              </>
                            )}
                          </span>
                          {!isSubmitting && (
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                          )}
                        </Button>
                      </form>
                    )}
                  </div>
                </Card>
                
                {/* Floating Elements Around Form */}
                <div className="absolute -top-6 -left-6 w-12 h-12 bg-primary/20 rounded-xl rotate-12 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:animate-float"></div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8 bg-accent/30 rounded-lg -rotate-12 opacity-0 group-hover:opacity-100 transition-all duration-700 group-hover:animate-float delay-1000"></div>
              </div>

              {/* Enhanced Contact Info */}
              <div id="contact-info" className="space-y-10">
                <div>
                  <h3 className="text-3xl font-bold mb-6 text-foreground">Let's Connect</h3>
                  <p className="text-lg text-foreground mb-8 leading-relaxed">
                    We're here to help you transform your business with AI automation. 
                    Reach out through any of these channels and let's start the conversation.
                  </p>
                </div>

                {/* Enhanced Contact Cards */}
                <div className="space-y-6">
                  {[
                    {
                      icon: Mail,
                      title: "Email Us",
                      info: "hello@gllarix.com",
                      description: "Drop us a line anytime",
                      gradient: "from-primary to-primary/60",
                      accent: "primary"
                    },
                    {
                      icon: Phone,
                      title: "Call Us",
                      info: "+38349636899",
                      description: "Mon-Fri from 8am to 6pm",
                      gradient: "from-accent to-accent/60",
                      accent: "accent"
                    },
                    {
                      icon: MapPin,
                      title: "Visit Us",
                      info: "Prishtinë, XKS",
                      description: "Our headquarters",
                      gradient: "from-secondary to-secondary/60",
                      accent: "secondary"
                    }
                  ].map((contact, index) => (
                    <div key={index} className="group relative">
                      <Card className="p-8 hover:shadow-2xl transition-all duration-500 cursor-pointer border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/20 hover:scale-[1.02] transform overflow-hidden">
                        {/* Card Background Effect */}
                        <div className={`absolute inset-0 bg-gradient-to-br from-${contact.accent}/5 via-transparent to-${contact.accent}/3 opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                        
                        <div className="flex items-start gap-6 relative">
                          <div className={`bg-gradient-to-br ${contact.gradient} p-4 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                            <contact.icon className="h-7 w-7 text-white" />
                          </div>
                          <div className="flex-1">
                            <h4 className={`text-xl font-bold text-foreground mb-2 group-hover:text-${contact.accent} transition-colors duration-300`}>
                              {contact.title}
                            </h4>
                            <p className={`text-${contact.accent} font-semibold text-lg mb-2`}>
                              {contact.info}
                            </p>
                            <p className="text-muted-foreground">
                              {contact.description}
                            </p>
                          </div>
                          
                          {/* Hover Arrow */}
                          <div className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
                            <ArrowRight className={`w-5 h-5 text-${contact.accent}`} />
                          </div>
                        </div>
                        
                        {/* Decorative Elements */}
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary/30 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:animate-bounce"></div>
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-accent/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:animate-bounce delay-200"></div>
                      </Card>
                    </div>
                  ))}
                </div>

                {/* Enhanced Response Time Card */}
                <Card className="p-8 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border-primary/30 hover:border-primary/50 transition-all duration-300 group">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="bg-gradient-to-br from-primary to-primary/60 p-3 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                        Response Time
                      </h4>
                      <p className="text-foreground/80 leading-relaxed">
                        We typically respond within 2-4 hours during business hours, 
                        and within 24 hours on weekends.
                      </p>
                    </div>
                  </div>
                  
                  {/* Progress Indicators */}
                  <div className="flex items-center space-x-4 mt-6 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-accent rounded-full animate-pulse delay-150"></div>
                      <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-300"></div>
                    </div>
                    <span className="text-sm text-muted-foreground">Available 24/7</span>
                  </div>
                </Card>

                {/* Why Choose Us */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
                  {[
                    { icon: Zap, label: "Fast Setup", desc: "Get started in minutes" },
                    { icon: Users, label: "Expert Team", desc: "Industry professionals" },
                    { icon: Shield, label: "Secure & Reliable", desc: "Enterprise-grade security" },
                    { icon: CheckCircle, label: "Proven Results", desc: "500+ satisfied clients" }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-3 p-4 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors group">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <item.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced FAQ Section */}
      <section className="py-32 relative overflow-hidden bg-gradient-to-br from-background via-accent/5 to-background">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/8 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 right-10 w-64 h-64 bg-secondary/5 rounded-full blur-3xl animate-pulse delay-500"></div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-20 w-6 h-6 bg-primary/30 rounded-full animate-float"></div>
        <div className="absolute top-40 right-32 w-4 h-4 bg-accent/40 rounded-lg rotate-45 animate-float delay-1000"></div>
        <div className="absolute bottom-32 left-16 w-8 h-8 bg-secondary/25 rounded-xl rotate-12 animate-float delay-500"></div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-medium mb-4">
                <span className="w-2 h-2 bg-secondary rounded-full mr-2 animate-pulse"></span>
                Common Questions
              </div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">
                Frequently Asked Questions
              </h2>
              <div className="w-24 h-1 bg-gradient-to-r from-primary via-accent to-secondary rounded-full mx-auto mb-8"></div>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Find answers to the most common questions about our AI automation services
              </p>
            </div>
            
            <div className="space-y-8">
              {[
                {
                  question: "How quickly can we get started?",
                  answer: "Most clients are up and running within 24-48 hours. Our setup process is designed to be quick and seamless, with dedicated onboarding specialists to guide you through every step.",
                  gradient: "from-primary to-primary/60",
                  accent: "primary"
                },
                {
                  question: "Do you offer custom integrations?",
                  answer: "Yes! We can integrate with most popular CRMs, calendaring systems, and business tools. Our team of integration specialists can create custom connections tailored to your specific workflow needs.",
                  gradient: "from-accent to-accent/60",
                  accent: "accent"
                },
                {
                  question: "What kind of support do you provide?",
                  answer: "We offer 24/7 technical support, dedicated account management, comprehensive training for your team, and ongoing optimization to ensure you get the maximum value from our platform.",
                  gradient: "from-secondary to-secondary/60",
                  accent: "secondary"
                },
                {
                  question: "Is there a contract commitment?",
                  answer: "We offer both monthly and annual plans with flexible terms. No long-term contracts required - you can upgrade, downgrade, or cancel anytime. We believe in earning your business every month.",
                  gradient: "from-primary via-accent/60 to-secondary",
                  accent: "primary"
                }
              ].map((faq, index) => (
                <div key={index} className="group relative">
                  <Card className="p-10 hover:shadow-2xl transition-all duration-700 border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/20 hover:scale-[1.02] transform overflow-hidden">
                    {/* Card Background Effect */}
                    <div className={`absolute inset-0 bg-gradient-to-br from-${faq.accent}/5 via-transparent to-${faq.accent}/3 opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
                    <div className="absolute -top-16 -right-16 w-32 h-32 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-125"></div>
                    
                    <div className="relative">
                      {/* Question */}
                      <div className="flex items-start gap-6 mb-6">
                        <div className={`bg-gradient-to-br ${faq.gradient} p-4 rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 flex-shrink-0`}>
                          <MessageSquare className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className={`text-2xl font-bold text-foreground mb-4 group-hover:text-${faq.accent} transition-colors duration-500`}>
                            {faq.question}
                          </h3>
                          
                          {/* Animated Underline */}
                          <div className={`w-16 h-1 bg-gradient-to-r ${faq.gradient} rounded-full mb-6 group-hover:w-24 transition-all duration-500`}></div>
                          
                          <p className="text-lg text-foreground leading-relaxed group-hover:text-foreground/90 transition-colors duration-300">
                            {faq.answer}
                          </p>
                        </div>
                        
                        {/* Hover Indicator */}
                        <div className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 flex-shrink-0">
                          <ArrowRight className={`w-6 h-6 text-${faq.accent}`} />
                        </div>
                      </div>
                      
                      {/* Interactive Elements */}
                      <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-500">
                        <div className="flex space-x-2">
                          <div className={`w-3 h-3 bg-${faq.accent} rounded-full animate-pulse`}></div>
                          <div className={`w-2 h-2 bg-${faq.accent}/60 rounded-full animate-pulse delay-150`}></div>
                          <div className={`w-2 h-2 bg-${faq.accent}/40 rounded-full animate-pulse delay-300`}></div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-muted-foreground">FAQ #{index + 1}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Decorative Elements */}
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary/30 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:animate-bounce"></div>
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-accent/40 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:animate-bounce delay-200"></div>
                  </Card>
                  
                  {/* Connecting Lines */}
                  {index < 3 && (
                    <div className="hidden md:block absolute -bottom-4 left-1/2 w-0.5 h-8 bg-gradient-to-b from-primary/20 to-transparent transform -translate-x-1/2"></div>
                  )}
                </div>
              ))}
            </div>
            
            {/* CTA at bottom of FAQ */}
            <div className="mt-20 text-center">
              <Card className="p-12 bg-gradient-to-br from-primary/10 via-accent/5 to-secondary/10 border-primary/20 hover:border-primary/40 transition-all duration-500 group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-xl"></div>
                
                <div className="relative">
                  <h3 className="text-3xl font-bold mb-6 text-gradient">
                    Still Have Questions?
                  </h3>
                  <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                    Our team is here to help. Get in touch and we'll answer any questions you have about our AI automation platform.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button 
                      size="lg" 
                      className="btn-hero group"
                      onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      Contact Our Team
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline"
                      className="border-2 border-accent/30 text-accent hover:bg-accent/10 hover:border-accent/50"
                    >
                      Schedule Demo
                      <MessageSquare className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
            
            {/* Central Connection Hub */}
            <div className="hidden md:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full opacity-20 animate-pulse pointer-events-none"></div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;