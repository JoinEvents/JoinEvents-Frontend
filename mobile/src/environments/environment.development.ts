export const environment = {
  production: false,
  /**
   * 10.0.2.2 is the Android emulator's alias for the host machine's
   * loopback interface; on an iOS simulator localhost works directly.
   * Point this at a LAN IP when running on a physical device.
   */
  apiUrl: 'http://10.0.2.2:7010/api/v1',
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
  facebookAppId: 'YOUR_FACEBOOK_APP_ID',
  chatPollSeconds: 5,
  notificationPollSeconds: 30
};
