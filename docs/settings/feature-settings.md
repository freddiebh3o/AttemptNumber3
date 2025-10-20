# Feature Settings

Learn how to manage your tenant's feature settings, including AI Chat Assistant configuration and barcode scanning options.

## Overview

The **Feature Settings** page allows administrators to enable or disable specific features for your organization and configure feature-specific options like API keys.

**Access Level:** Requires **Owner** or **Admin** role (users with `theme:manage` permission)

**Location:** System → Features

---

## Available Features

### AI Chat Assistant

Enable or disable the AI-powered chat assistant that helps users with inventory management tasks.

**Settings:**

1. **Enable AI Chat Assistant**
   - Toggle this on to make the chat assistant available to all users in your organization
   - When enabled, users will see a chat button in the navigation bar
   - When disabled, the chat feature will be completely hidden

2. **OpenAI API Key** (Optional)
   - Provide your own OpenAI API key to control AI costs
   - If left blank, the system will use the default server API key
   - Your API key must start with `sk-`
   - API key is stored securely and masked in the UI

**Cost Information:**

- **Using Your Own API Key:** All chat assistant usage will be billed to your OpenAI account. You have full control over costs and can monitor usage in your OpenAI dashboard.
- **Using System Default:** All chat assistant usage is included in your subscription (billed to the system's OpenAI account).

**How to Configure:**

1. Navigate to **System → Features** from the sidebar
2. Locate the **AI Chat Assistant** section
3. Toggle **Enable AI Chat Assistant** to turn the feature on
4. (Optional) Enter your OpenAI API key in the **OpenAI API Key** field
5. Click **Save Settings** to apply changes

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

1. Sign in with an **Owner** or **Admin** account
2. Click **System** in the left sidebar
3. Click **Features** from the expanded menu
4. You'll see the Feature Settings page with all available features

### Saving Changes

1. Make your desired changes to any feature settings
2. Click the **Save Settings** button at the bottom of the page
3. You'll see a success notification when your changes are saved
4. Changes take effect immediately for all users

### Settings Persistence

All feature settings are saved to your tenant's configuration and will persist:
- Across user sessions
- After page refreshes
- When users sign out and sign back in

---

## Frequently Asked Questions

### Who can change feature settings?

Only users with the **Owner** or **Admin** role can access and modify feature settings. Users with **Editor** or **Viewer** roles will not see the Features menu option.

### Do feature changes affect all users immediately?

Yes, feature changes take effect immediately for all users in your organization. Users may need to refresh their browser to see changes to UI elements.

### Can I use my own OpenAI API key?

Yes! You can provide your own OpenAI API key in the AI Chat Assistant settings. This gives you:
- Full control over AI costs
- Ability to monitor usage in your OpenAI dashboard
- Independent billing from the system

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
- Only accessible to users with `theme:manage` permission
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

**Last Updated:** 2025-10-20
