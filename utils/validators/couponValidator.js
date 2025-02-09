const moment = require('moment');

const { check } = require('express-validator');
const validatorMiddleware = require('../../middlewares/validatorMiddleware');
const Coupon = require('../../models/couponModel'); // Assuming Coupon is your model and you require it like this

// Create Coupon Validator
exports.createCouponValidator = [
    check('name')
        .notEmpty().withMessage('Coupon name is required')
        .isString().withMessage('Coupon name must be a String')
        .custom(async (name) => {
            const existingCoupon = await Coupon.findOne({ name });
            if (existingCoupon) {
                throw new Error("Coupon name already exists");
            }
        }),
    check('expire')
        .notEmpty().withMessage('Coupon expiration date is required')
        .custom((expire) => {
            const parsedDate = moment(expire, 'MM/DD/YYYY', true);
            if (!parsedDate.isValid()) {
                throw new Error('Invalid expiration date format. Use MM/DD/YYYY');
            }
            if (parsedDate.isBefore(moment())) {
                throw new Error("Coupon expiration date cannot be in the past");
            }
            return true;
        }),
    check('discount')
        .notEmpty().withMessage('Coupon discount is required')
        .isNumeric().withMessage('Coupon discount must be a number')
        .custom((discount) => {
            discount = Number(discount); // Ensure it's treated as a number
            if (discount <= 0 || discount > 100) {
                throw new Error("Coupon discount must be between 1 and 100");
            }
            return true;
        }),
    validatorMiddleware,
];

// Update Coupon Validator
exports.updateCouponValidator = [
    check('id')
        .notEmpty().withMessage('Coupon ID is required')
        .isMongoId().withMessage('Coupon ID must be a valid Mongo ID'),
    check('name')
        .optional()
        .isString().withMessage('Coupon name must be a String')
        .custom(async (name, { req }) => {
            if (name) {
                const existingCoupon = await Coupon.findOne({ 
                    name: { $eq: name }, 
                    _id: { $ne: req.params.id } // Exclude the current coupon being updated
                });
                if (existingCoupon) {
                    throw new Error("Coupon name already exists");
                }
            }
            return true;
        }),
    check('expire')
        .optional()
        .custom((expire) => {
            if (expire) {
                const parsedDate = moment(expire, 'MM/DD/YYYY', true);
                if (!parsedDate.isValid()) {
                    throw new Error('Invalid expiration date format. Use MM/DD/YYYY');
                }
                if (parsedDate.isBefore(moment())) {
                    throw new Error("Coupon expiration date cannot be in the past");
                }
            }
            return true;
        }),
    check('discount')
        .optional()
        .isNumeric().withMessage('Coupon discount must be a number')
        .custom((discount) => {
            if (discount) {
                discount = Number(discount); // Ensure it's treated as a number
                if (discount <= 0 || discount > 100) {
                    throw new Error("Coupon discount must be between 1 and 100");
                }
            }
            return true;
        }),
    validatorMiddleware,
];

// Delete Coupon Validator
exports.deleteCouponValidator = [
    check('id')
        .notEmpty().withMessage('Coupon ID is required')
        .isMongoId().withMessage('Coupon ID must be a valid Mongo ID'),
    validatorMiddleware,
];

// Get Coupon Validator
exports.getCouponValidator = [
    check('id')
        .notEmpty().withMessage('Coupon ID is required')
        .isMongoId().withMessage('Coupon ID must be a valid Mongo ID'),
    validatorMiddleware,
];
