import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, StatusBar } from 'react-native';
import Button from '../../components/Button';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function OtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams() as any;
  const { email, phone } = params || {};
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputRef = useRef<TextInput>(null);
  const otpDigits = otp.padEnd(6, ' ').slice(0, 6).split('');

  useEffect(() => {
    if (timer === 0) {
      setCanResend(true);
      return;
    }
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Error', 'Please enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Error', 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setCanResend(false);
    setTimer(60);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      Alert.alert('Sent', 'A new code was sent to your phone.');
    } catch (error) {
      Alert.alert('Error', 'Failed to resend OTP');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFBFB" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoPill}>
            <Text style={styles.logoPillText}>Sachio</Text>
          </View>
          <Text style={styles.title}>Verify your phone</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to <Text style={styles.highlight}>{phone || email || 'your number'}</Text>
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Enter code</Text>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => otpInputRef.current?.focus()}
            style={styles.otpRow}
          >
            {otpDigits.map((d, idx) => (
              <View key={idx} style={styles.otpBox}>
                <Text style={styles.otpChar}>{d.trim() ? d : '•'}</Text>
              </View>
            ))}
          </TouchableOpacity>
          <TextInput
            ref={otpInputRef}
            value={otp}
            onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            style={styles.hiddenInput}
            autoFocus
          />

          <Button
            title={loading ? 'Verifying...' : 'Verify & Continue'}
            onPress={handleVerifyOtp}
            disabled={loading}
          />

          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't get it?</Text>
            <TouchableOpacity onPress={handleResendOtp} disabled={!canResend} style={{ marginLeft: 6 }}>
              <Text style={[styles.resendLink, !canResend && styles.disabled]}>
                {canResend ? 'Resend' : `Resend in ${timer}s`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.replace('/auth/login')}>
            <Text style={styles.backLink}>Back to Login</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>
            If SMS is delayed, confirm the number is correct and your device can receive texts.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    backgroundColor: '#FAFBFB',
    paddingHorizontal: 24,
    paddingVertical: 36,
    gap: 16,
  },
  header: { gap: 6, marginBottom: 4 },
  logoPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E6F4F3',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1E7E5',
  },
  logoPillText: { color: '#0B6E6B', fontWeight: '800', letterSpacing: 0.5 },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0B6E6B',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  highlight: { fontWeight: '700', color: '#0B6E6B' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  label: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
    justifyContent: 'space-between',
  },
  otpBox: {
    flex: 1,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dce0e8',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  otpChar: { fontSize: 20, fontWeight: '800', color: '#0B6E6B', letterSpacing: 1 },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B6E6B',
  },
  disabled: { opacity: 0.5 },
  backLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B6E6B',
    textAlign: 'center',
  },
  footer: { alignItems: 'center', gap: 6 },
  helperText: { color: '#475569', fontSize: 12, textAlign: 'center' },
});
