const { withAndroidManifest, withStringsXml } = require('expo/config-plugins');

/**
 * Expo Config Plugin for Money Manager Notification Detection.
 * Adds the NotificationListenerService to the Android manifest.
 */
module.exports = function withNotificationDetection(config) {
  // Add the string resource
  config = withStringsXml(config, (config) => {
    if (!config.modResults.resources) {
      config.modResults.resources = { string: [] };
    }
    
    if (!Array.isArray(config.modResults.resources.string)) {
      config.modResults.resources.string = [config.modResults.resources.string];
    }
    
    const stringExists = config.modResults.resources.string.some(
      (s) => s.$?.name === 'notification_listener_service_name'
    );
    
    if (!stringExists) {
      config.modResults.resources.string.push({
        $: { name: 'notification_listener_service_name' },
        _: 'Money Manager UPI Notification Listener',
      });
    }
    
    return config;
  });

  // Add the NotificationListenerService to manifest
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    
    // Ensure application exists
    if (!manifest.application) {
      manifest.application = [{}];
    }
    
    const application = manifest.application[0];
    
    // Add the NotificationListenerService
    if (!application.service) {
      application.service = [];
    }
    
    const service = {
      $: {
        'android:name': 'com.moneymanager.notification.MoneyManagerNotificationListenerService',
        'android:label': '@string/notification_listener_service_name',
        'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            {
              $: {
                'android:name': 'android.service.notification.NotificationListenerService',
              },
            },
          ],
        },
      ],
    };
    
    // Check if service already exists
    const existingService = application.service.find(
      (s) => s.$?.['android:name'] === 'com.moneymanager.notification.MoneyManagerNotificationListenerService'
    );
    
    if (!existingService) {
      application.service.push(service);
    }
    
    // Add BIND_NOTIFICATION_LISTENER_SERVICE permission
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    
    const permissionExists = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE'
    );
    
    if (!permissionExists) {
      manifest['uses-permission'].push({
        $: {
          'android:name': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        },
      });
    }
    
    return config;
  });
};