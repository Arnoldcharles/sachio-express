import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureUserProfile, signUpEmail } from '../../lib/firebase';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

export default function SignupScreen() {
  WebBrowser.maybeCompleteAuthSession();
  const router = useRouter();
  const defaultGoogleClientId =
    '1052577492056-5s73ofdq8sme7uefml3t5nc1foei4qu3.apps.googleusercontent.com';
  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || defaultGoogleClientId;
  const googleRedirectUri = AuthSession.makeRedirectUri({
    scheme: 'sachio',
  });
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const passwordStrong = passwordScore >= 3;

  const handleSignup = async () => {
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!passwordStrong) {
      Alert.alert('Weak password', 'Use at least 8 characters with a number, uppercase letter, and symbol.');
      return;
    }

    setLoading(true);
    try {
      const user = await signUpEmail(email.trim(), password, { name: fullName, phone });
      // store uid locally
      await AsyncStorage.setItem('userToken', user.uid);
      // Navigate to OTP or main app - we'll go to tabs
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      const nonce = Math.random().toString(36).slice(2);
      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        '?response_type=id_token' +
        '&scope=openid%20profile%20email' +
        '&prompt=select_account' +
        `&client_id=${googleClientId}` +
        `&redirect_uri=${encodeURIComponent(googleRedirectUri)}` +
        `&nonce=${nonce}`;

      let idToken: string | null = null;

      if (typeof (AuthSession as any).startAsync === 'function') {
        const result: any = await (AuthSession as any).startAsync({
          authUrl,
          returnUrl: googleRedirectUri,
        });
        if (result?.type === 'success' && result?.params?.id_token) {
          idToken = result.params.id_token;
        }
      } else {
        // Fallback for Expo Go where startAsync may be missing
        const res = await WebBrowser.openAuthSessionAsync(authUrl, googleRedirectUri);
        if (res.type === 'success' && res.url) {
          const match = res.url.match(/id_token=([^&]+)/);
          if (match?.[1]) {
            idToken = decodeURIComponent(match[1]);
          }
        }
      }

      if (idToken) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);
        await ensureUserProfile(userCred.user);
        await AsyncStorage.setItem('userToken', userCred.user.uid);
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
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Sachio</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Sachio Mobile Toilets today</Text>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <FontAwesome5 name="clock" size={12} color="#0B6E6B" />
                <Text style={styles.pillText}>2-min signup</Text>
              </View>
              <View style={styles.pill}>
                <FontAwesome5 name="shield-alt" size={12} color="#0B6E6B" />
                <Text style={styles.pillText}>Secure</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.form}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
              />

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

              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="+234 800 000 0000"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                editable={!loading}
                keyboardType="phone-pad"
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
              <View style={styles.strengthRow}>
                <View style={[styles.strengthDot, passwordScore >= 1 && styles.strengthDotActive]} />
                <View style={[styles.strengthDot, passwordScore >= 2 && styles.strengthDotActive]} />
                <View style={[styles.strengthDot, passwordScore >= 3 && styles.strengthDotActive]} />
                <View style={[styles.strengthDot, passwordScore >= 4 && styles.strengthDotActive]} />
                <Text style={styles.strengthText}>
                  {passwordStrong ? 'Strong password' : 'Add 8+ chars, uppercase, number, symbol'}
                </Text>
              </View>

              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="********"
                placeholderTextColor="#999"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />

              <Text style={styles.termsText}>
                By signing up, you agree to our{' '}
                <Text style={styles.link}>Terms & Conditions</Text> and{' '}
                <Text style={styles.link}>Privacy Policy</Text>
              </Text>

              <Button
                title={loading ? 'Creating Account...' : 'Sign Up'}
                onPress={handleSignup}
                disabled={loading}
              />
              <TouchableOpacity
                style={[styles.socialBtn, loadingGoogle && { opacity: 0.7 }]}
                onPress={handleGoogle}
                disabled={loadingGoogle}
              >
                <FontAwesome5 name="google" size={16} color="#fff" />
                <Text style={styles.socialBtnText}>{loadingGoogle ? 'Please wait...' : 'Sign up with Google'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text style={styles.footerLink}>Sign In</Text>
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
    flex: 1,
    backgroundColor: '#FAFBFB',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  header: {
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E6F4F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1E7E5',
  },
  badgeText: {
    color: '#0B6E6B',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0B6E6B',
    marginBottom: 8,
    fontFamily: 'Nunito',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
    fontFamily: 'Nunito',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pillText: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
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
    marginBottom: 24,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  strengthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
  },
  strengthDotActive: {
    backgroundColor: '#0B6E6B',
  },
  strengthText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 6,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
    fontFamily: 'Nunito',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 24,
    fontFamily: 'Nunito',
  },
  link: {
    color: '#0B6E6B',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Nunito',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0B6E6B',
    fontFamily: 'Nunito',
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
});


