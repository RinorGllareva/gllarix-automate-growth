import { ArrowUpRight, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import FluidGlassBackground from "@/components/FluidGlassBackground";

interface FooterProps {
  transparent?: boolean;
}

const Footer = ({ transparent = false }: FooterProps) => {
  return (
    <footer
      className={`relative overflow-hidden border-t border-white/10 pb-16 ${
        transparent
          ? "z-10 bg-black/25 backdrop-blur-2xl"
          : "bg-black"
      }`}
    >
      {transparent ? null : <FluidGlassBackground variant="footer" />}
      <div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-violet-300/55 to-cyan-200/30" />

      <div className="container relative z-10 mx-auto px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 border-b border-white/12 pb-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <img
                src="/gllarix-icon-180.png.png"
                alt=""
                aria-hidden="true"
                className="h-12 w-12 object-contain"
                loading="lazy"
              />
              <h2 className="mt-7 max-w-2xl text-3xl font-light leading-tight text-white sm:text-4xl">
                Automation that answers, qualifies, and moves work forward.
              </h2>
            </div>

            <a
              href="mailto:hello@gllarix.com"
              className="inline-flex items-center gap-3 text-sm font-light text-white"
            >
              <Mail className="h-4 w-4" />
              hello@gllarix.com
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          <div className="flex flex-col gap-8 pt-8 md:flex-row md:items-center md:justify-between">
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-x-6 gap-y-3"
            >
              <Link className="text-xs text-white/48 hover:text-white" to="/#industries">
                Services
              </Link>
              <Link className="text-xs text-white/48 hover:text-white" to="/about">
                About
              </Link>
              <Link className="text-xs text-white/48 hover:text-white" to="/demo">
                Demo
              </Link>
              <Link className="text-xs text-white/48 hover:text-white" to="/contact">
                Contact
              </Link>
              <Link className="text-xs text-white/48 hover:text-white" to="/privacy">
                Privacy
              </Link>
              <Link className="text-xs text-white/48 hover:text-white" to="/terms">
                Terms
              </Link>
            </nav>

            <p className="text-xs font-light text-white/30">
              © 2026 Gllarix. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
