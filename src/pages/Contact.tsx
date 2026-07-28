import { useState } from "react";
import { ArrowRight, Check, Mail, MapPin, Send } from "lucide-react";
import { Link } from "react-router-dom";
import SecondaryPageShell from "@/components/SecondaryPageShell";

const initialForm = {
  name: "",
  email: "",
  company: "",
  message: "",
};

const Contact = () => {
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contact-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(formData),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to send your message.");
      }

      setIsSubmitted(true);
      setFormData(initialForm);
    } catch (error) {
      console.error("Contact form submission failed:", error);
      setErrorMessage(
        "The message could not be sent. Email us directly at hello@gllarix.com.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full border-b border-white/16 bg-transparent px-0 py-3 text-sm font-light text-white outline-none transition-colors placeholder:text-white/25 focus:border-white/55";

  return (
    <SecondaryPageShell accent="amber">
      <section className="px-5 pb-24 pt-36 sm:px-8 sm:pb-28 sm:pt-44 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <header className="grid gap-10 border-b border-white/12 pb-12 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <p className="mb-6 text-[10px] font-light uppercase tracking-[0.3em] text-amber-200/70 sm:text-xs">
                Contact
              </p>
              <h1 className="max-w-5xl [font-family:'Helvetica_Neue',Helvetica,Arial,sans-serif] text-5xl font-light leading-[0.92] text-white sm:text-6xl md:text-7xl lg:text-8xl">
                Tell us what should run itself.
              </h1>
            </div>
            <p className="text-base font-light leading-relaxed text-white/55 sm:text-lg">
              Share the workflow, the volume, and the result you want. We will
              reply with the clearest next step.
            </p>
          </header>

          <div className="secondary-glass-surface secondary-glass-surface--contact grid overflow-hidden lg:grid-cols-[minmax(17rem,0.58fr)_minmax(0,1.42fr)]">
            <aside className="secondary-glass-soft border-b border-white/12 px-7 py-10 lg:border-b-0 lg:border-r lg:border-white/12 lg:px-8 lg:py-14">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/34">
                Direct contact
              </p>

              <div className="mt-7 space-y-5">
                <a
                  href="mailto:hello@gllarix.com"
                  className="flex items-center gap-3 text-sm font-light text-white"
                >
                  <Mail className="h-4 w-4" />
                  hello@gllarix.com
                </a>
                <p className="flex items-center gap-3 text-sm font-light text-white/50">
                  <MapPin className="h-4 w-4" />
                  Prishtina, Kosovo
                </p>
              </div>

              <div className="mt-10 border-t border-white/10 pt-7">
                <p className="text-sm font-light leading-relaxed text-white/42">
                  Prefer a scheduled conversation?
                </p>
                <Link
                  to="/book-meeting"
                  className="mt-4 inline-flex items-center gap-2 text-xs font-light uppercase tracking-[0.15em] text-white"
                >
                  Book a meeting
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </aside>

            <div id="contact-form" className="px-7 py-10 sm:px-9 lg:px-12 lg:py-14">
              {isSubmitted ? (
                <div className="flex min-h-[28rem] flex-col items-start justify-center">
                  <span className="flex h-12 w-12 items-center justify-center border border-white/20 bg-white text-black">
                    <Check className="h-5 w-5 text-amber-700" />
                  </span>
                  <h2 className="mt-7 text-3xl font-light text-white">
                    Message received.
                  </h2>
                  <p className="mt-3 max-w-md text-sm font-light leading-relaxed text-white/48">
                    We will review your workflow and reply as soon as possible.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsSubmitted(false)}
                    className="mt-7 text-xs uppercase tracking-[0.14em] text-white/60 hover:text-white"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                        Name
                      </span>
                      <input
                        className={fieldClass}
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                        Work email
                      </span>
                      <input
                        className={fieldClass}
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="you@company.com"
                        required
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                        Company
                      </span>
                      <input
                        className={fieldClass}
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        placeholder="Company name"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-white/38">
                        Workflow
                      </span>
                      <textarea
                        className={`${fieldClass} min-h-32 resize-y`}
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="What should Gllarix handle?"
                        required
                      />
                    </label>
                  </div>

                  {errorMessage ? (
                    <p className="mt-6 text-sm font-light text-red-300">
                      {errorMessage}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-9 inline-flex items-center gap-3 border border-amber-100/60 bg-amber-100 px-6 py-4 text-xs font-light uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50"
                  >
                    {isSubmitting ? "Sending" : "Send message"}
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </SecondaryPageShell>
  );
};

export default Contact;
