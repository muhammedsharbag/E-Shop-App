const express = require("express");
const authService = require("../services/authService");
const { addProductToCart, getLoggedUserCart , removeSpecificCartItem, clearCart, updateCartItemQuantity, applyCoupon} = require("../services/cartService");

const router = express.Router();
router.use(authService.protect);
router.use(authService.allowedTo('user'));

router
  .route("/")
  .post( addProductToCart)
  .get(getLoggedUserCart)
  .delete(clearCart)
  
  router.put("/applyCoupon",applyCoupon)

  router
  .route("/:itemId")
  .delete(removeSpecificCartItem)
  .put(updateCartItemQuantity)

module.exports = router;
