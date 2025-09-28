import { Bot, Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import img from "../../public/Gllarix_LogoPNG.png";

const Footer = () => {
  const footerSections = [
    {
      title: "Solutions",
      links: [
        { name: "AI Voice Agents", href: "#" },
        { name: "Business Automation", href: "#" },
        { name: "CRM Integration", href: "#" },
        { name: "Appointment Booking", href: "#" },
      ],
    },
    {
      title: "Industries",
      links: [
        { name: "Real Estate", href: "#" },
        { name: "Healthcare", href: "#" },
        { name: "Solar & Energy", href: "#" },
        { name: "Automotive", href: "#" },
        { name: "Insurance", href: "#" },
        { name: "Hospitality", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Case Studies", href: "#" },
        { name: "Documentation", href: "#" },

      ],
    },
    {
      title: "Company",
      links: [
        { name: "About Us", href: "#" },
        { name: "Contact", href: "#" },
        { name: "Privacy Policy", href: "#" },
        { name: "Terms of Service", href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-background border-t border-border">
      {/* Main Footer */}
      <div className="container mx-auto px-6 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
            {/* Company Info */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <img
                  src={img}
                  alt="Gllarix Logo"
                  className="h-12 md:h-16 w-auto object-contain"
                />
              </div>

              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                AI agents and business automations that handle calls,
                reservations, appointments, and workflows so businesses run
                smoother with less human error.
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-5 w-5 text-primary" />
                  <span>hello@gllarix.com</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="h-5 w-5 text-primary" />
                  <span>38349636899</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>Prishtinë, XKS</span>
                </div>
              </div>
            </div>

            {/* Newsletter */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-foreground">
                Stay Updated
              </h3>
              <p className="text-muted-foreground">
                Get the latest updates on AI automation trends, case studies,
                and product features.
              </p>

              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="flex-1 px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
                <Button className="btn-hero px-6">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                No spam. Unsubscribe at any time.
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {footerSections.map((section, index) => (
              <div key={index}>
                <h4 className="font-semibold text-foreground mb-4">
                  {section.title}
                </h4>
                <ul className="space-y-3">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <a
                        href={link.href}
                        className="text-muted-foreground hover:text-primary transition-colors text-sm"
                      >
                        {link.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-border pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-muted-foreground text-sm">
                © 2025 Gllarix. All rights reserved.
              </p>

              <div className="flex items-center gap-6">
                <a
                  href="#"
                  className="text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  Privacy Policy
                </a>
                <a
                  href="#"
                  className="text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  Terms of Service
                </a>
                <a
                  href="#"
                  className="text-muted-foreground hover:text-primary transition-colors text-sm"
                >
                  Cookie Policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
