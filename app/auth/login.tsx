import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useRef, useState } from 'react';
import { View, Text as RNText, StyleSheet, TextInput, TouchableOpacity, Alert, StatusBar, ScrollView, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import Button from '../../components/Button';
import { useTheme } from '../../lib/theme';
import { ensureUserProfile, signInEmail, getUserProfile, sendPasswordReset, signOut } from '../../lib/firebase';
import { FontAwesome5 } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth, { GoogleAuthProvider } from '@react-native-firebase/auth';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_UID_KEY = 'biometric_uid';

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} style={[{ fontFamily: 'Nunito' }, props.style]} />
);

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const heroAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const emailFocusAnim = useRef(new Animated.Value(0)).current;
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const eyeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '1052577492056-5s73ofdq8sme7uefml3t5nc1foei4qu3.apps.googleusercontent.com',
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const checkBiometrics = async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const enabled =
          (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === 'true';
        if (!mounted) return;
        setBiometricsAvailable(hasHardware && isEnrolled);
        setBiometricsEnabled(enabled);
      } catch (e) {
        if (!mounted) return;
        setBiometricsAvailable(false);
        setBiometricsEnabled(false);
      }
    };
    checkBiometrics();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const curve = Easing.bezier(0.2, 0.8, 0.2, 1);
    Animated.stagger(140, [
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 480,
        easing: curve,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 520,
        easing: curve,
        useNativeDriver: true,
      }),
      Animated.timing(footerAnim, {
        toValue: 1,
        duration: 460,
        easing: curve,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cardAnim, footerAnim, heroAnim]);

  const animateFocus = (anim: Animated.Value, toValue: number) => {
    Animated.timing(anim, {
      toValue,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const togglePassword = () => {
    const next = !showPassword;
    setShowPassword(next);
    Animated.timing(eyeAnim, {
      toValue: next ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const promptEnableBiometrics = async (uid: string) => {
    if (!biometricsAvailable) return;
    const enabled =
      (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === 'true';
    if (enabled) return;
    Alert.alert(
      'Enable biometric login?',
      'Use fingerprint or Face ID to sign in faster next time.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Enable biometric login',
              cancelLabel: 'Cancel',
              fallbackLabel: 'Use passcode',
            });
            if (result.success) {
              await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
              await SecureStore.setItemAsync(BIOMETRIC_UID_KEY, uid);
              setBiometricsEnabled(true);
              Alert.alert('Enabled', 'Biometric login is ready.');
            }
          },
        },
      ]
    );
  };

  const handleBiometricLogin = async () => {
    if (!biometricsAvailable) {
      Alert.alert('Biometrics unavailable', 'Set up fingerprint or Face ID first.');
      return;
    }
    const storedUid = await SecureStore.getItemAsync(BIOMETRIC_UID_KEY);
    const current = auth().currentUser;
    if (!current || (storedUid && storedUid !== current.uid)) {
      Alert.alert('Sign in required', 'Please sign in with email or Google once.');
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in with biometrics',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use passcode',
    });
    if (!result.success) return;
    const blocked = await enforceBlockIfNeeded(current.uid);
    if (blocked) return;
    router.replace('/(tabs)/home');
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
      if (!user.emailVerified) {
        await signOut();
        Alert.alert(
          'Verify your email',
          'Please verify your email address using the link we sent you before logging in.'
        );
        return;
      }
      await AsyncStorage.setItem('userToken', user.uid);
      const blocked = await enforceBlockIfNeeded(user.uid);
      if (blocked) return;
      await promptEnableBiometrics(user.uid);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'Incorrect email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      const idToken = tokens?.idToken;
      if (!idToken) {
        throw new Error('No Google idToken returned');
      }
      const credential = GoogleAuthProvider.credential(idToken);
      const userCred = await auth().signInWithCredential(credential);
      await ensureUserProfile(userCred.user);
      await AsyncStorage.setItem('userToken', userCred.user.uid);
      const blocked = await enforceBlockIfNeeded(userCred.user.uid);
      if (blocked) return;
      await promptEnableBiometrics(userCred.user.uid);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert('Google sign-in cancelled');
      } else if (e?.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Google sign-in in progress');
      } else if (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Google Play Services unavailable');
      } else {
        Alert.alert('Google sign-in failed', e?.message || 'Try again');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.hero,
              {
                opacity: heroAnim,
                transform: [
                  {
                    translateY: heroAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.logoRow}>
              <View style={styles.logoSquare}>
                <FontAwesome5 name="toilet" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.brand}>Sachio Mobile Toilets</Text>
                <Text style={styles.brandSub}>Clean · Timely · Trusted</Text>
              </View>
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to manage deliveries, rentals, and orders.</Text>
            <View style={styles.chipStrip}>
              <View style={styles.chipBadge}>
                <FontAwesome5 name="shield-alt" size={10} color={colors.primary} />
                <Text style={styles.chipText}>Secure login</Text>
              </View>
              <View style={styles.chipBadge}>
                <FontAwesome5 name="clock" size={10} color={colors.primary} />
                <Text style={styles.chipText}>Under 1 minute</Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardAnim,
                transform: [
                  {
                    translateY: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                  {
                    scale: cardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.formGlow} pointerEvents="none" />
            <View style={styles.form}>
              <Text style={styles.label}>Email Address</Text>
              <Animated.View
                style={[
                  styles.inputWrap,
                  {
                    transform: [
                      {
                        translateY: emailFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -2],
                        }),
                      },
                      {
                        scale: emailFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.01],
                        }),
                      },
                    ],
                  },
                  focusedField === 'email' && styles.inputWrapActive,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => {
                    setFocusedField('email');
                    animateFocus(emailFocusAnim, 1);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    animateFocus(emailFocusAnim, 0);
                  }}
                />
              </Animated.View>

              <Text style={styles.label}>Password</Text>
              <Animated.View
                style={[
                  styles.inputWrap,
                  {
                    transform: [
                      {
                        translateY: passwordFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -2],
                        }),
                      },
                      {
                        scale: passwordFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.01],
                        }),
                      },
                    ],
                  },
                  focusedField === 'password' && styles.inputWrapActive,
                ]}
              >
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="********"
                    placeholderTextColor={colors.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    onFocus={() => {
                      setFocusedField('password');
                      animateFocus(passwordFocusAnim, 1);
                    }}
                    onBlur={() => {
                      setFocusedField(null);
                      animateFocus(passwordFocusAnim, 0);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={togglePassword}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Animated.View
                      style={{
                        transform: [
                          {
                            scale: eyeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.1],
                            }),
                          },
                          {
                            rotate: eyeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '-8deg'],
                            }),
                          },
                        ],
                      }}
                    >
                      <FontAwesome5
                        name={showPassword ? 'eye' : 'eye-slash'}
                        size={16}
                        color={colors.primary}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              </Animated.View>

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

              <Button title={loading ? 'Logging in...' : 'Sign In'} onPress={handleLogin} disabled={loading} />
              <TouchableOpacity
                style={[styles.socialBtn, loadingGoogle && { opacity: 0.7 }]}
                onPress={handleGoogle}
                disabled={loadingGoogle}
              >
                <FontAwesome5 name="google" size={16} color="#fff" />
                <Text style={styles.socialBtnText}>
                  {loadingGoogle ? 'Please wait...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>
              {biometricsAvailable && biometricsEnabled ? (
                <TouchableOpacity
                  style={styles.biometricBtn}
                  onPress={handleBiometricLogin}
                >
                  <FontAwesome5 name="fingerprint" size={16} color={colors.primary} />
                  <Text style={styles.biometricText}>Use Fingerprint / Face ID</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.footer,
              {
                opacity: footerAnim,
                transform: [
                  {
                    translateY: footerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.footerText}>{"Don't have an account? "}</Text>
            <TouchableOpacity onPress={() => router.replace('/auth/signup')}>
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: { [key: string]: string }, isDark: boolean) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  brand: { fontSize: 16, fontWeight: '800', color: colors.primary },
  brandSub: { fontSize: 11, fontWeight: '600', color: colors.primary },
  hero: { gap: 8, marginBottom: 12 },
  chipStrip: { flexDirection: 'row', gap: 8, marginTop: 6 },
  chipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: isDark ? '#12201f' : '#E6F4F3',
    borderWidth: 1,
    borderColor: isDark ? '#1f3b3a' : '#D1E7E5',
  },
  chipText: { color: colors.primary, fontWeight: '700', fontSize: 11 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: isDark ? '#000' : colors.primary,
    shadowOpacity: isDark ? 0.2 : 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: isDark ? 2 : 3,
  },
  formGlow: {
    position: 'absolute',
    top: -60,
    left: -40,
    right: -40,
    height: 140,
    borderRadius: 160,
    backgroundColor: isDark ? 'rgba(45, 212, 191, 0.18)' : 'rgba(11, 110, 107, 0.12)',
    opacity: 0.9,
  },
  form: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 0,
    fontSize: 14,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  inputWrap: {
    borderRadius: 10,
    marginBottom: 20,
  },
  inputWrapActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: isDark ? '#0f1f1e' : '#F6FBFA',
    shadowColor: colors.primary,
    shadowOpacity: isDark ? 0.22 : 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 2 : 3,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 14,
    backgroundColor: 'transparent',
  },
  eyeBtn: {
    paddingLeft: 8,
    paddingVertical: 10,
  },
  forgotPassword: {
    color: colors.primary,
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
    color: colors.muted,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  socialBtn: {
    marginTop: 10,
    backgroundColor: '#DB4437',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: { color: '#fff', fontWeight: '700' },
  biometricBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: isDark ? '#0f1f1e' : '#F6FBFA',
    borderWidth: 1,
    borderColor: colors.border,
  },
  biometricText: {
    fontWeight: '700',
    color: colors.primary,
  },
});
