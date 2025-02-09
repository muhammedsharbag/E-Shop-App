const express = require("express");
const {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
  createFilterObj,
  setProductIdAndUserIdToBody,
} = require("../services/reviewService");
const {
  createReviewValidator,
  getReviewValidator,
  updateReviewValidator,
  deleteReviewValidator,
} = require("../utils/validators/reviewValidator");

const authService = require("../services/authService");

const router = express.Router({ mergeParams: true });
router.get("/", createFilterObj, getReviews);
router.get("/:id", getReviewValidator, getReview);
router.use(authService.protect);

router.post(
  "/",
  authService.allowedTo("user"),
  setProductIdAndUserIdToBody,
  createReviewValidator,
  createReview
);
router.put(
  "/:id",
  authService.allowedTo("user"),
  updateReviewValidator,
  updateReview
);

router.delete(
  "/:id",
  authService.allowedTo("user", "admin", "manager"),
  deleteReviewValidator,
  deleteReview
);

module.exports = router;
