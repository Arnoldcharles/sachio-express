import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { auth } from '../../lib/firebase';
import type { User } from 'firebase/auth';
import { FontAwesome5 } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    if (!auth || typeof auth.onAuthStateChanged !== 'function') return;
    const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
      setCurrentUser(user);
    });
    setCurrentUser(auth.currentUser as User | null);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: 10 + insets.bottom,
            height: 60 + insets.bottom,
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarActiveTintColor: '#0B6E6B',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: 'Track',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="map-marker-alt" size={size} color={color} />
          ),
        }}
      />
      {/* Hide detail screens from the tab bar */}
      <Tabs.Screen name="orders/[id]" options={{ href: null }} />
      <Tabs.Screen name="track/[id]" options={{ href: null }} />
      {/* Hide admin tab entry entirely */}
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
      tabBarIcon: ({ color, size }) => (
        <FontAwesome5 name="user" size={size} color={color} />
      ),
    }}
  />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#e0e0e0',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
    height: 70,
  },
  tabBarLabel: {
    fontSize: 12,
    marginTop: 4,
  },
});

