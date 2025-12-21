// Bridge plugin to load the React Native Firebase app config plugin from its build output.
const withRnFirebaseApp = require('@react-native-firebase/app/plugin/build').default;

module.exports = function withFirebaseApp(config) {
  return withRnFirebaseApp(config);
};
