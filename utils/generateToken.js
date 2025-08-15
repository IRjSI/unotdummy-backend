import jwt from "jsonwebtoken"

export const generateRefreshToken = (user) => {
  const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '10d' })

  return refreshToken
}

export const generateAccessToken = (user) => {
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' })

  return token
}