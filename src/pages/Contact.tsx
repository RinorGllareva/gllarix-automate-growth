import { ArrowRight, Mail, Phone, MapPin, MessageSquare, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Canvas } from "@react-three/fiber";
import { Float, Text3D, OrbitControls } from "@react-three/drei";
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// 3D Contact Form Animation
const FloatingContact3D = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.2;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial 
          color="#6366f1"
          transparent
          opacity={0.7}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
    </Float>
  );
};

// Animated Particles
const ContactParticles = () => {
  const particlesRef = useRef<THREE.Points>(null);
  
  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.1;
    }
  });

  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10; 
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#8b5cf6" transparent opacity={0.6} />
    </points>
  );
};

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    // Reset form
    setFormData({ name: '', email: '', company: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section with 3D */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* 3D Background */}
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <ContactParticles />
            <FloatingContact3D />
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
          </Canvas>
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gradient">
              Get in Touch
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Ready to transform your business with AI? Let's discuss how Gllarix can automate your workflows and boost productivity.
            </p>
            <div className="flex justify-center gap-4">
              <Button 
                size="lg"
                className="btn-hero"
                onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Start Conversation
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => document.getElementById('contact-info')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Contact Info
              </Button>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="w-6 h-10 border-2 border-primary/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-primary rounded-full mt-2 animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              {/* Form */}
              <Card className="p-8 bg-card/80 backdrop-blur-sm border-border/50">
                <h2 className="text-3xl font-bold mb-6 text-foreground">Send us a Message</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-200"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-200"
                        placeholder="john@company.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Company
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all duration-200"
                      placeholder="Your Company"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Message *
                    </label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-vertical transition-all duration-200"
                      placeholder="Tell us about your project and how we can help..."
                    ></textarea>
                  </div>
                  
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full btn-hero"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send Message
                        <Send className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Card>

              {/* Contact Info */}
              <div id="contact-info" className="space-y-8">
                <div>
                  <h2 className="text-3xl font-bold mb-6 text-foreground">Let's Connect</h2>
                  <p className="text-lg text-muted-foreground mb-8">
                    We're here to help you transform your business with AI automation. 
                    Reach out through any of these channels.
                  </p>
                </div>

                {/* Contact Cards */}
                <div className="space-y-4">
                  {[
                    {
                      icon: Mail,
                      title: "Email Us",
                      info: "hello@gllarix.com",
                      description: "Drop us a line anytime"
                    },
                    {
                      icon: Phone,
                      title: "Call Us",
                      info: "+38349636899",
                      description: "Mon-Fri from 8am to 6pm"
                    },
                    {
                      icon: MapPin,
                      title: "Visit Us",
                      info: "Prishtinë, XKS",
                      description: "Our headquarters"
                    }
                  ].map((contact, index) => (
                    <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group">
                      <div className="flex items-start gap-4">
                        <div className="bg-primary/10 p-3 rounded-lg group-hover:bg-primary/20 transition-colors duration-300">
                          <contact.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">{contact.title}</h3>
                          <p className="text-primary font-medium mb-1">{contact.info}</p>
                          <p className="text-sm text-muted-foreground">{contact.description}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Response Time */}
                <Card className="p-6 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Response Time</h3>
                  </div>
                  <p className="text-muted-foreground">
                    We typically respond within 2-4 hours during business hours, 
                    and within 24 hours on weekends.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-foreground">
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-6 text-left">
              {[
                {
                  question: "How quickly can we get started?",
                  answer: "Most clients are up and running within 24-48 hours. Our setup process is designed to be quick and seamless."
                },
                {
                  question: "Do you offer custom integrations?",
                  answer: "Yes! We can integrate with most popular CRMs, calendaring systems, and business tools. Custom integrations are available."
                },
                {
                  question: "What kind of support do you provide?",
                  answer: "We offer 24/7 technical support, dedicated account management, and comprehensive training for your team."
                },
                {
                  question: "Is there a contract commitment?",
                  answer: "We offer both monthly and annual plans. No long-term contracts required - you can cancel anytime."
                }
              ].map((faq, index) => (
                <Card key={index} className="p-6">
                  <h3 className="font-semibold text-foreground mb-3">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;