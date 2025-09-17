import { ArrowRight } from "lucide-react";

const Navigation = () => {
  return (
    <>
      {/* Top Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent">
        <div className="container mx-auto px-12 py-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="text-primary text-xl">▲</div>
              <div className="text-xl font-light text-white tracking-wider">
                GLLARIX
              </div>
            </div>

            {/* Contact Button */}
            <button className="flex items-center gap-2 px-6 py-3 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary transition-all duration-300 backdrop-blur-sm">
              <span className="text-sm font-medium">Contact us</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-transparent">
        <div className="container mx-auto px-12 py-8">
          <div className="flex items-center justify-between">
            {/* Navigation Links */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                <a href="#" className="text-white hover:text-primary transition-colors text-sm font-light">
                  Home
                </a>
              </div>
              <a href="#services" className="text-gray-400 hover:text-primary transition-colors text-sm font-light">
                Services
              </a>
              <a href="#about" className="text-gray-400 hover:text-primary transition-colors text-sm font-light">
                Product
              </a>
              <a href="#contact" className="text-gray-400 hover:text-primary transition-colors text-sm font-light">
                About us
              </a>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;