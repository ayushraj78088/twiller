import mongoose from "mongoose";

const PaymentSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userEmail: { type: String, required: true },
  planName: { type: String, enum: ["Bronze", "Silver", "Gold"], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  transactionId: { type: String, required: true, unique: true },
  status: { type: String, enum: ["SUCCESS", "FAILED", "CANCELLED"], default: "SUCCESS" },
  paymentGateway: { type: String, default: "Razorpay/Stripe" },
  invoiceId: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Payment", PaymentSchema);
