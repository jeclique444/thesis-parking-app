/*
 * iParkBayan — Terms and Conditions Page
 * Clean, GCash-like UI: Mobile-optimized, sticky header, readable typography.
 */
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  const [, navigate] = useLocation();

  return (
    <div className="bg-slate-50 min-h-screen flex justify-center">
      {/* Mobile Container */}
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-xl">
        
        {/* Sticky Header - GCash Style */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3">
          <button 
            onClick={() => window.history.back()} // Goes back to previous page (Register or Settings)
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-800" />
          </button>
          <h1 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Terms & Privacy Policy
          </h1>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto pb-20 text-slate-700 space-y-6">
          
          <div className="mb-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Last Updated</p>
            <p className="text-sm font-medium">April 2026</p>
          </div>

          <p className="text-sm leading-relaxed">
            Welcome to Parkada! By using our application, you agree to comply with and be bound by the following terms and conditions. Please review them carefully.
          </p>

          <hr className="border-slate-100" />

          {/* Section 1: Vehicle Eligibility */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              1. Vehicle Eligibility
            </h2>
            <p className="text-sm leading-relaxed">
              Our parking reservation services are <strong>strictly limited to four-wheeled vehicles only</strong> (e.g., Sedans, SUVs, Vans). 
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
              <li>Motorcycles and tricycles are NOT allowed.</li>
              <li>Large commercial trucks (e.g., 10-wheelers, delivery trucks) are NOT permitted unless explicitly stated by the parking operator.</li>
            </ul>
          </section>

          {/* Section 2: Reservation & No Refund Policy */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              2. Strict No-Refund Policy
            </h2>
            <p className="text-sm leading-relaxed">
              To ensure fairness to parking operators and other drivers, <strong>all reservations made through the app are strictly non-refundable</strong>.
            </p>
            <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
              <li>If you arrive late, your slot will be held only up to the grace period defined by the parking operator.</li>
              <li>In the event of a no-show, the payment is forfeited entirely.</li>
            </ul>
          </section>

          {/* Section 3: Identity Verification & Privacy */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              3. Data Privacy & Verification
            </h2>
            <p className="text-sm leading-relaxed">
              In compliance with the Data Privacy Act of 2012, we collect your personal information, including your Valid ID and facial biometrics (selfie), strictly for identity verification and platform security.
            </p>
            <p className="text-sm leading-relaxed mt-2">
              We do not sell your data. Your verified status ensures accountability in case of property damage or abandoned vehicles within the parking premises.
            </p>
          </section>

          {/* Section 4: Liability */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              4. Vehicle & Property Liability
            </h2>
            <p className="text-sm leading-relaxed">
              You agree to park at your own risk. The app developers and the parking lot operators are <strong>not liable for any theft, loss, or damage</strong> to your vehicle or personal belongings left inside the vehicle while using the reserved parking space.
            </p>
          </section>

          {/* Section 5: Account Termination */}
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>
              5. Account Termination
            </h2>
            <p className="text-sm leading-relaxed">
              We reserve the right to suspend or ban users who submit fake identification, repeatedly abandon reservations, or violate the rules of the parking operators.
            </p>
          </section>

          <div className="pt-8 pb-4 text-center">
            <p className="text-xs text-slate-400">© 2026 Parkada. All rights reserved.</p>
          </div>

        </div>
      </div>
    </div>
  );
}