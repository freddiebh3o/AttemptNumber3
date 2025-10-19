# Common Issues & Solutions

## Sign-In & Authentication

### Issue: "Invalid credentials" Error

**Symptoms:**
- Can't sign in with email and password
- Error message: "Invalid credentials"

**Common Causes:**
1. Wrong password
2. Wrong tenant slug
3. Account not yet created
4. Caps Lock enabled

**Solutions:**

✅ **Check your credentials:**
- Verify email address is correct (case-sensitive)
- Check password (case-sensitive)
- Verify tenant slug is correct (lowercase only)
- Try disabling Caps Lock

✅ **Request password reset:**
- Contact your organization admin
- They can reset your password
- Or create a new account if yours doesn't exist

✅ **Verify tenant slug:**
- Ask admin for exact tenant slug
- Common mistake: using company name instead of slug
- Example: Company "ACME Corp" might have slug `acme` not `acme-corp`

### Issue: "Session Expired" Error

**Symptoms:**
- Suddenly logged out
- Error: "Your session has expired"
- Redirected to sign-in page

**Common Causes:**
1. Session timeout (inactive for extended period)
2. Cookie expired
3. Browser cleared cookies
4. Security logout (password changed elsewhere)

**Solutions:**

✅ **Sign in again:**
- Enter credentials to start new session
- Sessions typically last 24 hours of inactivity

✅ **Enable "Remember Me" (if available):**
- Checkbox on sign-in page
- Extends session duration

✅ **Check browser settings:**
- Ensure cookies are enabled
- Don't clear cookies while using platform

### Issue: Can't Access Certain Pages

**Symptoms:**
- Menu items missing
- "Permission denied" (403) error
- Redirected away from page

**Common Causes:**
1. Insufficient permissions
2. Role doesn't include required permission
3. Not assigned to any branches

**Solutions:**

✅ **Check your role:**
- Ask AI: "What role do I have?"
- Ask AI: "What permissions do I have?"
- Compare to required permission for page

✅ **Request access:**
- Contact your organization admin
- Request specific permission or role change
- Explain what you need to do

✅ **Verify branch assignment:**
- Ask AI: "What branches am I assigned to?"
- Many features require branch membership
- Request assignment from admin

**Permission Reference:**
- Products page → `products:read`
- Create/edit products → `products:write`
- Stock page → `stock:read`
- Adjust stock → `stock:write`
- Approve transfers → `stock:write` + approval rules
- Users page → `users:manage`
- Roles page → `roles:manage`
- Branches page → `branches:manage`
- Analytics → `reports:view`

## Product Management

### Issue: "SKU already exists" Error

**Symptoms:**
- Can't save new product
- Error: "A product with this SKU already exists"

**Common Causes:**
1. Duplicate SKU in your organization
2. Typo creating unintended duplicate

**Solutions:**

✅ **Search for existing product:**
- Navigate to Products page
- Search for the SKU
- Check if product already exists
- Edit existing product instead of creating new

✅ **Use different SKU:**
- Choose a unique SKU
- Common pattern: `CATEGORY-NAME-###`
- Example: `WIDGET-BLUE-001`, `WIDGET-BLUE-002`

✅ **Delete old product (if appropriate):**
- If old product is obsolete
- Navigate to product
- Click delete (if you have permission)
- Then create new product with same SKU

### Issue: Can't Find Product in Dropdown

**Symptoms:**
- Product missing from dropdowns (transfers, stock adjustments)
- Product exists but doesn't appear

**Common Causes:**
1. No stock at selected branch
2. Product filtered out by search
3. Product recently created (page not refreshed)

**Solutions:**

✅ **Check stock levels:**
- Product might have 0 stock at branch
- Some dropdowns only show products with stock > 0
- Add stock first, then try dropdown

✅ **Clear search filter:**
- Dropdown might have active search
- Clear search box to see all products
- Or type partial product name

✅ **Refresh page:**
- Press F5 or Ctrl+R
- Newly created products may not appear until refresh

✅ **Verify branch selection:**
- Ensure correct branch is selected
- Product stock is branch-specific

### Issue: Product Price Showing as £0.00

**Symptoms:**
- Product shows £0.00 unit price
- Expected to see actual price

**Common Causes:**
1. Price not set during creation
2. Price set to 0
3. Display formatting issue

**Solutions:**

✅ **Edit product price:**
- Navigate to product
- Click edit
- Enter unit price (in GBP)
- Save

✅ **Check price format:**
- Price should be entered as decimal (e.g., `25.99`)
- System stores in pence internally
- Displays as £XX.XX

## Stock & Inventory

### Issue: Stock Level Incorrect

**Symptoms:**
- Quantity on hand doesn't match physical count
- Discrepancy between system and reality

**Common Causes:**
1. Recent transfer not yet received
2. Adjustment not recorded
3. User error during receipt/shipment
4. Damage/theft not reported

**Solutions:**

✅ **Check stock ledger:**
- Navigate to product
- View stock movements
- Review recent RECEIPT, CONSUMPTION, ADJUSTMENT entries
- Identify where discrepancy occurred

✅ **Adjust stock:**
- If you have `stock:write` permission
- Navigate to product → Adjust Stock
- Select correct branch
- Enter correct quantity
- Add reason (e.g., "Physical count correction")

✅ **Review pending transfers:**
- Check if transfer is IN_TRANSIT
- Stock won't update until received at destination
- Complete receiving process

✅ **Report to admin:**
- If you can't adjust stock
- Provide details: expected vs actual, branch, product
- Admin can investigate and correct

### Issue: Can't Adjust Stock

**Symptoms:**
- "Adjust Stock" button missing or disabled
- Error when trying to adjust

**Common Causes:**
1. Missing `stock:write` permission
2. Not assigned to the branch
3. Product doesn't exist at branch yet

**Solutions:**

✅ **Check permissions:**
- Ask AI: "Can I adjust stock?"
- Need `stock:write` permission
- Request from admin if missing

✅ **Verify branch access:**
- Ask AI: "What branches am I assigned to?"
- You can only adjust stock at your assigned branches
- Request branch assignment from admin

✅ **Receive stock first:**
- If product has 0 stock at branch
- Use "Receive Stock" operation first
- Then future adjustments possible

### Issue: Stock Valuation Seems Wrong

**Symptoms:**
- Stock value too high or too low
- Expected different valuation

**Common Causes:**
1. Missing unit costs on receipts
2. Recent price changes not reflected (FIFO uses lot cost)
3. Viewing subset of branches
4. Recent consumption changed lot mix

**Solutions:**

✅ **Check FIFO lots:**
- Navigate to product
- View Stock Lots
- Verify `unitCostPence` for each lot
- Lots with 0 cost will show £0 value

✅ **Review recent receipts:**
- Check if unit cost was recorded
- Re-receive with correct cost if needed
- Or adjust existing lot costs (admin only)

✅ **Understand FIFO:**
- Valuation uses cost of remaining lots
- Not current product price
- Older cheaper lots consumed first
- Remaining stock valued at recent higher costs

✅ **Verify branch access:**
- Ask AI: "What's the stock value at [Branch]?"
- You might be seeing only your assigned branches
- Request access to more branches if needed

## Stock Transfers

### Issue: Approval Rule Not Triggering

**Symptoms:**
- Created approval rule but transfers not requiring approval
- Expected multi-level approval but getting auto-approved

**Common Causes:**
1. Rule is inactive (toggle OFF)
2. Rule is archived
3. Transfer doesn't match rule conditions
4. Higher priority rule is overriding
5. Wrong branch or threshold configured

**Solutions:**

✅ **Check rule status:**
- Go to Stock Transfers → Approval Rules
- Find your rule in the list
- Verify toggle switch is ON (Active)
- Check it's not showing "Archived" badge

✅ **Review rule conditions:**
- Edit the rule
- Verify quantity threshold matches your test
- Verify value threshold is correct (in pence, not pounds)
- Check source/destination branch filters
- Test with transfer that clearly exceeds thresholds

✅ **Check rule priority:**
- If multiple rules exist, lowest number = highest priority
- Your rule might be overridden by another
- Review all active rules
- Adjust priority numbers if needed

✅ **Test incrementally:**
- Create simple rule with one condition
- Verify it works
- Add complexity gradually

✅ **View rule in archived filter:**
- Change filter to "All Rules"
- Confirm rule wasn't accidentally archived
- Restore if needed

**See:** [Managing Approval Rules](../stock-transfers/approval-rules.md) for detailed troubleshooting

---

### Issue: Can't Find Archived Approval Rule

**Symptoms:**
- Archived a rule and now can't find it
- Need to restore rule but it's disappeared

**Common Causes:**
1. Looking at wrong filter view
2. Confused with inactive vs archived

**Solutions:**

✅ **Change filter view:**
- Go to Stock Transfers → Approval Rules
- Find "Show Rules" dropdown
- Select "Archived rules only" or "All rules (active + archived)"
- Look for gray "Archived" badge

✅ **Understand archive vs inactive:**
- Inactive = paused, still visible
- Archived = completely hidden from default view
- Both prevent rule from evaluating

**See:** [Managing Approval Rules](../stock-transfers/approval-rules.md#archiving-and-restoring-rules)

---

### Issue: Transfer Stuck in REQUESTED Status

**Symptoms:**
- Transfer not moving to next status
- Waiting for approval

**Common Causes:**
1. Awaiting approval (if multi-level approval required)
2. No one with approval permission at branches
3. Approver hasn't seen the request
4. Approval rule is misconfigured

**Solutions:**

✅ **Check approval requirements:**
- Navigate to transfer
- Check if "Requires Multi-Level Approval" is true
- Review which approval rule matched
- Ask AI: "Why does transfer [ID] need approval?"

✅ **Review approval rule:**
- Go to Stock Transfers → Approval Rules
- Find the rule that triggered
- Verify approval levels have correct roles assigned
- Check if users with those roles exist at the branch

✅ **Notify approver:**
- Identify who can approve (check approval rule levels)
- Send them notification
- Provide transfer number for quick lookup

✅ **Check priority:**
- URGENT transfers should be reviewed first
- Consider increasing priority if critical

✅ **Review transfer details:**
- Ensure quantities are reasonable
- Large requests might need manager approval
- Correct any errors and resubmit

**See:** [Approving Transfers](../stock-transfers/approving-transfers.md)

### Issue: Can't Ship Transfer

**Symptoms:**
- "Ship Transfer" button missing or disabled
- Error when trying to ship

**Common Causes:**
1. Transfer not yet approved
2. Missing `stock:allocate` permission
3. Not assigned to source branch
4. Insufficient stock to fulfill

**Solutions:**

✅ **Verify transfer status:**
- Transfer must be APPROVED before shipping
- Check current status
- Wait for approval if REQUESTED

✅ **Check permissions:**
- Need `stock:allocate` permission
- Ask AI: "Can I ship transfers?"
- Request from admin if missing

✅ **Verify branch access:**
- Must be member of source branch
- Ask AI: "What branches am I assigned to?"
- Request assignment if needed

✅ **Check stock availability:**
- Ensure sufficient stock at source
- Ask AI: "Show me stock for [Product] at [Branch]"
- Adjust transfer quantities if needed

### Issue: Transfer Received Quantity Doesn't Match Shipped

**Symptoms:**
- Discrepancy between shipped and received
- Example: Shipped 100, received 95

**Common Causes:**
1. Damage during transit
2. Theft
3. Counting error at receiving
4. Partial shipment

**Solutions:**

✅ **Report discrepancy:**
- During receiving, enter actual quantity received
- Add notes explaining discrepancy
- System will record difference in ledger

✅ **Investigate:**
- Check packing slip vs actual delivery
- Review with shipping branch
- Document reason (damage, shortage, etc.)

✅ **Adjust at source (if needed):**
- If stock was consumed at source but never shipped
- Source branch may need stock adjustment
- Contact admin to reconcile

✅ **Create follow-up transfer:**
- If shortage is being replaced
- Create new transfer for missing quantity
- Reference original transfer in notes

### Issue: Can't Reverse a Transfer

**Symptoms:**
- "Reverse Transfer" button missing
- Error when trying to reverse

**Common Causes:**
1. Transfer not completed yet
2. Missing permissions
3. Insufficient stock at destination for reversal
4. Already reversed

**Solutions:**

✅ **Check transfer status:**
- Can only reverse COMPLETED transfers
- Check current status
- Wait for completion if IN_TRANSIT

✅ **Verify stock availability:**
- Destination must have enough stock to reverse
- Check current stock levels
- Can't reverse more than was received

✅ **Check permissions:**
- Need approval to reverse (similar to creating transfer)
- Contact admin if you lack permissions

✅ **Review transfer history:**
- Check Activity tab
- See if already reversed
- Each transfer can only be reversed once

## User & Branch Management

### Issue: Can't Invite New User

**Symptoms:**
- "New User" button missing
- Error when inviting

**Common Causes:**
1. Missing `users:manage` permission
2. Email already exists in system
3. Invalid email format

**Solutions:**

✅ **Check permissions:**
- Need `users:manage` permission
- Only OWNER and ADMIN have this by default
- Request from OWNER if needed

✅ **Verify email unique:**
- Each email can only be used once per tenant
- Search existing users first
- Use different email or reactivate existing account

✅ **Check email format:**
- Must be valid email (name@domain.com)
- No spaces or special characters (except @ and .)

### Issue: User Can't See Any Data

**Symptoms:**
- User signed in but sees empty lists
- No products, transfers, or stock visible

**Common Causes:**
1. Not assigned to any branches
2. Missing read permissions

**Solutions:**

✅ **Assign to branches:**
- Navigate to Users page
- Find user
- Click to edit
- Add branch memberships
- Save

✅ **Verify role:**
- Check user's role
- Ensure role has at least `products:read` and `stock:read`
- Change role if needed (VIEWER is minimum)

✅ **Refresh user's browser:**
- Ask user to sign out and back in
- Or refresh page (F5)

### Issue: Can't Create Custom Role

**Symptoms:**
- "New Role" button missing
- Error creating role

**Common Causes:**
1. Missing `roles:manage` permission
2. Role name already exists

**Solutions:**

✅ **Check permissions:**
- Need `roles:manage` permission
- Only OWNER has this by default
- This is high-privilege permission

✅ **Use unique role name:**
- Each role name must be unique
- Search existing roles first
- Choose different name

✅ **Select at least one permission:**
- Roles must have 1+ permissions
- Can't create empty role

## AI Chatbot

### Issue: Chatbot Not Responding

**Symptoms:**
- Message sent but no response
- Loading spinner forever
- Error in chat

**Common Causes:**
1. Network connection lost
2. API server down
3. OpenAI API issue
4. Session expired

**Solutions:**

✅ **Check network:**
- Ensure internet connected
- Try refreshing page
- Check if other pages load

✅ **Retry message:**
- Click chat icon to close
- Reopen chat
- Send message again

✅ **Sign out and in:**
- Session might be expired
- Sign out
- Sign back in
- Try chat again

✅ **Contact admin:**
- If persistent issue
- Admin can check API server logs
- May be platform-wide issue

### Issue: Chatbot Says "Access Denied"

**Symptoms:**
- AI responds with "You don't have access"
- Can't retrieve requested data

**Common Causes:**
1. Requesting data from branch you're not member of
2. Missing permissions for feature
3. Data doesn't exist

**Solutions:**

✅ **Check branch membership:**
- Ask AI: "What branches am I assigned to?"
- Only query data for your branches
- Request branch access from admin

✅ **Verify permissions:**
- Ask AI: "What permissions do I have?"
- You can only access features you have permissions for
- Request permission from admin

✅ **Rephrase question:**
- Try asking differently
- Example: Instead of "Show all transfers", ask "Show my transfers"
- AI will filter to your accessible data

### Issue: Chatbot Giving Incorrect Information

**Symptoms:**
- AI response doesn't match reality
- Outdated or wrong data
- Suggests non-existent features

**Common Causes:**
1. AI hallucination (making up information)
2. Data recently changed
3. Feature not yet implemented

**Solutions:**

✅ **Verify in UI:**
- Check the actual page (Products, Transfers, etc.)
- UI data is authoritative
- Report discrepancy to admin

✅ **Ask for specific data:**
- Instead of general questions, be specific
- Example: "Show me transfer TRF-2025-0001"
- Specific queries less prone to hallucination

✅ **Use tools, not just knowledge:**
- Ask AI to "search" or "show" (uses tools)
- Avoid open-ended "tell me about" (uses knowledge)
- Tools pull real-time data

## Performance & Browser Issues

### Issue: Page Loading Slowly

**Symptoms:**
- Tables take long to load
- Spinning loader for extended time
- Page freeze or lag

**Common Causes:**
1. Large dataset (1000s of products/transfers)
2. Complex filters applied
3. Slow network connection
4. Browser performance

**Solutions:**

✅ **Use filters to reduce data:**
- Apply date range filters
- Filter by branch or status
- Reduce "per page" limit (50 → 20)

✅ **Pagination:**
- Don't load all data at once
- Use Next/Previous buttons
- Avoid requesting 1000+ items per page

✅ **Clear browser cache:**
- Clear cache and cookies
- Restart browser
- Try incognito mode

✅ **Check network:**
- Test internet speed
- Use wired connection if possible
- Close bandwidth-heavy apps

### Issue: Page Not Updating After Action

**Symptoms:**
- Made change but page shows old data
- Created item doesn't appear in list

**Common Causes:**
1. Page not refreshed
2. Filter hiding new item
3. Cache issue

**Solutions:**

✅ **Refresh page:**
- Press F5 or Ctrl+R
- Or click browser refresh
- Should show latest data

✅ **Clear filters:**
- New item might be filtered out
- Click "Clear all filters"
- Or adjust filters to include new item

✅ **Hard refresh:**
- Ctrl+Shift+R (Windows/Linux)
- Cmd+Shift+R (Mac)
- Clears cache and reloads

### Issue: Form Not Saving

**Symptoms:**
- Clicked "Save" but nothing happens
- No error message
- Form still editable

**Common Causes:**
1. Validation errors (not visible)
2. JavaScript error
3. Network issue
4. Session expired

**Solutions:**

✅ **Check for red errors:**
- Scroll through entire form
- Look for red error messages
- Fix all validation errors

✅ **Check browser console:**
- Press F12
- Click "Console" tab
- Look for red errors
- Screenshot and send to admin

✅ **Try again:**
- Wait 30 seconds
- Click Save again
- May have been temporary network issue

✅ **Copy data and refresh:**
- Copy form data to notepad
- Refresh page
- Re-enter and save

## Data & Reports

### Issue: Export Not Working

**Symptoms:**
- Click export but nothing happens
- No file downloaded

**Note:** Export functionality is not yet fully implemented.

**Current Workaround:**
- Use AI chatbot to get data
- Copy and paste into Excel
- Or take screenshots

**Future:**
- CSV/Excel export planned
- Will be available soon

### Issue: Activity Log Missing Entries

**Symptoms:**
- Expected to see change in activity
- Activity log incomplete

**Common Causes:**
1. Filtering applied
2. Not all actions logged (by design)
3. Date range too narrow

**Solutions:**

✅ **Clear filters:**
- Click "Clear all filters"
- Set wide date range
- Show all action types

✅ **Check correct entity:**
- Ensure viewing activity for correct item
- Product A's activity won't show Product B changes

✅ **Understand what's logged:**
- Creates, updates, deletes logged
- Read operations not logged
- Only state changes appear

## Using Activity Logs for Troubleshooting

### What Are Activity Logs?

Activity logs track every change made to entities in the system. They're your audit trail for understanding **who** changed **what** and **when**.

### Where to Find Activity Logs

**Most entities have an Activity tab:**
- Products → open product → **Activity** tab
- Branches → open branch → **Activity** tab
- Users → open user → **Activity** tab
- Roles → open role → **Activity** tab
- Stock Transfers → open transfer → **Activity** tab
- Theme Settings → **Activity** tab

**Organization-wide audit:**
- Analytics → Audit Log (requires `users:manage` permission)

### What Activity Logs Show

**For each change:**
- **When** - Date and time of change
- **Who** - User who made the change
- **What** - Which field(s) changed
- **Before/After** - Previous and new values
- **Action** - Type of change (CREATE, UPDATE, DELETE, STOCK_RECEIVE, etc.)
- **Correlation ID** - Unique identifier for request tracing

### Common Use Cases

**1. "Who changed the price?"**
```
Steps:
1. Open the product
2. Click Activity tab
3. Look for UPDATE action with "productPricePence" changed
4. See who made the change and when
```

**2. "What happened to this transfer?"**
```
Steps:
1. Open the transfer
2. Click Activity tab
3. Review timeline:
   - TRANSFER_REQUEST (created)
   - TRANSFER_APPROVE (approved)
   - TRANSFER_SHIP (shipped)
   - TRANSFER_RECEIVE (received)
4. See who performed each action
```

**3. "Why is stock wrong?"**
```
Steps:
1. Open the product
2. Click Activity tab
3. Filter to stock-related actions:
   - STOCK_RECEIVE
   - STOCK_ADJUST
   - STOCK_CONSUME
4. Identify unexpected adjustments
5. Contact user who made adjustment
```

**4. "Did someone archive this user?"**
```
Steps:
1. Open the user (change filter to show archived users)
2. Click Activity tab
3. Look for DELETE action (archive)
4. See who archived and when
5. Can restore if needed
```

### Filtering Activity Logs

**By Date Range:**
1. Click **Filters** button
2. Set **From Date** and **To Date**
3. Click **Apply**
4. Shows only changes in that timeframe

**By User (Actor):**
1. Click **Filters** button
2. Select specific user from dropdown
3. Click **Apply**
4. Shows only changes by that user

**By Action Type:**
1. Click **Filters** button (if available)
2. Select action type (CREATE, UPDATE, DELETE, etc.)
3. Click **Apply**

### Understanding Before/After Values

**Before Value:**
- State before the change
- `null` if field didn't exist (new creation)

**After Value:**
- State after the change
- `null` if field was deleted/cleared

**Example:**
```
Action: UPDATE
Field: productPricePence
Before: 1999 (£19.99)
After: 2499 (£24.99)
Who: alice@acme.com
When: 2025-01-15 14:30
```

### Using Correlation IDs

**What is a Correlation ID?**
- Unique identifier (UUID) for each API request
- Links all related actions together
- Used for debugging and tracing

**When to use:**
1. Copy correlation ID from activity log entry
2. Share with admin when reporting issues
3. Admin can search logs for complete request details
4. Traces request through entire system

**Example:**
```
Correlation ID: 550e8400-e29b-41d4-a716-446655440000

Admin can search logs to see:
- Which API endpoint was called
- Request body sent
- Response returned
- Any errors encountered
- Full request trace
```

### Activity Log Best Practices

**✅ Do:**
- Check activity logs before contacting admin
- Filter by date to find recent changes
- Note correlation ID when reporting issues
- Review before/after values to understand changes
- Use logs to verify your own actions were successful

**❌ Don't:**
- Ignore unusual activity (could indicate unauthorized access)
- Delete items thinking you can hide from logs (all actions tracked)
- Forget activity logs exist (they're your first troubleshooting stop)

---

## Session Management

### Understanding Session Expiration

**What is a session?**
- Your logged-in state maintained by the platform
- Stored in browser cookies
- Expires after period of inactivity or 24 hours (whichever comes first)

**Why sessions expire:**
- Security: Prevent unauthorized access if you leave computer unlocked
- Compliance: Reduce exposure window for sensitive data
- Resource management: Free up server resources

### Issue: "Your Session Has Expired" Error

**Symptoms:**
- Suddenly logged out mid-task
- Error message: "Your session has expired. Please sign in again."
- Redirected to sign-in page

**When this happens:**
1. Your session cookie expired (inactive for too long)
2. Platform automatically signs you out
3. Redirects you to sign-in page
4. **Remembers your intended destination**

**What to do:**

✅ **Sign in again:**
1. Enter your credentials on the sign-in page
2. Platform signs you in
3. **Automatically redirects you back** to the page you were on
4. Continue your work

✅ **Your work is preserved if:**
- You were viewing data (just refresh)
- You weren't mid-form (forms may be cleared)

❌ **Your work is lost if:**
- You were filling out a form (not yet saved)
- You were mid-edit (changes not saved)

**Prevention:**

✅ **Save frequently:**
- Click "Save" button often when editing
- Don't leave forms open for extended periods
- Complete tasks promptly

✅ **Stay active:**
- Sessions renew with activity
- Moving between pages counts as activity
- Idle for 30+ minutes risks expiration

### Issue: Session Expired While Filling Out Form

**Problem:** Lost form data after session expired

**Solutions:**

✅ **Work in shorter sessions:**
- Complete forms within 15-20 minutes
- Don't leave browser idle mid-form

✅ **Draft in external tool first:**
- Write long descriptions in Word/Notes
- Copy into platform when ready
- Reduces time spent in form

✅ **Save incrementally (if possible):**
- Some forms auto-save as you type
- Others require manual "Save" clicks
- Save early, save often

### Issue: Signed Out on Multiple Devices

**Problem:** Signed in on desktop, then signed in on laptop - desktop session ended

**This is normal behavior:**
- Platform allows one active session per user per tenant
- Signing in on new device ends previous session
- Security feature to prevent session hijacking

**Solutions:**

✅ **Sign out before switching devices:**
- Cleanly end session on first device
- Then sign in on second device

✅ **Complete work on one device:**
- Avoid switching mid-task
- Finish forms before moving to another computer

### Issue: Session Persists Too Long

**Problem:** Want to sign out automatically for security

**This is configurable by admins:**
- Contact your admin about session timeout policies
- They can adjust duration based on security needs

---

## Getting More Help

**If issue persists:**

1. **Note the error details:**
   - Exact error message
   - What you were doing
   - Screenshot if helpful
   - Correlation ID (if shown)

2. **Try AI chatbot:**
   - Describe the problem
   - Ask for troubleshooting steps

3. **Check activity logs:**
   - Review recent changes
   - Identify what changed and when

4. **Contact your admin:**
   - Provide error details
   - Explain steps to reproduce
   - Admin has access to server logs

5. **Platform support:**
   - If admin can't resolve
   - They can escalate to platform support
   - Include correlation ID for faster resolution

**Before contacting support:**
- ✅ Tried refreshing page
- ✅ Checked permissions
- ✅ Verified branch access
- ✅ Reviewed this troubleshooting guide
- ✅ Asked AI chatbot
- ✅ Noted exact error message

**Include in support request:**
- Your email
- Tenant slug
- Page/feature affected
- Exact error message
- Steps to reproduce
- Screenshot (if applicable)
- Correlation ID (from error response)
- What you expected to happen
- What actually happened
