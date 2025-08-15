import Razorpay from "razorpay";
import crypto from "crypto";
import { Course } from "../models/course.model.js";
import { CoursePurchase } from "../models/coursePurchase.model.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.id
    const { courseId } = req.body
    const course = await Course.findById(courseId).select("title description")
    if (!course) {
      return res.json({
        message: "course not found",
        status: 404,
        success: false
      })
    }

    const newPurchase = await CoursePurchase.create({
      course: courseId,
      user: userId,
      amount: course.price,
      status: "pending"
    })

    const options = {
      amount: course.price * 100,
      currency: "INR",
      receipt: `course_${courseId}`,
      notes: {
        courseId,
        userId
      }
    }

    const order = await razorpay.orders.create(options)

    newPurchase.paymentId = order.id,
    await newPurchase.save()

    return res.json({
      message: "purchase successful",
      status: 200,
      success: true,
      data: {
        order,
        course
      }
    })
  } catch (error) {
    console.log(error.message)
    throw new Error(error)
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    const body = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(body.toString()).digest('hex')
    const isAuthentic = expectedSignature === razorpay_signature
    
    if (!isAuthentic) {
      return res.json({
        message: "payment verification failed",
        status: 400,
        success: false
      })
    }
    
    const purchase = await CoursePurchase.findOne({ paymentId: razorpay_order_id })
    if (!purchase) {
      return res.json({
        message: "purchase not found",
        status: 404,
        success: false
      })
    }
    
    purchase.status = "completed",
    await purchase.save()
    
    return res.json({
      message: "purchase completed",
      status: 200,
      success: true,
      data: purchase.course
    })
  } catch (error) {
    console.log(error.message)
    throw new Error(error)
  }
};
