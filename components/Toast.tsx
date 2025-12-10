import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Animated, Text, StyleSheet, View, TouchableWithoutFeedback } from 'react-native';

type ToastOptions = {
  duration?: number; // ms
  type?: 'info' | 'success' | 'error';
};

type ToastContextValue = {
  show: (message: string, opts?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [bg, setBg] = useState('#0B6E6B');
  const anim = React.useRef(new Animated.Value(0)).current;
  const timeoutRef = React.useRef<number | undefined>(undefined);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, [anim]);

  const show = useCallback((msg: string, opts?: ToastOptions) => {
    const duration = opts?.duration ?? 3000;
    const type = opts?.type ?? 'info';
    let color = '#0B6E6B';
    if (type === 'success') color = '#16A34A';
    if (type === 'error') color = '#EF4444';
    setMessage(msg);
    setBg(color);
    setVisible(true);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // @ts-ignore - window.setTimeout vs Node
    timeoutRef.current = setTimeout(() => hide(), duration);
  }, [anim, hide]);

  const value = { show };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {visible && (
        <TouchableWithoutFeedback onPress={hide}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.toastContainer,
              {
                transform: [
                  {
                    translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-80, 20] }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.toast, { backgroundColor: bg }]}>
              <Text style={styles.toastText}>{message}</Text>
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
    paddingHorizontal: 16,
  },
  toast: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
  },
});
