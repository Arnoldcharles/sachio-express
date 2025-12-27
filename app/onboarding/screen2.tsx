import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import { useTheme } from '../../lib/theme';

export default function OnboardingScreen2() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
      <Image source={require('../../assets/images/onboarding/logo.png')} style={styles.image} />
      <Text style={styles.title}>Why Sachio?</Text>
      <Text style={styles.body}>We deliver clean, reliable portable toilets for events, construction, and more. On time, every time.</Text>
      <Button title="Next" onPress={() => router.push('/onboarding/screen3')} />
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


