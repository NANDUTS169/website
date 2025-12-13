const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Wishlist = require("../../models/wishlistSchema");

const cart = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const userId = req.session.user;
    const cartData = await Cart.findOne({ userId }).populate("items.productId");

    let subtotal = 0;
    if (cartData) {
      subtotal = cartData.items.reduce((sum, item) => sum + item.totalPrice, 0);
    }

    res.render("cart", {
      user: req.session.user,
      cart: cartData,
      subtotal,
      discount: 0,
      grandTotal: subtotal
    });

  } catch (err) {
    console.error("Error loading cart:", err);
    res.status(500).render("user-error", { error: "Failed to load cart" });
  }
};


const addToCart = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Please login to add to cart" });
    }
    const userId = req.session.user;
    let { productId, quantity, size } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }
    quantity = Number(quantity) || 1;
    if (quantity < 1 || quantity > 5) {
      return res.status(400).json({ message: "Invalid quantity (1-5 allowed)" });
    }

    const product = await Product.findById(productId).populate("category");
    if (!product) return res.status(404).json({ message: "Product not found" });

    const categoryBlocked = product.category && (product.category.isBlocked === true || product.category.status === "blocked" || product.category.isListed === false);
    if (product.isBlocked === true || product.status !== "Available" || categoryBlocked) {
      return res.status(400).json({ message: "This product is unavailable" });
    }

    // Determine price and stock based on variant
    let price = product.salePrice || product.regularPrice;
    let availableStock = product.quantity;

    if (product.variants && product.variants.length > 0) {
      if (!size) {
        return res.status(400).json({ message: "Please select a size" });
      }
      const variant = product.variants.find(v => v.size === size);
      if (!variant) {
        return res.status(400).json({ message: "Invalid size selected" });
      }
      price = variant.salePrice || variant.regularPrice;
      availableStock = variant.quantity;
    }

    if (quantity > availableStock) {
      return res.status(400).json({ message: "Not enough stock" });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity, price, totalPrice: price * quantity, size }]
      });
    } else {
      // Find item with same product AND size
      const existingItem = cart.items.find(i =>
        i.productId.toString() === productId && i.size === size
      );

      if (existingItem) {
        const newQty = existingItem.quantity + quantity;
        if (newQty > 5) return res.status(400).json({ message: "Maximum 5 units per product" });
        if (newQty > availableStock) return res.status(400).json({ message: "Not enough stock" });

        existingItem.quantity = newQty;
        existingItem.totalPrice = newQty * existingItem.price;
      } else {
        cart.items.push({ productId, quantity, price, totalPrice: price * quantity, size });
      }
    }

    await cart.save();
    await Wishlist.updateOne({ userId }, { $pull: { items: { productId } } });

    return res.status(200).json({ message: "Added to cart successfully" });
  } catch (err) {
    console.error("Error adding to cart:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


const updateCartItem = async (req, res) => {
  try {
    const userId = req.session.user;
    const { itemId, quantity } = req.body; // Using itemId instead of productId

    if (!itemId || quantity < 1 || quantity > 5) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.id(itemId); // Find subdocument by _id
    if (!item) return res.status(404).json({ message: "Item not in cart" });

    // Check stock
    const product = await Product.findById(item.productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let availableStock = product.quantity;
    if (product.variants && product.variants.length > 0 && item.size) {
      const variant = product.variants.find(v => v.size === item.size);
      if (variant) availableStock = variant.quantity;
    }

    if (quantity > availableStock) {
      return res.status(400).json({ message: "Not enough stock available" });
    }

    item.quantity = quantity;
    item.totalPrice = item.price * quantity;

    await cart.save();

    // Calculate new totals to send back
    const subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
    const itemTotal = item.totalPrice;

    res.json({
      success: true,
      message: "Cart updated successfully",
      itemTotal: itemTotal,
      subtotal: subtotal,
      grandTotal: subtotal
    });

  } catch (err) {
    console.error("Update cart error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.items = cart.items.filter(i => i._id.toString() !== itemId);

    await cart.save();

    // Check if request expects JSON
    if (req.xhr || req.headers.accept.indexOf('json') > -1 || req.method === 'DELETE') {
      // Calculate new totals
      const subtotal = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
      return res.json({
        success: true,
        message: "Item removed successfully",
        subtotal: subtotal,
        grandTotal: subtotal 
      });
    }

    res.redirect("/cart");
  } catch (err) {
    console.error("Remove cart error:", err);
    if (req.xhr || req.method === 'DELETE') {
      return res.status(500).json({ message: "Server error" });
    }
    res.redirect("/pageerror");
  }
};


const validateCartBeforeCheckout = async (req, res, next) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) return res.redirect("/cart");

    const invalidItems = cart.items.filter(item => item.productId.quantity < item.quantity);

    if (invalidItems.length > 0) {
      return res.render("cart", {
        user: req.session.user,
        cart,
        subtotal: cart.items.reduce((sum, i) => sum + i.totalPrice, 0),
        discount: 0,
        grandTotal: cart.items.reduce((sum, i) => sum + i.totalPrice, 0),
        error: "Some items are out of stock. Please update your cart."
      });
    }

    next();
  } catch (err) {
    console.error("Cart validation error:", err);
    res.status(500).render("user-error", { error: "Failed to validate cart" });
  }
};


module.exports = {
  cart,
  addToCart,
  updateCartItem,
  removeFromCart,
  validateCartBeforeCheckout
};
