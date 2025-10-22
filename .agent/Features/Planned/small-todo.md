- Remove chat feature fallback (ALready planned)

- Do we need the 'active' value on transfer approvals anymore given we now have the archival functionality. The 'show rules' filter has three options, Active rules only, Active and archived, archived only, however, this 'Active rules only' refers to non archived rules, and not the actual active varialbe on the rule, which would be confusing to the user i imagine. 


- e2e suites that have failures:
    - Features 
        - feature-flags.spec.ts
            - Feature Flags: ACME tenant (BARCODE Scanning Enabled)
                - Should show "Scan to receive" button on stock transfers for ACME tenant
            (Same issue as the chat where the acme tenant needs to be seeded with the feature on by default for the test to work)

    - Products 
        - product-crud.spec.ts
            - Edit product flow 
                - Should handle cancel action
                @product-crud.spec.ts:441
                Error: locator.click: Error: strict mode violation: getByRole('button', { name: /cancel/i }) resolved to 2 elements:
                    1) <button type="button" data-variant="default" class="mantine-focus-auto mantine-active m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root">…</button> aka locator('#root').getByRole('button', { name: 'Cancel' })
                    2) <button type="button" data-variant="default" class="mantine-focus-auto mantine-active m_77c9d27d mantine-Button-root m_87cf2631 mantine-UnstyledButton-root">…</button> aka getByLabel('Archive Product?').getByRole('button', { name: 'Cancel' })

                Call log:
                - waiting for getByRole('button', { name: /cancel/i })
            
    - Stock
        - stock-management.spec.ts
            - FIFO Tab - Ledger Display and Filtering
                - Should display ledger table with entries
                - Should paginate ledger entires 
                both failing with this error:
                @factories.ts:375
                Error: Failed to adjust stock: 403 - {"success":false,"data":null,"error":{"errorCode":"PERMISSION_DENIED","httpStatusCode":403,"userFacingMessage":"You do not have permission for this action.","correlationId":"893edbc0-c792-4b69-bae7-52c74c14988f"}}

        - transfer-reversal-lot-restoration.spec.ts
            - ALL OF THESE TESTS ARE FAILIGN WITH THIS OUTPUT:
            @factories.ts:418
            Error: Failed to add stock: 403 - {"success":false,"data":null,"error":{"errorCode":"PERMISSION_DENIED","httpStatusCode":403,"userFacingMessage":"You do not have permission for this action.","correlationId":"f9e956e9-f9e9-4df8-98bc-924a8f74757c"}}

    - Transfers 
        - approval-rules.spec.ts
            - Approval Rules -List and Navigation 
                - Should navigate to approval rules page from sidebar
                (Failing because its tring to access the approval rules item in the sidebar without first opening the 'stock management' dropdown first. I imagine this test was written before i implemented the dropdowns in the sidebar)
            - Approval rules - Edit and delete
                - should delete rule with confirmation 
                (I believe this test was written before i implemented the approval rules archival. This test should be changed to test the archival feature instead of the old delete functionality)

        - multi-level-approval.spec.ts
            - Multi-level Approval - Transfer Creation
                - should create transfer that matches approval rule. 
                Failing with this output:
                @factories.ts:418
                Error: Failed to add stock: 403 - {"success":false,"data":null,"error":{"errorCode":"PERMISSION_DENIED","httpStatusCode":403,"userFacingMessage":"You do not have permission for this action.","correlationId":"da4f8c2b-ac03-4d1d-a8f1-d4ad573b9954"}}
            - Mult-level Approval - Approval Actions
                - should approve level 1 as authorized user
                - should reject level as authorized user
                Both failing with this error:
                @factories.ts:418
                Error: Failed to add stock: 403 - {"success":false,"data":null,"error":{"errorCode":"PERMISSION_DENIED","httpStatusCode":403,"userFacingMessage":"You do not have permission for this action.","correlationId":"7730acf5-39d5-4c96-8151-336116aae503"}}
            - Multi-level Approval - Sequential Workflow
                - should enforce sequential approval order 
                @factories.ts:418
                Error: Failed to add stock: 403 - {"success":false,"data":null,"error":{"errorCode":"PERMISSION_DENIED","httpStatusCode":403,"userFacingMessage":"You do not have permission for this action.","correlationId":"f589c694-fadb-425c-9277-f9a1002518e9"}}
        - transfer-analytics.spec.ts
            - Transfer prioritization 
                - should create transfer with URGENT priority 
                @factories.ts:418
                Error: Failed to add stock: 403 - {"success":false,"data":null,"error":{"errorCode":"PERMISSION_DENIED","httpStatusCode":403,"userFacingMessage":"You do not have permission for this action.","correlationId":"41c32bc7-86ae-42b0-9ea5-84fa8c852a72"}}
        - transfer-reversal.spec.ts
            - Transfer Reversal - Complete Flow
                - should create, complete, and reverse a transfer 
                @factories.ts:418
                Error: Failed to add stock: 403 - {"success":false,"data":null,"error":{"errorCode":"PERMISSION_DENIED","httpStatusCode":403,"userFacingMessage":"You do not have permission for this action.","correlationId":"77b627de-9ff1-4299-a0e1-bb0dacdd91c6"}}
            - Transfer Reversal - Validation 
                - Should not show reverse button on already-reversed transfers 
                (This test is failing because its trying to locate the stock transfer in the table which it fails to because there are too many. Instead, it should just go directly to the relevant stock transfer)
            - Transfer Reversal - Status Display 
                - Should show reversal transfers with COMPLETED status
                (This test is failing because its trying to locate the stock transfer in the table which it fails to because there are too many. Instead, it should just go directly to the relevant stock transfer)
        - transfer-template-archival.spec.ts
            - Transfer Template Archival - Filter functionality 
                - Should show only archived templates when filter is archived only
                Failing with this error when trying to clean up the test:
                @api-helpers.ts:67
                Error: apiRequestContext.fetch: read ECONNRESET
                Call log:
                - → DELETE http://localhost:4000/api/stock-transfer-templates/cmh20n7cq02kju2r0huyeqb8j
                    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.37 Safari/537.36
                    - accept: */*
                    - accept-encoding: gzip,deflate,br
                    - Cookie: mt_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjdXJyZW50VXNlcklkIjoiY21oMjBiM3JhMDBoN3UyOGM1emh0dHd4MyIsImN1cnJlbnRUZW5hbnRJZCI6ImNtaDIwYjNnbjAwMGR1MjhjeWdteGwybHciLCJpc3N1ZWRBdFVuaXhTZWNvbmRzIjoxNzYxMTM4OTIyLCJpYXQiOjE3NjExMzg5MjIsImV4cCI6MTc2MTE0MjUyMn0.oIK8yKsG75Plfvp05uaXa5wU0JiBGNYf743mrhVd3Ss
                    - Content-Type: application/json
        - transfer-templates.spec.ts
            - Transfer Templates - List and Navigation (ALL FAILING)
                (These tests are failing because since they we're written, the page has moved frrom /acme/transfer-templates, to /acme/stock-transfers/templates)
            - Transfer Templates Create Template (ALL FAILING)
                (These tests are failing because since they we're written, the page has moved frrom /acme/transfer-templates, to /acme/stock-transfers/templates)
            - Transfer Templates - Search and Filter (ALL FAILING)
                (These tests are failing because since they we're written, the page has moved frrom /acme/transfer-templates, to /acme/stock-transfers/templates)
            - Transfer Templates - Delete Template
                (These tests are failing because since they we're written, the page has moved frrom /acme/transfer-templates, to /acme/stock-transfers/templates)
            
    - Users
        - user-archival.spec.ts
            - User Archival Functionality 
                - should filter to show all users (active + archived)
                