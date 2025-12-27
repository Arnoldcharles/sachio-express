import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useMemo } from 'react';
import { View, Image, StyleSheet, Text, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../../components/Button';
import { useTheme } from '../../lib/theme';

export default function OnboardingScreen1() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    const timer = setTimeout(() => {
      // navigate to onboarding step 2
      router.replace('/onboarding/screen2');
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
      <Image source={require('../../assets/images/onboarding/logo 1.png')} style={styles.logo} />
      <Text style={styles.title}>Sachio Mobile Toilets</Text>
      <Text style={styles.tagline}>Clean. Timely. Trusted.</Text>
      <Button title="Get Started" onPress={() => router.push('/onboarding/screen2')} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    logo: {
      width: 120,
      height: 120,
      marginBottom: 32,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 8,
      fontFamily: 'Nunito',
    },
    tagline: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 32,
      fontFamily: 'Nunito',
    },
  });


