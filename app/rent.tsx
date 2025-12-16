import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db, getUserProfile } from '../lib/firebase';
import { getProducts } from '../lib/products';
import DateTimePicker from '@react-native-community/datetimepicker';

const states = ['Lagos', 'Abuja', 'Ogun', 'Akwa Ibom', 'Rivers', 'Enugu', 'Kano', 'Kaduna'];
const weddingTypes = ['Wedding', 'Birthday Event', 'Corporate Event', 'Religious Event', 'Social Event', 'Other'];
const guestCounts = ['0 - 100', '100 - 250', '250 - 500', '500 - 1000', '1000+'];

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Math.max(0, days - 1));
  return d.toISOString().slice(0, 10);
}

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const safeDate = (value: string) => {
  const d = value ? new Date(value) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
};

export default function RentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stateVal, setStateVal] = useState('');
  const [location, setLocation] = useState('');
  const [weddingType, setWeddingType] = useState('');
  const [customEventModal, setCustomEventModal] = useState(false);
  const [customEventText, setCustomEventText] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<{ type: 'state' | 'wedding' | 'guest' | null }>({ type: null });

  const canSubmit = useMemo(() => {
    return !!phone && !!duration && !!eventDate && !!stateVal && !!location;
  }, [phone, duration, eventDate, stateVal, location]);

  useEffect(() => {
    if (!auth.currentUser) {
      Alert.alert('Sign in required', 'Please log in to book a toilet.', [
        { text: 'OK', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }
    if (id) {
      getProducts()
        .then((list) => {
          const found = list.find((p) => String(p.id) === String(id));
          if (found?.title) setProductTitle(found.title);
        })
        .catch(() => {});
    }
    getUserProfile(auth.currentUser.uid)
      .then((profile: any) => {
        if (profile) {
          if (profile.name) setName(profile.name);
          if (profile.phone) setPhone(profile.phone);
        }
      })
      .catch(() => {});
  }, [router]);

  const submit = () => {
    if (!canSubmit) {
      alert('Please fill the required fields.');
      return;
    }
    createRentOrder();
  };

  const createRentOrder = async () => {
    try {
      if (!auth.currentUser) {
        Alert.alert('Sign in required', 'Please log in to book.', [{ text: 'OK', onPress: () => router.push('/auth/login') }]);
        return;
      }
      const endDate = addDays(eventDate, parseInt(duration || '1', 10) || 1);
      const userId = auth.currentUser?.uid || (await AsyncStorage.getItem('userToken')) || 'guest';
      const orderData = {
        productId: id || null,
        productTitle: productTitle || (id ? `Rental for ${id}` : "Toilet rental"),
        type: 'rent',
        status: 'waiting_admin_price',
        amount: null,
        userId,
        customerName: name || auth.currentUser?.email || 'Guest',
        customerPhone: phone,
        phone,
        duration,
        rentalStartDate: eventDate,
        rentalEndDate: endDate,
        state: stateVal,
        location,
        weddingType,
        guestCount,
        note,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'orders'), orderData);
      router.push('/(tabs)/orders');
    } catch (e) {
      console.warn('rent order error', e);
      Alert.alert('Error', 'Could not submit booking. Please try again.');
    }
  };

  const renderPicker = (type: 'state' | 'wedding' | 'guest', data: string[], setter: (v: string) => void) => (
    <Modal
      visible={picker.type === type}
      transparent
      animationType="fade"
      onRequestClose={() => setPicker({ type: null })}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {data.map((item) => (
            <TouchableOpacity
              key={item}
              style={styles.optionRow}
              onPress={() => {
                if (type === 'wedding' && item === 'Other') {
                  setPicker({ type: null });
                  setCustomEventModal(true);
                  return;
                }
                setter(item);
                setPicker({ type: null });
              }}
            >
              <Text style={styles.optionText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6, marginRight: 8 }}>
            <FontAwesome5 name="arrow-left" size={18} color="#0B6E6B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Toilet</Text>
          <View style={{ width: 20 }} />
        </View>
        <Text style={styles.subtitle}>Do you need mobile toilet for your event or outdoor use? Fill the form to book a toilet.</Text>

        <View style={styles.field}>
          <TextInput
            placeholder="Your name"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <TextInput
            placeholder="+234 Your mobile number"
            placeholderTextColor="#94a3b8"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <TextInput
            placeholder="Event Duration (in Days)"
            placeholderTextColor="#94a3b8"
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.85}>
            <View pointerEvents="none">
              <TextInput
                placeholder="Event Date"
                placeholderTextColor="#94a3b8"
                value={eventDate}
                style={styles.input}
                editable={false}
              />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'state' })}>
          <View pointerEvents="none">
            <TextInput
              placeholder="State"
              placeholderTextColor="#94a3b8"
              value={stateVal}
              style={styles.input}
              editable={false}
            />
          </View>
        </TouchableOpacity>
        <View style={styles.field}>
          <TextInput
            placeholder="Event Location (full address)"
            placeholderTextColor="#94a3b8"
            value={location}
            onChangeText={setLocation}
            style={styles.input}
          />
        </View>
        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'wedding' })}>
          <View pointerEvents="none">
            <TextInput
              placeholder="Wedding Type"
              placeholderTextColor="#94a3b8"
              value={weddingType}
              style={styles.input}
              editable={false}
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'guest' })}>
          <View pointerEvents="none">
            <TextInput
              placeholder="Approximate Number of Guest"
              placeholderTextColor="#94a3b8"
              value={guestCount}
              style={styles.input}
              editable={false}
            />
          </View>
        </TouchableOpacity>
        <View style={styles.field}>
          <TextInput
            placeholder="Additional Request (optional)"
            placeholderTextColor="#94a3b8"
            value={note}
            onChangeText={setNote}
            style={[styles.input, { height: 70 }]}
            multiline
          />
        </View>

        <TouchableOpacity style={[styles.button, !canSubmit && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit}>
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableOpacity>
      </ScrollView>

      {renderPicker('state', states, setStateVal)}
      {renderPicker('wedding', weddingTypes, setWeddingType)}
      {renderPicker('guest', guestCounts, setGuestCount)}
      <Modal
        visible={customEventModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomEventModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { padding: 18, borderRadius: 14 }]}>
            <Text style={styles.modalTitle}>Tell us about your event</Text>
            <Text style={styles.modalSubtitle}>Give a short name so we can plan the right setup.</Text>
            <TextInput
              placeholder="e.g. Tech conference, Beach party"
              placeholderTextColor="#94a3b8"
              value={customEventText}
              onChangeText={setCustomEventText}
              style={[styles.input, { marginTop: 12, height: 48, backgroundColor: '#f8fafc' }]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setCustomEventModal(false)}
                style={[styles.ghostBtn]}
              >
                <Text style={[styles.buttonText, { color: '#0F172A' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const trimmed = customEventText.trim();
                  if (!trimmed) return;
                  setWeddingType(trimmed);
                  setCustomEventModal(false);
                }}
                style={[styles.button, { paddingVertical: 12 }]}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {showDatePicker && (
        <DateTimePicker
          value={safeDate(eventDate)}
          mode="date"
          display="spinner"
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (date) setEventDate(formatDate(date));
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16, paddingBottom: 32, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0B6E6B' },
  subtitle: { color: '#475569', marginBottom: 8 },
  field: {},
  input: {
    borderWidth: 1,
    borderColor: '#dce0e8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#0f172a',
  },
  button: {
    backgroundColor: '#F6B22F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: '60%',
  },
  modalTitle: { fontWeight: '800', color: '#0B6E6B', fontSize: 18 },
  modalSubtitle: { color: '#475569', marginTop: 6, fontSize: 13 },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  optionText: { color: '#0F172A', fontWeight: '600' },
});
