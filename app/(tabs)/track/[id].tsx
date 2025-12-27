import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../../../lib/theme';

const mockDeliveries = [
  { id: '1', status: 'in_transit', driver: 'John Okafor', eta: '2 hours', orderNum: '12345' },
  { id: '2', status: 'dispatched', driver: 'Ade Balogun', eta: 'Tomorrow', orderNum: '12346' },
];

export default function TrackDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const delivery = useMemo(() => mockDeliveries.find(d => d.id === id) || null, [id]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <FontAwesome5 name="arrow-left" size={18} color="#0B6E6B" />
          </TouchableOpacity>
          <Text style={styles.title}>Track Delivery</Text>
        </View>
        {delivery ? (
          <View style={styles.card}>
            <Text style={styles.orderId}>Order #{delivery.orderNum}</Text>
            <Text style={styles.label}>Driver</Text>
            <Text style={styles.value}>{delivery.driver}</Text>
            <Text style={styles.label}>ETA</Text>
            <Text style={styles.value}>{delivery.eta}</Text>
            <View style={styles.timeline}>
              {[
                { key: 'processing', label: 'Processing' },
                { key: 'dispatched', label: 'Dispatched' },
                { key: 'in_transit', label: 'In Transit' },
                { key: 'delivered', label: 'Delivered' },
              ].map((step, idx) => {
                const order = ['processing', 'dispatched', 'in_transit', 'delivered'];
                const active = order.indexOf(delivery.status) >= idx;
                return (
                  <View key={step.key} style={styles.timelineStep}>
                    <View style={[styles.dot, active && styles.dotActive]} />
                    <Text style={[styles.stepText, active && styles.stepTextActive]}>{step.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <Text style={{ color: '#475569', marginTop: 20 }}>Delivery not found.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFB' },
  container: { flex: 1, padding: 16, backgroundColor: '#FAFBFB' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#0B6E6B' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 1,
  },
  orderId: { fontSize: 16, fontWeight: '700', color: '#0B6E6B', marginBottom: 8 },
  label: { fontSize: 12, color: '#475569', marginTop: 6 },
  value: { fontSize: 14, color: '#0F172A', fontWeight: '700' },
  timeline: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  timelineStep: { alignItems: 'center', flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e5e7eb', marginBottom: 4 },
  dotActive: { backgroundColor: '#0B6E6B' },
  stepText: { fontSize: 11, color: '#94a3b8', textAlign: 'center' },
  stepTextActive: { color: '#0B6E6B', fontWeight: '700' },
});
