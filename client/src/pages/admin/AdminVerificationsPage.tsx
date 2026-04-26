import { useEffect, useState, useRef } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "../../supabaseClient";
import { toast } from "sonner";
import { 
  Loader2, Check, X, Image as ImageIcon, UserCircle, ExternalLink, 
  ShieldAlert, UserCheck, ShieldClose, CheckCircle2, XCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminVerifications() {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // State and Ref para sa Success/Reject visual indication (Animation bago mawala ang row)
  const [processedStatus, setProcessedStatus] = useState<Record<string, "approved" | "rejected">>({});
  const animatingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchPendingVerifications();

    // Supabase Realtime Subscription para mag-update ang queue kusa
    const channel = supabase
      .channel("admin-verifications-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new.verification_status === "pending") {
            // May bagong nag-apply, tahimik na i-refresh ang listahan
            fetchPendingVerifications(true);
          } 
          else if (payload.eventType === "UPDATE") {
            if (payload.new.verification_status === "pending") {
              fetchPendingVerifications(true);
            } else if (!animatingRef.current.has(payload.new.id)) {
              // Kung may ibang admin na nag-approve/reject, alisin sa table (basta hindi ikaw ang nag-click)
              setPendingUsers((prev) => prev.filter((u) => u.id !== payload.new.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // isSilent flag para hindi magpakita ng buong loading screen kapag nagre-refresh in background
  const fetchPendingVerifications = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone_number, id_front_photo_url, id_back_photo_url, selfie_photo_url, user_type, valid_id_type, id_number, address, birthdate")
        .eq("verification_status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching pending verifications:", error);
      toast.error("Failed to load pending verifications.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  const getImageUrl = (path: string | null) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const { data } = supabase.storage.from("id-verifications").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleApprove = async (userId: string, userName: string) => {
    try {
      setActionLoading(userId);
      
      // 1. Show Success Indication agad bago mag-update sa database
      animatingRef.current.add(userId);
      setProcessedStatus((prev) => ({ ...prev, [userId]: "approved" }));

      // 2. Official DB Update
      const { error } = await supabase
        .from("profiles")
        .update({ verification_status: "verified" })
        .eq("id", userId);

      if (error) throw error;
      toast.success(`${userName} has been officially verified!`);

      // 3. Tanggalin ang row after 1.5 seconds para makita ng admin yung success effect
      setTimeout(() => {
        setPendingUsers((prev) => prev.filter((user) => user.id !== userId));
        setProcessedStatus((prev) => {
          const newState = { ...prev };
          delete newState[userId];
          return newState;
        });
        animatingRef.current.delete(userId);
      }, 1500);

    } catch (error: any) {
      console.error("Error approving user:", error);
      toast.error("Failed to approve user.");
      // I-revert kung pumalya
      setProcessedStatus((prev) => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
      animatingRef.current.delete(userId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to reject ${userName}'s verification request?`)) return;

    try {
      setActionLoading(userId);
      
      // 1. Show Reject Indication
      animatingRef.current.add(userId);
      setProcessedStatus((prev) => ({ ...prev, [userId]: "rejected" }));

      // 2. Official DB Update - Changed to 'rejected' and retained photo URLs for record purposes
      const { error } = await supabase
        .from("profiles")
        .update({ 
          verification_status: "rejected"
        })
        .eq("id", userId);

      if (error) throw error;
      toast.info(`${userName}'s verification was rejected.`);

      // 3. Tanggalin ang row after 1.5 seconds delay
      setTimeout(() => {
        setPendingUsers((prev) => prev.filter((user) => user.id !== userId));
        setProcessedStatus((prev) => {
          const newState = { ...prev };
          delete newState[userId];
          return newState;
        });
        animatingRef.current.delete(userId);
      }, 1500);

    } catch (error: any) {
      console.error("Error rejecting user:", error);
      toast.error("Failed to reject user.");
      setProcessedStatus((prev) => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
      animatingRef.current.delete(userId);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Verifications">
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="animate-spin text-blue-700" size={40} />
            <p className="text-slate-600 font-medium animate-pulse tracking-wide">Securing data & loading records...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Identity Verifications">
      <div className="space-y-6">
        
        {/* Civic Tech Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm border-l-4 border-l-blue-600">
            <div className="bg-blue-50 p-3 rounded-full text-blue-700">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="text-3xl font-black text-slate-800">{pendingUsers.length}</p>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Pending Approvals</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-bold text-lg text-slate-800">Citizen Submissions</h3>
              <p className="text-sm text-slate-500">Carefully review IDs and selfies before granting platform access.</p>
            </div>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center">
              <div className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <Check size={40} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Queue is Empty</h3>
              <p className="text-slate-500 max-w-sm">
                No pending identity verifications at the moment. All citizens are processed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-bold">
                    <th className="p-4 pl-6">Applicant Details</th>
                    <th className="p-4">Account & ID Info</th>
                    <th className="p-4 text-center">Valid IDs (Front & Back)</th>
                    <th className="p-4 text-center">Selfie / Face</th>
                    <th className="p-4 pr-6 text-right">Official Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingUsers.map((user) => {
                    const isApproved = processedStatus[user.id] === "approved";
                    const isRejected = processedStatus[user.id] === "rejected";
                    
                    return (
                      <tr 
                        key={user.id} 
                        className={cn(
                          "transition-all duration-300 group",
                          isApproved && "bg-emerald-50/60 border-l-4 border-l-emerald-500 opacity-90",
                          isRejected && "bg-rose-50/60 border-l-4 border-l-rose-500 opacity-90",
                          !isApproved && !isRejected && "hover:bg-blue-50/30"
                        )}
                      >
                        
                        {/* User Details */}
                        <td className="p-4 pl-6 align-top">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 mt-1">
                              <UserCircle size={24} />
                            </div>
                            <div className="space-y-1">
                              <p className="font-bold text-slate-800">{user.full_name || "Unknown Citizen"}</p>
                              <div className="text-xs text-slate-500 space-y-0.5">
                                <p>Email: <span className="text-slate-700">{user.email}</span></p>
                                <p>Phone: <span className="font-mono text-slate-700">{user.phone_number}</span></p>
                                {user.birthdate && (
                                  <p>Bday: <span className="text-slate-700">{new Date(user.birthdate).toLocaleDateString()}</span></p>
                                )}
                                {user.address && (
                                  <p className="max-w-50 truncate" title={user.address}>
                                    Address: <span className="text-slate-700">{user.address}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Account & ID Info */}
                        <td className="p-4 align-top">
                          <div className="space-y-2">
                            {user.user_type ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 border border-amber-200">
                                {user.user_type}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic block">Unspecified</span>
                            )}
                            
                            <div className="text-xs text-slate-500 space-y-0.5 mt-2 bg-white/60 p-2 rounded border border-slate-100">
                              <p className="font-semibold text-slate-700">{user.valid_id_type || "No ID Type"}</p>
                              <p className="font-mono text-slate-600">ID#: {user.id_number || "N/A"}</p>
                            </div>
                          </div>
                        </td>

                        {/* ID Documents (Front and Back) */}
                        <td className="p-4 align-middle text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* Front ID */}
                            {user.id_front_photo_url ? (
                              <a 
                                href={getImageUrl(user.id_front_photo_url)} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-block relative group/img"
                                title="Front ID"
                              >
                                <div className="h-14 w-20 bg-slate-100 rounded border border-slate-300 overflow-hidden flex items-center justify-center shadow-sm transition-all group-hover/img:ring-2 ring-blue-600 ring-offset-1">
                                  <img src={getImageUrl(user.id_front_photo_url)} alt="Front ID" className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-full shadow-md opacity-0 group-hover/img:opacity-100 transition-opacity">
                                  <ExternalLink size={12} />
                                </div>
                              </a>
                            ) : (
                              <div className="h-14 w-20 bg-slate-50 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon size={16} />
                              </div>
                            )}

                            {/* Back ID */}
                            {user.id_back_photo_url ? (
                              <a 
                                href={getImageUrl(user.id_back_photo_url)} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-block relative group/img"
                                title="Back ID"
                              >
                                <div className="h-14 w-20 bg-slate-100 rounded border border-slate-300 overflow-hidden flex items-center justify-center shadow-sm transition-all group-hover/img:ring-2 ring-blue-600 ring-offset-1">
                                  <img src={getImageUrl(user.id_back_photo_url)} alt="Back ID" className="w-full h-full object-cover" />
                                </div>
                                <div className="absolute -top-2 -right-2 bg-blue-600 text-white p-1 rounded-full shadow-md opacity-0 group-hover/img:opacity-100 transition-opacity">
                                  <ExternalLink size={12} />
                                </div>
                              </a>
                            ) : (
                              <div className="h-14 w-20 bg-slate-50 rounded border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                                <ImageIcon size={16} />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Selfie */}
                        <td className="p-4 align-middle text-center">
                          {user.selfie_photo_url ? (
                            <a 
                              href={getImageUrl(user.selfie_photo_url)} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-block relative group/img"
                            >
                              <div className="h-14 w-14 mx-auto bg-slate-100 rounded-full border border-slate-300 overflow-hidden flex items-center justify-center shadow-sm transition-all group-hover/img:ring-2 ring-blue-600 ring-offset-1">
                                <img src={getImageUrl(user.selfie_photo_url)} alt="Selfie" className="w-full h-full object-cover" />
                              </div>
                              <div className="absolute -top-1 -right-1 bg-blue-600 text-white p-1 rounded-full shadow-md opacity-0 group-hover/img:opacity-100 transition-opacity">
                                <ExternalLink size={12} />
                              </div>
                            </a>
                          ) : (
                            <div className="h-14 w-14 mx-auto bg-slate-50 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                              <UserCircle size={20} />
                            </div>
                          )}
                        </td>

                        {/* Actions & Live Indicators */}
                        <td className="p-4 pr-6 align-middle text-right">
                          {isApproved ? (
                            <div className="flex items-center justify-end gap-1.5 text-emerald-700 font-bold bg-emerald-100 py-1.5 px-3 rounded-lg shadow-sm border border-emerald-200">
                              <CheckCircle2 size={16} className="animate-bounce" /> Verified!
                            </div>
                          ) : isRejected ? (
                            <div className="flex items-center justify-end gap-1.5 text-rose-700 font-bold bg-rose-100 py-1.5 px-3 rounded-lg shadow-sm border border-rose-200">
                              <XCircle size={16} className="animate-pulse" /> Rejected
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleReject(user.id, user.full_name)}
                                disabled={actionLoading === user.id}
                                className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 font-bold text-xs flex items-center gap-1.5 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-50 transition-all"
                              >
                                <ShieldClose size={14} />
                                Deny
                              </button>
                              <button
                                onClick={() => handleApprove(user.id, user.full_name)}
                                disabled={actionLoading === user.id}
                                className="px-4 py-2 rounded-lg bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-blue-800 shadow-sm disabled:opacity-50 transition-all"
                              >
                                {actionLoading === user.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <UserCheck size={14} />
                                )}
                                Verify
                              </button>
                            </div>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
} 