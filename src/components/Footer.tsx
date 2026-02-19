import { Bot, Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import img from "../../public/Gllarix_LogoPNG.png";

const Footer = () => {
  const footerSections = [
    {
      title: "Solutions",
      links: [
        { name: "AI Voice Agents", href: "/#services" },
        { name: "Business Automation", href: "/#how-it-works" },
        { name: "CRM Integration", href: "/demo" },
        { name: "Appointment Booking", href: "/#services" },
      ],
    },
    {
      title: "Industries",
      links: [
        { name: "Real Estate", href: "/#industries" },
        { name: "Healthcare", href: "/#industries" },
        { name: "Solar & Energy", href: "/#industries" },
        { name: "Automotive", href: "/#industries" },
        { name: "Insurance", href: "/#industries" },
        { name: "Hospitality", href: "/#industries" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Case Studies", href: "/demo" },
        { name: "Documentation", href: "/demo" },
        { name: "Demo Videos", href: "/demo" },
        { name: "API Docs", href: "/demo" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "About Us", href: "/about" },
        { name: "Contact", href: "/contact" },
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Terms of Service", href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="relative bg-black border-t border-white/10 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px), linear-gradient(hsl(var(--primary)) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-gray-900 pointer-events-none" />

      {/* Main Footer */}
      <div className="container mx-auto px-6 py-16 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Company Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img
                  src={img}
                  alt="Gllarix AI Voice Agents Logo"
                  className="h-10 sm:h-12 md:h-16 w-auto object-contain"
                  loading="lazy"
                  width="160"
                  height="64"
                />
              </div>

              <p className="text-base lg:text-lg text-gray-400 max-w-md leading-relaxed">
                AI agents and business automations that handle calls,
                reservations, appointments, and workflows so businesses run
                smoother with less human error.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-400 text-sm sm:text-base group hover:text-primary transition-colors">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  </div>
                  <span>hello@gllarix.com</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-sm sm:text-base group hover:text-primary transition-colors">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  </div>
                  <span>38349636899</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400 text-sm sm:text-base group hover:text-primary transition-colors">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                    <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  </div>
                  <span>Prishtinë, XKS</span>
                </div>
              </div>
            </div>

            {/* Newsletter */}
            <div className="space-y-6">
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Stay Updated
              </h3>
              <p className="text-sm sm:text-base text-gray-400">
                Get the latest updates on AI automation trends, case studies,
                and product features.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary/50 outline-none text-sm sm:text-base text-white placeholder:text-gray-500 transition-all"
                />
                <Button className="bg-primary hover:bg-primary/90 text-white px-4 sm:px-6 rounded-xl shrink-0 transition-all hover:scale-105">
                  Subscribe
                  <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>

              <p className="text-xs sm:text-sm text-gray-500">
                No spam. Unsubscribe at any time.
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {footerSections.map((section, index) => (
              <div key={index}>
                <h4 className="font-semibold text-white mb-4 text-sm sm:text-base">
                  {section.title}
                </h4>
                <ul className="space-y-3">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <Link
                        to={link.href}
                        className="text-gray-400 hover:text-primary transition-colors text-xs sm:text-sm inline-flex items-center gap-2 group"
                      >
                        <span className="w-0 h-0.5 bg-primary group-hover:w-4 transition-all duration-300" />
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-gray-400 text-xs sm:text-sm text-center sm:text-left">
                © 2026 Gllarix. All rights reserved.
              </p>

              <div className="flex flex-wrap justify-center sm:justify-end items-center gap-6">
                <Link
                  to="/privacy"
                  className="text-gray-400 hover:text-primary transition-colors text-xs sm:text-sm"
                >
                  Privacy Policy
                </Link>
                <Link
                  to="/terms"
                  className="text-gray-400 hover:text-primary transition-colors text-xs sm:text-sm"
                >
                  Terms of Service
                </Link>
                <Link
                  to="/privacy#cookies"
                  className="text-gray-400 hover:text-primary transition-colors text-xs sm:text-sm"
                >
                  Cookie Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
