/*
 * iParkBayan — AdminParkingSlots (Real Database Version with CRUD & Walk-in Toggle)
 * Updated: Role-Based View (Guard = View Only | Manager/Admin = Full Access)
 */
import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import ParkingSlotGrid from "@/components/parking/ParkingSlotGrid";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Car, Plus, Trash2, ArrowLeftRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabaseClient";

export default function AdminParkingSlots() {
  // Real States para sa Database
  const [lots, setLots] = useState<any[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingLots, setLoadingLots] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for Adding new slot
  const [isAdding, setIsAdding] = useState(false);
  const [newSlotLabel, setNewSlotLabel] = useState(""); 
  const [newSlotIsPwd, setNewSlotIsPwd] = useState(false);

  // Kunin ang credentials mula sa LocalStorage
  const userRole = localStorage.getItem("admin_role") || "guard"; // Default fallback para iwas error
  const userLotId = localStorage.getItem("admin_lot_id");

  // 1. Unang Load: Kunin ang mga Parking Lots
  useEffect(() => {
    fetchLots();
  }, []);

  // 2. Kapag nag-iba ang napiling Lot, kunin ang mga Slots nito
  useEffect(() => {
    if (selectedLotId) {
      fetchSlots(selectedLotId);
    }
  }, [selectedLotId]);

  const fetchLots = async () => {
    setLoadingLots(true);
    try {
      let query = supabase.from('parking_lots').select('*');

      // 🔥 MULTI-TENANT LOGIC: Kung Manager o Guard siya, i-filter lang sa hawak nilang Lot
      if ((userRole === 'manager' || userRole === 'guard') && userLotId) {
        query = query.eq('id', userLotId);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        setLots(data);
        
        // 🔥 NEW LOGIC: Saluhin ang kinlick galing sa "Parking Lots" page
        const viewLotId = localStorage.getItem("view_lot_id");
        
        if (viewLotId && data.some(l => l.id === viewLotId)) {
          setSelectedLotId(viewLotId); // I-auto select yung lot na kinlick
          localStorage.removeItem("view_lot_id"); // Linisin agad para isang beses lang gumana
        } else {
          setSelectedLotId(data[0].id); // Auto-select ang unang lot kung walang kinlick
        }
        
      } else {
        toast.error("Wala pang nakatalagang Parking Lot sa iyo.");
      }
    } catch (error: any) {
      console.error("Supabase Error:", error.message);
      toast.error("Failed to fetch parking lots.");
    } finally {
      setLoadingLots(false);
    }
  };

  const fetchSlots = async (lotId: string) => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('parking_slots')
        .select('*')
        .eq('lot_id', lotId)
        .order('label', { ascending: true });

      if (error) throw error;
      setSlots(data || []);
    } catch (error: any) {
      console.error("Supabase Error:", error.message);
      toast.error("Failed to fetch parking slots.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    if (selectedLotId) {
      await fetchSlots(selectedLotId);
      toast.success("Live parking data refreshed!");
    }
  };

  // 🔥 ACTION: Mag-add ng bagong slot sa database (FOR MANAGERS & ADMINS ONLY)
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole === 'guard') return; // Double protection

    if (!newSlotLabel.trim()) {
      toast.error("Please enter a slot label.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('parking_slots')
        .insert([
          { 
            lot_id: selectedLotId, 
            label: newSlotLabel.trim().toUpperCase(),
            status: 'available',
            is_pwd: newSlotIsPwd,
            is_reservable: true // Default ay pwede i-reserve
          }
        ])
        .select();

      if (error) {
        if (error.code === '23505') { // Unique violation
            toast.error("This slot label already exists in this lot.");
        } else {
            throw error;
        }
        return;
      }

      toast.success(`Slot ${newSlotLabel} added successfully!`);
      setNewSlotLabel("");
      setNewSlotIsPwd(false);
      setIsAdding(false);
      
      // I-refresh ang listahan
      fetchSlots(selectedLotId);

    } catch (error: any) {
      console.error("Supabase Error adding slot:", error.message);
      toast.error("Failed to add new slot.");
    }
  };

  // 🔥 ACTION: Toggle Reservable (Walk-in vs Reservable)
  const toggleReservableStatus = async (slotId: string, currentStatus: boolean, slotLabel: string) => {
    if (userRole === 'guard') return; // Double protection

    const newStatus = !currentStatus;
    const targetMode = newStatus ? 'Reservable' : 'Walk-in Only';
    const isConfirmed = window.confirm(
      `Are you sure you want to change Slot ${slotLabel} to ${targetMode} mode?`
    );

    if (!isConfirmed) return; 
    try {
      const { error } = await supabase
        .from('parking_slots')
        .update({ is_reservable: newStatus })
        .eq('id', slotId);

      if (error) throw error;
      
      toast.success(`Slot ${slotLabel} is now set to ${newStatus ? 'Reservable' : 'Walk-in Only'}.`);
      fetchSlots(selectedLotId); 
    } catch (error: any) {
      console.error("Error updating slot status:", error.message);
      toast.error("Failed to update booking mode.");
    }
  };

  // 🔥 ACTION: Mag-delete ng slot (SUPER ADMIN ONLY & AVAILABLE ONLY)
  const handleDeleteSlot = async (slotId: string, slotLabel: string, slotStatus: string) => {
    if (userRole !== 'superadmin') return; // Double protection

    if (slotStatus !== 'available') {
      toast.error(`Bawal i-delete ang Slot ${slotLabel} dahil ito ay ${slotStatus}!`);
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Slot ${slotLabel}?`)) return;

    try {
      const { error } = await supabase
        .from('parking_slots')
        .delete()
        .eq('id', slotId);

      if (error) {
        if (error.code === '23503') { 
          throw new Error("Cannot delete slot. It has past reservations and is linked to billing history.");
        }
        throw error;
      }

      toast.success(`Slot ${slotLabel} deleted.`);
      fetchSlots(selectedLotId);
    } catch (error: any) {
      console.error("Error deleting slot:", error.message);
      toast.error(error.message || "Failed to delete slot.");
    }
  };

  // Kung naglo-load pa ang system
  if (loadingLots) {
    return (
      <AdminLayout title="Parking Slots">
        <div className="flex flex-col items-center justify-center h-[50vh]">
          <RefreshCw className="animate-spin text-primary mb-4 w-8 h-8" />
          <p className="text-muted-foreground font-medium">Loading database...</p>
        </div>
      </AdminLayout>
    );
  }

  // Kunin ang active lot details
  const activeLot = lots.find((l) => l.id === selectedLotId);
  if (!activeLot) return <AdminLayout title="Parking Slots"><p className="p-6 text-muted-foreground">No data found.</p></AdminLayout>;

  // Real-time Calculations galing mismo sa database slots
  const totalSlots = slots.length;
  const availableSlots = slots.filter((s) => s.status === 'available').length;
  const occupiedSlots = slots.filter((s) => s.status === 'occupied').length;
  const pwdSlots = slots.filter((s) => s.is_pwd).length;

  return (
    <AdminLayout title="Parking Slots">
      <div className="space-y-6">
        
        {/* Lot Selector Dropdown */}
        <div className="flex flex-col space-y-1.5 w-full md:max-w-md">
          <label htmlFor="lot-dropdown" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Select Establishment
          </label>
          <div className="relative">
            <select
              id="lot-dropdown"
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full appearance-none bg-white border border-border text-foreground text-sm font-semibold rounded-xl px-4 py-3 pr-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer"
            >
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {/* Custom Dropdown Arrow */}
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-muted-foreground">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>

        {/* 🔥 DYNAMIC UI: Live Camera Feed based on Establishment */}
        <div className="w-full max-w-5xl mx-auto bg-slate-900 rounded-2xl shadow-sm border border-slate-800 overflow-hidden relative aspect-video flex items-center justify-center">
          
          {/* CHECK IF LOT IS "Thesis Demo" */}
          {activeLot.name.includes("Thesis Demo") ? (
            <>
              {/* MAKE SURE TO REPLACE THIS SRC WITH YOUR NGROK LINK FOR PRODUCTION */}
              <img 
                src="http://127.0.0.1:5000/video_feed" 
                alt="Live Parking Stream" 
                className="w-full h-full object-contain"
                onError={(e) => {
                   // Fallback: If the python script isn't running, hide the broken image and show the offline message
                   e.currentTarget.style.display = 'none';
                   const fallbackMsg = document.getElementById('stream-fallback');
                   if(fallbackMsg) fallbackMsg.style.display = 'flex';
                }}
              />
              
              {/* Offline Fallback UI for Thesis Demo */}
              <div id="stream-fallback" className="absolute inset-0 flex-col items-center justify-center text-slate-400 hidden bg-slate-900">
                 <Eye size={32} className="mb-3 opacity-50" />
                 <p className="text-base font-bold text-slate-300">Camera Feed Offline</p>
                 <p className="text-xs opacity-70 mt-1">Run <code className="bg-slate-800 px-1 py-0.5 rounded text-primary">python smart_slots.py</code> in terminal to start stream</p>
              </div>

              {/* Live Indicator Badge */}
              <div className="absolute top-4 left-4 bg-red-600/90 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE
              </div>
            </>
          ) : (
            /* 🔥 OFFLINE STATE FOR ALL OTHER ESTABLISHMENTS */
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-900">
               <Eye size={32} className="mb-3 opacity-50" />
               <p className="text-base font-bold text-slate-300">Camera Feed Offline</p>
               <p className="text-sm opacity-70 mt-1 font-medium">Hardware integration not active for {activeLot.name}</p>
            </div>
          )}

        </div>

        {/* Real-time Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Slots", value: totalSlots, color: "text-foreground" },
            { label: "Available", value: availableSlots, color: "text-emerald-600" },
            { label: "Occupied", value: occupiedSlots, color: "text-rose-600" },
            { label: "PWD Slots", value: pwdSlots, color: "text-amber-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-border text-center card-elevated">
              <p className={cn("text-3xl font-extrabold", color)} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {value}
              </p>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Visual Slot Grid & Management */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border card-elevated">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-full text-primary">
                {userRole === 'guard' ? <Eye size={24} /> : <Car size={24} />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  {activeLot.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {userRole === 'guard' ? "Live Slot Monitor" : "Live Tracking Dashboard"}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-xl text-sm font-bold"
              >
                <RefreshCw size={16} className={cn("mr-2", refreshing && "animate-spin")} />
                {refreshing ? "Syncing..." : "Refresh"}
              </Button>

              {/* HIDE "Add Slot" button if the user is a Guard */}
              {userRole !== 'guard' && (
                <Button 
                  size="sm" 
                  className="rounded-xl text-sm font-bold"
                  onClick={() => setIsAdding(!isAdding)}
                >
                  <Plus size={16} className="mr-2" />
                  Add Slot
                </Button>
              )}
            </div>
          </div>
          
          {/* HIDE Add Slot Form Panel if the user is a Guard */}
          {isAdding && userRole !== 'guard' && (
            <div className="mb-6 p-4 bg-muted/30 border border-border rounded-xl">
              <form onSubmit={handleAddSlot} className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Slot Label (e.g., A1, PWD-1)</label>
                  <input 
                    type="text" 
                    value={newSlotLabel}
                    onChange={(e) => setNewSlotLabel(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-border text-sm"
                    placeholder="Enter slot label"
                    autoFocus
                  />
                </div>
                <div className="flex items-center space-x-2 h-10 px-2">
                  <input 
                    type="checkbox" 
                    id="isPwd" 
                    checked={newSlotIsPwd}
                    onChange={(e) => setNewSlotIsPwd(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="isPwd" className="text-sm font-medium">PWD / Priority Slot?</label>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="h-10">Save Slot</Button>
                  <Button type="button" variant="ghost" className="h-10" onClick={() => setIsAdding(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          {slots.length > 0 ? (
            <div className={userRole !== 'guard' ? "mb-8" : ""}>
              <ParkingSlotGrid slots={slots} interactive={false} />
            </div>
          ) : (
            <div className="text-center p-8 mb-8 border-2 border-dashed border-border rounded-xl text-muted-foreground">
              {userRole === 'guard' 
                ? "Wala pang nakalagay na slots sa mapang ito."
                : <>Wala pang slots sa parking lot na ito.<br/>I-click ang "Add Slot" button sa taas para mag-umpisa.</>
              }
            </div>
          )}

          {/* HIDE Real Database Table entirely if the user is a Guard */}
          {userRole !== 'guard' && (
            <>
              <h3 className="text-base font-bold text-foreground mb-4 pt-4 border-t border-border" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Database Records
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left pb-3 font-semibold uppercase tracking-wider">Slot Label</th>
                      <th className="text-left pb-3 font-semibold uppercase tracking-wider">Type</th>
                      <th className="text-left pb-3 font-semibold uppercase tracking-wider">Booking Mode</th>
                      <th className="text-left pb-3 font-semibold uppercase tracking-wider">Status</th>
                      <th className="text-right pb-3 font-semibold uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {slots.map((slot) => {
                      const isReservable = slot.is_reservable !== false && String(slot.is_reservable) !== "false";

                      return (
                        <tr key={slot.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 font-bold text-base">{slot.label}</td>
                          <td className="py-3">
                            {slot.is_pwd ? (
                              <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">PWD / Reserved</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs font-medium">Regular</span>
                            )}
                          </td>
                          <td className="py-3">
                            {/* BOOKING MODE BADGE */}
                            <Badge variant="outline" className={isReservable ? "border-blue-200 text-blue-700 bg-blue-50" : "border-gray-300 text-gray-500 bg-gray-100"}>
                              {isReservable ? "Reservable" : "Walk-in Only (X)"}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                              slot.status === "available" ? "bg-emerald-100 text-emerald-700" :
                              slot.status === "occupied" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {slot.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex justify-end gap-2">
                              {/* TOGGLE MODE BUTTON (Makikita ng Manager at Superadmin) */}
                              <button
                                onClick={() => toggleReservableStatus(slot.id, isReservable, slot.label)}
                                className="p-2 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-colors inline-flex items-center"
                                title={`Switch to ${isReservable ? 'Walk-in' : 'Reservable'}`}
                              >
                                <ArrowLeftRight size={16} />
                              </button>

                              {/* DEFENSE LOGIC: Superadmin lang at Available Slots lang ang pwedeng i-delete */}
                              {userRole === 'superadmin' && (
                                <button
                                  onClick={() => handleDeleteSlot(slot.id, slot.label, slot.status)}
                                  disabled={slot.status !== 'available'}
                                  className={cn(
                                    "p-2 rounded-lg transition-colors inline-flex items-center",
                                    slot.status === 'available' 
                                      ? "text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                      : "text-slate-300 cursor-not-allowed"
                                  )}
                                  title={slot.status === 'available' ? "Delete Slot" : "Cannot delete occupied/reserved slot"}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        
      </div>
    </AdminLayout>
  );
}