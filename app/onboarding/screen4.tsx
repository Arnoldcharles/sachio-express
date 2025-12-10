import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';

export default function OnboardingScreen4() {
  const router = useRouter();

  const handleComplete = async () => {
    await AsyncStorage.setItem('onboardingComplete', 'true');
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <Image source={require('../../assets/images/onboarding/track.png')} style={styles.image} />
      <Text style={styles.title}>Track Your Delivery</Text>
      <Text style={styles.body}>Get real-time updates and see your driver’s location on the map. We guarantee on-time delivery.</Text>
      <Button title="Sign Up / Login" onPress={handleComplete} />
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
    padding: 24,
  },
  image: {
    width: 200,
    height: 140,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0B6E6B',
    marginBottom: 12,
    fontFamily: 'Inter',
  },
  body: {
    fontSize: 16,
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'Inter',
  },
});
