# Transfer Performance Metrics

## Overview

Transfer metrics help you understand how efficiently stock is moving between your branches. These analytics track transfer volumes, completion rates, cycle times, and fulfillment accuracy.

**What You Can Track:**
- Transfer volumes by status
- Completion and rejection rates
- Average cycle time (request to completion)
- Fill rates (requested vs received quantities)
- Inbound vs outbound performance by branch

## Accessing Transfer Metrics

### Via AI Chatbot

The fastest way to get transfer metrics is through the AI assistant:

**Click the chat icon** in the header and ask:
- "Show me transfer metrics for the last 30 days"
- "How many transfers did we complete this month?"
- "What's our transfer completion rate?"
- "Show me transfer stats for the last week"

The AI will return real-time metrics based on your accessible branches.

### Dashboard (Future)

A visual analytics dashboard is planned but not yet implemented. For now, use the AI chatbot for metrics.

## Available Metrics

### Overall Transfer Metrics

**Total Transfers**
- Count of all transfers within the selected period
- Includes all statuses (completed, pending, in-transit, etc.)

**Completed Transfers**
- Number of transfers with status = COMPLETED
- Transfers fully received at destination

**Pending Transfers**
- Number of transfers with status = REQUESTED
- Awaiting approval or action

**In-Transit Transfers**
- Number of transfers with status = IN_TRANSIT
- Shipped but not yet received

**Completion Rate**
- Percentage of transfers that reached COMPLETED status
- Formula: (Completed / Total) × 100
- Example: 85% means 85 out of 100 transfers completed

**Average Cycle Time**
- Average days from request to completion
- Only includes completed transfers
- Measures end-to-end efficiency
- Example: 3.5 days average from request to receipt

**Fill Rate**
- Percentage of requested quantity actually received
- Formula: (Total Received / Total Requested) × 100
- Example: 92% means 92 units received for every 100 requested
- Measures fulfillment accuracy

### Status Breakdown

**REQUESTED**
- Transfers awaiting approval
- Initial state after creation

**APPROVED**
- Transfers approved but not yet shipped
- Waiting for shipping action

**IN_TRANSIT**
- Transfers shipped but not received
- Goods en route to destination

**COMPLETED**
- Transfers fully received
- Final successful state

**REJECTED**
- Transfers denied approval
- Will not proceed

**CANCELLED**
- Transfers manually cancelled
- Can occur at any stage

## Filtering Metrics

### By Time Period

**Default: Last 30 Days**
- Standard period for metrics

**Custom Periods**
- Ask AI: "Show transfer metrics for the last 7 days"
- Ask AI: "Transfer stats for the last 90 days"
- Supported: Any number of days (e.g., 7, 14, 30, 60, 90)

### By Branch

**All Your Branches (Default)**
- Aggregates metrics across all branches you're a member of

**Specific Branch**
- Ask AI: "Show transfer metrics for London Warehouse"
- Ask AI: "Transfer stats for branch [ID]"
- Only shows transfers where that branch is source or destination

**Branch Membership Required**
- You can only view metrics for branches you're assigned to
- Contact admin if you need access to other branches

## Interpreting Metrics

### High Completion Rate (>90%)

**What it means:**
- Transfers are successfully completing
- Strong operational efficiency
- Good coordination between branches

**Actions:**
- Maintain current processes
- Document best practices
- Share success with team

### Low Completion Rate (<70%)

**What it means:**
- Many transfers stuck or cancelled
- Potential bottlenecks in workflow
- Approval or shipping issues

**Actions:**
- Investigate pending/rejected transfers
- Review approval rules for bottlenecks
- Check if transfers are being cancelled and why
- Train staff on transfer workflows

### Long Cycle Time (>7 days)

**What it means:**
- Transfers taking too long to complete
- Delays in approval, shipping, or receiving
- Potential stock availability issues

**Actions:**
- Review approval turnaround times
- Check shipping delays
- Train receiving staff to process faster
- Consider streamlining approval rules

### Short Cycle Time (<2 days)

**What it means:**
- Very efficient transfer process
- Fast approval and fulfillment
- Good for urgent/high-priority transfers

**Actions:**
- Document the process for other branches
- Maintain the efficiency
- Consider if quality is being sacrificed for speed

### Low Fill Rate (<85%)

**What it means:**
- Receiving less than requested
- Potential stock shortage at source
- Discrepancies during receiving
- Partial shipments common

**Actions:**
- Investigate source branch stock levels
- Check for receiving errors or discrepancies
- Review partial shipment policies
- Consider adjusting request quantities

### High Fill Rate (>95%)

**What it means:**
- Accurately fulfilling requests
- Good stock availability at source
- Effective receiving process

**Actions:**
- Maintain current accuracy standards
- Share best practices with other branches

## Branch Performance Metrics

### Inbound vs Outbound Analysis

**Inbound Transfers**
- Transfers coming TO a branch
- Measures how well branch receives stock
- Metrics: Count, quantities received, fill rate

**Outbound Transfers**
- Transfers going FROM a branch
- Measures how well branch fulfills requests
- Metrics: Count, quantities shipped, fill rate

**Net Flow**
- Difference between inbound received and outbound shipped
- Positive = More stock coming in than going out
- Negative = More stock going out than coming in
- Helps understand branch inventory trends

### Asking for Branch Performance

**Via AI:**
- "How is London Warehouse performing?"
- "Show me branch performance for Main Warehouse"
- "What's the inbound/outbound volume for Store 1?"

**What You'll Get:**
- Inbound transfer count and fill rate
- Outbound transfer count and fill rate
- Net flow (quantity difference)
- Completed transfer counts
- Period analyzed (week, month, quarter)

### Performance Periods

**Week** (7 days)
- Recent short-term performance
- Good for identifying immediate issues

**Month** (30 days) - Default
- Standard performance review period
- Balances recent trends with statistical significance

**Quarter** (90 days)
- Long-term performance trends
- Good for strategic planning

## Common Questions

### "Why are my metrics different from my colleague's?"

**Reason:** Branch membership filtering
- Each user only sees metrics for their assigned branches
- Your colleague may be a member of different branches
- Contact admin if you need access to more branches

### "Why is completion rate 0%?"

**Possible Reasons:**
- No transfers completed in the selected period
- All transfers are still pending/in-transit
- Try extending the time period (e.g., 90 days instead of 7)
- Check if you have branch access

### "Fill rate is over 100% - is that an error?"

**No, it's possible:**
- Destination received MORE than requested
- Can happen if source ships extra units
- Or if receiving staff recorded quantity incorrectly
- Review specific transfers to investigate

### "Cycle time shows 0 days - how?"

**Explanation:**
- Transfer requested and completed on same day
- Very fast approval and fulfillment
- Rounded down from partial day
- Example: 6-hour cycle time rounds to 0 days

### "Can I export metrics to Excel?"

**Not yet:**
- Export functionality not implemented
- Currently view-only through AI chatbot
- Future feature: Dashboard with export options

### "How do I track metrics over time?"

**Workaround:**
- Ask AI for metrics at regular intervals (weekly, monthly)
- Manually record results in spreadsheet
- Future: Automated trend charts and historical tracking

## Use Cases

### Weekly Performance Review

**Questions to Ask AI:**
1. "Show transfer metrics for the last 7 days"
2. "What's our completion rate this week?"
3. "How many pending transfers do we have?"

**What to Look For:**
- Are completion rates declining?
- Is cycle time increasing?
- Are there more pending transfers than usual?

### Monthly Branch Review

**Questions to Ask AI:**
1. "Show branch performance for [Branch Name] this month"
2. "What's the inbound fill rate for [Branch]?"
3. "Show me net flow for [Branch]"

**What to Look For:**
- Is branch receiving stock efficiently?
- Is branch fulfilling outbound requests accurately?
- Is inventory growing or shrinking?

### Quarterly Strategic Planning

**Questions to Ask AI:**
1. "Show transfer metrics for the last 90 days"
2. "What's our average cycle time over 3 months?"
3. "Compare branch performance for [Branch A] vs [Branch B]"

**What to Look For:**
- Long-term trends (improving or declining?)
- Which branches are high/low performers?
- Where should we invest in process improvements?

### Troubleshooting Delays

**Questions to Ask AI:**
1. "Show me pending transfers"
2. "What's our cycle time for the last month?"
3. "How many transfers are stuck in approval?"

**What to Look For:**
- Where are transfers getting stuck? (approval, shipping, receiving)
- Which branches have longest cycle times?
- Are approval rules too strict?

## Permissions Required

**To view transfer metrics:**
- No specific permission required (all authenticated users)
- Must be a member of at least one branch
- Can only see metrics for your assigned branches

**Branch Access:**
- Managed through Users page
- Contact admin to request branch membership

## Related Guides

- [Stock Transfers Overview](../stock-transfers/overview.md)
- [Approving Transfers](../stock-transfers/approving-transfers.md)
- [Shipping Transfers](../stock-transfers/shipping-transfers.md)
- [Receiving Transfers](../stock-transfers/receiving-transfers.md)
- [Managing Branches](../branches-users/managing-branches.md)
