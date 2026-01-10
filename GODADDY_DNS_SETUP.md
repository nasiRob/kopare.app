# GoDaddy DNS Setup for kopare.app

## ⚠️ IMPORTANT: Remove Domain Forwarding

The App Store links show a blank screen because GoDaddy's domain forwarding uses an iframe, and Apple's App Store blocks iframe loading for security reasons.

**You must disable forwarding and use proper DNS records instead.**

---

## Step 1: Remove Domain Forwarding (GoDaddy)

1. Log in to your GoDaddy account
2. Go to **My Products** → **Domains**
3. Click on **kopare.app**
4. Scroll to **Forwarding** section
5. Click **Edit** next to Domain forwarding
6. Click **Delete** or **Remove** to disable forwarding
7. **Save changes**

---

## Step 2: Configure DNS Records (GoDaddy)

1. Still on the kopare.app domain page, click **DNS** or **Manage DNS**
2. **Delete any existing A records or CNAME records** for `@` (root domain)
3. Add the following **A records** for GitHub Pages:

| Type | Name | Value               | TTL  |
|------|------|---------------------|------|
| A    | @    | 185.199.108.153     | 600  |
| A    | @    | 185.199.109.153     | 600  |
| A    | @    | 185.199.110.153     | 600  |
| A    | @    | 185.199.111.153     | 600  |

4. Add a **CNAME record** for the www subdomain:

| Type  | Name | Value                      | TTL  |
|-------|------|----------------------------|------|
| CNAME | www  | nasirob.github.io          | 600  |

5. **Save all DNS records**

---

## Step 3: Configure GitHub Pages

1. Go to your GitHub repository: https://github.com/nasiRob/kopare.app
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under **Custom domain**, enter: `kopare.app`
4. Click **Save**
5. Wait a few minutes for DNS checks to complete
6. Once ready, **check the "Enforce HTTPS" checkbox**

---

## Step 4: Wait for DNS Propagation

- DNS changes can take **10 minutes to 48 hours** to propagate globally
- Typically takes **10-30 minutes** with GoDaddy
- Check propagation status: https://www.whatsmydns.net/#A/kopare.app

---

## Step 5: Verify the Fix

After DNS propagates:

1. Visit `https://kopare.app` in your browser
2. Click an **App Store link**
3. It should redirect to the App Store (no blank screen!)

---

## Why This Fixes the Issue

### ❌ Before (with forwarding):
```
User visits kopare.app
  → GoDaddy loads nasirob.github.io/kopare.app in an IFRAME
  → User clicks App Store link
  → App Store blocks iframe loading
  → Blank screen
```

### ✅ After (with DNS records):
```
User visits kopare.app
  → DNS points directly to GitHub Pages servers
  → GitHub serves your site directly (no iframe)
  → User clicks App Store link
  → App Store opens normally
  → Success!
```

---

## Troubleshooting

### DNS not working after 1 hour?
- Verify all 4 A records are correct
- Check for conflicting records (delete old ones)
- Try incognito/private browsing to bypass cache

### GitHub Pages shows 404?
- Make sure you pushed the CNAME file to the repository
- Verify GitHub Pages custom domain setting
- Wait 5-10 more minutes

### Still seeing blank screen?
- Clear browser cache
- Try different browser/device
- Verify you're accessing `https://kopare.app` (not http)

---

## Additional Resources

- [GitHub Pages Custom Domain Documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [GoDaddy DNS Management](https://www.godaddy.com/help/manage-dns-records-680)
