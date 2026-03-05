// heroikzrePayment.js
// Creator : Heroikzre API
// Author  : Daffa Heroik

const axios = require("axios");

const BASE_URL = "https://restapi.heroikzre.my.id";

async function createPayment(apikey, amount) {
  try {
    const { data } = await axios.get(`${BASE_URL}/payment/create`, {
      params: { apikey, amount },
      timeout: 15000
    });
    return data;
  } catch (err) {
    return { status: false, message: "Server Error" };
  }
}

async function checkPayment(apikey, idtrx) {
  try {
    const { data } = await axios.get(`${BASE_URL}/payment/check`, {
      params: { apikey, idtrx },
      timeout: 15000
    });
    return data;
  } catch (err) {
    return { status: false, message: "Server Error" };
  }
}

async function deletePayment(apikey, amount, idtrx) {
  try {
    const { data } = await axios.get(`${BASE_URL}/payment/delete`, {
      params: { apikey, amount, idtrx },
      timeout: 15000
    });
    return data;
  } catch (err) {
    return { status: false, message: "Server Error" };
  }
}

async function createPaymentMessage(apikey, amount) {
  const payment = await createPayment(apikey, amount);
  if (!payment || payment.status !== true) {
    return { status: false, message: "❌ Gagal membuat pembayaran" };
  }
  const { idtrx, qris_url, fee_admin, base_amount, amount: total_amount } = payment.result;
  const caption = `💳 *DEPOSIT QRIS*\n\n🧾 ID Transaksi:\n${idtrx}\n\n💰 Nominal:\nRp ${Number(base_amount).toLocaleString("id-ID")}\n\n💸 Fee Admin:\nRp ${Number(fee_admin).toLocaleString("id-ID")}\n\n📦 Total Bayar:\nRp ${Number(total_amount).toLocaleString("id-ID")}\n\n⚠️ Scan QRIS di atas\n⚠️ Verifikasi otomatis`.trim();
  return { status: true, idtrx, qris_url, amount: total_amount, base_amount, caption };
}

async function checkPaymentMessage(apikey, idtrx) {
  const res = await checkPayment(apikey, idtrx);
  if (!res || typeof res.status !== "boolean") {
    return { status: "error", text: "❌ Terjadi kesalahan server\nSilakan coba lagi." };
  }
  if (res.status === true && String(res.message).toLowerCase() === "sukses") {
    return { status: "sukses", text: "✅ *Pembayaran Berhasil!*\n\n💰 Pembayaran diterima." + (res.saldo !== undefined ? `\n📊 Saldo: Rp ${Number(res.saldo).toLocaleString("id-ID")}` : "") };
  }
  if (res.status === false && String(res.message).toLowerCase().includes("pending")) {
    return { status: "pending", text: "⏳ *Pembayaran Masih Pending*\n\nSilakan selesaikan pembayaran QRIS terlebih dahulu." };
  }
  if (res.status === false && String(res.message).toLowerCase().includes("expired")) {
    return { status: "expired", text: "⌛ *Transaksi Expired*\n\nSilakan buat transaksi baru." };
  }
  if (res.status === true && res.saldo !== undefined) {
    return { status: "sukses", text: "✅ *Transaksi Sudah Berhasil Sebelumnya*\n\n📊 Saldo: Rp " + Number(res.saldo).toLocaleString("id-ID") };
  }
  return { status: "error", text: "❌ *Gagal Mengecek Status*\n\n" + (res.message || "Status tidak dikenal, hubungi admin.") };
}

async function deletePaymentMessage(apikey, amount, idtrx) {
  const res = await deletePayment(apikey, amount, idtrx);
  if (!res || res.status !== true) {
    return { status: false, text: "❌ Gagal menghapus transaksi.\n" + (res?.message || "Server error, coba lagi nanti.") };
  }
  const { data, message, request_id, processing_time_ms } = res;
  const { idtrx: deletedId, amount: total, base_amount, fee_admin, unique_fee, created_at, deleted_at, hours_old } = data;
  const caption = `🗑️ *Transaksi Berhasil Dihapus*\n\n🧾 ID Transaksi: ${deletedId}\n💰 Nominal: Rp ${Number(base_amount).toLocaleString("id-ID")}\n💸 Fee Admin: Rp ${Number(fee_admin).toLocaleString("id-ID")}\n🔢 Kode Unik: ${unique_fee}\n📦 Total: Rp ${Number(total).toLocaleString("id-ID")}\n\n📅 Dibuat: ${new Date(created_at).toLocaleString("id-ID")}\n⌛ Dihapus: ${new Date(deleted_at).toLocaleString("id-ID")}\n🕒 Usia Transaksi: ${hours_old} jam\n\n✅ ${message}\n🔍 Request ID: ${request_id} (${processing_time_ms} ms)`.trim();
  return { status: true, text: caption, raw: res };
}

module.exports = { createPayment, checkPayment, deletePayment, createPaymentMessage, checkPaymentMessage, deletePaymentMessage };
