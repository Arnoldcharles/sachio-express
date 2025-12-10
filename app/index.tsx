import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem('onboardingComplete');

        if (!onboardingDone) {
          // first-time users go to onboarding
          router.replace('/onboarding/screen1');
          return;
        }

        // proceed to main tabs (guest or logged in)
        router.replace('/(tabs)/home');
      } catch (e) {
        console.error('bootstrap error', e);
        router.replace('/onboarding/screen1');
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFBFB' }}>
        <ActivityIndicator size="large" color="#0B6E6B" />
      </View>
    );
  }

  return null;
}
