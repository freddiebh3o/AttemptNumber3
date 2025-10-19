# Theme & Branding Management

**What you'll learn:**
- How to customize your organization's theme and branding
- Choosing and customizing color presets
- Uploading your organization logo
- Managing theme activity and history

---

## Prerequisites

**You need:**
- `theme:manage` permission (OWNER role only)
- Understanding of your organization's brand guidelines

**Your role:** You're customizing the visual appearance of the platform for your organization.

---

## What is Theme & Branding?

Theme & Branding allows you to customize the platform's appearance to match your organization's brand identity:

- **Color Scheme** - Primary colors, button colors, UI accents
- **Logo** - Your organization's logo displayed in the header
- **Fonts** - Typography customization
- **UI Components** - Button styles, rounded corners, spacing

All members of your organization will see the customized theme when they sign in.

---

## Accessing Theme Settings

1. Navigate to **Settings** → **Theme & Branding** (visible to OWNER role only)
2. You'll see the **Settings** and **Activity** tabs

---

## Theme Presets

### What Are Presets?

Presets are pre-configured color schemes designed by professional designers. They provide a polished look with minimal effort.

### Available Presets

The platform offers 12+ theme presets:

- **Classic Blue** - Professional corporate blue
- **Ruby Dark** - Bold dark red theme
- **Emerald Light** - Fresh green tones
- **Ocean Light** - Calming blue-green
- **Violet Light** - Modern purple accents
- **Grape Dark** - Deep purple theme
- **Teal Dark** - Professional teal
- **Cyan Light** - Bright cyan accents
- **Orange Light** - Energetic orange
- **Lime Light** - Fresh lime green
- **Pink Dark** - Bold pink theme
- **Yellow Light** - Warm yellow tones

### Choosing a Preset

1. Open the **Settings** tab
2. Browse the **Theme Presets** section
3. Click a preset tile to preview
4. The platform UI updates immediately (preview)
5. Click **"Save Changes"** to apply permanently

**Tip:** Try different presets to see which best matches your brand.

---

## Custom Color Overrides

### When to Use Custom Colors

Use custom colors when:
- Your brand colors aren't available in presets
- You need exact color matching (e.g., #FF6B35)
- You're creating a unique brand identity

### Customizing Primary Color

**Primary color** is the main brand color used for:
- Buttons and links
- Navigation highlights
- Active states
- Call-to-action elements

**To customize:**
1. Scroll to **Custom Color Overrides** section
2. Enter your brand color in **Primary Color** field
   - Format: Hex color code (e.g., `#2E86C1`)
3. The UI updates immediately
4. Click **"Save Changes"** to apply

### Color Palette (Advanced)

You can define complete 10-step color palettes for advanced theming:

**What is a 10-step palette?**
- A range from light to dark shades of one color
- Used for hover states, borders, backgrounds
- Example: `['#E3F2FD', '#BBDEFB', '#90CAF9', ... '#0D47A1']`

**To create custom palette:**
1. Scroll to **Custom Palette** section
2. Enter 10 hex colors (light to dark)
3. Platform generates all UI variations automatically
4. Click **"Save Changes"**

**Tip:** Use a color palette generator tool to create harmonious 10-step scales.

---

## Primary Shade

**What is Primary Shade?**
The shade number (0-9) determines which step from the color palette is used as the "primary" color.

- **0-2** - Very light shades (subtle accents)
- **3-5** - Medium shades (balanced, recommended)
- **6** - Default (most presets use this)
- **7-9** - Dark shades (high contrast)

**To adjust:**
1. Find **Primary Shade** field
2. Enter a number 0-9
3. Preview the result
4. Click **"Save Changes"**

**Tip:** Shade 6 works well for most brands. Adjust only if colors appear too light or too dark.

---

## Typography & Fonts

### Font Family

Customize the platform's typeface to match your brand:

**To change font:**
1. Scroll to **Font Family** field
2. Enter a web-safe font or Google Fonts name
   - Example: `'Roboto', sans-serif`
   - Example: `'Open Sans', sans-serif`
3. Preview updates immediately
4. Click **"Save Changes"**

**Supported fonts:**
- System fonts (Arial, Helvetica, etc.)
- Google Fonts (must be web-safe)
- Font stacks for fallback support

**Tip:** Always include a fallback (e.g., `sans-serif` at the end).

---

## Border Radius

Control how rounded UI elements appear:

**Options:**
- `0px` - Sharp corners (modern, technical)
- `4px` - Slightly rounded (default)
- `8px` - Noticeably rounded (friendly)
- `12px` - Very rounded (playful)
- `16px+` - Extra rounded (bold choice)

**To adjust:**
1. Find **Default Radius** field
2. Enter value like `8px`
3. Preview button/card corners
4. Click **"Save Changes"**

---

## Uploading Your Logo

### Logo Requirements

**Format:** PNG, JPEG, WebP, or SVG
**Size:** Maximum 5MB
**Recommended Dimensions:** 200x50 pixels (landscape) or 100x100 pixels (square)
**Background:** Transparent PNG recommended for best results

### How to Upload

1. Scroll to **Logo Upload** section
2. Click **"Choose File"** or drag-and-drop
3. Select your logo file
4. Click **"Upload Logo"**
5. Logo appears in platform header immediately

### Replacing Your Logo

To change your logo:
1. Upload a new file (same steps as above)
2. The new logo replaces the old one automatically
3. Previous logo is not deleted (available in activity history)

### Removing Your Logo

To remove your logo and use the default:
1. Click **"Remove Logo"** button
2. Confirm the action
3. Platform reverts to default branding

---

## Saving Changes

### When Changes Take Effect

**Preview:** Changes show immediately as you type (not saved yet)
**Save:** Click **"Save Changes"** to apply permanently
**All Users:** Changes appear for all organization members on next page load

### Unsaved Changes Warning

If you navigate away without saving:
- Browser warns you about unsaved changes
- Changes are lost if you leave
- Always click **"Save Changes"** before leaving

---

## Viewing Theme Activity

### Accessing Activity Log

1. Click the **Activity** tab
2. View all theme changes made by your team

### What's Tracked

The activity log shows:
- Theme preset changes
- Color customizations
- Logo uploads/removals
- Font changes
- Border radius adjustments
- Who made the change
- When it was changed
- Before/after values

### Filtering Activity

**By Date Range:**
1. Click **"Filters"** button
2. Select start and end dates
3. Click **"Apply"**

**By User:**
1. Click **"Filters"** button
2. Select specific user from dropdown
3. Click **"Apply"**

### Why Activity Tracking Matters

- **Audit trail** - See who changed what
- **Rollback reference** - Know previous values
- **Compliance** - Document brand changes
- **Troubleshooting** - Identify when issues started

---

## Common Questions

**Q: Can I have different themes for different branches?**
A: No. Theme is organization-level (all branches see the same branding).

**Q: Will my custom theme work on mobile?**
A: Yes. Themes apply to all devices and screen sizes.

**Q: What happens if I choose a bad color combination?**
A: You can always switch back to a preset or change colors. Test thoroughly before finalizing.

**Q: Can I preview themes before saving?**
A: Yes! The UI updates live as you make changes. Only click "Save Changes" when satisfied.

**Q: How do I reset to default theme?**
A: Select any preset (e.g., "Classic Blue") and save. This overwrites all customizations.

**Q: Can I export my theme settings?**
A: Not yet. Document your custom colors externally if needed for reference.

**Q: Why doesn't my logo appear?**
A: Check that:
- File size is under 5MB
- File format is PNG, JPEG, WebP, or SVG
- You clicked "Upload Logo" (not just chose the file)
- Page has refreshed

**Q: Can I use my brand's exact Pantone color?**
A: Convert Pantone to hex code first (use online converter), then enter the hex value.

**Q: What's the difference between preset and custom colors?**
A: Presets are pre-designed color schemes. Custom colors override specific parts of the preset.

---

## Best Practices

**Testing:**
- ✅ Test theme on multiple pages before finalizing
- ✅ Check readability of text on colored backgrounds
- ✅ Verify logo appears correctly in light/dark areas
- ✅ Ask team members for feedback

**Colors:**
- ✅ Use your brand's official color palette
- ✅ Ensure sufficient contrast (text should be readable)
- ✅ Stick to 1-2 primary colors for consistency
- ❌ Avoid neon/extreme colors that strain eyes
- ❌ Don't use too many custom colors (overwhelming)

**Logo:**
- ✅ Use transparent PNG for versatility
- ✅ Ensure logo is high resolution (crisp on all screens)
- ✅ Test logo on both light and dark backgrounds
- ❌ Don't use extremely wide logos (breaks header layout)
- ❌ Avoid low-resolution images (pixelated)

**Fonts:**
- ✅ Choose web-safe or Google Fonts
- ✅ Include fallback fonts
- ✅ Test readability at different sizes
- ❌ Avoid decorative/script fonts (hard to read)
- ❌ Don't use too many font families (inconsistent)

**Workflow:**
- ✅ Start with a preset close to your brand
- ✅ Make small adjustments incrementally
- ✅ Save frequently to avoid losing work
- ✅ Document your final settings externally
- ❌ Don't make drastic changes all at once
- ❌ Don't forget to click "Save Changes"

---

## Troubleshooting

### Theme Changes Not Appearing

**Problem:** Saved changes but UI still shows old theme

**Solutions:**
1. Hard refresh the page (Ctrl+F5 or Cmd+Shift+R)
2. Clear browser cache
3. Sign out and sign in again
4. Check Activity tab to confirm save was successful

### Logo Upload Fails

**Problem:** "Upload failed" error

**Check:**
1. File size under 5MB?
2. File format is PNG, JPEG, WebP, or SVG?
3. Network connection stable?
4. Try a different browser

**Solutions:**
1. Compress the image file (use online tool)
2. Convert to PNG format
3. Retry upload
4. Contact admin if persistent

### Colors Look Wrong

**Problem:** Chosen colors appear different than expected

**Check:**
1. Monitor color calibration (colors vary by screen)
2. Hex code entered correctly (include `#`)
3. Primary shade set appropriately (try 6)
4. Preset might be overriding custom colors

**Solutions:**
1. Use hex color from brand guidelines exactly
2. Test on multiple devices
3. Adjust primary shade up or down
4. Clear preset before applying custom colors

### Unsaved Changes Warning Won't Go Away

**Problem:** Browser says changes unsaved even after saving

**Solution:**
1. Click "Save Changes" button (not just Enter key)
2. Wait for success message
3. Refresh the page
4. Check Activity tab for confirmation

---

## Related Guides

- [Roles & Permissions](../branches-users/roles-permissions.md) - Understanding OWNER role
- [Common Issues](../troubleshooting/common-issues.md) - General troubleshooting

---

## Need More Help?

Contact your platform admin or ask the chat assistant: "How do I customize my organization's theme?"
