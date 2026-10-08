# Live order status sync

## Order document fields

Order status remains in the existing `orders/{orderId}` document. New orders include:

- `status`: canonical order status (`pending`, `confirmed`, `preparing`, `ready`, `assigned`, `out_for_delivery`, `completed`, `delivered`, `cancelled`, or `rejected`).
- `statusHistory`: append-only-in-app event list with status, timestamp, and actor metadata.
- `updatedAt` and `updatedBy`: last status change metadata.
- `deliveryStatus`: retained for compatibility with delivery workflows and older clients.

All staff status transitions use the shared transaction helper. Existing orders are not rewritten: their current status remains visible, and subsequent transitions append history. For a legacy order without history, the UI shows its current status and the order creation/update time.

## Deployment

Deploy `firestore.indexes.json` with the Firebase CLI (or use the Firestore console link shown for the missing index). The composite index supports live account-order queries sorted by creation time. The app can be deployed independently after the index reaches `READY`.

## Security follow-up

`firestore.rules` currently permits unrestricted reads and writes. It is intentionally not replaced as part of this change: customer access can be tied to Firebase Auth, but staff panels currently use a custom JWT in browser `sessionStorage` and write directly through the Firebase client SDK. Firestore rules cannot validate that JWT. A secure role and branch policy needs a coordinated migration of staff Firestore operations to authenticated server endpoints using Firebase Admin credentials, or a migration of staff identities to Firebase Authentication with trusted role claims. Until then, browser-side status actor metadata is audit context, not authorization.

## Manual verification

1. Sign in as a customer, open Profile → Orders, and keep an active order expanded.
2. Change the order status from Kitchen, Counter, Admin, and Delivery as applicable. Confirm the profile status and status timeline update without refresh.
3. Sign in to the same account on another device and open `/track`. Confirm active orders appear and status changes update live.
4. Place two active orders and switch between them on `/track`.
5. Open `/track/{orderId}` from an active profile order and confirm it opens that order. Confirm a signed-out visitor is sent to sign in.
6. For a legacy counter order associated by the customer's registered phone, confirm the profile receives live status changes.
7. Confirm delivered, completed, cancelled, and rejected orders leave the active-order list but remain visible in history with their final status.
8. Confirm guest phone/order-number lookup still works for legacy orders.
