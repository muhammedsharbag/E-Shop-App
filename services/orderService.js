const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const asyncHandler = require('express-async-handler');
const { default: mongoose } = require('mongoose');

const ApiError = require('../utils/apiError');
const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');

// @desc    Create a cash order
// @route   POST /api/v1/orders/:cartId
// @access  Protected/User
exports.createCashOrder = asyncHandler(async (req, res, next) => {
  const taxPrice = 0;
  const shippingPrice = 0;
  const cart = await Cart.findById(req.params.cartId);
  if (!cart) {
    return next(new ApiError(`No cart found with ID ${req.params.cartId}`, 404));
  }
  const cartPrice = cart.totalPriceAfterDiscount || cart.totalCartPrice;
  const totalOrderPrice = cartPrice + taxPrice + shippingPrice;
  const order = await Order.create({
    user: req.user._id,
    cartItems: cart.cartItems,
    shippingAddress: req.body.shippingAddress,
    totalOrderPrice,
  });
  if (order) {
    const bulkOption = cart.cartItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.quantity, sold: item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});
    await Cart.findByIdAndDelete(req.params.cartId);
  }
  res.status(201).json({ status: 'success', data: order });
});
exports.updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) {
    return next(new ApiError(`There is no order with the ID: ${req.params.orderId}`, 404));
  }
  order.isPaid = true;
  order.paidAt = Date.now();
  const updatedOrder = await order.save();
  res.status(200).json({ status: 'success', data: updatedOrder });
});
exports.updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) {
    return next(new ApiError(`There is no order with the ID: ${req.params.orderId}`, 404));
  }
  order.isDelivered = true;
  order.deliveredAt = Date.now();
  const updatedOrder = await order.save();
  res.status(200).json({ status: 'success', data: updatedOrder });
});

exports.checkoutSession = asyncHandler(async (req, res, next) => {
  try {
    const taxPrice = 0;
    const shippingPrice = 0;
    if (!mongoose.Types.ObjectId.isValid(req.params.cartId)) {
      return next(new ApiError('Invalid cart ID format', 400));
    }
    const cart = await Cart.findById(req.params.cartId);
    if (!cart) {
      return next(new ApiError(`No cart found with ID ${req.params.cartId}`, 404));
    }
    const cartPrice = cart.totalPriceAfterDiscount || cart.totalCartPrice || 0;
    const totalOrderPrice = cartPrice + taxPrice + shippingPrice;
    if (totalOrderPrice <= 0) {
      return next(new ApiError('Total order price must be greater than zero', 400));
    }
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'egp',
          unit_amount: totalOrderPrice * 100,
          product_data: { name: req.user.name || 'Customer' },
        },
        quantity: 1,
      }],
      success_url: `${req.protocol}://${req.get('host')}/orders`,
      cancel_url: `${req.protocol}://${req.get('host')}/cart`,
      customer_email: req.user.email,
      client_reference_id: req.params.cartId,
      metadata: { shippingAddress: JSON.stringify(req.body.shippingAddress) },
    });
    res.status(200).json({ status: 'success', session });
  } catch (error) {
    next(new ApiError(`Stripe checkout session creation failed: ${error.message}`, 500));
  }
});

const createCardOrder = async (session) => {
  const cartId = session.client_reference_id;
  const shippingAddress = session.metadata
  const orderPrice = session.amount_total / 100

  const cart = await Cart.findById(cartId);
  const user = await User.findOne({ email: session.customer_email });
  if (!cart || !user) {
    throw new Error('Cart or user not found');
  }
  const order = await Order.create({
    user: user._id,
    cartItems: cart.cartItems,
    shippingAddress,
    totalOrderPrice: orderPrice,
    isPaid: true,
    paidAt: Date.now(),
    paymentMethodType: 'card',
  });
  if (order) {
    const bulkOption = cart.cartItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.quantity, sold: item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});
    await Cart.findByIdAndDelete(cartId);
  }
};

exports.webhookCheckout = asyncHandler(async (req, res, next) => {
  console.log("Webhook received");
  console.log("Headers:", req.headers);
  console.log("Raw Body:", req.rawBody.toString());
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === 'checkout.session.completed') {
  
    await createCardOrder(event.data.object);
  }
  res.status(200).json({ received: true });
});
