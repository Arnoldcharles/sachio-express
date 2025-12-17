import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, StatusBar, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import Button from '../../components/Button';
import { signInEmail, getUserProfile, sendPasswordReset, signOut } from '../../lib/firebase';
import { signInWithCredential, GoogleAuthProvider, PhoneAuthProvider } from 'firebase/auth';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { auth, firebaseConfig } from '../../lib/firebase';
import { FontAwesome5 } from '@expo/vector-icons';

let FirebaseRecaptchaVerifierModal: any = null;
try {
  // optional require so Expo Go doesn't crash if module isn't installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FirebaseRecaptchaVerifierModal = require('expo-firebase-recaptcha').FirebaseRecaptchaVerifierModal;
} catch (e) {
  FirebaseRecaptchaVerifierModal = null;
}

export default function LoginScreen() {
  WebBrowser.maybeCompleteAuthSession();
  const router = useRouter();
  const defaultGoogleClientId =
    '893149086467-72mm49s9guhltn9er7l649icbn12h968.apps.googleusercontent.com';
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || defaultGoogleClientId;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || defaultGoogleClientId;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || defaultGoogleClientId;
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
    projectNameForProxy: '@jamesarnold/sachio-express',
  });
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    expoClientId: googleClientId,
    webClientId: googleClientId,
    androidClientId: googleAndroidClientId,
    iosClientId: googleIosClientId,
    responseType: 'id_token',
    usePKCE: true,
    redirectUri,
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const otpInputRef = useRef<TextInput>(null);
  const recaptchaRef = useRef<any>(null);
  const phoneAuthAvailable = !!FirebaseRecaptchaVerifierModal;

  const normalizePhone = (val: string) => {
    let n = (val || '').replace(/[\s-]/g, '');
    if (!n) return '';
    if (n.startsWith('0')) {
      // assume NG local number and prepend country code
      n = `+234${n.slice(1)}`;
    }
    if (!n.startsWith('+')) {
      n = `+${n}`;
    }
    return n;
  };

  const enforceBlockIfNeeded = async (uid: string) => {
    try {
      const profile = await getUserProfile(uid);
      if (profile?.blocked) {
        await signOut();
        Alert.alert('Account blocked', 'Your account has been blocked by an administrator. Please contact support.');
        router.replace('/auth/login');
        return true;
      }
    } catch (err) {
      // ignore profile fetch errors to avoid blocking login
    }
    return false;
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const user = await signInEmail(email.trim(), password);
      await AsyncStorage.setItem('userToken', user.uid);
      const blocked = await enforceBlockIfNeeded(user.uid);
      if (blocked) return;
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      Alert.alert('Enter phone', 'Please input your phone number in international format.');
      return;
    }
    if (!phoneAuthAvailable) {
      Alert.alert(
        'OTP needs a dev build',
        'Install expo-firebase-recaptcha and run a development build (expo-dev-client) to use phone verification.'
      );
      return;
    }
    try {
      const provider = new PhoneAuthProvider(auth);
      const verification = await provider.verifyPhoneNumber(normalized, recaptchaRef.current as any);
      setVerificationId(verification);
      setOtpSent(true);
      setOtp('');
      Alert.alert('Code sent', 'We sent a code to your phone.');
      setTimeout(() => otpInputRef.current?.focus(), 300);
    } catch (err: any) {
      Alert.alert('OTP Error', err?.message || 'Could not send code. Try again.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpSent) {
      Alert.alert('Send code first', 'Tap "Send code" to receive your OTP.');
      return;
    }
    if (!phoneAuthAvailable) {
      Alert.alert(
        'OTP needs a dev build',
        'Install expo-firebase-recaptcha and run a development build (expo-dev-client) to verify phone codes.'
      );
      return;
    }
    try {
      if (!verificationId) {
        Alert.alert('Error', 'No verification in progress. Please resend the code.');
        return;
      }
      if (otp.length < 6) {
        Alert.alert('Invalid code', 'Enter the 6-digit code.');
        return;
      }
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const result = await signInWithCredential(auth, credential);
      await AsyncStorage.setItem('userToken', result.user.uid);
      const blocked = await enforceBlockIfNeeded(result.user.uid);
      if (blocked) return;
      router.replace('/(tabs)/home');
    } catch (err: any) {
      Alert.alert('Verification failed', err?.message || 'Could not verify code. Try again.');
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      const result = await promptGoogle({
        useProxy: true,
        projectNameForProxy: '@jamesarnold/sachio-express',
        showInRecents: true,
        redirectUri,
      });
      if (result?.type === 'success' && result.authentication?.idToken) {
        const credential = GoogleAuthProvider.credential(result.authentication.idToken);
        const userCred = await signInWithCredential(auth, credential);
        await AsyncStorage.setItem('userToken', userCred.user.uid);
        const blocked = await enforceBlockIfNeeded(userCred.user.uid);
        if (blocked) return;
        router.replace('/(tabs)/home');
      } else {
        Alert.alert('Google sign-in cancelled');
      }
    } catch (e: any) {
      Alert.alert('Google sign-in failed', e?.message || 'Try again');
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFBFB" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        {phoneAuthAvailable && FirebaseRecaptchaVerifierModal ? (
          <FirebaseRecaptchaVerifierModal
            ref={recaptchaRef}
            firebaseConfig={firebaseConfig as any}
            attemptInvisibleVerification
          />
        ) : null}
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.logoRow}>
              <View style={styles.logoSquare}>
                <FontAwesome5 name="toilet" size={18} color="#0B6E6B" />
              </View>
              <View>
                <Text style={styles.brand}>Sachio Toilets</Text>
                <Text style={styles.brandSub}>Clean · Timely · Trusted</Text>
              </View>
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to manage deliveries, rentals, and orders.</Text>
            <View style={styles.chipStrip}>
              <View style={styles.chipBadge}>
                <FontAwesome5 name="shield-alt" size={10} color="#0B6E6B" />
                <Text style={styles.chipText}>Secure login</Text>
              </View>
              <View style={styles.chipBadge}>
                <FontAwesome5 name="clock" size={10} color="#0B6E6B" />
                <Text style={styles.chipText}>Under 1 minute</Text>
              </View>
            </View>
            {!phoneAuthAvailable ? (
              <Text style={styles.helperTextSmall}>
                Note: Phone OTP needs a dev build with expo-firebase-recaptcha. Email login still works in Expo Go.
              </Text>
            ) : null}
          </View>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'phone' && styles.toggleBtnActive]}
              onPress={() => setMode('phone')}
            >
              <Text style={[styles.toggleText, mode === 'phone' && styles.toggleTextActive]}>Phone OTP</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'email' && styles.toggleBtnActive]}
              onPress={() => setMode('email')}
            >
              <Text style={[styles.toggleText, mode === 'email' && styles.toggleTextActive]}>Email & Password</Text>
            </TouchableOpacity>
          </View>

          {mode === 'phone' ? (
            <View style={styles.card}>
              <Text style={styles.label}>Phone number</Text>
              <TextInput
                style={styles.input}
                placeholder="+2348012345678"
                placeholderTextColor="#94a3b8"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Button title={otpSent ? 'Resend code' : 'Send code'} onPress={handleSendOtp} />

              {otpSent ? (
                <View style={{ marginTop: 18 }}>
                  <Text style={[styles.label, { textAlign: 'center', marginBottom: 8 }]}>Enter 6-digit code</Text>
                  <TextInput
                    ref={otpInputRef}
                    style={styles.otpInputField}
                    value={otp}
                    onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    placeholder="123456"
                    placeholderTextColor="#94a3b8"
                    autoFocus
                  />
                  <Button title="Verify & Continue" onPress={handleVerifyOtp} />
                  {!phoneAuthAvailable ? (
                    <Text style={styles.helperTextSmall}>
                      Phone verification requires a dev build with expo-firebase-recaptcha installed.
                    </Text>
                  ) : (
                    <Text style={styles.helperTextSmall}>
                      If SMS does not arrive, confirm the number is in full international format (e.g. +2348012345678) and use a real device with SMS.
                    </Text>
                  )}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.form}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="********"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />

                <TouchableOpacity
                  onPress={async () => {
                    if (!email) {
                      Alert.alert('Forgot Password', 'Enter your account email first.');
                      return;
                    }
                    try {
                      await sendPasswordReset(email.trim());
                      Alert.alert('Check your email', 'Password reset link sent.');
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || 'Could not send reset link.');
                    }
                  }}
                >
                  <Text style={styles.forgotPassword}>Forgot Password?</Text>
                </TouchableOpacity>

                <Button
                  title={loading ? 'Logging in...' : 'Sign In'}
                  onPress={handleLogin}
                  disabled={loading}
                />
                <TouchableOpacity
                  style={[styles.socialBtn, loadingGoogle && { opacity: 0.7 }]}
                  onPress={handleGoogle}
                  disabled={loadingGoogle}
                >
                  <FontAwesome5 name="google" size={16} color="#fff" />
                  <Text style={styles.socialBtnText}>{loadingGoogle ? 'Please wait...' : 'Continue with Google'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/signup')}>
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    backgroundColor: '#FAFBFB',
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'space-between',
    paddingBottom: 48,
  },
  header: { gap: 6, marginBottom: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoSquare: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E6F4F3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1E7E5',
  },
  brand: { fontSize: 16, fontWeight: '800', color: '#0B6E6B' },
  brandSub: { fontSize: 11, fontWeight: '600', color: '#0B6E6B' },
  hero: { gap: 8, marginBottom: 12 },
  chipStrip: { flexDirection: 'row', gap: 8, marginTop: 6 },
  chipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E6F4F3',
    borderWidth: 1,
    borderColor: '#D1E7E5',
  },
  chipText: { color: '#0B6E6B', fontWeight: '700', fontSize: 11 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0B6E6B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#E6F4F3',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1E7E5',
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#0B6E6B',
  },
  toggleText: { color: '#0B6E6B', fontWeight: '700', fontSize: 13 },
  toggleTextActive: { color: '#fff' },
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
  },
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  forgotPassword: {
    color: '#F6B22F',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B6E6B',
  },
  socialBtn: {
    marginTop: 12,
    backgroundColor: '#DB4437',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: { color: '#fff', fontWeight: '700' },
  otpBoxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  otpBox: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce0e8',
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpInputField: {
    borderWidth: 1,
    borderColor: '#dce0e8',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '800',
    color: '#0B6E6B',
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 12,
  },
});
