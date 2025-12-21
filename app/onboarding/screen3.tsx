import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';

export default function OnboardingScreen3() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <Image source={require('../../assets/images/onboarding/cta.png')} style={styles.image} />
      <Text style={styles.title}>Buy or Rent</Text>
      <Text style={styles.body}>Choose the best option for your needs. Quick checkout, secure payment, and fast delivery.</Text>
      <Button title="Next" onPress={() => router.push('/onboarding/screen4')} />
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
    fontFamily: 'Nunito',
  },
  body: {
    fontSize: 16,
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'Nunito',
  },
});


