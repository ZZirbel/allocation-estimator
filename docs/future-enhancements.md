# Future Enhancements

Enhancements identified during initial build that are not yet implemented.
These can be picked up in future iterations.

## UX Improvements

### Utilization Heatmap (#18)
Color-code allocation cells by intensity:
- Green: < 50% allocation
- Yellow: 50-75% allocation
- Red: > 75% allocation
Helps quickly spot over/under-allocation at a glance.

## Export & Integration

### Configurable XLSX Template (#20)
Let users upload their company's branded Excel template and map fields to it,
so exports match their SOW format exactly. Useful for firms with strict
proposal formatting requirements.

### Import from Excel (#21)
Drag-and-drop an existing estimate spreadsheet (like the original template)
and auto-populate the app. Reduces onboarding friction for teams migrating
from spreadsheet-based workflows.

## Enterprise Features

### Client & Opportunity Metadata (#13)
Link estimates to an opportunity name, expected close date, and probability
percentage. Enables pipeline-weighted revenue forecasting across all active
estimates.

### Revenue Recognition Timeline (#10)
Show cumulative revenue curve over the engagement timeline. Useful for
finance teams forecasting bookings by quarter and tracking against targets.

### Discount / Adjustment Row (#15)
Apply a percentage discount or fixed dollar adjustment to the total per phase.
Common in negotiations (e.g., "give them 10% off phase 2"). Should show
original price, discount, and net price.
