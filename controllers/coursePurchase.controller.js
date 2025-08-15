import Stripe from "stripe";
import { Course } from "../models/course.model.js";
import { CoursePurchase } from "../models/coursePurchase.model.js";
import { Lecture } from "../models/lecture.model.js";
import { User } from "../models/user.model.js";
import { catchAsync } from "../middleware/error.middleware.js";
import { AppError } from "../middleware/error.middleware.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe checkout session for course purchase
 * @route POST /api/v1/payments/create-checkout-session
 */
export const initiateStripeCheckout = catchAsync(async (req, res) => {
  // TODO: Implement stripe checkout session creation functionality
});

/**
 * Handle Stripe webhook events
 * @route POST /api/v1/payments/webhook
 */
export const handleStripeWebhook = catchAsync(async (req, res) => {
  // TODO: Implement stripe webhook handling functionality
});

/**
 * Get course details with purchase status
 * @route GET /api/v1/payments/courses/:courseId/purchase-status
 */
export const getCoursePurchaseStatus = catchAsync(async (req, res) => {
  const { courseId } = req.params
  
  const course = await Course.findById(courseId)
  if (!course) {
    throw new AppError("Course not found", 404);
  }

  const purchased = await CoursePurchase.findOne({ course: courseId, user: req.id, status: "completed" })

  return res.json({
    message: "purchase status",
    status: 200,
    success: true,
    data: Boolean(purchased)
  })
});

/**
 * Get all purchased courses
 * @route GET /api/v1/payments/purchased-courses
 */
export const getPurchasedCourses = catchAsync(async (req, res) => {
  const courses = await CoursePurchase.findOne({ user: req.id, status: "completed" })

  return res.json({
    message: "purchased courses",
    status: 200,
    success: true,
    data: courses
  })
});
