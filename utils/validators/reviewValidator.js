const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

const Product = require("../../models/productModel");
const Review = require("../../models/reviewModel");

exports.getReviewValidator = [
  check("id").isMongoId().withMessage("InvalidReview id format"),
  validatorMiddleware,
];
exports.createReviewValidator = [
  check("title").optional(),
  check("ratings")
    .notEmpty()
    .withMessage("Review ratings required")
    .isFloat({ min: 1, max: 5 })
    .withMessage("Review ratings values must be between 1 and 5"),
  check("user").isMongoId().withMessage("Invalid User ID"),
  check("product")
    .isMongoId()
    .withMessage("Invalid Product ID")
    .custom(async (value, { req }) => {
      const product = await Product.findById(value);
      if (!product) {
        throw new Error("Product not found");
      }

      const existingReview = await Review.findOne({
        user: req.user._id,
        product: value,
      });

      if (existingReview) {
        throw new Error("You have already created a review for this product");
      }

      return true;
    }),
  validatorMiddleware,
];
exports.updateReviewValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Review id format")
    .custom(async (val, { req }) => {
      // Check review ownership before update
      const review = await Review.findById(val);
      if (!review) {
        throw new Error(`No review found with id ${val}`);
      }
      if (review.user._id.toString() !== req.user._id.toString()) {
        throw new Error("You are not allowed to update this review");
      }
      return true;
    }),
  check("title")
    .optional()
    .isString()
    .withMessage("Review title must be a string"),
  check("ratings")
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage("Review ratings must be between 1 and 5"),
  validatorMiddleware,
];
exports.deleteReviewValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid Review id format")
    .custom((val, { req }) =>
      //check review ownership before delete(if role is user)
      {
        if (req.user.role === "user") {
          return Review.findById(val).then((review) => {
            if (!review) {
              return Promise.reject(
                new Error(`No review found with this id ${val}`)
              );
            }
            if (review.user._id.toString() !== req.user._id.toString()) {
              return Promise.reject(
                new Error(`You are not allowed to perform this action`)
              );
            }
          });
        }
        return true;
      }
    ),
  validatorMiddleware,
];
