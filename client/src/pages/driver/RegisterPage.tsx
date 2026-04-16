/*
 * iParkBayan — RegisterPage (Connected to Supabase)
 * Multi-step registration: Personal -> Vehicle -> OTP Verification -> Success
 * Constrained to Mobile View with Strict Validations.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, CheckCircle2, ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";

// Allowed 4-Wheel Car Brands in the Philippines
const ALLOWED_CAR_BRANDS = [
  "Toyota", "Mitsubishi", "Ford", "Nissan", "Honda", "Hyundai", 
  "Kia", "Isuzu", "Suzuki", "Chevrolet", "Mazda", "Geely", 
  "MG", "Changan", "GAC", "BYD", "Subaru", "Others"
];

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  // View State for Terms & Conditions
  const [showTerms, setShowTerms] = useState(false);

  // Step 1: Personal Info
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 2: Vehicle Info & Terms
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [agreeTc, setAgreeTc] = useState(false);

  // Step 3: OTP Verification & Limits
  const [otpCode, setOtpCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<number | null>(null);

  // Timer Effect for OTP Resend Cooldown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Check if email or phone already exists in profiles
  const checkExistingUser = async () => {
    const { data: existingUser, error } = await supabase
      .from("profiles")
      .select("email, phone_number")
      .or(`email.eq.${email},phone_number.eq.${phoneNumber}`);

    if (error) throw error;
    
    if (existingUser && existingUser.length > 0) {
      const emailExists = existingUser.some(user => user.email === email);
      const phoneExists = existingUser.some(user => user.phone_number === phoneNumber);
      
      if (emailExists && phoneExists) {
        throw new Error("Both email and phone number are already registered.");
      } else if (emailExists) {
        throw new Error("Email is already registered. Please use a different email.");
      } else if (phoneExists) {
        throw new Error("Phone number is already registered. Please use a different number.");
      }
    }
    
    return false;
  };

  const handleNextStep = async () => {
    if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
      toast.error("Please fill in all personal details.");
      return;
    }

    const phoneRegex = /^[0-9]{11}$/;
    if (!phoneRegex.test(phoneNumber)) {
      toast.error("Contact number must be exactly 11 digits.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address.");
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

    setLoading(true);
    try {
      // Check if email or phone already exists in database
      await checkExistingUser();
      setStep(2);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!plateNumber || !vehicleBrand || !vehicleModel || !vehicleColor) {
      toast.error("Please fill in all vehicle details.");
      return;
    }

    // Strict LTO Plate Validation
    const plateRegex = /^[A-Z]{3}[\s-]?[0-9]{3,4}$/i;
    if (!plateRegex.test(plateNumber.trim())) {
      toast.error("Invalid Plate Number. Must be LTO standard (e.g., ABC 123 or ABC 1234).");
      return;
    }

    if (!agreeTc) {
      toast.error("Please agree to the Terms & Conditions and Privacy Policy.");
      return;
    }

    setLoading(true);
    try {
      // Double-check if user exists before sending OTP
      await checkExistingUser();
      
      // Create User in Supabase Auth
      const { error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
          }
        }
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          toast.info("Account already exists. Sending you to OTP verification.");
          await handleResendOtp(true);
          setStep(3);
          return;
        }
        throw authError;
      }

      toast.success("Verification code sent to your email!");
      setStep(3);
    } catch (error: any) {
      toast.error(error.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (isSilent = false) => {
    if (countdown > 0 && !isSilent) {
      toast.info(`Please wait before requesting a new code.`);
      return;
    }
    
    if (!isSilent) setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      
      if (!isSilent) {
        setCountdown(120);
        toast.success("New verification code sent!");
      }
    } catch (error: any) {
      if (!isSilent) toast.error("Failed to resend code. Please wait a moment.");
    } finally {
      if (!isSilent) setResending(false);
    }
  };

  const handleVerifyOtpAndSave = async () => {
    // Check if user is locked out
    if (lockoutTime && Date.now() < lockoutTime) {
      const remainingMins = Math.ceil((lockoutTime - Date.now()) / 60000);
      toast.error(`Too many attempts. Please try again in ${remainingMins} minutes.`);
      return;
    }

    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      // 1. Verify OTP
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup'
      });

      if (verifyError) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= 5) {
          setLockoutTime(Date.now() + 15 * 60 * 1000);
          throw new Error("Maximum attempts reached. Locked for 15 minutes.");
        }
        
        throw new Error(`Invalid code. ${5 - newAttempts} attempts remaining.`);
      }

      // Reset attempts upon success
      setAttempts(0);

      const userId = verifyData.user?.id;
      if (!userId) throw new Error("Verification failed. User ID not found.");

      // Final check: Ensure email/phone aren't already in profiles (race condition check)
      const { data: existingCheck, error: checkError } = await supabase
        .from("profiles")
        .select("email, phone_number")
        .or(`email.eq.${email},phone_number.eq.${phoneNumber}`);

      if (existingCheck && existingCheck.length > 0) {
        const emailExists = existingCheck.some(user => user.email === email);
        const phoneExists = existingCheck.some(user => user.phone_number === phoneNumber);
        
        if (emailExists && phoneExists) {
          throw new Error("Both email and phone number are already registered.");
        } else if (emailExists) {
          throw new Error("Email is already registered.");
        } else if (phoneExists) {
          throw new Error("Phone number is already registered.");
        }
      }

      // Combine Brand and Model for database storage
      const fullVehicleModel = `${vehicleBrand} ${vehicleModel}`;

      // 2. Insert into profiles
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: userId,
          email: email,
          full_name: fullName,
          phone_number: phoneNumber,
          plate_number: plateNumber.toUpperCase(),
          vehicle_model: fullVehicleModel,
          vehicle_color: vehicleColor,
          role: "driver",
          verification_status: "unverified" 
        }
      ]);
      
      if (profileError) {
        // Handle unique constraint violations
        if (profileError.code === '23505') { // PostgreSQL unique violation code
          if (profileError.message.includes("email")) {
            throw new Error("Email is already registered.");
          } else if (profileError.message.includes("phone_number")) {
            throw new Error("Phone number is already registered.");
          } else {
            throw new Error("Account already exists with this email or phone number.");
          }
        }
        throw new Error("Failed to save profile details.");
      }

      // 3. Insert into 'vehicles' table
      const { error: vehicleError } = await supabase.from("vehicles").insert([
        {
          user_id: userId,
          plate: plateNumber.toUpperCase(),
          model: fullVehicleModel,
          color: vehicleColor,
          is_default: true
        }
      ]);

      if (vehicleError) {
        console.error("Vehicle insert error:", vehicleError);
        // Don't throw here, user can add vehicle later
        toast.warning("Profile created, but there was an issue saving vehicle details. You can add it later.");
      }

      setStep(4);

    } catch (error: any) {
      toast.error(error.message || "Invalid or expired code.");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  };

  // Check Lockout Status for Rendering
  const isLocked = lockoutTime !== null && Date.now() < lockoutTime;
  const lockoutRemaining = isLocked ? Math.ceil((lockoutTime - Date.now()) / 60000) : 0;

  // --- TERMS & CONDITIONS FULL-SCREEN VIEW ---
  if (showTerms) {
    return (
      <div className="bg-slate-50 min-h-screen flex justify-center">
        <div className="w-full max-w-md bg-white min-h-screen flex flex-col relative shadow-xl">
          
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-4 flex items-center gap-3">
            <button 
              onClick={() => setShowTerms(false)}
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

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>1. Vehicle Eligibility</h2>
              <p className="text-sm leading-relaxed">Our parking reservation services are <strong>strictly limited to four-wheeled vehicles only</strong> (e.g., Sedans, SUVs, Vans).</p>
              <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                <li>Motorcycles and tricycles are NOT allowed.</li>
                <li>Large commercial trucks are NOT permitted unless explicitly stated by the operator.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>2. Account Limitations</h2>
              <p className="text-sm leading-relaxed">To ensure fairness and avoid hoarding of parking slots, users are <strong>strictly allowed one (1) account per email address and phone number</strong>. Newly registered accounts are placed in "Unverified" status.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>3. Strict No-Refund Policy</h2>
              <p className="text-sm leading-relaxed">To ensure fairness to parking operators, <strong>all reservations made through the app are strictly non-refundable</strong>.</p>
              <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                <li>Late arrivals hold the slot only up to the grace period.</li>
                <li>In the event of a no-show, the payment is forfeited entirely.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>4. Data Privacy & Verification</h2>
              <p className="text-sm leading-relaxed">In compliance with the Data Privacy Act of 2012, we collect your personal information strictly for identity verification and platform security.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-slate-900 mb-2" style={{ color: "oklch(0.22 0.07 255)" }}>5. Liability & Termination</h2>
              <p className="text-sm leading-relaxed mb-3">You agree to park at your own risk. The app developers and parking operators are not liable for theft or damage to your vehicle.</p>
              <p className="text-sm leading-relaxed">We reserve the right to ban users who submit fake IDs or repeatedly abandon reservations.</p>
            </section>

            <div className="pt-8 pb-4 text-center">
              <p className="text-xs text-slate-400">© 2026 Parkada. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- STEP 4: SUCCESS SCREEN ---
  if (step === 4) {
    return (
      <div className="bg-slate-100 min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md min-h-screen sm:min-h-0 sm:h-[850px] bg-white flex flex-col items-center justify-center p-6 text-center sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-extrabold mb-2 text-slate-900" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Account Created!
          </h2>
          <p className="text-slate-500 text-sm mb-2 px-4 leading-relaxed">
            Welcome to Parkada. Your account is currently under <strong className="text-amber-500">Unverified (Basic) Status</strong>.
          </p>
          <p className="text-slate-500 text-sm mb-8 px-4 leading-relaxed">
            You can verify your account later in the app settings to unlock full features.
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

  // --- STEPS 1, 2 & 3: FORM REGISTRATION ---
  return (
    <div className="bg-slate-100 min-h-screen flex items-center justify-center sm:py-8">
      <div className="w-full max-w-md min-h-screen sm:min-h-0 sm:h-[850px] bg-white flex flex-col sm:rounded-[2.5rem] sm:shadow-2xl overflow-hidden relative">
        
        {/* Header Area */}
        <div 
          className="w-full text-white px-6 pt-12 pb-8 rounded-b-[2rem] shadow-lg relative shrink-0"
          style={{ background: "oklch(0.22 0.07 255)" }}
        >
          <button 
            onClick={() => {
              if (step === 3) setStep(2);
              else if (step === 2) setStep(1);
              else navigate("/");
            }}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center mb-6 transition-colors backdrop-blur-sm"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          
          <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">
            Step {step} of 3 — {step === 1 ? "Personal Info" : step === 2 ? "Vehicle Details" : "Verify Email"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight mb-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {step === 1 ? "Create Account" : step === 2 ? "Add Your Vehicle" : "Enter OTP Code"}
          </h1>
          
          <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-amber-400 h-full rounded-full transition-all duration-300 ease-in-out" 
              style={{ width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' }}
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
                  disabled={loading}
                  className="w-full h-14 text-base font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-white disabled:opacity-70"
                  style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "Continue"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: VEHICLE DETAILS */}
          {step === 2 && (
            <div className="space-y-4 flex-1">
              <p className="text-sm text-slate-500 mb-4">Register your 4-wheel vehicle for verification. Strictly no motorcycles allowed.</p>
              
              <div>
                <label className="text-sm font-bold text-slate-800 mb-1.5 block">Plate Number</label>
                <input
                  type="text"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="ABC 1234"
                  className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm uppercase focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">Must match LTO standard (e.g. ABC 123 or ABC 1234).</p>
              </div>

              <div className="flex gap-3">
                <div className="w-1/2">
                  <label className="text-sm font-bold text-slate-800 mb-1.5 block">Car Brand</label>
                  <select 
                    value={vehicleBrand} 
                    onChange={(e) => setVehicleBrand(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none appearance-none"
                  >
                    <option value="" disabled>Select Brand</option>
                    {ALLOWED_CAR_BRANDS.map(brand => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>

                <div className="w-1/2">
                  <label className="text-sm font-bold text-slate-800 mb-1.5 block">Specific Model</label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. Vios"
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] outline-none transition-all"
                    disabled={!vehicleBrand}
                  />
                </div>
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

              {/* T&C Checkbox Section */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreeTc}
                  onChange={(e) => setAgreeTc(e.target.checked)}
                  className="mt-0.5 w-4 h-4 shrink-0 rounded border-slate-300 focus:ring-2 focus:ring-[oklch(0.22_0.07_255)] accent-[oklch(0.22_0.07_255)]"
                />
                <label htmlFor="terms" className="text-xs text-slate-600 leading-snug">
                  I agree to the{" "}
                  <span 
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTerms(true);
                    }}
                    className="font-bold cursor-pointer hover:underline" 
                    style={{ color: "oklch(0.22 0.07 255)" }}
                  >
                    Terms & Conditions
                  </span>{" "}
                  and{" "}
                  <span 
                    onClick={(e) => {
                      e.preventDefault();
                      setShowTerms(true); 
                    }}
                    className="font-bold cursor-pointer hover:underline" 
                    style={{ color: "oklch(0.22 0.07 255)" }}
                  >
                    Privacy Policy
                  </span>
                  . I acknowledge that reservations are strictly <strong>non-refundable</strong> and only accept <strong>four-wheeled vehicles</strong>.
                </label>
              </div>

              <div className="pt-4 pb-2">
                <Button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full h-14 text-base font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-white disabled:opacity-70"
                  style={{ background: "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : "Send Code"}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: OTP VERIFICATION */}
          {step === 3 && (
            <div className="space-y-6 flex-1 flex flex-col items-center justify-center text-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Check your email</h3>
                <p className="text-sm text-slate-500">We've sent a 6-digit verification code to<br/><strong className="text-slate-800">{email}</strong></p>
              </div>
              
              {/* OTP UI BOXES */}
              <div className="relative w-full max-w-[280px] mx-auto">
                <div className="flex justify-between gap-2">
                  {[0, 1, 2, 3, 4, 5].map((index) => {
                    const char = otpCode[index];
                    return (
                      <div 
                        key={index} 
                        className={`w-10 h-14 flex items-center justify-center text-2xl font-bold rounded-xl border-2 transition-all 
                          ${otpCode.length === index && !isLocked ? 'border-[oklch(0.22_0.07_255)] shadow-sm' : 'border-slate-200'}
                          ${char ? 'bg-white text-slate-900' : 'bg-slate-50 text-slate-400'}
                          ${isLocked ? 'opacity-50' : ''}
                        `}
                      >
                        {char ? char : "•"}
                      </div>
                    );
                  })}
                </div>
                {/* Hidden Input field for mobile keyboard */}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                  disabled={isLocked || loading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10 disabled:cursor-not-allowed"
                />
              </div>

              {/* Status/Error Text For Lockout */}
              {isLocked && (
                <p className="text-sm font-bold text-red-500 bg-red-50 p-3 rounded-lg w-full">
                  Locked out. Try again in {lockoutRemaining} min{lockoutRemaining > 1 ? 's' : ''}.
                </p>
              )}

              <div className="w-full pt-4 space-y-4">
                <Button 
                  onClick={handleVerifyOtpAndSave} 
                  disabled={loading || otpCode.length !== 6 || isLocked} 
                  className="w-full h-14 text-base font-bold rounded-xl shadow-lg text-white disabled:opacity-70 transition-transform active:scale-95" 
                  style={{ background: isLocked ? "#94a3b8" : "oklch(0.22 0.07 255)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : isLocked ? `Locked (${lockoutRemaining}m)` : "Verify & Create Account"}
                </Button>

                {/* RESEND OTP BUTTON W/ TIMER */}
                <button
                  onClick={() => handleResendOtp(false)}
                  disabled={resending || countdown > 0 || isLocked}
                  className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
                >
                  {countdown > 0 ? (
                    `Resend code in ${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`
                  ) : resending ? (
                    <><Loader2 className="animate-spin" size={16} /> Resending...</>
                  ) : (
                    <><RefreshCcw size={16} /> Didn't receive the code? Resend</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Login Link - Show only on step 1 & 2 */}
          {(step === 1 || step === 2) && (
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
          )}

        </div>
      </div>
    </div>
  );
}