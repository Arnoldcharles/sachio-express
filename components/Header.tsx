import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

type Props = {
  title: string;
  showNotifications?: boolean;
  onMenuPress?: () => void;
};

export default function Header({ title, showNotifications, onMenuPress }: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onMenuPress}>
        <FontAwesome5 name="bars" size={20} color="#0B6E6B" />
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>

      {showNotifications ? (
        <TouchableOpacity>
          <View style={styles.notificationBadge}>
            <FontAwesome5 name="bell" size={18} color="#0B6E6B" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 20 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0B6E6B',
    fontFamily: 'Nunito',
  },
  notificationBadge: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});


