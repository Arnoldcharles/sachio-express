import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Button from '../../components/Button';

export default function OnboardingScreen1() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      // navigate to onboarding step 2
      router.replace('/onboarding/screen2');
    }, 2000);
    return () => clearTimeout(timer);
  }, [router]);
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <Image source={require('../../assets/images/onboarding/logo.png')} style={styles.logo} />
      <Text style={styles.title}>Sachio Mobile Toilets</Text>
      <Text style={styles.tagline}>Clean. Timely. Trusted.</Text>
      <Button title="Get Started" onPress={() => router.push('/onboarding/screen2')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFBFB',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0B6E6B',
    marginBottom: 8,
    fontFamily: 'Inter',
  },
  tagline: {
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 32,
    fontFamily: 'Inter',
  },
});
