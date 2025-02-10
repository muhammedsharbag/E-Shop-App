const express = require("express");

const authService = require("../services/authService");
const { createCashOrder, findAllOrders, findSpecificOrder, filterOrderForLoggedUser, updateOrderToPaid, updateOrderToDelivered, checkoutSession } = require("../services/orderService");

const router = express.Router();
router.use(authService.protect);

router.route("/:cartId").post(authService.allowedTo("user"),createCashOrder)
router.put("/:orderId/pay",authService.allowedTo("admin","manager"),updateOrderToPaid)
router.put("/:orderId/deliver",authService.allowedTo("admin","manager"),updateOrderToDelivered)


router.get("/",authService.allowedTo("user","admin","manager"),filterOrderForLoggedUser,findAllOrders)
router.get("/:orderId",authService.allowedTo("user","admin","manager"),findSpecificOrder)
router.get("/checkout-session/:cartId",authService.allowedTo("user"),checkoutSession)

module.exports = router;

