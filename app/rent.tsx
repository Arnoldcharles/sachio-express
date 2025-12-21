import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db, getUserProfile } from '../lib/firebase';
import { getProducts } from '../lib/products';
import DateTimePicker from '@react-native-community/datetimepicker';

const states = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
  'FCT',
];
const eventTypes = [
  'Wedding',
  'Anniversary',
  'Birthday',
  'Cocktail Party',
  'Holiday Party',
  'Sporting Event',
  'Religious Event',
  'Corporate Event',
  'Trade Show',
  'Grand Opening',
  'House Warming',
  'Product Launch',
  'Media Event',
  'Awards Event',
  'Fundraiser',
  'Retirement',
  'Long Term Rental',
  'Burial Ceremony',
];
const guestCounts = ['0 - 100', '100 - 250', '250 - 500', '500 - 1000', '1000+'];
const productTypes = ['VIP Restrooms', 'Porta Potties'];
const rentalTypes = ['Construction', 'Events', 'Other'];
const referrals = ['Google Search', 'Social Media', 'Referral', 'Website', 'Other'];

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
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [productTitle, setProductTitle] = useState('');
  const [toiletsRequired, setToiletsRequired] = useState('');
  const [duration, setDuration] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [stateVal, setStateVal] = useState('');
  const [location, setLocation] = useState('');
  const [weddingType, setWeddingType] = useState('');
  const [guestCount, setGuestCount] = useState('');
  const [productType, setProductType] = useState<string[]>([]);
  const [rentalType, setRentalType] = useState('');
  const [note, setNote] = useState('');
  const [referral, setReferral] = useState('');
  const [picker, setPicker] = useState<{ type: 'state' | 'event' | 'guest' | 'product' | 'rental' | 'referral' | null }>({ type: null });

  const canSubmit = useMemo(() => {
    return (
      !!name &&
      !!email &&
      !!phone &&
      !!toiletsRequired &&
      !!duration &&
      !!eventDate &&
      !!stateVal &&
      !!location &&
      !!weddingType &&
      !!guestCount &&
      productType.length > 0 &&
      !!rentalType
    );
  }, [
    name,
    email,
    phone,
    toiletsRequired,
    duration,
    eventDate,
    stateVal,
    location,
    weddingType,
    guestCount,
    productType,
    rentalType,
  ]);

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
    if (auth.currentUser?.email) {
      setEmail(auth.currentUser.email);
    }
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
        customerEmail: email,
        customerPhone: phone,
        customerAddress: location,
        phone,
        duration,
        rentalStartDate: eventDate,
        rentalEndDate: endDate,
        state: stateVal,
        location,
        weddingType,
        guestCount,
        productType,
        rentalType,
        toiletsRequired,
        referral,
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

  const renderPicker = (
    type: 'state' | 'event' | 'guest' | 'product' | 'rental' | 'referral',
    data: string[],
    setter: (v: string) => void
  ) => (
    <Modal
      visible={picker.type === type}
      transparent
      animationType="fade"
      onRequestClose={() => setPicker({ type: null })}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setPicker({ type: null })}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator>
            {data.map((item) => {
              const isSelected = type === 'product' && productType.includes(item);
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  onPress={() => {
                    if (type === 'product') {
                      setProductType((prev) =>
                        prev.includes(item) ? prev.filter((val) => val !== item) : [...prev, item]
                      );
                      return;
                    }
                    setter(item);
                    setPicker({ type: null });
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {type === 'product' ? (
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setPicker({ type: null })}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </Pressable>
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
            placeholder="Your Email Address"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <TextInput
            placeholder="Your Phone Number"
            placeholderTextColor="#94a3b8"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <TextInput
            placeholder="Number of Toilets Required"
            placeholderTextColor="#94a3b8"
            value={toiletsRequired}
            onChangeText={setToiletsRequired}
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
        <View style={styles.field}>
          <TextInput
            placeholder="Event Duration (In Days)"
            placeholderTextColor="#94a3b8"
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'state' })}>
          <View pointerEvents="none">
            <TextInput
              placeholder="Event Location (State)"
              placeholderTextColor="#94a3b8"
              value={stateVal}
              style={styles.input}
              editable={false}
            />
          </View>
        </TouchableOpacity>
        <View style={styles.field}>
          <TextInput
            placeholder="Event Location (Full Address)"
            placeholderTextColor="#94a3b8"
            value={location}
            onChangeText={setLocation}
            style={styles.input}
          />
        </View>
        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'event' })}>
          <View pointerEvents="none">
            <TextInput
              placeholder="Type of Event"
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
              placeholder="Approximate Number of Guests"
              placeholderTextColor="#94a3b8"
              value={guestCount}
              style={styles.input}
              editable={false}
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'product' })}>
          <View pointerEvents="none">
            <TextInput
              placeholder="Product Type"
              placeholderTextColor="#94a3b8"
              value={productType.join(', ')}
              style={styles.input}
              editable={false}
            />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'rental' })}>
          <View pointerEvents="none">
            <TextInput
              placeholder="Rental Type"
              placeholderTextColor="#94a3b8"
              value={rentalType}
              style={styles.input}
              editable={false}
            />
          </View>
        </TouchableOpacity>
        <View style={styles.field}>
          <TextInput
            placeholder="Additional Request and Comments (Optional)"
            placeholderTextColor="#94a3b8"
            value={note}
            onChangeText={setNote}
            style={[styles.input, { height: 90 }]}
            multiline
          />
        </View>
        <TouchableOpacity style={styles.field} onPress={() => setPicker({ type: 'referral' })}>
          <View pointerEvents="none">
            <TextInput
              placeholder="How did you hear about us? (Optional)"
              placeholderTextColor="#94a3b8"
              value={referral}
              style={styles.input}
              editable={false}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, !canSubmit && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit}>
          <Text style={styles.buttonText}>Submit</Text>
        </TouchableOpacity>
      </ScrollView>

      {renderPicker('state', states, setStateVal)}
      {renderPicker('event', eventTypes, setWeddingType)}
      {renderPicker('guest', guestCounts, setGuestCount)}
      {renderPicker('product', productTypes, () => {})}
      {renderPicker('rental', rentalTypes, setRentalType)}
      {renderPicker('referral', referrals, setReferral)}
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
    maxHeight: '70%',
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  optionText: { color: '#0F172A', fontWeight: '600' },
  optionRowSelected: {
    backgroundColor: '#E6F4F3',
  },
  modalDoneBtn: {
    marginTop: 10,
    backgroundColor: '#0B6E6B',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalDoneText: { color: '#fff', fontWeight: '700' },
});
