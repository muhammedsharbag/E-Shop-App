const express = require("express");


const authService = require("../services/authService");
const { getCoupons, createCoupon, getCoupon, updateCoupon, deleteCoupon } = require("../services/couponService");
const { createCouponValidator, getCouponValidator, updateCouponValidator, deleteCouponValidator } = require("../utils/validators/couponValidator");

const router = express.Router();
router.use(authService.protect);
router.use(authService.allowedTo("admin", "manager"));
router
  .route("/")
  .get(getCoupons)
  .post(createCouponValidator,createCoupon);
router
  .route("/:id")
  .get(getCouponValidator,getCoupon)
  .put(updateCouponValidator,updateCoupon)
  .delete(deleteCouponValidator,deleteCoupon);

module.exports = router;
