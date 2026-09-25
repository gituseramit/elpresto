"use client";

import React, { useState } from "react";
import { Star, CheckCircle, X, MessageSquare, AlertCircle } from "lucide-react";
import { submitProductRating } from "@/lib/ratingService";

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

export default function RatingModal({
  isOpen,
  onClose,
  order,
  userId,
  userName,
  onSuccess,
}: RatingModalProps) {
  const [selectedRatings, setSelectedRatings] = useState<Record<string, number>>({});
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const items = order.items || [];

  const handleStarClick = (productId: string, star: number) => {
    setSelectedRatings((prev) => ({ ...prev, [productId]: star }));
  };

  const handleReviewChange = (productId: string, text: string) => {
    setReviews((prev) => ({ ...prev, [productId]: text }));
  };

  const handleSubmitAll = async () => {
    setError(null);
    const itemIds = Object.keys(selectedRatings);
    if (itemIds.length === 0) {
      setError("Please rate at least one item by clicking on the stars.");
      return;
    }

    setSubmitting(true);
    try {
      for (const pid of itemIds) {
        const itemObj = items.find((i: any) => (i.id || i.name) === pid);
        const name = itemObj?.name || pid;
        const star = selectedRatings[pid] || 5;
        const reviewText = reviews[pid] || "";

        await submitProductRating({
          productId: pid,
          productName: name,
          userId,
          userName: userName || "Valued Customer",
          orderId: order.id,
          orderNumber: order.orderNumber,
          rating: star,
          review: reviewText,
        });
      }

      setSubmitted(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error("Failed to submit ratings:", err);
      setError(err.message || "Failed to submit ratings. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-orange-100 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#D92312] bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              Verified Order Experience
            </span>
            <h3 className="text-xl font-black text-gray-950 mt-1">
              Rate Dishes from Order #{order.orderNumber}
            </h3>
            <p className="text-xs text-gray-500">
              Help fellow foodies discover the best crusts and toppings!
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg animate-bounce">
              <CheckCircle size={36} />
            </div>
            <h4 className="text-lg font-black text-gray-950">Thank You For Your Feedback!</h4>
            <p className="text-xs text-gray-600 max-w-xs">
              Your real rating has been saved and is now helping calibrate community recommendations.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {items.map((item: any) => {
                const pid = item.id || item.name;
                const currentRating = selectedRatings[pid] || 0;

                return (
                  <div
                    key={pid}
                    className="p-4 rounded-2xl bg-orange-50/40 border border-orange-100 space-y-2.5 transition hover:bg-orange-50/70"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🍕</span>
                        <div>
                          <p className="text-sm font-black text-gray-900">{item.name}</p>
                          <p className="text-[11px] font-bold text-gray-400">
                            {item.quantity}x • ₹{item.price}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleStarClick(pid, star)}
                            className="p-1 hover:scale-125 transition-transform"
                            title={`${star} Star`}
                          >
                            <Star
                              size={22}
                              className={
                                star <= currentRating
                                  ? "fill-amber-400 text-amber-500"
                                  : "text-gray-300"
                              }
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {currentRating > 0 && (
                      <div className="relative">
                        <MessageSquare
                          size={14}
                          className="absolute left-3 top-3 text-gray-400"
                        />
                        <input
                          type="text"
                          placeholder="What did you think of the flavor, crust, or cheese? (Optional)"
                          value={reviews[pid] || ""}
                          onChange={(e) => handleReviewChange(pid, e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-white rounded-xl border border-orange-200/80 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400 placeholder:text-gray-400 font-medium"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitAll}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D92312] to-[#F59E0B] text-white text-xs font-black shadow-md shadow-red-500/25 hover:shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                {submitting ? "Saving Ratings..." : "Submit Ratings"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
