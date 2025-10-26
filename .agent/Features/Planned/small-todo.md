- Probably change the permission required for the features 
    - Currently it is theme:manage which doesnt make sense
    - Should either be a new permission, or tenant:manage

- Small issues identified
    - We need to make sure, for prices, that the frontend only ever uses pounds (never pence/dollars/cents)
        - Products page filters
        - Adjust stock modal
    - It seems the date formats are wrong. They're currently using american date format (MM/DD/YYYY), but i want it to use (DD/MM/YYYY)