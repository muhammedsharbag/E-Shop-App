const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const asyncHandler = require('express-async-handler');
const factory = require('./handlersFactory');
const ApiError = require('../utils/apiError');

const User = require('../models/userModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Order = require('../models/orderModel');
const { default: mongoose } = require('mongoose');

// @desc    Create a cash order
// @route   POST /api/v1/orders/:cartId
// @access  Protected/User
exports.createCashOrder = asyncHandler(async (req, res, next) => {
  // App settings
  const taxPrice = 0;
  const shippingPrice = 0;

  // 1) Get cart by ID
  const cart = await Cart.findById(req.params.cartId);
   if (!cart) {
     return next(new ApiError(`No cart found with ID ${req.params.cartId}`, 404));
  }

  // 2) Calculate order total
  const cartPrice = cart.totalPriceAfterDiscount || cart.totalCartPrice;
  const totalOrderPrice = cartPrice + taxPrice + shippingPrice;

  // 3) Create the order
  const order = await Order.create({
    user: req.user._id,
    cartItems: cart.cartItems,
    shippingAddress: req.body.shippingAddress,
    totalOrderPrice,
  });

  // 4) Update product stock and sold count
  if (order) {
    const bulkOption = cart.cartItems.map((item) => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantity: -item.quantity, sold: item.quantity } },
      },
    }));
    await Product.bulkWrite(bulkOption, {});

    // 5) Clear cart
    await Cart.findByIdAndDelete(req.params.cartId);
  }

  res.status(201).json({ status: 'success', data: order });
});

// Middleware to filter orders for logged in user (if role is 'user')
exports.filterOrderForLoggedUser = asyncHandler(async (req, res, next) => {
  if (req.user.role === 'user') req.filterObj = { user: req.user._id };
  next();
});

// @desc    Get all orders
// @route   GET /api/v1/orders
// @access  Protected/User-Admin-Manager
exports.findAllOrders = factory.getAll(Order);

// @desc    Get specific order
// @route   GET /api/v1/orders/:id
// @access  Protected/User-Admin-Manager
exports.findSpecificOrder = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return next(new ApiError(`Invalid order ID format: ${orderId}`, 400));
  }

  const order = await Order.findById(orderId);

  if (!order) {
    return next(new ApiError(`There is no order with the ID: ${orderId}`, 404));
  }

  res.status(200).json({ status: 'success', data: order });
});

// @desc    Update order paid status to paid
// @route   PUT /api/v1/orders/:id/pay
// @access  Protected/Admin-Manager
exports.updateOrderToPaid = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) {
    return next(
      new ApiError(`There is no order with the ID: ${req.params.orderId}`, 404)
    );
  }

  // Update order to paid
  order.isPaid = true;
  order.paidAt = Date.now();

  const updatedOrder = await order.save();

  res.status(200).json({ status:'success', data: updatedOrder });
});

// @desc    Update order delivered status
// @route   PUT /api/v1/orders/:id/deliver
// @access  Protected/Admin-Manager
exports.updateOrderToDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);
  
  if (!order) {
    return next(
      new ApiError(`There is no order with the ID: ${req.params.orderId}`, 404)
    );
  }

  // Update order to Delivered
  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updatedOrder = await order.save();

  res.status(200).json({ status:'success', data: updatedOrder });
});

// @desc    Get Stripe checkout session and send it as response
// @route   GET /api/v1/orders/checkout-session/:cartId
// @access  Protected/User
exports.checkoutSession = asyncHandler(async (req, res, next) => {
  const taxPrice = 0;
  const shippingPrice = 0;

  // 1) Get cart by ID
  const cart = await Cart.findById(req.params.cartId);
  if (!cart) {
    return next(new ApiError(`No cart found with ID ${req.params.cartId}`, 404));
  }

  // 2) Calculate order total
  const cartPrice = cart.totalPriceAfterDiscount || cart.totalCartPrice;
  const totalOrderPrice = cartPrice + taxPrice + shippingPrice;

  // 3) Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'egp',
          unit_amount: totalOrderPrice * 100, // Convert to smallest currency unit (e.g., cents)
          product_data: {
            name: req.user.name,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${req.protocol}://${req.get('host')}/orders`,
    cancel_url: `${req.protocol}://${req.get('host')}/cart`,
    customer_email: req.user.email,
    client_reference_id: req.params.cartId,
    metadata: { shippingAddress: JSON.stringify(req.body.shippingAddress) }, // Save shippingAddress as a string
  });

  res.status(200).json({ status: 'success', session });
});

// Helper function to create a card order after successful payment
const createCardOrder = async (session) => {
  try {
    const cartId = session.client_reference_id;
    const shippingAddress = session.metadata?.shippingAddress
      ? JSON.parse(session.metadata.shippingAddress)
      : {};
    const orderPrice = session.amount_total / 100; // Convert from cents

    const cart = await Cart.findById(cartId);
    if (!cart) {
      console.error(`Cart not found: ${cartId}`);
      return;
    }

    const user = await User.findOne({ email: session.customer_email });
    if (!user) {
      console.error(`User not found for email: ${session.customer_email}`);
      return;
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
  } catch (error) {
    console.error("Error in createCardOrder:", error);
  }
};

// Stripe Webhook Handler
exports.webhookCheckout = asyncHandler(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    await createCardOrder(event.data.object);
  }

  res.status(200).json({ received: true });
});
