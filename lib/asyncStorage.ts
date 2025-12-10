// Mock AsyncStorage for development until package is installed
// Replace with actual '@react-native-async-storage/async-storage' after npm install

const storage: Record<string, string> = {};

export const AsyncStorage = {
  setItem: async (key: string, value: string) => {
    storage[key] = value;
    return Promise.resolve();
  },
  getItem: async (key: string) => {
    return Promise.resolve(storage[key] || null);
  },
  removeItem: async (key: string) => {
    delete storage[key];
    return Promise.resolve();
  },
  clear: async () => {
    Object.keys(storage).forEach(key => delete storage[key]);
    return Promise.resolve();
  },
};

export default AsyncStorage;
