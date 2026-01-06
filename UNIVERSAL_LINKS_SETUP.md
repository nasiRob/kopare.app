# iOS Universal Links Setup Guide

This guide explains how to complete the iOS Universal Links configuration for the Kopare app.

## 📋 What Has Been Added

### 1. Apple App Site Association File
**Location:** `.well-known/apple-app-site-association`

This JSON file tells iOS which app should handle links from your domain (`kopare.app`).

### 2. iOS Meta Tags
Added to both `index.html` and `privacy-policy.html`:
- `apple-itunes-app` - Shows a smart app banner on iOS Safari
- `apple-mobile-web-app-capable` - Enables full-screen mode when saved to home screen
- `apple-mobile-web-app-status-bar-style` - Controls the status bar appearance
- `apple-mobile-web-app-title` - Sets the name when saved to home screen

---

## ⚙️ Required Configuration

### Step 1: Update the Apple App Site Association File

You **MUST** update the `.well-known/apple-app-site-association` file with your actual values:

1. **Get your Apple Team ID:**
   - Go to https://developer.apple.com/account
   - Click on "Membership" in the sidebar
   - Your Team ID is a 10-character alphanumeric code (e.g., `A1B2C3D4E5`)

2. **Get your iOS App Bundle Identifier:**
   - Open your Xcode project
   - Select your app target
   - Go to the "Signing & Capabilities" tab
   - Find the "Bundle Identifier" (e.g., `com.kopare.app`)

3. **Update the file:**
   - Replace `TEAM_ID` with your actual Team ID
   - Replace `com.kopare.app` with your actual Bundle Identifier

**Example:**
```json
{
  "applinks": {
    "details": [
      {
        "appIDs": [
          "A1B2C3D4E5.com.kopare.app"
        ],
        "components": [
          {
            "/": "*",
            "comment": "Matches all paths"
          }
        ]
      }
    ]
  }
}
```

### Step 2: Configure Your iOS App in Xcode

1. **Add Associated Domains Capability:**
   - Open your Xcode project
   - Select your app target
   - Go to "Signing & Capabilities" tab
   - Click "+ Capability" and add "Associated Domains"

2. **Add Your Domain:**
   - Under Associated Domains, click "+"
   - Add: `applinks:kopare.app`
   - If using www subdomain, also add: `applinks:www.kopare.app`

3. **Handle Universal Links in Code:**

Add this to your `AppDelegate.swift` or `SceneDelegate.swift`:

```swift
// For AppDelegate
func application(_ application: UIApplication,
                continue userActivity: NSUserActivity,
                restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL else {
        return false
    }

    // Handle the universal link
    handleUniversalLink(url)
    return true
}

// For SceneDelegate (iOS 13+)
func scene(_ scene: UIScene,
          continue userActivity: NSUserActivity) {
    guard userActivity.activityType == NSUserActivityTypeBrowsingWeb,
          let url = userActivity.webpageURL else {
        return
    }

    // Handle the universal link
    handleUniversalLink(url)
}

// Your custom URL handling function
func handleUniversalLink(_ url: URL) {
    // Parse the URL and navigate to the appropriate screen
    // Example:
    // if url.path == "/privacy-policy" {
    //     // Navigate to privacy policy screen
    // }
}
```

---

## 🌐 Hosting Requirements

### Critical Requirements:

1. **HTTPS Only:**
   - Universal links ONLY work with HTTPS
   - Your site MUST be served over HTTPS (not HTTP)

2. **Correct Content-Type:**
   - The `apple-app-site-association` file must be served with:
     - Content-Type: `application/json` or `application/pkcs7-mime`
   - No `.json` extension should be on the filename

3. **Accessible at Root:**
   - The file must be accessible at:
     - `https://kopare.app/.well-known/apple-app-site-association`
     - Or: `https://kopare.app/apple-app-site-association` (legacy)

### For GitHub Pages:

GitHub Pages automatically serves files from the `.well-known` directory correctly. No additional configuration needed!

---

## 🧪 Testing Universal Links

### Before Testing:
1. Update the `apple-app-site-association` file with your Team ID and Bundle ID
2. Deploy the changes to your website (push to GitHub Pages)
3. Build and install your app on a physical device (simulator won't work for testing)
4. Make sure your app includes the Associated Domains capability

### Test Steps:

1. **Validate the Configuration:**
   - Use Apple's validator: https://search.developer.apple.com/appsearch-validation-tool/
   - Enter your domain: `kopare.app`
   - Check for any errors

2. **Test on Device:**
   - Send yourself a link to `https://kopare.app` via Messages or Mail
   - **Important:** Long-press the link, you should see "Open in Kopare"
   - Tap the link - it should open your app (not Safari)

3. **Smart App Banner:**
   - Open `https://kopare.app` in Safari on iOS
   - You should see a banner at the top suggesting to open in the app

### Common Testing Issues:

- **Link opens in Safari instead of app:**
  - Verify Team ID and Bundle ID are correct
  - Check that Associated Domains capability is added in Xcode
  - Reinstall the app (iOS caches the association file)
  - Wait a few minutes after deployment (iOS needs to download the file)

- **No "Open in App" option:**
  - Make sure you're testing on a physical device
  - Verify the file is accessible at `https://kopare.app/.well-known/apple-app-site-association`
  - Check that the app is built with the Associated Domains entitlement

---

## 📝 Path Configuration (Optional)

The current configuration opens ALL paths from `kopare.app` in your app. To customize which paths open in the app:

### Example: Only Open Specific Paths

Edit `.well-known/apple-app-site-association`:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAM_ID.com.kopare.app"],
        "components": [
          {
            "/": "/events/*",
            "comment": "Open event pages in app"
          },
          {
            "/": "/schedules/*",
            "comment": "Open schedule pages in app"
          }
        ]
      }
    ]
  }
}
```

### Example: Exclude Specific Paths

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAM_ID.com.kopare.app"],
        "components": [
          {
            "/": "*",
            "exclude": true,
            "comment": "Don't open privacy policy in app"
          },
          {
            "/": "*",
            "comment": "Open everything else in app"
          }
        ]
      }
    ]
  }
}
```

---

## ✅ Deployment Checklist

- [ ] Updated `TEAM_ID` in `.well-known/apple-app-site-association`
- [ ] Updated Bundle ID in `.well-known/apple-app-site-association`
- [ ] Added Associated Domains capability in Xcode
- [ ] Added `applinks:kopare.app` to Associated Domains
- [ ] Implemented universal link handling in AppDelegate/SceneDelegate
- [ ] Deployed website to GitHub Pages with HTTPS
- [ ] Validated configuration using Apple's tool
- [ ] Tested on physical iOS device
- [ ] Verified smart app banner appears in Safari

---

## 🔗 Useful Resources

- [Apple Universal Links Documentation](https://developer.apple.com/ios/universal-links/)
- [Apple App Site Association Validator](https://search.developer.apple.com/appsearch-validation-tool/)
- [Supporting Universal Links in Your App](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)

---

## 📧 Support

If you encounter issues, check:
1. The file is accessible via HTTPS
2. Team ID and Bundle ID match exactly
3. Associated Domains are configured in Xcode
4. You're testing on a real device (not simulator)
5. You've waited a few minutes after deployment
