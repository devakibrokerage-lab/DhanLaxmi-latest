import placeMarketOrder from "./placeMarketOrder.js";
import Order from "../../Model/OrdersModel.js";   // adjust path as needed
import Fund from "../../Model/FundModel.js";     // adjust path as needed

export async function attemptSquareoff(order) {
  if (!order) return { ok: false, reason: 'no-order' };

  const orderStatus = order.order_status || order.orderStatus; // 'OPEN', 'HOLD', or null/undefined
  const orderCategory = order.order_category || order.orderCategory;
  
  // Expiry Date
  const expireDateRaw = order.meta?.selectedStock?.expiry || order.expireDate;
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  
  let expireDateStr = null;
  if (expireDateRaw) {
      expireDateStr = new Date(expireDateRaw).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  }

  const isActiveStatus = (status) => {
      return status === 'OPEN' || status === 'HOLD' || status === null || status === undefined;
  };

  const setOrderMarginBlockedZero = async (orderId) => {
    try {
      await Order.findByIdAndUpdate(
        orderId,
        { $set: { margin_blocked: 0, updatedAt: new Date() } },
        { new: true }
      );
    } catch (e) {
      console.error(`[Squareoff] Failed to clear margin_blocked for order ${orderId}:`, e);
    }
  };

  try {
    const isHold = orderStatus === 'HOLD';

    // CASE 1: INTRADAY (Hamesha Close hoga) BUT skip if it's a HOLD order.
    if (orderCategory === 'INTRADAY' && isActiveStatus(orderStatus) && !isHold) {
        console.log(`✅ [Squareoff] Closing Intraday: ${order._id} (Status: ${orderStatus})`);
        const res = await placeMarketOrder(order._id);

        // For INTRADAY non-HOLD, if placeMarketOrder indicates success, proceed to fund-release for HOLD orders
        // (existing behaviour kept: release margin only when original status was HOLD — but here !isHold so no release)
        // Still ensure margin_blocked is cleared in DB
        const successFlag = res && (res.ok === true || res.success === true || res.status === 'success' || res.updated);
        if (successFlag) {
          await setOrderMarginBlockedZero(order._id);
        }

        return { ok: true, action: 'closed_intraday', result: res };
    }

    // CASE 1b: HOLD orders (any category) -> Only close on expiry date. Do NOT release margin to fund; only set margin_blocked = 0.
    if (isHold && isActiveStatus(orderStatus)) {
        if (!expireDateStr) {
            return { ok: false, reason: 'no_expiry_date_found_for_hold' };
        }

        if (expireDateStr <= todayStr) {
            console.log(`✅ [Squareoff] Closing HOLD on Expiry: ${order._id} (Status: ${orderStatus}, Exp: ${expireDateStr})`);
            const res = await placeMarketOrder(order._id);

            const successFlag = res && (res.ok === true || res.success === true || res.status === 'success' || res.updated);
            if (successFlag) {
              // Important: do NOT modify Fund.* — just clear margin_blocked on order
              await setOrderMarginBlockedZero(order._id);
            }

            return { ok: true, action: 'closed_hold_on_expiry', result: res };
        } else {
            return { ok: true, action: 'hold_kept_active_future_expiry' };
        }
    }

    // CASE 2: OVERNIGHT / NON-HOLD (Sirf Expiry Date par close hoga)
    if (orderCategory === 'OVERNIGHT' && isActiveStatus(orderStatus)) {
        if (!expireDateStr) {
            return { ok: false, reason: 'no_expiry_date_found' };
        }

        if (expireDateStr <= todayStr) {
            console.log(`✅ [Squareoff] Closing EXPIRED Overnight: ${order._id} (Status: ${orderStatus}, Exp: ${expireDateStr})`);
            const res = await placeMarketOrder(order._id);

            // For overnight (and hold) we do NOT want automatic fund release — so we DON'T touch fund here.
            // But ensure DB order has margin_blocked cleared
            const successFlag = res && (res.ok === true || res.success === true || res.status === 'success' || res.updated);
            if (successFlag) {
              await setOrderMarginBlockedZero(order._id);
            }

            return { ok: true, action: 'closed_expired_overnight', result: res };
        } else {
            return { ok: true, action: 'kept_active_future_expiry' };
        }
    }

    return { ok: true, action: 'noop' };

  } catch (err) {
    console.error('[attemptSquareoff] Error:', err.message);
    return { ok: false, reason: 'error', error: err.message };
  }
}
