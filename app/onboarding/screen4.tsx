import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import { useTheme } from '../../lib/theme';

export default function OnboardingScreen4() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleComplete = async () => {
    await AsyncStorage.setItem('onboardingComplete', 'true');
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
      <Image source={require('../../assets/images/onboarding/track.png')} style={styles.image} />
      <Text style={styles.title}>Track Your Delivery</Text>
      <Text style={styles.body}>Get real-time updates and see your driver’s location on the map. We guarantee on-time delivery.</Text>
      <Button title="Sign Up / Login" onPress={handleComplete} />
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
      color: colors.primary,
      marginBottom: 12,
      fontFamily: 'Nunito',
    },
    body: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 32,
      fontFamily: 'Nunito',
    },
  });


