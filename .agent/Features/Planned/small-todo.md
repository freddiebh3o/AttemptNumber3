- Stock transfer additional features:
    - When a stock transfer is created, we need to create a PDF document for the stock transfer dispatch note, aswell as a purchase order PDF document. Obviously the purchase order will be have a order total of 0 as its just transferring stock between branches

- Probably change the permission required for the features 
    - Currently it is theme:manage which doesnt make sense
    - Should either be a new permission, or tenant:manage

- Small issues identified
    - We need to make sure, for prices, that the frontend only ever uses pounds (never pence/dollars/cents)
    - It seems the date formats are wrong. They're currently using american date format (MM/DD/YYYY), but i want it to use (DD/MM/YYYY)