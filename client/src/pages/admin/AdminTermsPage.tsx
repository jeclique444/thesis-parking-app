/*
 * ParKada — AdminTermsPage
 * Terms and Conditions for ParKada Admin/Manager Accounts
 */
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ArrowLeft, ShieldCheck } from "lucide-react";
import { useState } from "react";

const BG_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663457633559/7LbcgdNcQ8vnZSarPg7jeB/iparkbayan-mobile-bg-8Wgq9qnQX7R8Lyxjz9xWvm.webp";

export default function AdminTermsPage() {
  const [, setLocation] = useLocation();
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});

  const toggleSection = (index: number) => {
    setOpenSections(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: "By accessing or using the ParKada Admin Dashboard, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the platform. These terms apply to all administrators and parking managers."
    },
    {
      title: "2. Description of Service",
      content: "ParKada provides a centralized platform for managing parking reservations, slot availability, user verifications, and operational reporting for parking facilities. The service includes the admin dashboard, mobile driver app, and related backend systems."
    },
    {
      title: "3. Account Eligibility & Responsibilities",
      content: "You must be at least 18 years old and authorized by your organization to use this admin account. You are solely responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use."
    },
    {
      title: "4. Accuracy of Information",
      content: "As a manager, you agree to keep your profile, parking lot details, rates, and slot availability accurate and up‑to‑date. Misrepresentation may lead to suspension or termination of your account."
    },
    {
      title: "5. Booking and Reservation Policies",
      content: "All driver reservations are subject to slot availability on a first‑come, first‑served basis. Managers must honor confirmed reservations unless exceptional circumstances (e.g., force majeure) apply. Cancellation and refund policies are set by the parking facility operator."
    },
    {
      title: "6. Fees and Payment Processing",
      content: "Managers are responsible for setting and collecting parking fees through the platform. ParKada processes payments securely but is not liable for disputes between drivers and parking facilities."
    },
    {
      title: "7. Prohibited Conduct",
      content: "You may not: (a) use the platform for illegal activities; (b) share your account credentials; (c) manipulate occupancy data; (d) harass drivers or other admins; (e) attempt to bypass security measures; (f) violate any applicable laws or regulations."
    },
    {
      title: "8. Data Privacy and Compliance (RA 10173)",
      content: "As a manager, you will have access to personal information of drivers (e.g., name, email, phone, vehicle details). You must comply with the Data Privacy Act of 2012 (RA 10173). This means: (a) process data only for legitimate parking operations; (b) keep data secure and confidential; (c) do not share or sell data to third parties. Violation may result in criminal and civil liability."
    },
    {
      title: "9. Intellectual Property",
      content: "The ParKada name, logo, interface design, and all related trademarks are owned by the application developer. You may not copy, modify, or reverse‑engineer any part of the platform without written permission."
    },
    {
      title: "10. Account Suspension and Termination",
      content: "We reserve the right to suspend or terminate any admin account that violates these Terms, engages in fraudulent activity, or causes harm to the platform or its users. You may also request account deletion by contacting support."
    },
    {
      title: "11. Disclaimer of Warranties",
      content: "The service is provided 'as is' and 'as available' without warranties of merchantability, fitness for a particular purpose, or non‑infringement. We do not guarantee uninterrupted or error‑free operation."
    },
    {
      title: "12. Limitation of Liability",
      content: "To the fullest extent permitted by law, ParKada and its developers shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform, including loss of revenue or data."
    },
    {
      title: "13. Governing Law and Dispute Resolution",
      content: "These Terms are governed by the laws of the Republic of the Philippines. Any dispute arising from these Terms shall be resolved exclusively by the competent courts of Lipa City, Batangas."
    },
    {
      title: "14. Changes to Terms",
      content: "We may update these Terms from time to time. Continued use of the admin dashboard after changes constitutes your acceptance of the revised Terms. It is your responsibility to review this page periodically."
    },
    {
      title: "15. Contact Information",
      content: "For questions or concerns regarding these Terms, please contact the system administrator at support@parkada.com or through the help desk in the dashboard."
    }
  ];

  return (
    <div className="mobile-shell flex flex-col h-screen">
      {/* Hero Header with Back Button */}
      <div className="relative h-56 shrink-0 overflow-hidden">
        <img src={BG_IMG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-[oklch(0.18_0.06_255/0.85)] to-[oklch(0.18_0.06_255/0.95)]" />
        
        {/* Fixed Back Button - now goes to /set-password */}
        <button
          onClick={() => setLocation("/set-password")}
          className="absolute top-12 left-4 z-20 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="absolute bottom-6 left-6 right-6">
          <p className="text-white/70 text-xs font-medium uppercase tracking-wide mb-1">
            Legal Agreement
          </p>
          <h1 className="text-3xl font-extrabold text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Terms & Conditions
          </h1>
        </div>
      </div>

      {/* Content Card */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-6 px-6 pt-8 pb-10 overflow-y-auto shadow-inner">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck size={24} className="text-primary" />
          <p className="text-sm text-muted-foreground">
            Last updated: April 26, 2026
          </p>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          These Terms and Conditions govern your use of the ParKada Admin Dashboard and related services. 
          By accessing or using the platform as an administrator or parking manager, you agree to be bound by these terms.
        </p>

        <div className="space-y-3">
          {sections.map((section, idx) => {
            const isOpen = openSections[idx];
            return (
              <div key={idx} className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection(idx)}
                  className="w-full flex items-center justify-between p-4 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <span className="font-semibold text-foreground text-sm">{section.title}</span>
                  {isOpen ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
                </button>
                {isOpen && (
                  <div className="p-4 text-sm text-muted-foreground leading-relaxed border-t border-border bg-white">
                    {section.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © 2026 ParKada App. All rights reserved. | De La Salle Lipa • IT3C Group 9
          </p>
          <Button
            onClick={() => setLocation("/set-password")}
            variant="outline"
            className="mt-6 w-full max-w-xs mx-auto rounded-xl"
          >
            I Understand, Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}