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
    <footer className="bg-background border-t border-border">
      {/* Main Footer */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 mb-12">
            {/* Company Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img
                  src={img}
                  alt="Gllarix Logo"
                  className="h-10 sm:h-12 md:h-16 w-auto object-contain"
                />
              </div>

              <p className="text-base lg:text-lg text-muted-foreground max-w-md leading-relaxed">
                AI agents and business automations that handle calls,
                reservations, appointments, and workflows so businesses run
                smoother with less human error.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground text-sm sm:text-base">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  <span>hello@gllarix.com</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground text-sm sm:text-base">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  <span>38349636899</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground text-sm sm:text-base">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                  <span>Prishtinë, XKS</span>
                </div>
              </div>
            </div>

            {/* Newsletter */}
            <div className="space-y-6">
              <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                Stay Updated
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                Get the latest updates on AI automation trends, case studies,
                and product features.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
                />
                <Button className="btn-hero px-4 sm:px-6 shrink-0">
                  <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground">
                No spam. Unsubscribe at any time.
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-12">
            {footerSections.map((section, index) => (
              <div key={index}>
                <h4 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">
                  {section.title}
                </h4>
                <ul className="space-y-2 sm:space-y-3">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <Link
                        to={link.href}
                        className="text-muted-foreground hover:text-primary transition-colors text-xs sm:text-sm"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border pt-6 sm:pt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-muted-foreground text-xs sm:text-sm text-center sm:text-left">
                © 2025 Gllarix. All rights reserved.
              </p>

              <div className="flex flex-wrap justify-center sm:justify-end items-center gap-4 sm:gap-6">
                <Link
                  to="/privacy"
                  className="text-muted-foreground hover:text-primary transition-colors text-xs sm:text-sm"
                >
                  Privacy Policy
                </Link>
                <Link
                  to="/terms"
                  className="text-muted-foreground hover:text-primary transition-colors text-xs sm:text-sm"
                >
                  Terms of Service
                </Link>
                <Link
                  to="/cookies"
                  className="text-muted-foreground hover:text-primary transition-colors text-xs sm:text-sm"
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
