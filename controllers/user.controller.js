import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/generateToken.js";
import { deleteMediaFromCloudinary, uploadMedia } from "../utils/cloudinary.js";
import { catchAsync } from "../middleware/error.middleware.js";
import { AppError } from "../middleware/error.middleware.js";
import crypto from "crypto";
import axios from "axios";
import sendEmail from "../utils/sendMail.js";

/**
 * Create a new user account
 * @route POST /api/v1/user/signup
 */
export const createUserAccount = catchAsync(async (req, res) => {
  try {
    const { name, email, password, role } = req.body
    console.log(req.body)
    if (!name || !email || !password || !role) {
      throw new AppError("all fields are required", 401)
    }

    const existing = await User.findOne({ email })
    if (existing) {
      throw new AppError("user with this email already exists", 402)
    }

    const newUser = await User.create({ email, name, password, role })
    
    const token = generateAccessToken(newUser)
    const refreshToken = generateRefreshToken(newUser)

    await newUser.updateLastActive()

    return res.cookie("token", token, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 24*60*60*1000
    }).cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "strict",
    }).json({
      message: "user signed up",
      status: 200,
      success: true,
      data: {
        user: newUser,
        token,
        refreshToken
      }
    })
  } catch (error) {
    console.log(error)
    return new AppError(error, 500)
  }
});

/**
 * Authenticate user and get token
 * @route POST /api/v1/user/signin
 */
export const authenticateUser = catchAsync(async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    throw new AppError("all fields are required", 401)
  }

  const existing = await User.findOne({ email }).select("+password")
  if (!existing) {
    throw new AppError("user not found", 404)
  }

  const isValidUser = existing.comparePassword(password)
  if (!isValidUser) {
    throw new AppError("invalid creds", 402)
  }

  await existing.updateLastActive()

  const token = generateAccessToken(existing)
  const refreshToken = generateRefreshToken(existing)

  existing.refreshToken = refreshToken
  await existing.save({ ValidityBeforeSave: false })
  
  return res.cookie("token", token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 24*60*60*1000
  }).cookie("refreshToken", refreshToken, {
    httpOnly: true,
    sameSite: "strict",
  }).json({
    message: "user logged in",
    status: 200,
    success: true,
    data: {
      user: existing,
      token,
      refreshToken
    }
  })
});

/**
 * Sign in user with OAuth
 * @route GET /api/v1/user/oauth/google
 */
export const googleLogin = catchAsync(async (req,res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: "Authorization code is required" });
  }

  const tokenResponse = await axios.post(
    "https://oauth2.googleapis.com/token",
    {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    },
    { headers: { "Content-Type": "application/json" } }
  );

  const { access_token } = tokenResponse.data;

  const googleUser = await axios.get(
    `https://www.googleapis.com/oauth2/v2/userinfo`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    }
  );

  const { email, name, id: googleId } = googleUser.data;

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      name,
      email,
      provider: "google",
      providerId: googleId
    });
  } else if (user.provider !== "google") {
    return res.status(400).json({
      message: "Email already registered with a different provider",
    });
  }

  const token = generateAccessToken(user)
  const refreshToken = generateRefreshToken(user)

  user.refreshToken = refreshToken
  await user.save({ ValidityBeforeSave: false })
  console.log(user)

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 24*60*60*1000
  }).cookie("refreshToken", refreshToken,  {
    httpOnly: true,
    sameSite: "strict"
  }).json({
    message: "user logged in",
    status: 200,
    success: true,
    data: {
      user: user,
      token,
      refreshToken
    }
  })
  
})

/**
 * Sign out user and clear cookie
 * @route POST /api/v1/user/signout
 */
export const signOutUser = catchAsync(async (_, res) => {
  return res
    .cookie("token", "", { maxAge: 0 })
    .cookie("refreshToken", "", { maxAge: 0 })
    .json({
      message: "logged out",
      status: 200,
      success: true
    })
});

/**
 * Get current user profile
 * @route GET /api/v1/user/refresh-token
 */
export const refreshToken = catchAsync(async (req, res) => {
  const { token } = req.cookies.refreshToken
  if (!token) {
    throw new AppError('Refresh token is required', 401)
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId)
    if (!user) {
      throw new AppError('invalid refresh token', 401);
    }
    const refreshToken = user?.refreshToken

    if (refreshToken !== token) {
      throw new AppError('invalid refresh token', 401);
    }

    const newToken = generateAccessToken(user)

    return res
          .cookie('token', newToken)   
          .json(
          {
            status: 200,
            message: 'access token refreshed successfully',
            data: newToken
          })
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Refresh token expired — please log in again', 401)
    }
    throw new AppError('Internal server error :: refreshing token', 500)
  }
})


/**
 * Get current user profile
 * @route GET /api/v1/user/profile
 */
export const getCurrentUserProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({
      path: "enrolledCourses.course",
      select: "title description thumbnail",
    })
    .populate({
      path: "createdCourses",
      select: "title thumbnail enrolledStudents",
    })

  if (!user) {
    throw new AppError("user not found", 404)
  }

  return res.json({
    message: "user found",
    status: 200,
    success: true,
    data: {
      ...user.toJSON(),
      totalEnrolledCourses: user.totalEnrolledCourses,
    }
  })
});

/**
 * Update user profile
 * @route PATCH /api/v1/user/profile
 */
export const updateUserProfile = catchAsync(async (req, res) => {
  const { name, email, bio } = req.body
  const updateData = { name, email, bio }

  if (req.file) {
    const avatarResult = await uploadMedia(req.file.path)
    updateData.avatar = avatarResult?.secure_url || req.file.path

    const user = await User.findById(req.id);
    if (user.avatar && user.avatar !== "default-avatar.png") {
      await deleteMediaFromCloudinary(user.avatar);
    }
  }

  const updatedUser = await User.findByIdAndUpdate(req.id, updateData, {
    new: true,
    runValidators: true,
  })

  if (!updatedUser) {
    throw new AppError("User not found", 404);
  }

  return res.json({
    message: "user updated",
    status: 200,
    success: true,
    data: updatedUser
  })
});

/**
 * Change user password
 * @route PATCH /api/v1/user/change-password
 */
export const changeUserPassword = catchAsync(async (req, res) => {
  const { oldPassword, newPassword } = req.body

  const user = await User.findById(req.id).select("+password")
  if (!user) {
    throw new AppError("user not authenticated", 403)
  }
  
  if (!(await user.comparePassword(oldPassword))) {
    return res.json({
      message:"password incorrect",
      status: 403,
      success: false
    })
  }

  user.password = newPassword
  await user.save()

  return res.json({
    message: "password updated",
    status: 200,
    success: true
  })
});

/**
 * Request password reset
 * @route POST /api/v1/user/forgot-password
 * send mail with the token
 */
export const forgotPassword = catchAsync(async (req, res) => {
  // TODO: Implement forgot password functionality
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw new AppError("User not found", 404);

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
  const html = `
    <p>Hello ${user.name || ''},</p>

    <p>We received a request to reset your password for your account.</p>

    <p>Please click the link below to set a new password:</p>

    <p><a href="${resetUrl}" style="background-color:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Reset Password</a></p>

    <p>This link will expire in 15 minutes for your security.</p>

    <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>

    <p>Best regards,<br>UNotDummy</p>
  `;

  await sendEmail(user.email, "Password Reset", html);
  res.json({ success: true, message: "Reset link sent" });
});

/**
 * Reset password
 * @route POST /api/v1/user/reset-password/:token
 * Do the actual resetting
 */
export const resetPassword = catchAsync(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
    resetPasswordExpire: { $gt: Date.now() }
  })

  if (!user) {
    throw new AppError("Invalid or expired reset token", 400);
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  res.json({
    message: "Password reset successful",
    status: 200,
    success: true
  });
});

/**
 * Delete user account
 * @route DELETE /api/v1/user/account
 */
export const deleteUserAccount = catchAsync(async (req, res) => {
  const user = await User.findById(req.id)
  
  if (user.avatar && user.avatar !== "default-avatar.png") {
    await deleteMediaFromCloudinary(user.avatar);
  }

  await User.findByIdAndDelete(req.id);

  return res.cookie("token", "", { maxAge: 0 }).json({
    message: "account deleted",
    status: 200,
    success: true,
  })
});
