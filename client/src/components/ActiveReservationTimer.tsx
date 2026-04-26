import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Clock, AlertTriangle, Plus, Loader2, ChevronRight, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { cn } from '@/lib/utils';

interface ActiveReservationTimerProps {
  reservation: {
    id: string;
    user_id: string;
    lot_id: string;
    end_time: string;
    start_time: string;
    duration: number;
    extension_count: number;
    extension_fee: number;
    fine_amount: number;
    fine_paid: boolean;
    hourly_rate: number;
    extension_rate_per_hour?: number;
    extension_fee_setting: number;
    fine_penalty: number;
    overtime_rate: number;
    grace_period_minutes: number;
    allow_extensions: boolean;
    total_amount: number;
  };
  onUpdate: () => void;
}

export default function ActiveReservationTimer({ reservation, onUpdate }: ActiveReservationTimerProps) {
  const [, navigate] = useLocation();
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extending, setExtending] = useState(false);
  const [fineAmount, setFineAmount] = useState(0);
  const [gracePeriodEnd, setGracePeriodEnd] = useState<Date | null>(null);
  const [settings, setSettings] = useState({
    extension_fee: 10,
    fine_penalty: 50,
    overtime_rate: 30,
    grace_period_minutes: 15,
    allow_extensions: true
  });

  const extensionRate = reservation.extension_rate_per_hour ?? reservation.hourly_rate ?? 30;
  const progress = calculateProgress();

  function calculateProgress() {
    const start = new Date(reservation.start_time).getTime();
    const end = new Date(reservation.end_time).getTime();
    const now = new Date().getTime();
    if (now >= end) return 100;
    if (now <= start) return 0;
    return ((now - start) / (end - start)) * 100;
  }

  useEffect(() => {
    const fetchSettings = async () => {
      if (!reservation.lot_id) return;
      const { data } = await supabase
        .from('parking_lots')
        .select('extension_fee, fine_penalty, overtime_rate, grace_period_minutes, allow_extensions')
        .eq('id', reservation.lot_id)
        .single();
      if (data) setSettings(prev => ({ ...prev, ...data }));
    };
    fetchSettings();
  }, [reservation.lot_id]);

  useEffect(() => {
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [reservation.end_time, settings]);

  const updateTimer = () => {
    const now = new Date();
    const end = new Date(reservation.end_time);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      const graceEnd = new Date(end.getTime() + settings.grace_period_minutes * 60 * 1000);
      if (!gracePeriodEnd) setGracePeriodEnd(graceEnd);

      if (now >= graceEnd && !reservation.fine_paid) {
        const overtimeMinutes = Math.floor((now.getTime() - graceEnd.getTime()) / (1000 * 60));
        const overtimeHours = Math.ceil(overtimeMinutes / 60);
        const fine = settings.fine_penalty + (overtimeHours * settings.overtime_rate);
        setFineAmount(fine);
        setIsOvertime(true);
        setTimeLeft(`Overtime: ${overtimeMinutes} min`);
      } else {
        setTimeLeft('Session ended');
      }
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);

    if (diff < 30 * 60 * 1000 && !isExpiringSoon) {
      setIsExpiringSoon(true);
      sendExpiringNotification();
    }
  };

  const sendExpiringNotification = async () => {
    await supabase.from('notifications').insert({
      user_id: reservation.user_id,
      title: 'Parking Session Expiring Soon',
      message: `Your parking ends in 30 minutes. Extend now to avoid penalty.`,
      type: 'expiring_soon'
    });
  };

  const handleExtendClick = (additionalHours: number) => {
    const rate = extensionRate ?? 30;
    const fee = settings.extension_fee ?? 0;
    const additionalAmount = (extensionRate * additionalHours) + fee;

    sessionStorage.setItem('extendReservationId', reservation.id);
    sessionStorage.setItem('extendHours', additionalHours.toString());
    sessionStorage.setItem('extendAmount', additionalAmount.toString());
    sessionStorage.setItem('extendRate', rate.toString());
    sessionStorage.setItem('extendFee', fee.toString());

    navigate(`/payment/extension?amount=${additionalAmount}&hours=${additionalHours}`);
  };

  const handlePayFine = async () => {
    const { error } = await supabase
      .from('reservations')
      .update({
        fine_amount: fineAmount,
        fine_paid: true,
        status: 'completed'
      })
      .eq('id', reservation.id);
    if (!error && onUpdate) onUpdate();
  };

  return (
    <div className="relative mt-3">
      {/* Timer Card - unchanged */}
      <div className={cn(
        "rounded-xl p-4 transition-all duration-300 backdrop-blur-sm",
        isOvertime ? "bg-rose-950/60 border border-rose-500/30" :
        isExpiringSoon ? "bg-amber-950/60 border border-amber-500/30" :
        "bg-slate-800/80 border border-white/10"
      )}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Clock size={14} className={cn(
              isOvertime ? "text-rose-400" : isExpiringSoon ? "text-amber-400" : "text-white/60"
            )} />
            <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
              {isOvertime ? "OVERTIME" : isExpiringSoon ? "ENDING SOON" : "TIME REMAINING"}
            </span>
          </div>
          {!isOvertime && !isExpiringSoon && (
            <div className="text-[9px] text-white/30">
              {Math.floor(progress)}%
            </div>
          )}
        </div>

        <div className="text-center mb-2">
          <p className={cn(
            "text-3xl font-mono font-black tracking-tight",
            isOvertime ? "text-rose-400" : isExpiringSoon ? "text-amber-400" : "text-white"
          )}>
            {timeLeft}
          </p>
        </div>

        {!isOvertime && (
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-300",
                isExpiringSoon ? "bg-amber-500" : "bg-emerald-500"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}

        {isExpiringSoon && !isOvertime && settings.allow_extensions && (
          <button
            onClick={() => setShowExtendModal(true)}
            className="w-full mt-1 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 shadow-lg"
          >
            Extend Session
          </button>
        )}

        {isOvertime && !reservation.fine_paid && (
          <div className="mt-2 bg-rose-500/20 border border-rose-500/50 rounded-lg p-2.5">
            <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Overtime Penalty</p>
            <p className="text-xl font-black text-rose-400">₱{fineAmount}</p>
            <button
              onClick={handlePayFine}
              className="w-full mt-2 bg-rose-600 hover:bg-rose-700 text-white py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              Pay Fine
            </button>
          </div>
        )}
      </div>

      {/* Extension Modal - BLUE THEME */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl transform transition-all animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <h3 className="font-black text-lg text-gray-900">Extend Parking</h3>
              <button 
                onClick={() => setShowExtendModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* Modal Body - BLUE */}
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-blue-600 tracking-wider">Extension Rate</p>
                <p className="text-xl font-black text-blue-700">₱{extensionRate}<span className="text-sm font-normal">/hour</span></p>
                {settings.extension_fee > 0 && (
                  <p className="text-xs text-gray-600 mt-1">+ ₱{settings.extension_fee} fixed fee</p>
                )}
              </div>

              <div className="space-y-2">
                {[1, 2, 3].map(h => {
                  const total = (extensionRate * h) + settings.extension_fee;
                  return (
                    <button
                      key={h}
                      onClick={() => handleExtendClick(h)}
                      disabled={extending}
                      className="w-full group flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-150"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                          {h}
                        </div>
                        <span className="font-semibold text-gray-800">{h} hour{h !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg font-black text-blue-600">+₱{total}</span>
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => setShowExtendModal(false)}
                className="w-full text-center text-gray-500 text-sm font-medium py-2 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>

            {extending && (
              <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={28} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}