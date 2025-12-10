import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PaymentMethods() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [methods, setMethods] = useState<any[]>([]);
  const [addVisible, setAddVisible] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newLast4, setNewLast4] = useState('');
  const [newExp, setNewExp] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      const stored = await AsyncStorage.getItem('customPaymentMethods');
      const parsed = stored ? JSON.parse(stored) : [];
      const base = [
        { id: 'flutterwave', brand: 'Flutterwave Web Pay', last4: '', label: 'Preferred', exp: '' },
        { id: 'pm-1', brand: 'Visa', last4: '4242', label: 'Personal', exp: '09/28' },
      ];
      setMethods([...base, ...parsed]);
      const id = await AsyncStorage.getItem('preferredPaymentMethod');
      if (id) setSelectedId(id);
    };
    bootstrap();
  }, []);

  async function handleSelect(id: string) {
    setSelectedId(id);
    await AsyncStorage.setItem('preferredPaymentMethod', id);
    if (id === 'flutterwave') {
      Alert.alert('Selected', 'Flutterwave Web Pay selected. You can pay on checkout with this method.');
    } else {
      Alert.alert('Saved', 'Payment method saved for checkout.');
    }
  }

  async function handleAddMethod() {
    if (!newLabel || !newBrand || !newLast4 || !newExp) {
      Alert.alert('All fields required');
      return;
    }
    const custom = {
      id: `pm-${Date.now()}`,
      brand: newBrand,
      last4: newLast4,
      label: newLabel,
      exp: newExp,
    };
    const updated = [...methods, custom];
    const customOnly = updated.filter((m) => !['flutterwave', 'pm-1'].includes(m.id));
    setMethods(updated);
    await AsyncStorage.setItem('customPaymentMethods', JSON.stringify(customOnly));
    setAddVisible(false);
    setNewLabel('');
    setNewBrand('');
    setNewLast4('');
    setNewExp('');
    Alert.alert('Saved', 'New payment method added.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFBFB" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome5 name="chevron-left" size={16} color="#0B6E6B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={{ width: 32 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Saved cards are used at checkout for faster payment.</Text>
        {methods.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={[styles.cardRow, selectedId === m.id && styles.cardRowActive]}
            onPress={() => handleSelect(m.id)}
          >
            <View style={styles.cardIcon}>
              <FontAwesome5 name="credit-card" size={16} color="#0B6E6B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{m.label}</Text>
              <Text style={styles.cardMeta}>{`${m.brand}${m.last4 ? ` **** ${m.last4}` : ''}${m.exp ? ` exp ${m.exp}` : ''}`}</Text>
            </View>
            {selectedId === m.id ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>Selected</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={() => setAddVisible(true)}>
          <FontAwesome5 name="plus" size={14} color="#fff" />
          <Text style={styles.addButtonText}>Add new method</Text>
        </TouchableOpacity>

        <View style={styles.infoBox}>
          <FontAwesome5 name="shield-alt" size={16} color="#0B6E6B" />
          <Text style={styles.infoText}>
            Cards are processed securely via your selected gateway. We do not store full card details on device.
          </Text>
        </View>

        <Modal visible={addVisible} transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 12 }}>Add payment method</Text>
              <Field label="Label" value={newLabel} onChangeText={setNewLabel} placeholder="e.g., Business card" />
              <Field label="Brand" value={newBrand} onChangeText={setNewBrand} placeholder="Visa / Mastercard" />
              <Field label="Last 4 digits" value={newLast4} onChangeText={setNewLast4} placeholder="1234" />
              <Field label="Expiry" value={newExp} onChangeText={setNewExp} placeholder="09/28" />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.addButton, { flex: 1 }]} onPress={handleAddMethod}>
                  <Text style={styles.addButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, { flex: 1, backgroundColor: '#e5e7eb' }]}
                  onPress={() => {
                    setAddVisible(false);
                    setNewLabel('');
                    setNewBrand('');
                    setNewLast4('');
                    setNewExp('');
                  }}
                >
                  <Text style={[styles.addButtonText, { color: '#1E293B' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder }: any) {
  return (
    <View style={{ width: '100%', marginBottom: 10 }}>
      <Text style={{ fontWeight: '600', marginBottom: 4, color: '#1E293B' }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#FAFBFB',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F4F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#0B6E6B' },
  content: {
    padding: 16,
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 12,
  },
  cardRowActive: {
    borderColor: '#0B6E6B',
    shadowColor: '#0B6E6B',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  cardMeta: { fontSize: 12, color: '#64748B' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0B6E6B',
    borderRadius: 999,
  },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0B6E6B',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '700' },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoText: { flex: 1, fontSize: 12, color: '#475569' },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
});
