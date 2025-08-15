import { Course } from "../models/course.model.js";
import { Lecture } from "../models/lecture.model.js";
import { User } from "../models/user.model.js";
import { deleteMediaFromCloudinary, uploadMedia } from "../utils/cloudinary.js";
import { catchAsync } from "../middleware/error.middleware.js";
import { AppError } from "../middleware/error.middleware.js";
import mongoose from "mongoose";

/**
 * Create a new course
 * @route POST /api/v1/course
 */
export const createNewCourse = catchAsync(async (req, res) => {
  // TODO Clean up the code (lectures part)  

  const { title, subtitle, description, level, category, price, lectureIds, currency } = req.body

  const lectureIdsClean = lectureIds && lectureIds.replace("[", "").replace("]", "")
  const lecturesIdsArray = lectureIdsClean ? lectureIdsClean.split(",") : []

  if (!req.file) {
    throw new AppError("thumbnail is req")
  }
  const thumbnailResult = await uploadMedia(req.file.path)
  const thumbnail = thumbnailResult.secure_url || req.file.path

  const course = await Course.create({ title, subtitle, description, level, category, price: parseInt(price), thumbnail, currency, instructor: req.id })
  
  for (let i = 0; i < lecturesIdsArray.length; i++) {
    const lectureIdClean = lecturesIdsArray[i].replaceAll('"', '')
    const lectureId = new mongoose.Types.ObjectId(lectureIdClean)
    course.lectures.push(lectureId)
  }
  await course.save();

  // update User model
  await User.findByIdAndUpdate(req.id, {
    $push: { createdCourses: course._id }
  })

  return res.json({
    message: "course created",
    success: true,
    status: 201,
    data: course
  })
});

/**
 * Search courses with filters
 * @route GET /api/v1/course/search
 */
export const searchCourses = catchAsync(async (req, res) => {
  // search with filters *******
  
  const {
    query ="",
    categories = [],
    level,
    priceRange,
    sortBy = "newest"
  } = req.query
  
  // Create search query
  const searchCriteria = {
    isPublished: true,
    $or: [
      { title: { $regex: query, $options: "i" } },
      { subtitle: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ],
  }

  // if categories are selected
  if (categories.length > 0) {
    searchCriteria.category = { $in: categories }
  }

  if (level) {
    searchCriteria.level = level
  }

  if (priceRange) {
    const [min, max] = priceRange.split("-")
    searchCriteria.price = { $gte: min || 0, $lte: max || Infinity }
  }

  const sortOptions = {}
  switch(sortBy) {
    case "price-low":
      sortOptions.price = 1
      break
    case "price-high":
      sortOptions.price = -1
      break
    case "oldest":
      sortOptions.createdAt = 1
      break
    default:
      sortOptions.createdAt = -1
  }

  const courses = await Course.find(searchCriteria).populate({ path: "instructor", select: "name avatar" }).sort(sortOptions)

  return res.json({
    message: "all courses matching search",
    status: 200,
    success: true,
    count: courses.length,
    data: courses
  })
});

/**
 * Get all published courses WITH PAGINATION
 * @route GET /api/v1/courses/published
 */
export const getPublishedCourses = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 1
  const skip = (page - 1) * limit

  const courses = await Course.find({ isPublished: true }).populate({ path: "instructor", select: "name avatar" }).sort({ createdAt: -1 }).skip(skip).limit(limit)

  const total = await Course.countDocuments({ isPublished: true })

  return res.json({
    message: "all published courses",
    status: 200,
    success: true,
    data: courses,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  })
});

export const getCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params

  const course = await Course.findById(courseId).populate({ path: "instructor", select: "name avatar"})
  if (!course) {
    return res.json({
      message: "Course not found",
      status: 404,
      success: false
    })
  }

  return res.json({
    message: "Course Found",
    status: 200,
    success: true,
    data: course
  })
})

/**
 * Get courses created by the current user
 * @route GET /api/v1/courses/my-courses
 */
export const getMyCreatedCourses = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 1
  const skip = (page - 1) * limit

  const courses = await Course.find({ instructor: req.id }).populate({ path: "enrolledStudents", select: "name avatar"}).sort({ createdAt: -1 }).skip(skip).limit(limit)

  const total = await Course.countDocuments({ instructor: req.id })

  return res.json({
    message: "my courses",
    status: 200,
    success: true,
    count: courses.length,
    data: courses,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    }
  })
});

/**
 * Update course details
 * @route PATCH /api/v1/course/c/:courseId
 */
export const updateCourseDetails = catchAsync(async (req, res) => {
  const { courseId } = req.params
  const { title, description, category, level, price, isPublished, currency } = req.body
  const updateData = { title, description, category, level, price: parseInt(price), currency, isPublished: isPublished === "true" ? true : false }

  const course = await Course.findById(courseId)
  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.instructor.toString() !== req.id) {
    throw new AppError("Not authorized to update this course", 403);
  }

  if (req.file) {
    await deleteMediaFromCloudinary(course.thumbnail)
    const thumbnailResult = await uploadMedia(req.file.path)
    updateData.thumbnail = thumbnailResult?.secure_url || req.file.path
  }

  await course.updateOne(updateData, { new: true, runValidators: true })
  const updatedCourse = await course.save()

  return res.json({
    message: "course updated",
    status: 200,
    success: true,
    data: updatedCourse
  })
});

export const deleteCourse = catchAsync(async (req,res) => {
  const { courseId } = req.params
  if (!courseId) {
    throw new AppError("courseId required", 402)
  }

  const course = await Course.findByIdAndDelete(courseId)
  if (!course) {
    throw new AppError("Course not found", 404)
  }

  return res.json({
    message: "course deleted",
    status: 200,
    success: true,
    data: course
  })
})

/**
 * Get course by ID
 * @route GET /api/v1/courses/:courseId
 */
export const getCourseDetails = catchAsync(async (req, res) => {
  const { courseId } = req.params
  const course = await Course.findById(courseId).populate({ path: "instructor", select: "name avatar bio" }).populate({ path: "lectures", select: "title videoUrl duration isPreview order" });

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  return res.json({
    message: "course details",
    status: 200,
    success: true,
    data: course
  })
});

/**
 * Add lecture to course
 * @route POST /api/v1/courses/:courseId/lectures
 */
export const addLectureToCourse = catchAsync(async (req, res) => {
  const { courseId } = req.params
  const { title, description, isPreview } = req.body

  const isPreviewBoolean = isPreview === "false" ? false : true
  
  const course = await Course.findById(courseId)
  if (!course) {
    throw new AppError("Course not found", 404);
  }
  if (course.instructor.toString() !== req.id) {
    throw new AppError("Not authorized to update this course", 403);
  }
  
  if (!req.file) {
    throw new AppError("video file req", 403)
  }

  const videoResult = await uploadMedia(req.file.path)
  if (!videoResult) {
    throw new AppError("error uploading video", 500)
  }

  const lecture = await Lecture.create({
    title,
    description,
    isPreview: isPreviewBoolean,
    order: course.lectures.length + 1,
    videoUrl: videoResult?.secure_url || req.file.path,
    publicId: videoResult?.public_id || req.file.path,
    duration: videoResult?.duration || 0
  })

  course.lectures.push(lecture._id)
  await course.save()

  return res.json({
    message: "Lecture added successfully",
    status: 201,    
    success: true,
    data: lecture
  })
});

/**
 * Get course lectures
 * @route GET /api/v1/courses/:courseId/lectures
 */
export const getCourseLectures = catchAsync(async (req, res) => {
  const { courseId } = req.params
  const course = await Course.findById(courseId).populate({
    path: "lectures",
    select: "title description videoUrl duration isPreview order isCompleted",
    options: { sort: { order: 1 } },
  });

  const lectures = course.lectures
  
  const isEnrolled = course.enrolledStudents.includes(req.id);
  const isInstructor = course.instructor.toString() === req.id;
  
  // if (!isEnrolled && !isInstructor) {
  //   // Only return preview lectures for non-enrolled users
  //   lectures = lectures.filter((lecture) => lecture.isPreview);
  // }

  return res.json({
    message: "lectures details",
    status: 200,
    success: true,
    data: {
      lectures,
      isEnrolled,
      isInstructor,
    }
  })
});
