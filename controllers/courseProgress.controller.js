import { CourseProgress } from "../models/courseProgress.js";
import { Course } from "../models/course.model.js";
import { catchAsync } from "../middleware/error.middleware.js";
import { AppError } from "../middleware/error.middleware.js";
import { Lecture } from "../models/lecture.model.js";

/**
 * Get user's progress for a specific course
 * @route GET /api/v1/progress/:courseId
 */
export const getUserCourseProgress = catchAsync(async (req, res) => {
  // TODO: Implement get user's course progress functionality
  const { courseId } = req.params

  const courseDetails = await Course.findById(courseId).populate("lectures").select("courseTitle courseThumbnail lectures")
  if (!courseDetails) {
    throw new AppError("now course found", 404)
  }

  const courseProgress = await CourseProgress.findOne({ course: courseId, user: req.id })
  if (!courseProgress) {
    return res.status(200).json({
      success: true,
      data: {
        courseDetails,
        progress: [],
        isCompleted: false,
        completionPercentage: 0,
      },
    });
  }

  if (courseProgress.isCompleted) {
    return res.json({
      message: "course progress(completed)",
      status: 200,
      succcess: true,
      data: {
        courseDetails,
        progress: courseProgress.lectureProgress,
        isCompleted: courseProgress.isCompleted,
        completionPercentage: courseProgress.completionPercentage
      }
    })
  }
  
  return res.json({
    message: "course progress",
    status: 200,
    succcess: true,
    data: {
      courseDetails,
      progress: courseProgress.lectureProgress,
      isCompleted: courseProgress.isCompleted,
      completionPercentage: courseProgress.completionPercentage
    }
  })
});

/**
 * Update progress for a specific lecture
 * @route PATCH /api/v1/progress/:courseId/lectures/:lectureId
 */
export const updateLectureProgress = catchAsync(async (req, res) => {
  // TODO: Implement update lecture progress functionality
  const { courseId, lectureId } = req.params

  let isLecCompleted = true;
  
  let courseProgress = await CourseProgress.findOne({ course: courseId, user: req.id })
  if (!courseProgress) {
    // just started the course
    courseProgress = await CourseProgress.create({
      user: req.id,
      course: courseId,
      isCompleted: false,
      lectureProgress: []
    })
    isLecCompleted = false
    
  } 
  
  /*
    Example:

    we found the courseProgress. And the lectureId is, say, of the lecture no.5, so the lectureIndex will be 4.
    so set this lecture as completed in courseProgress. If no lecture with the id is found that means we need to push that lecture in courseProgress

    we didn't find any courseProgress. So, create courseProgress and set it as not completed since we just started the course

  */
  const lectureIndex = courseProgress.lectureProgress.findIndex(
    lecture => lecture.lecture.toString() === lectureId
  )

  if (lectureIndex !== -1) {
    courseProgress.lectureProgress[lectureIndex].isCompleted = true
  } else {
    courseProgress.lectureProgress.push({
      lecture: lectureId,
      isCompleted: true
    })
  }

  const course = await Course.findById(courseId)
  const completedLectures = courseProgress.lectureProgress.filter(lecture => lecture.isCompleted).length

  courseProgress.isCompleted = course.lectures.length === completedLectures

  const lecture = await Lecture.findById(lectureId)

  await lecture.updateLectureProgress(isLecCompleted)

  await courseProgress.save()

  return res.json({
    status: 200,
    success: true,
    message: "Lecture progress updated successfully",
    data: {
      lectureProgress: courseProgress.lectureProgress,
      isCompleted: courseProgress.isCompleted,
    }
  })
  
})

/**
 * Mark entire course as completed
 * @route PATCH /api/v1/progress/:courseId/complete
 */
export const markCourseAsCompleted = catchAsync(async (req, res) => {
  const { courseId } = req.params
  
  const courseProgress = await CourseProgress.findOne({ course: courseId, user: req.id })
  if (!courseProgress) {
    throw new AppError("Course progress not found", 404);
  }

  courseProgress.lectureProgress.forEach((progress) => progress.isCompleted = true)
  courseProgress.isCompleted = true
  
  await courseProgress.save()

  res.status(200).json({
    success: true,
    message: "Course marked as completed",
    data: courseProgress,
  })
});

/**
 * Reset course progress
 * @route PATCH /api/v1/progress/:courseId/reset
 */
export const resetCourseProgress = catchAsync(async (req, res) => {
  const { courseId } = req.params
  
  const courseProgress = await CourseProgress.findOne({ course: courseId, user: req.id })
  if (!courseProgress) {
    throw new AppError("Course progress not found", 404);
  }

  courseProgress.lectureProgress.forEach((progress) => progress.isCompleted = false)
  courseProgress.isCompleted = false
  
  await courseProgress.save()

  res.status(200).json({
    success: true,
    message: "Course progress reset",
    data: courseProgress,
  })
});
