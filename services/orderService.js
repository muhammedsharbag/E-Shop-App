const asyncHandler = require("express-async-handler");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const ApiError = require("../utils/apiError");

const factory = require("./handlersFactory");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const Product = require("../models/productModel");


// @desc    Create cash Order
// @route   POST /api/v1/orders/cartId
// @access  private/User
exports.createCashOrder = asyncHandler(async (req, res, next) => {
    // App settings (Admin can set them)
    const shippingPrice = 0;
    const taxPrice = 0;

    // 1) Get cart based on cartId
    const cart = await Cart.findById(req.params.cartId);
    if (!cart) {
        return next(new ApiError(`No cart found with id: ${req.params.cartId}`, 404));
    }

    // 2) Get order price depending on cart price (Check if coupon applied)
    const orderPrice = cart.totalPriceAfterDiscount
        ? cart.totalPriceAfterDiscount
        : cart.totalCartPrice;

    const totalOrderPrice = orderPrice + shippingPrice + taxPrice;

    // 3) Create order with default paymentMethodType (cash)
    const order = await Order.create({
        user: req.user._id,
        cartItems: cart.cartItems,
        totalOrderPrice,
        shippingAddress: req.body.shippingAddress,
        paymentMethod: "cash",
    });

    // Save the cart (if any changes were made to it)
    await cart.save();

    // Send response after order creation
    res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: order,
    });

    // 4) After creating order, decrement product quantity and increment product sold
    if (order) {
        const bulkOption = cart.cartItems.map(item => ({
            updateOne: {
                filter: { _id: item.product },
                update: {$inc: {quantity: -item.quantity,sold: item.quantity }}
            }
        }));

        // Perform the bulk update operation
        const result = await Product.bulkWrite(bulkOption);
        // 5) Clear cart after order is created
    await Cart.findByIdAndDelete(req.params.cartId);
    }

    
});
exports.filterOrderForLoggedUser = asyncHandler(async(req,res,next)=>{
    if(req.user.role ==="user") req.filterObj = {user:req.user._id}
    next();
})

// @desc    Get all orders
// @route   GET /api/v1/orders
// @access  private/User-Admin-Manager
exports.findAllOrders = factory.getAll(Order);

// @desc    Get Specific order
// @route   GET /api/v1/orders/orderId
// @access  private/User-Admin-Manager
exports.findSpecificOrder = asyncHandler(async(req,res,next)=>{
    const order = await Order.findById(req.params.orderId);
    if(!order) return next(new ApiError(`No order found with id: ${req.params.orderId}`, 404));
    res.status(200).json({
        success: true,
        data: order,
    });
})

// @desc    Update order status to paid
// @route   PUT /api/v1/orders/orderId/pay
// @access  private/Admin
exports.updateOrderStatusToPaid = asyncHandler(async(req,res,next)=>{
    const order = await Order.findById(req.params.orderId)
    if(!order) return next(new ApiError(`No order found with id: ${req.params.orderId}`, 404));
    // Update order to paid
    order.isPaid = true;
    order.paidAt = Date.now();
    const updatedOrder = await order.save();
    res.status(200).json({
        success: true,
        data: updatedOrder,
    });

})

// @desc    Update order status to delivered
// @route   PUT /api/v1/orders/orderId/deliver
// @access  private/Admin
exports.updateOrderStatusToDelivered = asyncHandler(async(req,res,next)=>{
    const order = await Order.findById(req.params.orderId)
    if(!order) return next(new ApiError(`No order found with id: ${req.params.orderId}`, 404));
    // Update order to delivered
    order.isDelivered = true;
    order.deliveredAt = Date.now();
    const updatedOrder = await order.save();
    res.status(200).json({
        success: true,
        data: updatedOrder,
    });

})

// @desc    Get Checkout Session from Stripe and send it as a response
// @route   PUT /api/v1/orders/checkout-session/cartId
// @access  private/User
exports.checkoutSession = asyncHandler(async(req, res, next) => {
    // App settings (Admin can set them)
    const shippingPrice = 0;
    const taxPrice = 0;

    // 1) Get cart depending on cartId
    const cart = await Cart.findById(req.params.cartId);
    if (!cart) {
        return next(new ApiError(`No cart found with id: ${req.params.cartId}`, 404));
    }

    // 2) Get order price depending on cart price (Check if coupon applied)
    const orderPrice = cart.totalPriceAfterDiscount
        ? cart.totalPriceAfterDiscount
        : cart.totalCartPrice;
    const totalOrderPrice = orderPrice + shippingPrice + taxPrice;

    // 3) Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
        line_items: [
            {
                price_data: {
                    currency: 'egp',
                    unit_amount: totalOrderPrice * 100, 
                    product_data: {
                        name:  req.user.name,
                    },
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}/orders`,
        cancel_url: `${req.protocol}://${req.get('host')}/cart`,
        customer_email: req.user.email,
        client_reference_id: req.params.cartId,
        metadata: req.body.shippingAddresses,
    });

    res.status(200).json({
        success: true,
        sessionId: session.id, 
        session: session
    });
});

