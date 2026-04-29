import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { updateUserTotalSpent } from "@/lib/auth";
import { notifyTelegram, escapeHtml } from "@/lib/telegram";

/**
 * TrueMoney webhook endpoint
 * TODO: Implement actual TrueMoney API verification when available
 * For now, this accepts manual confirmation (admin or callback)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentRef, transactionId, status } = body;

    if (!paymentRef) {
      return NextResponse.json({ error: "Missing payment reference" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { paymentRef },
      include: { game: true, product: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status !== "PENDING") {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // TODO: Verify with TrueMoney API using transactionId
    // For now, trust the webhook (admin should verify manually)
    if (status === "PAID" || status === "COMPLETED") {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      if (order.userId) {
        await updateUserTotalSpent(order.userId, order.amountUsd);
      }

      const baseUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "";
      const link = baseUrl ? `\n<a href="${baseUrl}/admin/orders/${order.orderNumber}">Open in admin</a>` : "";
      await notifyTelegram(
        `💰 <b>New paid order (TrueMoney)</b>\n` +
          `<b>#${escapeHtml(order.orderNumber)}</b>\n` +
          `${escapeHtml(order.game.name)} — ${escapeHtml(order.product.name)}\n` +
          `UID: <code>${escapeHtml(order.playerUid)}</code>\n` +
          `Amount: ${order.currency === "KHR"
            ? `${Math.round(order.amountKhr ?? 0).toLocaleString()} KHR`
            : `$${order.amountUsd.toFixed(2)}`}${link}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[truemoney-webhook] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
