# Feature Settings

Learn how to manage your tenant's feature settings, including AI Chat Assistant configuration and barcode scanning options.

## Overview

The **Feature Settings** page allows administrators to enable or disable specific features for your organization and configure feature-specific options like API keys.

**Access Level:**
- **View Settings:** All authenticated users (requires `features:read` permission)
- **Modify Settings:** Owner only (requires `features:manage` permission)

**Location:** System → Features

---

## Available Features

### AI Chat Assistant

Enable or disable the AI-powered chat assistant that helps users with inventory management tasks.

**⚠️ IMPORTANT: You must provide your own OpenAI API key to use this feature.**

**Settings:**

1. **Enable AI Chat Assistant**
   - Toggle this on to make the chat assistant available to all users in your organization
   - When enabled, users will see a chat button in the navigation bar
   - When disabled, the chat feature will be completely hidden
   - **Requires:** A valid OpenAI API key (see below)

2. **OpenAI API Key** (Required)
   - **REQUIRED** to enable the AI Chat Assistant feature
   - Your API key must start with `sk-`
   - API key is stored securely and masked in the UI
   - The system no longer provides a fallback API key

**Cost Information:**

All chat assistant usage will be billed to **your OpenAI account**. You have full control over costs and can monitor usage in your [OpenAI dashboard](https://platform.openai.com/usage).

**How to Get an OpenAI API Key:**

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or sign in to your account
3. Navigate to **API Keys** in your account settings
4. Click **"Create new secret key"**
5. Copy the key (it starts with `sk-`)
6. Paste it into the **OpenAI API Key** field below

**⚠️ Security Note:** Keep your API key secure! Don't share it publicly or commit it to version control.

**How to Configure:**

1. Navigate to **System → Features** from the sidebar
2. Locate the **AI Chat Assistant** section
3. Enter your OpenAI API key in the **OpenAI API Key** field
4. Toggle **Enable AI Chat Assistant** to turn the feature on
5. Click **Save Settings** to apply changes

**Note:** You cannot enable the AI Chat Assistant without providing an API key. The system will show a validation error if you try to enable the feature without a key.

### Barcode Scanning

Enable or disable barcode scanning capabilities for product management and stock receiving.

**Settings:**

1. **Enable Barcode Scanning**
   - Toggle this on to allow users to scan product barcodes using their device camera
   - When enabled, users will see "Scan to Receive" options on stock transfers
   - When enabled, barcode fields will appear on product forms

**Use Cases:**

- Quickly receive stock transfers by scanning barcodes
- Add products to transfers by scanning instead of manual entry
- Reduce data entry errors in warehouse operations

**How to Configure:**

1. Navigate to **System → Features** from the sidebar
2. Locate the **Barcode Scanning** section
3. Toggle **Enable Barcode Scanning** to turn the feature on
4. Click **Save Settings** to apply changes

---

## Managing Feature Settings

### Accessing the Features Page

1. Sign in with any account (**Owner**, **Admin**, **Editor**, or **Viewer**)
2. Click **System** in the left sidebar
3. Click **Features** from the expanded menu
4. You'll see the Feature Settings page with all available features

**Note:** If you're not an **Owner**, the page will be in read-only mode. You can view current settings but cannot make changes.

### Understanding Read-Only Mode

If you see a blue information banner at the top of the page stating *"You have permission to view feature settings, but only the account owner can modify them"*, you are in **read-only mode**.

**In Read-Only Mode:**
- ✅ You can see which features are enabled or disabled
- ✅ You can view current configuration (e.g., whether an API key is set)
- ❌ You cannot toggle features on or off
- ❌ You cannot modify API keys or other settings
- ❌ The Save Settings button is not visible

**Why Read-Only?**
Feature settings affect billing, costs, and tenant-wide capabilities. Only the account **Owner** can modify these settings to maintain control over organizational costs and feature availability.

**Need to Make Changes?**
Contact your organization's **Owner** to request feature changes.

### Saving Changes

**For Owners:**
1. Make your desired changes to any feature settings
2. Click the **Save Settings** button at the top of the page
3. You'll see a success notification when your changes are saved
4. Changes take effect immediately for all users

**For Other Roles (Admin, Editor, Viewer):**
- You can view current feature settings but cannot modify them
- All input fields will be disabled (grayed out)
- The **Save Settings** button will not be visible
- You'll see a blue information alert: *"You have permission to view feature settings, but only the account owner can modify them."*

### Settings Persistence

All feature settings are saved to your tenant's configuration and will persist:
- Across user sessions
- After page refreshes
- When users sign out and sign back in

---

## Troubleshooting

### I can't enable the AI Chat Assistant

**Error:** "Please provide an OpenAI API key to enable the AI Chat Assistant"

**Cause:** The AI Chat Assistant requires a valid OpenAI API key. The system no longer provides a fallback key.

**Solution:**
1. Get an OpenAI API key (see "[How to Get an OpenAI API Key](#how-to-get-an-openai-api-key)" above)
2. Enter the key in the **OpenAI API Key** field
3. Ensure the key starts with `sk-`
4. Click **Save Settings**
5. Now you can enable the AI Chat Assistant toggle

### I get "OpenAI API key must start with sk-" error

**Cause:** The API key format is invalid.

**Solution:**
- OpenAI API keys always start with `sk-`
- Double-check you copied the entire key from OpenAI Platform
- Don't include spaces or extra characters
- If still failing, generate a new key from OpenAI

### The chat assistant was working, now it's not

**Possible causes:**
1. **API key removed:** Someone cleared the API key field
2. **Feature disabled:** The toggle was turned off
3. **OpenAI account issue:** Your API key may be invalid or billing issue

**Solutions:**
- Check that the toggle is ON in Settings → Features
- Verify the API key is still present (will show as masked dots)
- Check your OpenAI account for billing issues or rate limits
- Try regenerating your API key if it's expired or revoked

---

## Migrating from Server-Level API Keys

**What Changed?**

As of **October 2025**, the platform no longer provides a server-level OpenAI API key as a fallback for tenants. Previously, if you enabled the AI Chat Assistant without providing your own API key, the system would use a shared server key.

**Why the Change?**

- **Cost allocation:** The developer was bearing the cost for all tenant AI usage
- **Scalability:** Shared keys create usage limits and billing complexity
- **Transparency:** You now have full visibility and control over your AI costs

**Impact on Existing Users:**

If you previously enabled the AI Chat Assistant **without** providing your own API key:
- ✅ Your chat history is preserved
- ❌ New chat requests will fail until you add your own key
- ⚠️ You must add an API key to continue using the feature

**Migration Steps:**

1. **Get an OpenAI API key** (see "[How to Get an OpenAI API Key](#how-to-get-an-openai-api-key)" above)
2. Navigate to **System → Features**
3. Enter your new API key in the **OpenAI API Key** field
4. Ensure **Enable AI Chat Assistant** is toggled ON
5. Click **Save Settings**
6. Test the chat assistant to confirm it's working

**Cost Considerations:**

- **OpenAI pricing:** Approximately $0.01-0.03 per chat interaction (varies by model and message length)
- **Monitoring costs:** Track usage in your [OpenAI dashboard](https://platform.openai.com/usage)
- **Setting limits:** Configure spending limits in your OpenAI account settings
- **Free credits:** New OpenAI accounts often include free credits for testing

**Questions?**

Contact your organization admin or platform support if you need help migrating.

---

## Frequently Asked Questions

### Who can view and change feature settings?

**View Settings:** All users (**Owner**, **Admin**, **Editor**, **Viewer**) can access and view feature settings. The Features menu option is visible to all authenticated users.

**Modify Settings:** Only users with the **Owner** role can change feature settings. Admin, Editor, and Viewer roles have read-only access and will see disabled input fields.

### Do feature changes affect all users immediately?

Yes, feature changes take effect immediately for all users in your organization. Users may need to refresh their browser to see changes to UI elements.

### Why do I need my own OpenAI API key?

The platform no longer provides a shared server API key. You must provide your own OpenAI API key to:
- Control and monitor your AI usage costs
- Ensure service availability (not dependent on shared limits)
- Maintain data privacy (your requests go directly to OpenAI with your account)

### Where do I get an OpenAI API key?

Visit [OpenAI Platform](https://platform.openai.com/), sign up for an account, and create an API key in your account settings. See the "[How to Get an OpenAI API Key](#how-to-get-an-openai-api-key)" section above for step-by-step instructions.

### What happens if I don't provide an API key?

Without an API key, you cannot enable the AI Chat Assistant feature. The system will show a validation error if you try to enable it without providing a key. Other features (like barcode scanning) work independently and don't require an API key.

### What happens if I disable the AI Chat Assistant?

When disabled:
- The chat button will be hidden from all users
- Users cannot start new chat conversations
- Existing chat history is preserved (not deleted)
- You can re-enable the feature at any time to restore access

### What happens if I disable barcode scanning?

When disabled:
- "Scan to Receive" buttons will be hidden
- Barcode fields will be hidden on product forms
- Users can still manage products and transfers manually
- You can re-enable the feature at any time

### Is my OpenAI API key secure?

Yes, your API key is:
- Stored securely in the database
- Masked (password field) when displayed in the UI
- Only accessible to users with `features:read` permission (visible but masked)
- Only modifiable by users with `features:manage` permission (Owner role)
- Validated to ensure it starts with `sk-`

Note: In the current version, API keys are stored in plaintext in the database. For enhanced security in future versions, we plan to add encryption at rest.

### Can I see chat usage or costs?

Currently, there is no built-in usage analytics for the AI Chat Assistant. If you use your own OpenAI API key, you can monitor usage and costs in your OpenAI dashboard at https://platform.openai.com/usage.

---

## Related Documentation

- [Theme & Branding Settings](theme-branding.md)
- [User Management](../getting-started/user-management.md)
- [Roles & Permissions](../getting-started/roles-permissions.md)

---

**Need Help?**

If you have questions about feature settings or need assistance configuring features for your organization, contact your system administrator or support team.

**Last Updated:** 2025-10-27
