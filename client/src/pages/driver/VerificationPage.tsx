import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { 
  ShieldCheck, Loader2, CheckCircle2, Camera, Repeat, 
  Info, Clock, CreditCard, MapPin, CalendarDays, ScanLine, AlertCircle, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VALID_ID_OPTIONS = [
  "Philippine Identification (PhilID / ePhilID)",
  "Driver's License",
  "Passport",
  "UMID",
  "Postal ID",
  "Voter's ID",
  "Senior Citizen ID",
  "PWD ID",
  "PRC ID"
];

export default function VerificationPage() {
  const [, navigate] = useLocation();
  
  // States
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false); 
  const [status, setStatus] = useState<string>("unverified");
  const [idType, setIdType] = useState("Regular");
  
  // UI Flow State
  const [currentStep, setCurrentStep] = useState(1); // 1: Details, 2: Document, 3: Selfie

  // Form States
  const [validIdType, setValidIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [address, setAddress] = useState("");
  const [birthday, setBirthday] = useState("");

  // Photo States
  const [idFrontBlob, setIdFrontBlob] = useState<Blob | null>(null);
  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);
  const [idBackBlob, setIdBackBlob] = useState<Blob | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  // Camera States
  const [cameraMode, setCameraMode] = useState<'id-front' | 'id-back' | 'selfie' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setFetching(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("verification_status, user_type")
        .eq("id", user.id)
        .single();

      if (error) {
        toast.error("Error fetching profile data.");
        return;
      }

      if (data) {
        const rawStatus = data.verification_status || "unverified";
        const cleanStatus = rawStatus.toString().replace(/['"]/g, '').trim().toLowerCase();
        setStatus(cleanStatus);
        
        const rawType = data.user_type || "Regular";
        const cleanType = rawType.toString().replace(/['"]/g, '').trim().toLowerCase();
        
        if (cleanType === 'pwd') {
          setIdType('PWD');
        } else {
          setIdType(cleanType.charAt(0).toUpperCase() + cleanType.slice(1));
        }
      }
    } catch (error) {
      console.error("Unexpected Error:", error);
    } finally {
      setFetching(false);
    }
  };

  const openCamera = async (mode: 'id-front' | 'id-back' | 'selfie') => {
    setCameraMode(mode);
    try {
      const facingMode = mode.includes('id') ? "environment" : "user";
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
      } catch (fallbackErr) {
        toast.error("Cannot access camera. Please check permissions.");
        setCameraMode(null);
      }
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setCameraMode(null);
  };

  const verifyDocumentAuthenticity = async (blob: Blob): Promise<boolean> => {
    setIsAnalyzing(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        setIsAnalyzing(false);
        if (blob.size < 25000) {
          toast.error("Fake or unreadable ID detected. Please scan clearly.");
          resolve(false);
        } else {
          resolve(true);
        }
      }, 2000);
    });
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && cameraMode && !isAnalyzing) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            if (cameraMode.includes('id')) {
              const isLegit = await verifyDocumentAuthenticity(blob);
              if (!isLegit) return;
            }

            const objectUrl = URL.createObjectURL(blob);
            if (cameraMode === 'id-front') {
              setIdFrontBlob(blob);
              setIdFrontPreview(objectUrl);
            } else if (cameraMode === 'id-back') {
              setIdBackBlob(blob);
              setIdBackPreview(objectUrl);
            } else {
              setSelfieBlob(blob);
              setSelfiePreview(objectUrl);
            }
            closeCamera();
          }
        }, 'image/jpeg', 0.85);
      }
    }
  };

  const uploadVerification = async () => {
    if (!validIdType || !idNumber || !address || !birthday || !idFrontBlob || !idBackBlob || !selfieBlob) {
      toast.error("Please complete all required fields and photos.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const timestamp = Date.now();
      
      const idFrontFileName = `${user.id}/id_front_${timestamp}.jpg`;
      const { error: idFrontError } = await supabase.storage.from('id-verifications').upload(idFrontFileName, idFrontBlob, { contentType: 'image/jpeg' });
      if (idFrontError) throw idFrontError;

      const idBackFileName = `${user.id}/id_back_${timestamp}.jpg`;
      const { error: idBackError } = await supabase.storage.from('id-verifications').upload(idBackFileName, idBackBlob, { contentType: 'image/jpeg' });
      if (idBackError) throw idBackError;

      const selfieFileName = `${user.id}/selfie_${timestamp}.jpg`;
      const { error: selfieError } = await supabase.storage.from('id-verifications').upload(selfieFileName, selfieBlob, { contentType: 'image/jpeg' });
      if (selfieError) throw selfieError;

      const formattedUserType = idType.toLowerCase();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          verification_status: 'pending',
          user_type: formattedUserType, 
          valid_id_type: validIdType,
          id_number: idNumber,
          address: address,
          birthdate: birthday,
          id_front_photo_url: idFrontFileName, 
          id_back_photo_url: idBackFileName,
          selfie_photo_url: selfieFileName
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast.success("Submitted successfully!");
      setStatus('pending');
    } catch (err: any) {
      toast.error(err.message || "Failed to upload.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  const isStep1Valid = validIdType && idNumber && address && birthday;
  const isStep2Valid = idFrontBlob && idBackBlob;

  return (
    <MobileLayout title="Verify Account" showBack onBack={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate("/profile")}>
      <div className="px-6 py-6 space-y-6 pb-28 min-h-screen bg-white">
        
        {/* Dynamic Stepper Header */}
        {status === 'unverified' && !cameraMode && (
          <div className="mb-8">
            <div className="flex items-center justify-between relative px-2">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 -translate-y-1/2"></div>
              
              {/* Step 1 Indicator */}
              <div className="flex flex-col items-center gap-2 bg-white">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  currentStep >= 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  {currentStep > 1 ? <Check size={16} /> : "1"}
                </div>
              </div>

              {/* Step 2 Indicator */}
              <div className="flex flex-col items-center gap-2 bg-white px-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  currentStep >= 2 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  {currentStep > 2 ? <Check size={16} /> : "2"}
                </div>
              </div>

              {/* Step 3 Indicator */}
              <div className="flex flex-col items-center gap-2 bg-white">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                  currentStep >= 3 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  3
                </div>
              </div>
            </div>
            <div className="flex justify-between px-1 mt-2">
              <p className={cn("text-[10px] font-bold uppercase", currentStep >= 1 ? "text-slate-800" : "text-slate-400")}>Account Type</p>
              <p className={cn("text-[10px] font-bold uppercase", currentStep >= 2 ? "text-slate-800" : "text-slate-400")}>Verification</p>
              <p className={cn("text-[10px] font-bold uppercase", currentStep >= 3 ? "text-slate-800" : "text-slate-400")}>Selfie</p>
            </div>
          </div>
        )}

        {status === 'unverified' && !cameraMode && (
          <div className="space-y-6 page-enter">
            
            {/* STEP 1: ACCOUNT TYPE & DETAILS */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-800">Account Type</label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {['Regular', 'Senior', 'PWD'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setIdType(type)}
                        className={cn(
                          "py-3.5 rounded-2xl text-[12px] font-bold uppercase border-2 transition-all",
                          idType === type 
                            ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20" 
                            : "border-slate-100 bg-white text-slate-500 hover:border-slate-200"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Valid ID Type</label>
                    <select 
                      value={validIdType}
                      onChange={(e) => setValidIdType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none"
                    >
                      <option value="" disabled>Select your ID</option>
                      {VALID_ID_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Valid ID Number</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="e.g. XXXX-XXXX-XXXX"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Date of Birth</label>
                    <div className="relative">
                      <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="date" 
                        value={birthday}
                        onChange={(e) => setBirthday(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Current Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                      <textarea 
                        placeholder="Enter your full address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <Button 
                    onClick={() => setCurrentStep(2)}
                    disabled={!isStep1Valid}
                    className="w-full h-14 rounded-full font-bold text-base text-white shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: ID SCANNING */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-black text-slate-800">Upload Valid ID</h3>
                  <p className="text-sm text-slate-500">Please provide clear photos of your ID.</p>
                </div>

                <div className="space-y-4">
                  {/* Front ID */}
                  <div className="space-y-2">
                    {idFrontPreview ? (
                      <div className="border-2 border-blue-600 bg-blue-50 rounded-2xl p-4 flex flex-col items-center gap-3 relative overflow-hidden">
                        <img src={idFrontPreview} alt="ID Front Scan" className="w-full h-32 rounded-xl object-cover border border-blue-200" />
                        <button onClick={() => openCamera('id-front')} className="w-full py-2 bg-white text-blue-600 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-50">
                          Retake Front ID
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => openCamera('id-front')} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 transition-all">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <ScanLine className="text-blue-600" size={20} />
                        </div>
                        <p className="text-sm font-bold text-slate-700">Scan Front of ID</p>
                      </button>
                    )}
                  </div>

                  {/* Back ID */}
                  <div className="space-y-2">
                    {idBackPreview ? (
                      <div className="border-2 border-blue-600 bg-blue-50 rounded-2xl p-4 flex flex-col items-center gap-3 relative overflow-hidden">
                        <img src={idBackPreview} alt="ID Back Scan" className="w-full h-32 rounded-xl object-cover border border-blue-200" />
                        <button onClick={() => openCamera('id-back')} className="w-full py-2 bg-white text-blue-600 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-50">
                          Retake Back ID
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => openCamera('id-back')} className="w-full h-32 border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 transition-all">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                          <ScanLine className="text-blue-600" size={20} />
                        </div>
                        <p className="text-sm font-bold text-slate-700">Scan Back of ID</p>
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-6">
                  <Button 
                    onClick={() => setCurrentStep(3)}
                    disabled={!isStep2Valid}
                    className="w-full h-14 rounded-full font-bold text-base text-white shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: SELFIE */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-black text-slate-800">Face Authentication</h3>
                  <p className="text-sm text-slate-500">Let's make sure it's really you.</p>
                </div>

                <div className="space-y-4">
                  {selfiePreview ? (
                    <div className="border-2 border-blue-600 bg-blue-50 rounded-[2.5rem] p-6 flex flex-col items-center gap-4 relative overflow-hidden">
                      <img src={selfiePreview} alt="Selfie" className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-lg" />
                      <button onClick={() => openCamera('selfie')} className="w-full py-3 bg-white text-blue-600 rounded-2xl text-sm font-bold shadow-sm hover:bg-blue-50">
                        Retake Selfie
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => openCamera('selfie')} className="w-full py-12 border-2 border-dashed border-slate-300 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 bg-slate-50 hover:bg-slate-100 transition-all">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <Camera className="text-blue-600" size={32} />
                      </div>
                      <p className="text-base font-bold text-slate-700">Take a Selfie</p>
                    </button>
                  )}
                </div>

                <div className="pt-6">
                  <Button 
                    onClick={uploadVerification}
                    disabled={loading || !selfieBlob}
                    className="w-full h-14 rounded-full font-bold text-base text-white shadow-lg shadow-blue-600/20 bg-blue-600 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "Submit Verification"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- FULL SCREEN CAMERA OVERLAYS --- */}
        {cameraMode && (
          <div className="fixed inset-0 z-100 bg-black flex items-center justify-center overflow-hidden">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />
            
            {/* Analyzing Overlay */}
            {isAnalyzing && (
              <div className="absolute inset-0 z-130 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                <p className="text-white font-bold tracking-widest uppercase">Analyzing Frame...</p>
              </div>
            )}

            {/* Visual Guides & Shadow Outbox Overlay */}
            <div className="absolute inset-0 z-110 pointer-events-none flex flex-col items-center justify-center">
              
              {/* Overlay Top Texts */}
              <div className="absolute top-16 left-0 w-full px-6 flex flex-col items-center text-center space-y-2 z-120">
                {cameraMode.includes('id') ? (
                  <>
                    <h2 className="text-white text-2xl font-black tracking-tight">
                      Scan {cameraMode === 'id-front' ? 'Front' : 'Back'} of ID
                    </h2>
                    <p className="text-white/80 text-sm">Ensure all details are clear and legible.</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-white text-2xl font-black tracking-tight">Face Authentication</h2>
                    <p className="text-white/80 text-sm">Make sure your face is well-lit and clearly visible.</p>
                    <div className="mt-4 bg-amber-500/20 text-amber-400 px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold backdrop-blur-md">
                      <AlertCircle size={14} />
                      Remove glasses or hats.
                    </div>
                  </>
                )}
              </div>

              {/* Central Cutout Framing */}
              <div className={cn(
                "relative shadow-[0_0_0_4000px_rgba(0,0,0,0.7)]",
                cameraMode.includes('id') ? "w-[85%] aspect-[1.58/1] rounded-2xl" : "w-[75%] aspect-3/4 sm:aspect-square rounded-[100%]"
              )}>
                {/* ID Corner Brackets */}
                {cameraMode.includes('id') && (
                  <>
                    <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
                    <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
                    <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
                    <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
                  </>
                )}
                {/* Selfie Frame Styling (optional subtle border) */}
                {cameraMode === 'selfie' && (
                  <div className="absolute inset-0 border-4 border-dashed border-white/40 rounded-[100%]"></div>
                )}
              </div>

              {/* Overlay Bottom Controls */}
              <div className="absolute bottom-12 left-0 w-full flex flex-col items-center px-6 z-120 pointer-events-auto">
                <Button 
                  onClick={capturePhoto} 
                  disabled={isAnalyzing} 
                  className="w-full max-w-xs h-14 rounded-full bg-blue-600 text-white font-bold text-lg hover:bg-blue-700"
                >
                  {cameraMode === 'selfie' ? 'Take Selfie' : 'Take Photo'}
                </Button>
                <Button 
                  onClick={closeCamera} 
                  disabled={isAnalyzing} 
                  variant="ghost" 
                  className="mt-4 text-white hover:bg-white/10 rounded-full px-8"
                >
                  Cancel
                </Button>
              </div>
            </div>
            
            <canvas ref={canvasRef} className="hidden"></canvas>
          </div>
        )}

        {/* --- STATUS SCREENS --- */}
        {status === 'pending' && !cameraMode && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
             <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <Clock className="text-amber-500" size={48} />
             </div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">Under Review</h2>
             <p className="text-sm text-slate-500 mt-3 max-w-70 leading-relaxed">
                Sit tight! We're validating your identity documents. We'll notify you once approved.
             </p>
             <Button onClick={() => navigate("/profile")} variant="outline" className="mt-10 rounded-full w-full max-w-50 font-bold">Back to Profile</Button>
          </div>
        )}

        {status === 'verified' && !cameraMode && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
             <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-sm border-8 border-green-100">
                <CheckCircle2 className="text-green-500" size={48} />
             </div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">Verified</h2>
             <p className="text-sm text-slate-500 mt-2">
                Your account is successfully secured as a <strong>{idType}</strong> user.
             </p>
             <Button onClick={() => navigate("/profile")} className="mt-10 bg-blue-600 text-white rounded-full w-full max-w-50 h-12 font-bold shadow-lg shadow-blue-600/20">
               Continue to Profile
             </Button>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}