import React from 'react';
import { View, Text as RNText, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

export default function Track() {
  const { colors, isDark } = useTheme();
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
        <Text style={styles.title}>Track Order</Text>
        <Text style={styles.info}>Order tracking details will appear here.</Text>
      </View>
    </SafeAreaView>
  );
}

const Text = (props: React.ComponentProps<typeof RNText>) => (
  <RNText {...props} style={[{ fontFamily: 'Nunito' }, props.style]} />
);

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: '#0B6E6B' },
  info: { fontSize: 16, color: '#333' },
});
