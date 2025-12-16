const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const User = require("../../models/userSchema");



const getUserProductList = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, sort, page = 1 } = req.query;
    const limit = 3;
    const skip = (parseInt(page) - 1) * limit;

    let query = {
      isBlocked: false,
      status: "Available",
      quantity: { $gt: 0 }
    };

    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    if (category) query.category = category;

    if (minPrice || maxPrice) {
      query.salePrice = {};
      if (minPrice) query.salePrice.$gte = Number(minPrice);
      if (maxPrice) query.salePrice.$lte = Number(maxPrice);
    }

    let sortOption = {};
    if (sort === "price_asc") sortOption.salePrice = 1;
    else if (sort === "price_desc") sortOption.salePrice = -1;
    else if (sort === "newest") sortOption.createdOn = -1;

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const categories = await Category.find({ isListed: true });

    const pagination = {
      currentPage: parseInt(page),
      totalPages: totalPages,
      totalProducts: totalProducts,
      hasPrevPage: parseInt(page) > 1,
      hasNextPage: parseInt(page) < totalPages
    };

    // If AJAX -> return JSON
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({ products, categories, pagination });
    }

    // Normal render
    res.render("products", {
      products,
      categories,
      search,
      category,
      minPrice,
      maxPrice,
      sort,
      pagination
    });
  } catch (error) {
    console.error("Error loading products page:", error);
    res.redirect("/pageerror");
  }
};



const getProductDetailPage = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId).populate("category");

    if (!product) {
      return res.redirect("/pageNotFound");
    }

    let relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isBlocked: false
    }).limit(4);

    if (!relatedProducts || relatedProducts.length === 0) {
      console.log("No related products found");
      relatedProducts = await Product.find({ isBlocked: false })
        .sort({ createdAt: -1 })
        .limit(4);
    }

    res.render("product-detail", { product, relatedProducts });

  } catch (error) {
    console.error("Product detail page error:", error);
    res.redirect("/pageNotFound");
  }
};


module.exports = {
  getUserProductList,
  getProductDetailPage,
}
