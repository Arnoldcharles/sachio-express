import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTheme } from '../lib/theme';

export default function Index() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return null;
}
