import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, StatusBar, KeyboardAvoidingView, Platform, Animated, Easing } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureUserProfile, signUpEmail, signOut } from '../../lib/firebase';
import { useRouter } from 'expo-router';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import auth, { GoogleAuthProvider } from '@react-native-firebase/auth';
import { useTheme } from '../../lib/theme';

export default function SignupScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;
  const fullNameFocusAnim = useRef(new Animated.Value(0)).current;
  const emailFocusAnim = useRef(new Animated.Value(0)).current;
  const phoneFocusAnim = useRef(new Animated.Value(0)).current;
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;
  const confirmFocusAnim = useRef(new Animated.Value(0)).current;
  const strengthAnim = useRef(new Animated.Value(0)).current;
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const eyeAnim = useRef(new Animated.Value(0)).current;
  const confirmEyeAnim = useRef(new Animated.Value(0)).current;
  const [focusedField, setFocusedField] = useState<
    'fullName' | 'email' | 'phone' | 'password' | 'confirm' | null
  >(null);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: '1052577492056-5s73ofdq8sme7uefml3t5nc1foei4qu3.apps.googleusercontent.com',
    });
  }, []);

  useEffect(() => {
    const curve = Easing.bezier(0.2, 0.8, 0.2, 1);
    Animated.stagger(140, [
      Animated.timing(headerAnim, {
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
  }, [cardAnim, footerAnim, headerAnim]);

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

  const toggleConfirmPassword = () => {
    const next = !showConfirmPassword;
    setShowConfirmPassword(next);
    Animated.timing(confirmEyeAnim, {
      toValue: next ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const passwordStrong = passwordScore >= 3;

  useEffect(() => {
    Animated.timing(strengthAnim, {
      toValue: passwordScore,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [passwordScore, strengthAnim]);

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
      Alert.alert(
        'Verify your email',
        'We sent a verification link to your email. Please verify before logging in.',
        [
          {
            text: 'OK',
            onPress: async () => {
              try {
                await signOut();
              } catch {
                // ignore sign out errors
              }
              router.replace('/auth/login');
            },
          },
        ]
      );
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
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerAnim,
                transform: [
                  {
                    translateY: headerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Sachio Mobile Toilets</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Sachio Mobile Toilets today</Text>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <FontAwesome5 name="clock" size={12} color={colors.primary} />
                <Text style={styles.pillText}>2-min signup</Text>
              </View>
              <View style={styles.pill}>
                <FontAwesome5 name="shield-alt" size={12} color={colors.primary} />
                <Text style={styles.pillText}>Secure</Text>
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
            <View style={styles.form}>
              <Text style={styles.label}>Full Name</Text>
              <Animated.View
                style={[
                  styles.inputWrap,
                  {
                    transform: [
                      {
                        translateY: fullNameFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -2],
                        }),
                      },
                      {
                        scale: fullNameFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.01],
                        }),
                      },
                    ],
                  },
                  focusedField === 'fullName' && styles.inputWrapActive,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={colors.muted}
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!loading}
                  onFocus={() => {
                    setFocusedField('fullName');
                    animateFocus(fullNameFocusAnim, 1);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    animateFocus(fullNameFocusAnim, 0);
                  }}
                />
              </Animated.View>

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

              <Text style={styles.label}>Phone Number</Text>
              <Animated.View
                style={[
                  styles.inputWrap,
                  {
                    transform: [
                      {
                        translateY: phoneFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -2],
                        }),
                      },
                      {
                        scale: phoneFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.01],
                        }),
                      },
                    ],
                  },
                  focusedField === 'phone' && styles.inputWrapActive,
                ]}
              >
                <TextInput
                  style={styles.input}
                  placeholder="+234 800 000 0000"
                  placeholderTextColor={colors.muted}
                  value={phone}
                  onChangeText={setPhone}
                  editable={!loading}
                  keyboardType="phone-pad"
                  onFocus={() => {
                    setFocusedField('phone');
                    animateFocus(phoneFocusAnim, 1);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    animateFocus(phoneFocusAnim, 0);
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
              <View style={styles.strengthRow}>
                <Animated.View
                  style={[
                    styles.strengthDot,
                    {
                      backgroundColor: strengthAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [isDark ? '#374151' : '#e5e7eb', colors.primary],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.strengthDot,
                    {
                      backgroundColor: strengthAnim.interpolate({
                        inputRange: [1, 2],
                        outputRange: [isDark ? '#374151' : '#e5e7eb', colors.primary],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.strengthDot,
                    {
                      backgroundColor: strengthAnim.interpolate({
                        inputRange: [2, 3],
                        outputRange: [isDark ? '#374151' : '#e5e7eb', colors.primary],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.strengthDot,
                    {
                      backgroundColor: strengthAnim.interpolate({
                        inputRange: [3, 4],
                        outputRange: [isDark ? '#374151' : '#e5e7eb', colors.primary],
                      }),
                    },
                  ]}
                />
                <Text style={styles.strengthText}>
                  {passwordStrong ? 'Strong password' : 'Add 8+ chars, uppercase, number, symbol'}
                </Text>
              </View>

              <Text style={styles.label}>Confirm Password</Text>
              <Animated.View
                style={[
                  styles.inputWrap,
                  {
                    transform: [
                      {
                        translateY: confirmFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -2],
                        }),
                      },
                      {
                        scale: confirmFocusAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.01],
                        }),
                      },
                    ],
                  },
                  focusedField === 'confirm' && styles.inputWrapActive,
                ]}
              >
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    placeholder="********"
                    placeholderTextColor={colors.muted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                    onFocus={() => {
                      setFocusedField('confirm');
                      animateFocus(confirmFocusAnim, 1);
                    }}
                    onBlur={() => {
                      setFocusedField(null);
                      animateFocus(confirmFocusAnim, 0);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={toggleConfirmPassword}
                    accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <Animated.View
                      style={{
                        transform: [
                          {
                            scale: confirmEyeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 1.1],
                            }),
                          },
                          {
                            rotate: confirmEyeAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0deg', '-8deg'],
                            }),
                          },
                        ],
                      }}
                    >
                      <FontAwesome5
                        name={showConfirmPassword ? 'eye' : 'eye-slash'}
                        size={16}
                        color={colors.primary}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              </Animated.View>

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
                <Text style={styles.socialBtnText}>
                  {loadingGoogle ? 'Please wait...' : 'Continue with Google'}
                </Text>
              </TouchableOpacity>
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
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text style={styles.footerLink}>Sign In</Text>
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
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: isDark ? '#12201f' : '#E6F4F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: isDark ? '#1f3b3a' : '#D1E7E5',
  },
  badgeText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
    fontFamily: 'Nunito',
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
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
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: isDark ? '#000' : colors.primary,
    shadowOpacity: isDark ? 0.2 : 0.05,
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
    marginBottom: 0,
  },
  strengthDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: isDark ? '#374151' : '#e5e7eb',
  },
  strengthDotActive: {
    backgroundColor: colors.primary,
  },
  strengthText: {
    fontSize: 12,
    color: colors.muted,
    marginLeft: 6,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    fontFamily: 'Nunito',
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
    marginBottom: 16,
  },
  inputWrapActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: isDark ? '#0f1f1e' : '#F6FBFA',
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
  termsText: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 24,
    fontFamily: 'Nunito',
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: colors.muted,
    fontFamily: 'Nunito',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    fontFamily: 'Nunito',
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
});
