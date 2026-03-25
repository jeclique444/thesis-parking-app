/*
 * iParkBayan — RegisterPage (Connected to Supabase)
 * Multi-step registration. Saves to Auth, 'profiles' table, AND 'vehicles' table.
 * Constrained to Mobile View with Strict Validations.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Personal Info
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Vehicle Info
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  const handleNextStep = () => {
    if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
      toast.error("Please fill in all personal details.");
      return;
    }

    const phoneRegex = /^[0-9]{11}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast.error("Contact number must be exactly 11 digits.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setStep(2);
  };

  const handleCompleteRegistration = async () => {
    if (!plateNumber || !vehicleModel || !vehicleColor) {
      toast.error("Please fill in all vehicle details.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create User in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      if (authData.user) {
        const userId = authData.user.id;

        // 2. Insert into 'profiles' table
        const { error: profileError } = await supabase.from("profiles").insert([
          {
            id: userId,
            email: email,
            full_name: fullName,
            phone_number: phoneNumber,
            // Nilagay ko pa rin ang vehicle info dito dahil nasa columns mo ito sa profile screenshot,
            // pero safe na rin na nasa hiwalay na table siya.
            plate_number: plateNumber.toUpperCase(),
            vehicle_model: vehicleModel,
            vehicle_color: vehicleColor,
            role: "driver"
          }
        ]);
        
        if (profileError) {
          console.error("Profile insert error:", profileError);
          throw new Error("Failed to save profile details.");
        }

        // 3. Insert into 'vehicles' table
        const { error: vehicleError } = await supabase.from("vehicles").insert([
          {
            user_id: userId,
            plate: plateNumber.toUpperCase(),
            model: vehicleModel,
            color: vehicleColor,
            is_default: true
          }
        ]);

        if (vehicleError) {
          console.error("Vehicle insert error:", vehicleError);
          // Hindi natin in-i-stop ang registration dito kasi successful na ang account creation,
          // pero magandang naka-log para makita kung may mali sa vehicles table setup mo.
        }
      }

      // Proceed to Success Screen (Step 3)
      setStep(3);

    } catch (error: any) {
      toast.error(error.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 3: SUCCESS SCREEN ---
  if (step === 3) {
    return (
      <div className="bg-slate-100 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md min-h-screen sm:min-h-0 sm:h-[850px] bg-white flex flex-col items-center justify-center p-6 text-center sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-extrabold mb-2 text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Account Created!
          </h2>
          <p className="text-slate-500 text-sm mb-8 px-4 leading-relaxed">
            Welcome to iParkBayan. You can now find and reserve parking slots in Lipa City Downtown.
          </p>
          <Button
            onClick={() => navigate("/login")}
            className="w-full h-14 text-base font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-white"
            style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Start Parking
          </Button>
        </div>
      </div>
    );
  }

  // --- STEPS 1 & 2: FORM REGISTRATION ---
  return (
    <div className="bg-slate-100 min-h-screen flex items-center justify-center sm:py-8">
      {/* Mobile Container wrapper */}
      <div className="w-full max-w-md min-h-screen sm:min-h-0 sm:h-[850px] bg-white flex flex-col sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden relative">
        
        {/* Header Area */}
        <div 
          className="w-full text-white px-6 pt-12 pb-8 rounded-b-[2rem] shadow-lg relative shrink-0"
          style={{ background: "oklch(0.22 0.07 255)" }}
        >
          <button 
            onClick={() => step === 2 ? setStep(1) : navigate("/")}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center mb-6 transition-colors backdrop-blur-sm"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          
          <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">
            Step {step} of 2 — {step === 1 ? "Personal Info" : "Vehicle Details"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {step === 1 ? "Create Account" : "Add Your Vehicle"}
          </h1>
          
          {/* Progress Bar */}
          <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-amber-400 h-full rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: step === 1 ? '50%' : '100%' }}
            ></div>
          </div>
        </div>

        {/* Form Content */}
        <div className="px-6 py-6 flex-1 flex flex-col overflow-y-auto">
          
          {/* STEP 1: PERSONAL INFO */}
          {step === 1 && (
            <div className="space-y-4 flex-1">
              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan dela Cruz"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@example.com"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Contact Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    const onlyNumbers = e.target.value.replace(/[^0-9]/g, '');
                    if (onlyNumbers.length <= 11) {
                      setPhoneNumber(onlyNumbers);
                    }
                  }}
                  placeholder="09XXXXXXXXX"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full h-12 pl-4 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type your password"
                    className="w-full h-12 pl-4 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-4 pb-2">
                <Button
                  onClick={handleNextStep}
                  className="w-full h-14 text-base font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-white"
                  style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: VEHICLE DETAILS */}
          {step === 2 && (
            <div className="space-y-4 flex-1">
              <p className="text-sm text-slate-500 mb-4">Register your vehicle for parking verification.</p>
              
              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Plate Number</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="ABC 1234"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm uppercase focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Vehicle Model</label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g. Toyota Vios"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Vehicle Color</label>
                <input
                  type="text"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  placeholder="e.g. White"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                />
              </div>

              <div className="pt-4 pb-2">
                <Button
                  onClick={handleCompleteRegistration}
                  disabled={loading}
                  className="w-full h-14 text-base font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-white"
                  style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "Create Account"}
                </Button>
              </div>
            </div>
          )}

          {/* Login Link */}
          <div className="mt-auto pt-6 pb-4 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <button 
                onClick={() => navigate("/login")} 
                className="font-bold hover:underline"
                style={{ color: "oklch(0.22 0.07 255)" }}
              >
                Sign In
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}