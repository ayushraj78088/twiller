"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Sparkles,
  CreditCard,
  ShieldCheck,
  Receipt,
  X,
  RefreshCw,
  Mail,
} from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";
import { useAuth } from "@/context/AuthContext";
import TwitterLogo from "@/components/TwitterLogo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SubscriptionQuota {
  subscriptionPlan: string;
  limit: number;
  tweetsPosted: number;
  remainingTweets: number | string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  isExpired: boolean;
}

export default function SubscriptionsPage() {
  const { user, setSessionUser } = useAuth();
  const [quota, setQuota] = useState<SubscriptionQuota | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<{
    allowed: boolean;
    currentIST: string;
    window: string;
  }>({
    allowed: false,
    currentIST: "",
    window: "10:00 AM - 11:00 AM IST",
  });

  const [bypassCheck, setBypassCheck] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"Bronze" | "Silver" | "Gold" | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInvoice, setSuccessInvoice] = useState<any | null>(null);

  // Simulated Card Details
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("123");

  const fetchQuotaAndStatus = async () => {
    try {
      // 1. Fetch Payment Time Window Status
      const statusRes = await axiosInstance.get("/payment-status", {
        params: { bypassPaymentCheck: bypassCheck },
      });
      setPaymentStatus(statusRes.data);

      // 2. Fetch User Quota if logged in
      if (user?._id) {
        const quotaRes = await axiosInstance.get(`/user-subscription/${user._id}`);
        setQuota(quotaRes.data);
      }
    } catch (err) {
      console.error("Failed to fetch subscription status:", err);
    }
  };

  useEffect(() => {
    fetchQuotaAndStatus();
    const interval = setInterval(fetchQuotaAndStatus, 10000);
    return () => clearInterval(interval);
  }, [user, bypassCheck]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayCheckout = async (plan: "Bronze" | "Silver" | "Gold") => {
    setErrorMsg(null);
    if (!user) {
      setErrorMsg("Please sign in to upgrade your subscription plan.");
      return;
    }

    if (quota?.subscriptionPlan === plan && !quota?.isExpired) {
      setErrorMsg(`You are already subscribed to the ${plan} Plan.`);
      return;
    }

    if (!paymentStatus.allowed && !bypassCheck) {
      setErrorMsg(
        "Payment system is time-restricted. Payments and subscription upgrades are allowed only between 10:00 AM and 11:00 AM IST."
      );
      return;
    }

    setIsProcessing(true);

    try {
      const intentRes = await axiosInstance.post("/create-payment-intent", {
        userId: user._id,
        email: user.email,
        planName: plan,
        bypassPaymentCheck: bypassCheck,
      });

      const orderData = intentRes.data;
      const scriptLoaded = await loadRazorpayScript();

      if (scriptLoaded && (window as any).Razorpay) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount * 100,
          currency: "INR",
          name: "Twiller / X Inc.",
          description: `${plan} Plan Subscription`,
          handler: async function (response: any) {
            const txnId = response.razorpay_payment_id || `pay_${Date.now()}`;
            await handleProcessPayment("SUCCESS", plan, txnId);
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
            },
          },
          prefill: {
            name: user.displayName,
            email: user.email,
          },
          theme: {
            color: "#1d9bf0",
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on("payment.failed", function (response: any) {
          console.error("Razorpay payment failed:", response.error);
          setIsProcessing(false);
          setSelectedPlan(plan);
          setIsCheckoutOpen(true);
        });
        rzp.open();
        setIsProcessing(false);
      } else {
        setSelectedPlan(plan);
        setIsCheckoutOpen(true);
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.warn("Razorpay trigger error, falling back to test modal:", err);
      setSelectedPlan(plan);
      setIsCheckoutOpen(true);
      setIsProcessing(false);
    }
  };

  const handleOpenCheckout = (plan: "Bronze" | "Silver" | "Gold") => {
    handleRazorpayCheckout(plan);
  };

  const handleProcessPayment = async (
    status: "SUCCESS" | "FAILED" | "CANCELLED" = "SUCCESS",
    targetPlan?: "Bronze" | "Silver" | "Gold",
    customTxnId?: string
  ) => {
    const planToProcess = targetPlan || selectedPlan;
    if (!user || !planToProcess) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const transactionId = customTxnId || `TXN_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

      const res = await axiosInstance.post("/process-payment", {
        userId: user._id,
        email: user.email,
        planName: planToProcess,
        transactionId,
        paymentStatus: status,
        bypassPaymentCheck: bypassCheck,
      });

      if (res.data.success) {
        setSuccessInvoice(res.data.invoice);
        setIsCheckoutOpen(false);

        // Update AuthContext session user with new subscription
        if (res.data.user) {
          setSessionUser(res.data.user);
        }

        // Refresh quota
        fetchQuotaAndStatus();
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        "Payment processing failed. Please ensure you are within 10:00 AM - 11:00 AM IST.";
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const planCards = [
    {
      name: "Free",
      price: "₹0",
      period: "forever",
      limit: "1 Tweet",
      tweets: 1,
      color: "border-gray-800 bg-gray-950",
      badge: "Default",
      buttonText: "Current Plan",
      buttonVariant: "outline" as const,
      features: ["1 Tweet limit per account", "Standard tweeting", "Audio tweet support"],
    },
    {
      name: "Bronze",
      price: "₹100",
      period: "/ month",
      limit: "3 Tweets",
      tweets: 3,
      color: "border-amber-700/60 bg-gradient-to-b from-amber-950/40 via-gray-950 to-black",
      badge: "Bronze Tier",
      buttonText: "Upgrade to Bronze",
      buttonVariant: "default" as const,
      features: ["Up to 3 Tweets per account", "Priority tweet processing", "Audio tweet support", "Monthly Invoice Receipt"],
    },
    {
      name: "Silver",
      price: "₹300",
      period: "/ month",
      limit: "5 Tweets",
      tweets: 5,
      color: "border-slate-400/60 bg-gradient-to-b from-slate-900/60 via-gray-950 to-black",
      badge: "Most Popular 🔥",
      buttonText: "Upgrade to Silver",
      buttonVariant: "default" as const,
      features: ["Up to 5 Tweets per account", "Advanced engagement analytics", "High-priority support", "Monthly Invoice Receipt"],
    },
    {
      name: "Gold",
      price: "₹1000",
      period: "/ month",
      limit: "Unlimited Tweets",
      tweets: -1,
      color: "border-yellow-500/80 bg-gradient-to-b from-yellow-950/60 via-gray-950 to-black",
      badge: "Best Value 👑",
      buttonText: "Upgrade to Gold",
      buttonVariant: "default" as const,
      features: [
        "Unlimited Tweets & Retweets",
        "Gold VIP Verification Badge",
        "Unlimited Audio tweets",
        "Instant Email Invoices",
        "24/7 Dedicated Support",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="p-2 rounded-full hover:bg-gray-900 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center space-x-2">
                <Crown className="h-6 w-6 text-yellow-400" />
                <span>Premium Subscriptions</span>
              </h1>
              <p className="text-xs text-gray-400">
                Choose a plan to regulate your posting activity and unlock premium tweeting capacity.
              </p>
            </div>
          </div>
          <TwitterLogo size="md" className="text-white hidden sm:block" />
        </div>

        {/* Payment Time Window Status Banner */}
        <Card className="bg-gradient-to-r from-gray-950 via-gray-900 to-black border-gray-800 text-white shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div
                className={`p-3 rounded-full border ${
                  paymentStatus.allowed
                    ? "bg-green-950/80 text-green-400 border-green-500/40"
                    : "bg-amber-950/80 text-amber-400 border-amber-500/40"
                }`}
              >
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base">Payment Window: {paymentStatus.window}</h3>
                  <Badge
                    className={`${
                      paymentStatus.allowed
                        ? "bg-green-500/20 text-green-400 border-green-500/40"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    }`}
                  >
                    {paymentStatus.allowed ? "WINDOW OPEN (10 AM - 11 AM IST)" : "WINDOW CLOSED"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Current IST Time: <span className="text-white font-mono">{paymentStatus.currentIST || "Evaluating..."}</span>
                  {!paymentStatus.allowed && " — Payments and plan upgrades are permitted strictly between 10:00 AM and 11:00 AM IST."}
                </p>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* User Current Quota Summary */}
        {user && quota && (
          <Card className="bg-gray-950 border-gray-800 text-white rounded-2xl">
            <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Active Plan Status</p>
                <div className="flex items-center space-x-3">
                  <span className="text-xl font-bold text-blue-400">{quota.subscriptionPlan} Plan</span>
                  <Badge variant="outline" className="text-gray-300 border-gray-700">
                    {quota.limit === -1 ? "Unlimited Tweets" : `${quota.limit} Tweet Limit`}
                  </Badge>
                </div>
                {quota.subscriptionExpiresAt && (
                  <p className="text-xs text-gray-400">
                    Expires on: {new Date(quota.subscriptionExpiresAt).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-6 text-center">
                <div>
                  <p className="text-2xl font-extrabold text-white">{quota.tweetsPosted}</p>
                  <p className="text-xs text-gray-400">Tweets Posted</p>
                </div>
                <div className="h-8 w-px bg-gray-800" />
                <div>
                  <p className="text-2xl font-extrabold text-green-400">
                    {quota.remainingTweets}
                  </p>
                  <p className="text-xs text-gray-400">Remaining Quota</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="flex items-start space-x-3 bg-red-950/80 border border-red-800/80 text-red-300 p-4 rounded-xl text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
            <div className="flex-1">{errorMsg}</div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {planCards.map((plan) => {
            const isCurrent = quota?.subscriptionPlan === plan.name && !quota?.isExpired;
            return (
              <Card
                key={plan.name}
                className={`relative flex flex-col justify-between border ${plan.color} text-white rounded-2xl shadow-xl transition-all duration-200 hover:border-blue-500/50`}
              >
                <div>
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-center mb-2">
                      <Badge className="bg-gray-900 border-gray-700 text-gray-300 text-xs">
                        {plan.badge}
                      </Badge>
                      {isCurrent && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/40 text-xs">
                          Active Plan
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                    <div className="flex items-baseline space-x-1 mt-2">
                      <span className="text-3xl font-black text-white">{plan.price}</span>
                      <span className="text-xs text-gray-400">{plan.period}</span>
                    </div>
                    <CardDescription className="text-xs font-semibold text-blue-400 mt-1">
                      Limit: {plan.limit}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="border-t border-gray-800/80 pt-3" />
                    <ul className="space-y-2">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center space-x-2 text-xs text-gray-300">
                          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </div>

                <div className="p-6 pt-0 mt-4">
                  {plan.name === "Free" ? (
                    <Button variant="outline" className="w-full rounded-full border-gray-700 text-gray-400" disabled>
                      {isCurrent ? "Active Plan" : "Included"}
                    </Button>
                  ) : (
                    <Button
                      variant={isCurrent ? "outline" : "default"}
                      className={`w-full rounded-full font-bold ${
                        isCurrent
                          ? "border-gray-700 text-gray-400"
                          : "bg-blue-500 hover:bg-blue-600 text-white"
                      }`}
                      disabled={isCurrent}
                      onClick={() => handleOpenCheckout(plan.name as any)}
                    >
                      {isCurrent ? "Current Plan" : `Select ${plan.name}`}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

      </div>

      {/* Payment Gateway Modal (Razorpay / Stripe Simulation) */}
      {isCheckoutOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-gray-800 text-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-bold">Secure Payment Checkout</h3>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Plan Summary */}
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Selected Subscription:</span>
                <span className="font-bold text-white">{selectedPlan} Plan</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Tweet Posting Limit:</span>
                <span className="font-bold text-blue-400">
                  {selectedPlan === "Gold" ? "Unlimited" : selectedPlan === "Silver" ? "5 Tweets" : "3 Tweets"}
                </span>
              </div>
              <div className="flex justify-between items-center text-base font-bold border-t border-gray-800 pt-2">
                <span>Total Amount Due:</span>
                <span className="text-green-400 text-lg">
                  ₹{selectedPlan === "Gold" ? "1000" : selectedPlan === "Silver" ? "300" : "100"}
                </span>
              </div>
            </div>

            {/* Simulated Payment Form */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Cardholder Email</label>
                <input
                  type="text"
                  value={user?.email || ""}
                  disabled
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400">Card Number (Test Mode)</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Expiry Date</label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">CVC / CVV</label>
                  <input
                    type="text"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-gray-400 bg-gray-900/60 p-2.5 rounded-lg border border-gray-800">
              <ShieldCheck className="h-4 w-4 text-green-400 shrink-0" />
              <span>Encrypted via Razorpay / Stripe Payment Gateway. Invoice emailed automatically.</span>
            </div>

            {/* Actions: Test Success, Fail, or Cancel */}
            <div className="space-y-2">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-full text-base"
                disabled={isProcessing}
                onClick={() => handleProcessPayment("SUCCESS")}
              >
                {isProcessing ? (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Verifying & Upgrading Plan...</span>
                  </div>
                ) : (
                  `Pay ₹${selectedPlan === "Gold" ? "1000" : selectedPlan === "Silver" ? "300" : "100"} & Upgrade`
                )}
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-800 text-red-400 hover:bg-red-950/50 text-xs"
                  onClick={() => handleProcessPayment("FAILED")}
                  disabled={isProcessing}
                >
                  Simulate Failure
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-700 text-gray-400 hover:bg-gray-900 text-xs"
                  onClick={() => setIsCheckoutOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Success Modal */}
      {successInvoice && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-950 border border-green-500/40 text-white rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-green-500/20 text-green-400 rounded-full border border-green-500/40">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold text-white">Payment Successful!</h3>
              <p className="text-xs text-gray-300">
                Your subscription has been upgraded to <strong className="text-blue-400">{successInvoice.planName} Plan</strong>.
              </p>
            </div>

            {/* Invoice Breakdown */}
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Invoice Number:</span>
                <span className="font-mono font-bold text-white">{successInvoice.invoiceId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Transaction ID:</span>
                <span className="font-mono font-bold text-white">{successInvoice.transactionId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">Date & Time (IST):</span>
                <span className="font-bold text-white">{successInvoice.paymentDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800">
                <span className="text-gray-400">New Tweet Posting Limit:</span>
                <span className="font-bold text-green-400">{successInvoice.tweetLimit}</span>
              </div>
              <div className="flex justify-between py-2 text-sm font-bold">
                <span>Amount Paid:</span>
                <span className="text-green-400">₹{successInvoice.amount}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-xs text-blue-400 bg-blue-950/60 p-3 rounded-xl border border-blue-800/60">
              <Mail className="h-4 w-4 shrink-0" />
              <span>Invoice receipt email has been dispatched to <strong>{user?.email}</strong>.</span>
            </div>

            <Button
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-full"
              onClick={() => setSuccessInvoice(null)}
            >
              Done & Continue Tweeting
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
