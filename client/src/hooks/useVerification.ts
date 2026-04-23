import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function useVerification() {
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'unverified' | 'pending' | 'verified' | 'rejected'>('loading');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkVerification = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setVerificationStatus('unverified');
          return;
        }

        setUserId(user.id);

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('verification_status')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setVerificationStatus(profile?.verification_status || 'unverified');
      } catch (error) {
        console.error('Verification check error:', error);
        setVerificationStatus('unverified');
      }
    };

    checkVerification();
  }, []);

  const isVerified = verificationStatus === 'verified';
  const canReserve = isVerified;
  const canMakePayments = isVerified;
  const canAccessFullFeatures = isVerified;

  return {
    verificationStatus,
    isVerified,
    canReserve,
    canMakePayments,
    canAccessFullFeatures,
    userId,
    isLoading: verificationStatus === 'loading'
  };
}