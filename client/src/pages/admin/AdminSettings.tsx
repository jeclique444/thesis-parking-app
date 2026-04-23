/*
 * iParkBayan — AdminSettings (Global System Configuration)
 * Design: Civic Tech / LGU Ordinance Controls
 */
import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Banknote, Clock, Percent, Save, Landmark, 
  BadgePercent, Gavel, CalendarClock, CreditCard, 
  Eye, EyeOff, ShieldAlert
} from "lucide-react";

export default function AdminSettings() {
  const [isSaving, setIsSaving] = useState(false);
  
  // 1. Global Rates
  const [baseRate, setBaseRate] = useState("50");
  const [hourlyRate, setHourlyRate] = useState("20");
  const [gracePeriod, setGracePeriod] = useState("15");
  
  // 2. Taxes / LGU Share
  const [lguShare, setLguShare] = useState("10");
  const [taxRate, setTaxRate] = useState("12");

  // 3. Statutory & Eco Discounts
  const [seniorDiscount, setSeniorDiscount] = useState("20");
  const [pwdDiscount, setPwdDiscount] = useState("20");
  const [evPromo, setEvPromo] = useState("100");

  // 4. Violations & Penalties
  const [overnightFee, setOvernightFee] = useState("500");
  const [lostTicketFee, setLostTicketFee] = useState("300");

  // 5. Booking Rules
  const [maxAdvanceDays, setMaxAdvanceDays] = useState("7");
  const [noShowMinutes, setNoShowMinutes] = useState("30");

  // 6. Payment API (Mock for Enterprise feel)
  const [merchantId, setMerchantId] = useState("LGU-IPARK-00192");
  const [showKey, setShowKey] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Dito papasok yung Supabase update logc mo in the future
      await new Promise(resolve => setTimeout(resolve, 1500)); // Fake loading
      toast.success("City Ordinance Rates & System Settings Updated Globally!");
    } catch (error: any) {
      toast.error(`Error saving settings: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout title="System Configurations">
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        
        {/* Header Alert for Super Admin */}
        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl flex items-start gap-4">
          <div className="bg-amber-500/20 p-2 rounded-full shrink-0">
            <Landmark className="text-amber-600" size={24} />
          </div>
          <div>
            <h4 className="text-amber-800 font-black text-sm uppercase tracking-wider">City Ordinance Configuration Panel</h4>
            <p className="text-amber-700/80 text-xs font-medium mt-1 leading-relaxed max-w-3xl">
              Changes made here will affect the pricing, enforcement algorithms, and revenue computations across ALL ParKada branches globally. Ensure changes align with the latest Local Government Unit (LGU) and Republic Act mandates.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ========================================= */}
            {/* COLUMN 1: FINANCIALS & REVENUE            */}
            {/* ========================================= */}
            <div className="space-y-6">
              
              {/* 1. PRICING & RATES */}
              <div className="bg-white rounded-[24px] shadow-sm border border-border p-6 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-emerald-500/10 p-2 rounded-xl text-emerald-600">
                    <Banknote size={20} />
                  </div>
                  <h3 className="font-bold text-lg">Standard Parking Rates</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Base Rate (1st 3 Hrs)</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₱</span>
                      <Input type="number" className="h-12 rounded-xl text-lg font-bold pl-8" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hourly Succeeding</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₱</span>
                      <Input type="number" className="h-12 rounded-xl text-lg font-bold pl-8" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} required />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. STATUTORY DISCOUNTS */}
              <div className="bg-white rounded-[24px] shadow-sm border border-border p-6 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-blue-500/10 p-2 rounded-xl text-blue-600">
                    <BadgePercent size={20} />
                  </div>
                  <h3 className="font-bold text-lg">Statutory Discounts</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold">Senior Citizen & PWD</p>
                      <p className="text-[10px] text-muted-foreground">Mandated by R.A. 9994 & R.A. 10754</p>
                    </div>
                    <div className="relative w-24">
                      <Input type="number" className="h-10 rounded-xl font-bold pr-8 text-right" value={seniorDiscount} onChange={(e) => setSeniorDiscount(e.target.value)} readOnly />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <p className="text-sm font-bold text-emerald-600">E-Vehicle (EV) Incentive</p>
                      <p className="text-[10px] text-muted-foreground">Discount on first hour for Green Plates</p>
                    </div>
                    <div className="relative w-24">
                      <Input type="number" className="h-10 rounded-xl font-bold pr-8 text-right border-emerald-200" value={evPromo} onChange={(e) => setEvPromo(e.target.value)} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. TAX & LGU SHARE */}
              <div className="bg-white rounded-[24px] shadow-sm border border-border p-6 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-slate-900 p-2 rounded-xl text-white">
                    <Percent size={20} />
                  </div>
                  <h3 className="font-bold text-lg">Revenue Sharing</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">LGU Remittance (%)</Label>
                    <Input type="number" className="h-12 rounded-xl text-lg font-bold" value={lguShare} onChange={(e) => setLguShare(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">System VAT (%)</Label>
                    <Input type="number" className="h-12 rounded-xl text-lg font-bold" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} required />
                  </div>
                </div>
              </div>

            </div>

            {/* ========================================= */}
            {/* COLUMN 2: RULES, ENFORCEMENT & TECH       */}
            {/* ========================================= */}
            <div className="space-y-6">

              {/* 4. VIOLATIONS & PENALTIES */}
              <div className="bg-white rounded-[24px] shadow-sm border border-border p-6 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-rose-500/10 p-2 rounded-xl text-rose-600">
                    <Gavel size={20} />
                  </div>
                  <h3 className="font-bold text-lg">Enforcement & Penalties</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-rose-600/80 uppercase tracking-wider">Overnight Parking Penalty</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₱</span>
                      <Input type="number" className="h-12 rounded-xl text-lg font-bold pl-8 border-rose-100 focus:ring-rose-500" value={overnightFee} onChange={(e) => setOvernightFee(e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-rose-600/80 uppercase tracking-wider">Lost Ticket / Unverified QR</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₱</span>
                      <Input type="number" className="h-12 rounded-xl text-lg font-bold pl-8 border-rose-100 focus:ring-rose-500" value={lostTicketFee} onChange={(e) => setLostTicketFee(e.target.value)} required />
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. BOOKING & OPERATIONS */}
              <div className="bg-white rounded-[24px] shadow-sm border border-border p-6 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-violet-500/10 p-2 rounded-xl text-violet-600">
                    <CalendarClock size={20} />
                  </div>
                  <h3 className="font-bold text-lg">Operational Rules</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock size={12}/> Grace Period</Label>
                    <Input type="number" className="h-12 rounded-xl text-lg font-bold" value={gracePeriod} onChange={(e) => setGracePeriod(e.target.value)} required />
                    <p className="text-[9px] text-muted-foreground">Mins free before charge.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No-Show Forfeit</Label>
                    <Input type="number" className="h-12 rounded-xl text-lg font-bold" value={noShowMinutes} onChange={(e) => setNoShowMinutes(e.target.value)} required />
                    <p className="text-[9px] text-muted-foreground">Mins before slot is freed.</p>
                  </div>
                </div>
                
                <div className="space-y-2 pt-4 border-t border-border">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Max Advance Booking</Label>
                  <div className="relative">
                    <Input type="number" className="h-12 rounded-xl text-lg font-bold pr-16" value={maxAdvanceDays} onChange={(e) => setMaxAdvanceDays(e.target.value)} required />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">Days</span>
                  </div>
                </div>
              </div>

              {/* 6. PAYMENT GATEWAY (MOCK) */}
              <div className="bg-slate-50 rounded-[24px] border border-border p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl text-slate-700 shadow-sm border border-border">
                      <CreditCard size={20} />
                    </div>
                    <h3 className="font-bold text-lg">Payment Gateway</h3>
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-1 rounded-md">Live Mode</span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Merchant ID</Label>
                    <Input type="text" className="h-10 rounded-lg bg-white font-mono text-sm" value={merchantId} onChange={(e) => setMerchantId(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Production API Key</Label>
                    <div className="relative">
                      <Input type={showKey ? "text" : "password"} className="h-10 rounded-lg bg-white font-mono text-sm pr-10" defaultValue="pk_live_51HXXXXXiparkbayangcash" />
                      <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* DANGER ZONE / SAVE ACTION */}
          <div className="mt-8 bg-white border border-border rounded-[24px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4 text-rose-600">
              <div className="bg-rose-100 p-3 rounded-full">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h4 className="font-bold text-sm">System Maintenance Mode</h4>
                <p className="text-xs text-rose-600/70 mt-0.5 font-medium">Pause all incoming reservations globally.</p>
              </div>
            </div>
            
            <Button 
              type="submit" 
              disabled={isSaving}
              className="w-full md:w-auto h-14 px-8 font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 flex items-center gap-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
            >
              <Save size={18} />
              {isSaving ? "Syncing to Database..." : "Apply Global Settings"}
            </Button>
          </div>
          
        </form>

      </div>
    </AdminLayout>
  );
}