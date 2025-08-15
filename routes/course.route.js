import express from "express";
import { isAuthenticated, restrictTo } from "../middleware/auth.middleware.js";
import {
  createNewCourse,
  searchCourses,
  getPublishedCourses,
  getMyCreatedCourses,
  updateCourseDetails,
  getCourseDetails,
  addLectureToCourse,
  getCourseLectures,
  getCourse,
  deleteCourse,
} from "../controllers/course.controller.js";
import upload from "../utils/multer.js";

const router = express.Router();

// Public routes
router.get("/published", getPublishedCourses);

/* THIS IS WRONG...

  if a get request comes to ".../search", it will be handled by ".../:courseId" and give error (if id is not passed)

  // router.get("/:courseId", getCourse);
  // router.get("/search", searchCourses);
  
  therefore, 
  // router.get("/search", searchCourses);
  // router.get("/:courseId", getCourse);
  
*/

router.get("/search", searchCourses);
router.get("/:courseId", getCourse);

// Protected routes
router.use(isAuthenticated);

// Course management
router.post("/", restrictTo("instructor"), upload.single("thumbnail"), createNewCourse)
router.get("/", restrictTo("instructor"), getMyCreatedCourses);

// Course details and updates
router
  .route("/c/:courseId")
  .get(getCourseDetails)
  .patch(
    restrictTo("instructor"),
    upload.single("thumbnail"),
    updateCourseDetails
  )
  .delete(deleteCourse)

// Lecture management
router
  .route("/c/:courseId/lectures")
  .get(getCourseLectures)
  .post(restrictTo("instructor"), upload.single("video"), addLectureToCourse);

export default router;
