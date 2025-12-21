import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';

export default function OnboardingScreen2() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <Image source={require('../../assets/images/onboarding/logo.png')} style={styles.image} />
      <Text style={styles.title}>Why Sachio?</Text>
      <Text style={styles.body}>We deliver clean, reliable portable toilets for events, construction, and more. On time, every time.</Text>
      <Button title="Next" onPress={() => router.push('/onboarding/screen3')} />
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
