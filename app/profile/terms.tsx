import React, { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';

export default function TermsScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="chevron-left" size={16} color="#0B6E6B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Terms of Service</Text>
          <Text style={styles.body}>
            These terms explain how Sachio Mobile Toilets services are provided, how orders and rentals work,
            and what is expected of users. By using the app, you agree to these terms.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.subtitle}>Orders and Rentals</Text>
          <Text style={styles.body}>
            All orders and rentals are subject to availability and confirmation. Pricing, delivery windows,
            and rental durations are shown before checkout.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.subtitle}>Payments</Text>
          <Text style={styles.body}>
            Payments are processed securely. If a payment fails or is reversed, your order may be cancelled.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.subtitle}>Contact</Text>
          <Text style={styles.body}>
            For questions about these terms, contact support from the Profile page.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.primary },
  content: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
  body: { fontSize: 13, color: colors.muted, lineHeight: 18 },
});
