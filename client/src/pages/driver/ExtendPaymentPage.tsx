import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import MobileLayout from '@/components/MobileLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '../../supabaseClient';
import { toast } from 'sonner';
import { CheckCircle2, Wallet, Loader2, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ExtendPaymentPage() {
  const [, navigate] = useLocation();
  const [amount, setAmount] = useState<string | null>(null);
  const [hours, setHours] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'maya'>('gcash');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Kunin ang query string mula sa buong URL
    const url = window.location.href;
    const queryString = url.split('?')[1];
    const params = new URLSearchParams(queryString || '');
    let amountParam = params.get('amount');
    let hoursParam = params.get('hours');

    // Fallback sa sessionStorage kung wala sa URL
    if (!amountParam || amountParam === 'NaN') {
      amountParam = sessionStorage.getItem('extendAmount');
      hoursParam = sessionStorage.getItem('extendHours');
    }

    if (amountParam && hoursParam) {
      setAmount(amountParam);
      setHours(hoursParam);
    } else {
      // Kung wala pa ring makuha, magpakita ng error
      setAmount(null);
      setHours(null);
    }
  }, []);

  // Kung walang amount, magpakita ng error
  if (amount === null || amount === 'NaN' || amount === 'null') {
    return (
      <MobileLayout title="Error" showBack>
        <div className="p-4 text-center text-red-600">
          Invalid extension request. Please go back and try again.
        </div>
      </MobileLayout>
    );
  }

  const handlePayment = async () => {
    setProcessing(true);
    setTimeout(async () => {
      try {
        const reservationId = sessionStorage.getItem('extendReservationId');
        const additionalHours = parseInt(sessionStorage.getItem('extendHours') || '0');
        const additionalAmount = parseFloat(sessionStorage.getItem('extendAmount') || '0');
        const extensionRate = parseFloat(sessionStorage.getItem('extendRate') || '10');
        const extensionFee = parseFloat(sessionStorage.getItem('extendFee') || '0');

        if (!reservationId) throw new Error('No extension session found');

        const { data: reservation, error: fetchError } = await supabase
          .from('reservations')
          .select('*')
          .eq('id', reservationId)
          .single();
        if (fetchError) throw fetchError;

        const newEnd = new Date(reservation.end_time);
        newEnd.setHours(newEnd.getHours() + additionalHours);

        const { error: updateError } = await supabase
          .from('reservations')
          .update({
            end_time: newEnd.toISOString(),
            duration: reservation.duration + additionalHours,
            extension_count: (reservation.extension_count || 0) + 1,
            extension_fee: (reservation.extension_fee || 0) + extensionFee,
            total_amount: reservation.total_amount + additionalAmount
          })
          .eq('id', reservationId);

        if (updateError) throw updateError;

        sessionStorage.removeItem('extendReservationId');
        sessionStorage.removeItem('extendHours');
        sessionStorage.removeItem('extendAmount');
        sessionStorage.removeItem('extendRate');
        sessionStorage.removeItem('extendFee');

        setSuccess(true);
        toast.success('Extension successful!');
        setTimeout(() => navigate('/home'), 2000);
      } catch (err: any) {
        console.error(err);
        toast.error('Payment failed: ' + err.message);
        setProcessing(false);
      }
    }, 2000);
  };

  if (success) {
    return (
      <MobileLayout title="Success" showBack={false}>
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
          <CheckCircle2 size={48} className="text-green-600 mb-4" />
          <h2 className="text-2xl font-black">Extension Successful!</h2>
          <p className="text-gray-500 mt-2">Your parking session has been extended.</p>
          <Button onClick={() => navigate('/home')} className="mt-6 bg-primary text-white px-6 py-3 rounded-xl">
            Back to Home
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Extension Payment" showBack>
      <div className="p-4 space-y-5">
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Additional Payment</p>
          <p className="text-4xl font-black text-primary mt-1">₱{amount}</p>
          <p className="text-xs text-gray-400 mt-1">for {hours} hour(s) extension</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <label className="text-[10px] font-black uppercase text-gray-500 mb-3 flex items-center gap-1">
            <CreditCard size={12} /> Payment Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod('gcash')}
              className={cn(
                "h-14 rounded-xl border-2 flex items-center justify-center gap-2 transition-all",
                paymentMethod === 'gcash'
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-xs">G</span>
              </div>
              <span className="font-bold text-blue-600">GCash</span>
              {paymentMethod === 'gcash' && <CheckCircle2 size={14} className="text-blue-600" />}
            </button>
            <button
              onClick={() => setPaymentMethod('maya')}
              className={cn(
                "h-14 rounded-xl border-2 flex items-center justify-center gap-2 transition-all",
                paymentMethod === 'maya'
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className="w-6 h-6 bg-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-xs">M</span>
              </div>
              <span className="font-bold text-emerald-600">Maya</span>
              {paymentMethod === 'maya' && <CheckCircle2 size={14} className="text-emerald-600" />}
            </button>
          </div>
        </div>

        <Button
          onClick={handlePayment}
          disabled={processing}
          className={cn(
            "w-full h-14 rounded-xl text-base font-black shadow-lg transition-all",
            paymentMethod === 'gcash' ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
          )}
        >
          {processing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={20} />
              <span>Processing...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Wallet size={18} />
              <span>Pay ₱{amount} with {paymentMethod === 'gcash' ? 'GCash' : 'Maya'}</span>
            </div>
          )}
        </Button>

        <p className="text-center text-[10px] text-gray-400">
          By continuing, you agree to pay the extension fee. No refunds.
        </p>
      </div>
    </MobileLayout>
  );
}