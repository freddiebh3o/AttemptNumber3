# Frontend features

## Products

### Overview tab (General product info)
- Product name
- SKU (Product code)
- Price
- Barcode Type
- Barcode

### Stock levels
Simple table to show amount of stock at different branches

### FIFO tab 
- FIFO control + ledger
- Allows the user to manually adjust stock
- Stock is shown in lots. Each lot represent a shipment of that product entering or exiting the branch
- Ledger that shows complete stock flow for the product

### Activity tab
- Shows complete activity history for the product. So every change made to the product is logged
- Includes a timeline view

### Archival 
- Because products have ledger history, you cannot simply delete them, so instead, they can be archvied 


## Stock Transfers 
- Allows the user to request a stock transfer from one branch to another
    - Stock transfer is created initially in a requested state, and needs to reviewed by someone at the source branch
    - Once the transfer has been approved, it can then be shipped to the destination branch
    - At this point, you can choose to ship the entire order, or partial ship it if you want to
    - Once the items have been shipped or partially shipped, a user at the destination branch can choose to either scan to recive them (using the barcode feature if enabled), or manually receive the item
    - Once received, the transfer can then be reversed. If reversed, it creates an identical stock transfer, in the opposite direction that follows the same process
- Stock transfers has lots of differnet functionality 

### Transfer templates
- If a user finds that there is a specific transfer that they find themselves repeating, then they can create a template for it that allows them to quickly create the stock transfer 

### Approval rules 
- You can set specific rules that apply to stock transfers given different conditions 
- For example:
    - Rule: If total value of order exceeds x amount, approval rule is applied
    - Aproval mode: SEQUENTIAL|PARALLEL|HYBRID
        - Sequential -> Requires approvals in a certain order
        - Parallel -> Approvals can be made in any order
        - Hybrid -> A mix of both, i.e. need approval of both of these people in any order, before we then get approval off of this person
    - Approval levels: Who needs to approve this, i.e. the owner or an admin etc 

### Transfer analytics
- Shows analytics for all stock transfers, including a bottleneck analyis showing how long each stage takes. 

## User management 

### Users 
- Can create a user with the following values
    - Email
    - Password
    - Role
    - branch memeberships 
- Can also see all activity for this user
    - Who/when anything about the user changed 
    - When they login/logout

### Roles
- Can create custom roles with specific permissions that can be assigned to a user

## Branches 
- Allows the user to set up differnt branches/locations 
- Activity tab showing changes to the branches 

## System

### Theme
- Allows the user to set a custom colour theme and logo
- Comes with light and dark theme

### Feature flags
- Allows the user to toggle on and off different features
    - AI Chat assistant 
    - Barcode Scanning

### Audit log 
- Log of every request made through the platform 

### AI Chat
- AI Chat loaded with user guides for the platform
- Chat also has read access to the database, so you can ask it specific questions about live data
- Has chat analytics to show stats for the ai chat